import * as fs from 'fs';
import * as caminho from 'path';

import {
    ArgumentoReferenciaFuncao,
    BlocoPegue,
    Classe,
    Const,
    ConstMultiplo,
    Declaracao,
    FuncaoConstruto,
    FuncaoDeclaracao,
    ParaCada,
    ReferenciaFuncao,
    Var,
    Variavel,
    VarMultiplo,
} from '@designliquido/delegua';
import { Simbolo } from '@designliquido/delegua/lexador';
import { SimboloInterface } from '@designliquido/delegua/interfaces';
import tiposDeSimbolos from '@designliquido/delegua/tipos-de-simbolos/delegua';

/**
 * Espaços de nomes para importações de arquivos e pacotes: `importar tudo como m de "./m"`.
 *
 * O compilador junta as declarações de todos os arquivos importados em um único programa.
 * Para que `m.funcao()` funcione e para que dois arquivos possam declarar funções com o
 * mesmo nome, as funções, variáveis e constantes do nível superior de todo arquivo
 * importado com `tudo como` recebem um nome qualificado (`m__funcao`), e os acessos
 * `m.funcao` de quem importa são reescritos para esse nome antes da análise sintática,
 * para que o avaliador sintático continue inferindo os tipos.
 *
 * Classes não são renomeadas: continuam globais, e `m.Classe` é reescrito para `Classe`.
 */

const regexImportacaoTudo = /^\s*importar\s+tudo\s+como\s+([^\s]+)\s+de\s+['"]([^'"]+)['"]/;
const regexImportacaoElementos = /^\s*importar\s*\{([^}]*)\}\s*de\s+['"]([^'"]+)['"]/;
const regexImportacaoQualquer = /^\s*importar\s+.*\s+de\s+['"]([^'"]+)['"]/;

/**
 * Membros do nível superior de um arquivo importado com `tudo como`.
 */
export interface MembrosArquivo {
    // Nome original → nome qualificado (funções, variáveis e constantes).
    nomes: Map<string, string>;
    // Declarações, por nome original, para registrar o tipo no avaliador de quem importa.
    declaracoes: Map<string, Declaracao>;
    // Classes declaradas no arquivo (mantêm o nome original).
    classes: Set<string>;
}

/**
 * Estado dos espaços de nomes compartilhado por todos os arquivos de um programa.
 */
export interface EstadoEspacosNomes {
    // Arquivos (caminho absoluto) importados com `tudo como` por algum arquivo do programa.
    arquivosQualificados: Set<string>;
    // Membros já qualificados, por arquivo.
    membrosPorArquivo: Map<string, MembrosArquivo>;
    // Prefixos já usados, para que dois arquivos com o mesmo nome não colidam.
    prefixosUsados: Set<string>;
    prefixoPorArquivo: Map<string, string>;
}

export function criarEstadoEspacosNomes(): EstadoEspacosNomes {
    return {
        arquivosQualificados: new Set(),
        membrosPorArquivo: new Map(),
        prefixosUsados: new Set(),
        prefixoPorArquivo: new Map(),
    };
}

/**
 * Resolve o caminho de uma importação para o arquivo que ela traz, ou null se a importação
 * não é de arquivo nem de pacote instalado.
 */
export type ResolvedorCaminhoImportacao = (especificador: string, diretorioBase: string) => string | null;

export function resolverArquivoRelativo(especificador: string, diretorioBase: string): string | null {
    if (!especificador.startsWith('./') && !especificador.startsWith('../')) return null;
    let caminhoAbsoluto = caminho.resolve(diretorioBase, especificador);
    if (!caminhoAbsoluto.endsWith('.delegua')) caminhoAbsoluto += '.delegua';
    return caminhoAbsoluto;
}

/**
 * Percorre o grafo de importações a partir do código dado e marca os arquivos importados
 * com `tudo como`. Precisa acontecer antes da análise: um arquivo pode ser importado primeiro
 * com `{ ... }` e só depois com `tudo como`, e os nomes dele têm de ser os mesmos nos dois casos.
 */
export function marcarArquivosQualificados(
    codigo: string[],
    diretorioBase: string,
    resolver: ResolvedorCaminhoImportacao,
    estado: EstadoEspacosNomes,
    visitados: Set<string> = new Set()
): void {
    for (const linha of codigo) {
        const correspondencia = regexImportacaoQualquer.exec(linha);
        if (!correspondencia) continue;
        const caminhoArquivo = resolver(correspondencia[1], diretorioBase);
        if (!caminhoArquivo) continue;
        if (regexImportacaoTudo.test(linha)) estado.arquivosQualificados.add(caminhoArquivo);
        if (visitados.has(caminhoArquivo) || !fs.existsSync(caminhoArquivo)) continue;
        visitados.add(caminhoArquivo);
        const linhasArquivo = fs.readFileSync(caminhoArquivo, 'utf-8').split('\n');
        marcarArquivosQualificados(linhasArquivo, caminho.dirname(caminhoArquivo), resolver, estado, visitados);
    }
}

interface EspacoNomes {
    caminhoArquivo: string;
    membros: MembrosArquivo;
}

interface ElementoImportado {
    nomeQualificado: string;
    declaracao: Declaracao;
}

/**
 * Importações de um arquivo que dependem de espaços de nomes: os apelidos de `tudo como` e
 * os elementos de `{ ... }` trazidos de arquivos qualificados.
 */
export class ImportacoesLocais {
    espacos: Map<string, EspacoNomes> = new Map();
    elementos: Map<string, ElementoImportado> = new Map();

    constructor(readonly caminhoArquivo: string) {}

    get vazia(): boolean {
        return this.espacos.size === 0 && this.elementos.size === 0;
    }

    /**
     * Reescreve `apelido.membro` para o nome qualificado do membro (ou para o nome da classe).
     */
    reescreverSimbolos(simbolos: SimboloInterface[]): SimboloInterface[] {
        if (this.espacos.size === 0) return simbolos;
        const resultado: SimboloInterface[] = [];
        for (let indice = 0; indice < simbolos.length; indice++) {
            const simbolo = simbolos[indice];
            const espaco = simbolo.tipo === tiposDeSimbolos.IDENTIFICADOR ? this.espacos.get(simbolo.lexema) : undefined;
            const anterior = resultado[resultado.length - 1];
            const ponto = simbolos[indice + 1];
            const membro = simbolos[indice + 2];
            if (
                !espaco ||
                anterior?.tipo === tiposDeSimbolos.PONTO ||
                ponto?.tipo !== tiposDeSimbolos.PONTO ||
                membro?.tipo !== tiposDeSimbolos.IDENTIFICADOR
            ) {
                resultado.push(simbolo);
                continue;
            }

            const destino =
                espaco.membros.nomes.get(membro.lexema) ??
                (espaco.membros.classes.has(membro.lexema) ? membro.lexema : undefined);
            if (destino === undefined) {
                throw new Error(
                    `${this.caminhoArquivo}:${simbolo.linha}: '${membro.lexema}' não é declarado em '${simbolo.lexema}' (${espaco.caminhoArquivo}).`
                );
            }
            resultado.push(
                new Simbolo(
                    tiposDeSimbolos.IDENTIFICADOR,
                    destino,
                    null,
                    simbolo.linha,
                    simbolo.hashArquivo,
                    simbolo.colunaInicio,
                    membro.colunaFim
                )
            );
            indice += 2;
        }
        return resultado;
    }

    /**
     * Declarações que o avaliador sintático precisa conhecer com o nome local: elementos de
     * `{ ... }` vindos de arquivos qualificados, que no programa têm o nome qualificado.
     */
    simbolosLocais(): { nome: string; declaracao: Declaracao }[] {
        return [...this.elementos.entries()].map(([nome, elemento]) => ({ nome, declaracao: elemento.declaracao }));
    }

    /**
     * Nome local → nome no programa, para os elementos importados de arquivos qualificados.
     */
    renomeacoes(): Map<string, string> {
        const mapa = new Map<string, string>();
        for (const [nome, elemento] of this.elementos) mapa.set(nome, elemento.nomeQualificado);
        return mapa;
    }
}

/**
 * Lê as importações de um arquivo cujas dependências já foram analisadas.
 */
export function coletarImportacoesLocais(
    codigo: string[],
    caminhoArquivo: string,
    diretorioBase: string,
    resolver: ResolvedorCaminhoImportacao,
    estado: EstadoEspacosNomes
): ImportacoesLocais {
    const importacoes = new ImportacoesLocais(caminhoArquivo);
    codigo.forEach((linha, indiceLinha) => {
        const tudo = regexImportacaoTudo.exec(linha);
        const elementos = tudo ? null : regexImportacaoElementos.exec(linha);
        const especificador = tudo?.[2] ?? elementos?.[2];
        if (!especificador) return;
        const caminhoImportado = resolver(especificador, diretorioBase);
        if (!caminhoImportado || !estado.arquivosQualificados.has(caminhoImportado)) return;
        const membros = estado.membrosPorArquivo.get(caminhoImportado);
        if (!membros) {
            throw new Error(
                `${caminhoArquivo}:${indiceLinha + 1}: não foi possível importar '${especificador}' como espaço de nomes (importação circular?).`
            );
        }

        if (tudo) {
            importacoes.espacos.set(tudo[1], { caminhoArquivo: caminhoImportado, membros });
            return;
        }

        for (const parte of elementos[1].split(',')) {
            const [original, apelido] = parte.split(/\s+como\s+/).map((nome) => nome.trim());
            if (!original) continue;
            const nomeQualificado = membros.nomes.get(original);
            if (nomeQualificado === undefined) continue; // classe, ou nome inexistente: o avaliador acusa.
            importacoes.elementos.set(apelido || original, {
                nomeQualificado,
                declaracao: membros.declaracoes.get(original),
            });
        }
    });
    return importacoes;
}

function prefixoDoArquivo(caminhoArquivo: string, estado: EstadoEspacosNomes): string {
    const existente = estado.prefixoPorArquivo.get(caminhoArquivo);
    if (existente) return existente;
    const base = caminho.basename(caminhoArquivo, '.delegua').replace(/[^A-Za-z0-9_À-ÿ]/g, '_') || 'modulo';
    let prefixo = base;
    for (let contador = 2; estado.prefixosUsados.has(prefixo); contador++) prefixo = `${base}${contador}`;
    estado.prefixosUsados.add(prefixo);
    estado.prefixoPorArquivo.set(caminhoArquivo, prefixo);
    return prefixo;
}

function nomesDeclarados(declaracao: Declaracao): string[] {
    if (declaracao instanceof FuncaoDeclaracao || declaracao instanceof Var || declaracao instanceof Const) {
        const nome = (declaracao as any).simbolo?.lexema;
        return nome ? [nome] : [];
    }
    if (declaracao instanceof VarMultiplo || declaracao instanceof ConstMultiplo) {
        return ((declaracao as any).simbolos ?? []).map((simbolo: Simbolo) => simbolo.lexema);
    }
    return [];
}

/**
 * Dá nomes qualificados aos membros do nível superior de um arquivo importado com
 * `tudo como`. Não altera as declarações: isso é feito por `renomearReferencias`.
 */
export function qualificarMembros(
    declaracoes: Declaracao[],
    caminhoArquivo: string,
    estado: EstadoEspacosNomes
): MembrosArquivo {
    const prefixo = prefixoDoArquivo(caminhoArquivo, estado);
    const membros: MembrosArquivo = { nomes: new Map(), declaracoes: new Map(), classes: new Set() };
    for (const declaracao of declaracoes) {
        if (declaracao instanceof Classe) {
            membros.classes.add(declaracao.simbolo.lexema);
            continue;
        }
        for (const nome of nomesDeclarados(declaracao)) {
            membros.nomes.set(nome, `${prefixo}__${nome}`);
            membros.declaracoes.set(nome, declaracao);
        }
    }
    estado.membrosPorArquivo.set(caminhoArquivo, membros);
    return membros;
}

function comNovoLexema<T extends SimboloInterface>(simbolo: T, lexema: string): T {
    return Object.assign(Object.create(Object.getPrototypeOf(simbolo)), simbolo, { lexema });
}

/**
 * Nomes declarados localmente em um trecho de código (variáveis, constantes, funções
 * aninhadas, variáveis de `para cada` e de `pegue`), sem entrar em funções aninhadas.
 * Dentro do trecho, esses nomes escondem os membros do nível superior com o mesmo nome.
 */
function coletarNomesLocais(no: any, nomes: Set<string>, visitados: WeakSet<object>): void {
    if (!no || typeof no !== 'object' || visitados.has(no)) return;
    visitados.add(no);
    if (Array.isArray(no)) {
        no.forEach((item) => coletarNomesLocais(item, nomes, visitados));
        return;
    }
    if (no instanceof FuncaoConstruto) return;
    if (no instanceof FuncaoDeclaracao) {
        nomesDeclarados(no).forEach((nome) => nomes.add(nome));
        return;
    }
    nomesDeclarados(no).forEach((nome) => nomes.add(nome));
    if (no instanceof ParaCada) {
        const variavelIteracao: any = no.variavelIteracao;
        if (variavelIteracao instanceof Variavel) nomes.add(variavelIteracao.simbolo.lexema);
        else if (variavelIteracao && typeof variavelIteracao === 'object') {
            for (const valor of Object.values(variavelIteracao)) {
                if (valor instanceof Variavel) nomes.add(valor.simbolo.lexema);
            }
        }
    }
    if (no instanceof BlocoPegue && no.parametro?.lexema) nomes.add(no.parametro.lexema);
    for (const valor of Object.values(no)) {
        if (valor && typeof valor === 'object') coletarNomesLocais(valor, nomes, visitados);
    }
}

function renomearNo(
    no: any,
    mapa: Map<string, string>,
    escondidos: Set<string>,
    hashArquivo: number,
    visitados: WeakSet<object>
): void {
    if (!no || typeof no !== 'object' || visitados.has(no)) return;
    // Não entra em nós de outros arquivos (ex.: referências a declarações importadas).
    if (typeof no.hashArquivo === 'number' && no.hashArquivo !== hashArquivo && !(no instanceof Simbolo)) return;
    visitados.add(no);

    if (Array.isArray(no)) {
        no.forEach((item) => renomearNo(item, mapa, escondidos, hashArquivo, visitados));
        return;
    }

    if (no instanceof Variavel) {
        const novo = mapa.get(no.simbolo?.lexema);
        if (novo !== undefined && !escondidos.has(no.simbolo.lexema)) no.simbolo = comNovoLexema(no.simbolo, novo);
        return;
    }

    if (no instanceof ReferenciaFuncao || no instanceof ArgumentoReferenciaFuncao) {
        const simboloFuncao = (no as any).simboloFuncao as Simbolo;
        const novo = mapa.get(simboloFuncao?.lexema);
        if (novo !== undefined && !escondidos.has(simboloFuncao.lexema)) {
            (no as any).simboloFuncao = comNovoLexema(simboloFuncao, novo);
        }
        return;
    }

    let escondidosNo = escondidos;
    if (no instanceof FuncaoConstruto) {
        const locais = new Set(escondidos);
        for (const parametro of no.parametros ?? []) {
            if (parametro?.nome?.lexema) locais.add(parametro.nome.lexema);
        }
        coletarNomesLocais(no.corpo, locais, new WeakSet());
        escondidosNo = locais;
    }

    for (const [chave, valor] of Object.entries(no)) {
        if (!valor || typeof valor !== 'object' || valor instanceof Simbolo) continue;
        if (chave === 'simbolo' || chave === 'simbolos') continue;
        renomearNo(valor, mapa, escondidosNo, hashArquivo, visitados);
    }
}

/**
 * Renomeia, nas declarações de um arquivo, as declarações do nível superior e as referências
 * que aparecem no mapa (nome original → nome no programa). Um nome declarado localmente
 * (parâmetro, variável) esconde o membro do nível superior dentro da função que o declara.
 */
export function renomearReferencias(declaracoes: Declaracao[], mapa: Map<string, string>, hashArquivo: number): void {
    if (mapa.size === 0) return;
    const visitados = new WeakSet<object>();
    for (const declaracao of declaracoes) {
        const qualquer: any = declaracao;
        if (declaracao instanceof FuncaoDeclaracao || declaracao instanceof Var || declaracao instanceof Const) {
            const novo = mapa.get(qualquer.simbolo?.lexema);
            if (novo !== undefined) qualquer.simbolo = comNovoLexema(qualquer.simbolo, novo);
            renomearNo(declaracao, mapa, new Set(), hashArquivo, visitados);
            continue;
        }
        if (declaracao instanceof VarMultiplo || declaracao instanceof ConstMultiplo) {
            qualquer.simbolos = (qualquer.simbolos ?? []).map((simbolo: Simbolo) => {
                const novo = mapa.get(simbolo.lexema);
                return novo !== undefined ? comNovoLexema(simbolo, novo) : simbolo;
            });
            renomearNo(declaracao, mapa, new Set(), hashArquivo, visitados);
            continue;
        }
        if (declaracao instanceof Classe) {
            renomearNo(declaracao, mapa, new Set(), hashArquivo, visitados);
            continue;
        }
        // Laços, blocos e condicionais do nível superior: nomes declarados dentro deles são locais.
        const locais = new Set<string>();
        coletarNomesLocais(declaracao, locais, new WeakSet());
        renomearNo(declaracao, mapa, locais, hashArquivo, visitados);
    }
}
