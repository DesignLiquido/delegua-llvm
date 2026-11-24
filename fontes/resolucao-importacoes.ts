import * as fs from 'fs';
import * as caminho from 'path';

import { Lexador } from '@designliquido/delegua/lexador';
import { AvaliadorSintatico } from '@designliquido/delegua/avaliador-sintatico';
import { cyrb53 } from '@designliquido/delegua/geracao-identificadores';
import { Declaracao, Classe, FuncaoDeclaracao, Var, Const } from '@designliquido/delegua';
import { InformacaoElementoSintatico } from '@designliquido/delegua/informacao-elemento-sintatico';

import { ehModuloEmbutido } from './bibliotecas-compilacao';
import { localizarPacote, PacoteLocalizado } from './pacotes';
import {
    coletarImportacoesLocais,
    criarEstadoEspacosNomes,
    EstadoEspacosNomes,
    ImportacoesLocais,
    marcarArquivosQualificados,
    qualificarMembros,
    renomearReferencias,
    resolverArquivoRelativo,
} from './espacos-nomes';

const regexImportacaoArquivo = /importar\s+.*\s+de\s+['"](\.{1,2}[^'"]*)['"]/;
const regexImportacaoNomeada = /importar\s+.*\s+de\s+['"]([A-Za-z0-9][A-Za-z0-9_-]*)['"]/;
const regexImportacaoDinamica = /importar\s*\(\s*['"]([A-Za-z0-9][A-Za-z0-9_-]*)['"]\s*\)/;

export function ehImportacaoArquivo(linha: string): boolean {
    return regexImportacaoArquivo.test(linha);
}

function extrairCaminhoImportacao(linha: string): string | null {
    const correspondencia = regexImportacaoArquivo.exec(linha);
    return correspondencia ? correspondencia[1] : null;
}

/**
 * Informações coletadas ao resolver as importações de todos os arquivos do programa.
 */
export interface ContextoResolucao {
    // Módulos embutidos (json, arquivos, processo...) importados em qualquer arquivo.
    modulosEmbutidos: Set<string>;
    // Pacotes instalados (pacotes/llvm/<nome>) importados, por nome.
    pacotes: Map<string, PacoteLocalizado>;
    // Fontes C e bibliotecas do sistema declaradas pelos pacotes em "nativo".
    fontesNativas: Set<string>;
    bibliotecasNativas: Set<string>;
    // Ajustes aplicados ao avaliador sintático de cada arquivo importado, os mesmos do arquivo
    // principal (ex.: inferência de membros de módulos embutidos).
    prepararAvaliador?: (avaliador: any) => void;
    // Declarações de todos os arquivos já analisados, em qualquer ramo da árvore de
    // importações. Um arquivo importado de novo é pulado (já visitado), então quem o importa
    // depois precisa enxergar os símbolos dele por aqui, como já acontece com as classes.
    declaracoesAnalisadas: Declaracao[];
    // Espaços de nomes (`importar tudo como m de "./m"`): arquivos qualificados e seus membros.
    espacosNomes: EstadoEspacosNomes;
    // Verdadeiro depois que o grafo de importações foi percorrido para marcar os arquivos
    // importados com `tudo como`.
    espacosNomesMarcados?: boolean;
}

export function criarContextoResolucao(): ContextoResolucao {
    return {
        modulosEmbutidos: new Set(),
        pacotes: new Map(),
        fontesNativas: new Set(),
        bibliotecasNativas: new Set(),
        declaracoesAnalisadas: [],
        espacosNomes: criarEstadoEspacosNomes(),
    };
}

/**
 * Declara no escopo global do avaliador sintático as funções e variáveis de nível superior
 * vindas de arquivos/pacotes já importados. Sem isso, cada arquivo é analisado sem conhecer
 * os símbolos dos demais, e qualquer chamada a uma função importada é rejeitada como
 * "Variável não definida". Deve ser chamada logo após inicializarPilhaEscopos().
 */
export function registrarSimbolosImportados(
    avaliador: any,
    declaracoes: Declaracao[],
    simbolosLocais: { nome: string; declaracao: Declaracao }[] = []
): void {
    const pilhaEscopos = avaliador?.pilhaEscopos;
    if (!pilhaEscopos?.definirInformacoesVariavel) return;
    const registrar = (nome: string, declaracao: Declaracao) => {
        if (!nome) return;
        if (declaracao instanceof FuncaoDeclaracao) {
            const tipo = (declaracao as any).tipo ?? `função<${declaracao.funcao?.tipo ?? 'qualquer'}>`;
            pilhaEscopos.definirInformacoesVariavel(nome, new InformacaoElementoSintatico(nome, tipo));
            pilhaEscopos.registrarReferenciaFuncao?.(nome, declaracao);
        } else if (declaracao instanceof Var || declaracao instanceof Const) {
            pilhaEscopos.definirInformacoesVariavel(nome, new InformacaoElementoSintatico(nome, declaracao.tipo ?? 'qualquer'));
        } else if (!declaracao) {
            pilhaEscopos.definirInformacoesVariavel(nome, new InformacaoElementoSintatico(nome, 'qualquer'));
        }
    };
    for (const declaracao of declaracoes) {
        if (declaracao instanceof FuncaoDeclaracao || declaracao instanceof Var || declaracao instanceof Const) {
            registrar(declaracao.simbolo?.lexema, declaracao);
        }
    }
    // Elementos de `importar { ... }` trazidos de arquivos com espaço de nomes: no programa
    // eles têm o nome qualificado, mas o arquivo que os importa usa o nome local.
    for (const { nome, declaracao } of simbolosLocais) {
        registrar(nome, declaracao);
    }
}

/**
 * Caminho absoluto do arquivo trazido por uma importação (arquivo relativo ou ponto de
 * entrada de pacote instalado), ou null.
 */
function resolvedorCaminhos(contexto: ContextoResolucao) {
    return (especificador: string, diretorioBase: string): string | null => {
        const relativo = resolverArquivoRelativo(especificador, diretorioBase);
        if (relativo) return relativo;
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(especificador) || ehModuloEmbutido(especificador)) return null;
        const pacote = contexto.pacotes.get(especificador) ?? localizarPacote(especificador, diretorioBase);
        return pacote?.pontoDeEntrada ?? null;
    };
}

/**
 * Prepara os espaços de nomes de um arquivo cujas dependências já foram resolvidas: os
 * apelidos de `importar tudo como` e os elementos importados de arquivos qualificados.
 */
export function prepararImportacoesLocais(
    codigo: string[],
    caminhoArquivo: string,
    diretorioBase: string,
    contexto: ContextoResolucao
): ImportacoesLocais {
    return coletarImportacoesLocais(codigo, caminhoArquivo, diretorioBase, resolvedorCaminhos(contexto), contexto.espacosNomes);
}

/**
 * Nome do pacote instalado importado por `importar { ... } de "nome"`, ou null se a linha
 * não importa um pacote (importação de arquivo, módulo embutido ou nome não instalado).
 */
function extrairPacoteImportado(linha: string, diretorioBase: string, contexto: ContextoResolucao): PacoteLocalizado | null {
    const correspondencia = regexImportacaoNomeada.exec(linha);
    if (!correspondencia) return null;
    const nome = correspondencia[1];
    if (ehModuloEmbutido(nome)) return null;
    if (contexto.pacotes.has(nome)) return contexto.pacotes.get(nome);
    return localizarPacote(nome, diretorioBase);
}

/**
 * Verdadeiro se a linha é uma importação resolvida por resolverEMesclarDeclaracoes
 * (arquivo relativo ou pacote instalado), e portanto deve ser removida antes da análise.
 */
export function ehImportacaoResolvida(linha: string, diretorioBase: string, contexto?: ContextoResolucao): boolean {
    if (ehImportacaoArquivo(linha)) return true;
    return extrairPacoteImportado(linha, diretorioBase, contexto ?? criarContextoResolucao()) !== null;
}

function registrarModuloEmbutido(linha: string, contexto: ContextoResolucao): void {
    const correspondencia = regexImportacaoDinamica.exec(linha) || regexImportacaoNomeada.exec(linha);
    if (correspondencia && ehModuloEmbutido(correspondencia[1])) {
        contexto.modulosEmbutidos.add(correspondencia[1]);
    }
}

function normalizarRetornosEstruturados(linhasArquivo: string[]): string[] {
    const resultado: string[] = [];

    for (let indice = 0; indice < linhasArquivo.length; indice++) {
        const linhaAtual = linhasArquivo[indice];

        if (linhaAtual.trim() !== 'retorna {') {
            resultado.push(linhaAtual);
            continue;
        }

        let tipoRetorno: string | null = null;
        for (let anterior = indice - 1; anterior >= Math.max(0, indice - 10); anterior--) {
            const correspondenciaTipo = linhasArquivo[anterior].match(/\)\s*:\s*([A-Z][A-Za-z0-9_]*)\s*\{\s*$/);
            if (correspondenciaTipo) {
                tipoRetorno = correspondenciaTipo[1];
                break;
            }
        }

        if (!tipoRetorno) {
            resultado.push(linhaAtual);
            continue;
        }

        const argumentos: string[] = [];
        let indiceFechamento = indice;
        let transformacaoValida = true;

        for (let cursor = indice + 1; cursor < linhasArquivo.length; cursor++) {
            const linhaCursor = linhasArquivo[cursor].trim();

            if (linhaCursor === '}') {
                indiceFechamento = cursor;
                break;
            }

            const correspondenciaArgumento = linhasArquivo[cursor].match(/^\s*[A-Za-z_À-ÿ][\wÀ-ÿ]*\s*:\s*(.+?),?\s*$/);
            if (!correspondenciaArgumento) {
                transformacaoValida = false;
                break;
            }

            argumentos.push(correspondenciaArgumento[1]);
            indiceFechamento = cursor;
        }

        if (!transformacaoValida || indiceFechamento === indice) {
            resultado.push(linhaAtual);
            continue;
        }

        const indentacao = linhaAtual.match(/^\s*/)?.[0] ?? '';
        resultado.push(`${indentacao}retorna ${tipoRetorno}(${argumentos.join(', ')})`);
        indice = indiceFechamento;
    }

    return resultado;
}

/**
 * Resolve importações de arquivo de forma recursiva, parseando cada arquivo com um
 * AvaliadorSintatico independente. Classes descobertas são pré-registradas progressivamente
 * para que arquivos subsequentes as reconheçam como tipos válidos.
 *
 * Retorna todas as declarações coletadas dos arquivos importados, em ordem de dependência.
 */
export async function resolverEMesclarDeclaracoes(
    codigo: string[],
    diretorioBase: string,
    arquivosVisitados: Set<string> = new Set(),
    registroClasses: { [nome: string]: Declaracao } = {},
    mapaHash: Map<number, string> = new Map(),
    contexto: ContextoResolucao = criarContextoResolucao()
): Promise<{ declaracoes: Declaracao[]; mapaHash: Map<number, string>; contexto: ContextoResolucao }> {
    const resultado: Declaracao[] = [];

    if (!contexto.espacosNomes) contexto.espacosNomes = criarEstadoEspacosNomes();
    if (!contexto.espacosNomesMarcados) {
        marcarArquivosQualificados(codigo, diretorioBase, resolvedorCaminhos(contexto), contexto.espacosNomes);
        contexto.espacosNomesMarcados = true;
    }

    for (const linha of codigo) {
        registrarModuloEmbutido(linha, contexto);

        let caminhoAbsoluto: string;
        const caminhoImportado = extrairCaminhoImportacao(linha);
        if (caminhoImportado !== null) {
            caminhoAbsoluto = caminho.resolve(diretorioBase, caminhoImportado);
            if (!caminhoAbsoluto.endsWith('.delegua')) {
                caminhoAbsoluto += '.delegua';
            }
        } else {
            const pacote = extrairPacoteImportado(linha, diretorioBase, contexto);
            if (!pacote) continue;
            if (!contexto.pacotes.has(pacote.nome)) {
                contexto.pacotes.set(pacote.nome, pacote);
                pacote.fontesNativas.forEach((fonte) => contexto.fontesNativas.add(fonte));
                pacote.bibliotecasNativas.forEach((biblioteca) => contexto.bibliotecasNativas.add(biblioteca));
            }
            caminhoAbsoluto = pacote.pontoDeEntrada;
        }

        if (arquivosVisitados.has(caminhoAbsoluto)) continue;
        arquivosVisitados.add(caminhoAbsoluto);
        const hashArquivo = cyrb53(caminhoAbsoluto.toLowerCase());
        mapaHash.set(hashArquivo, caminhoAbsoluto);

        if (!fs.existsSync(caminhoAbsoluto)) {
            throw new Error(`Arquivo importado não encontrado: ${caminhoAbsoluto}`);
        }

        const conteudo = fs.readFileSync(caminhoAbsoluto, 'utf-8');
        const linhasArquivo = normalizarRetornosEstruturados(conteudo.split('\n'));
        const diretorioArquivo = caminho.dirname(caminhoAbsoluto);

        // Resolve dependências do arquivo importado antes de parseá-lo.
        const resultadoDeps = await resolverEMesclarDeclaracoes(
            linhasArquivo,
            diretorioArquivo,
            arquivosVisitados,
            registroClasses,
            mapaHash,
            contexto
        );
        resultado.push(...resultadoDeps.declaracoes);

        // Parseia o arquivo com as classes já descobertas pré-registradas.
        // analisar() reseta tiposDefinidosEmCodigo internamente; usa o mesmo hook de
        // inicializarPilhaEscopos para injetar o registroClasses após o reset.
        const linhasSemImportacoes = linhasArquivo.map((l) =>
            ehImportacaoResolvida(l, diretorioArquivo, contexto) ? '' : l
        );

        const importacoesLocais = prepararImportacoesLocais(linhasArquivo, caminhoAbsoluto, diretorioArquivo, contexto);

        const lexador = new Lexador();
        const avaliador = new AvaliadorSintatico();
        const avaliadorAny = avaliador as any;
        contexto.prepararAvaliador?.(avaliadorAny);
        const inicializarOriginal = avaliadorAny.inicializarPilhaEscopos?.bind(avaliadorAny);
        if (inicializarOriginal) {
            const capturedRegistro = { ...registroClasses };
            const simbolosAnteriores = [...contexto.declaracoesAnalisadas];
            avaliadorAny.inicializarPilhaEscopos = () => {
                inicializarOriginal();
                Object.assign(avaliadorAny.tiposDefinidosEmCodigo, capturedRegistro);
                registrarSimbolosImportados(avaliadorAny, simbolosAnteriores, importacoesLocais.simbolosLocais());
            };
        }

        const retornoLexador = lexador.mapear(linhasSemImportacoes, hashArquivo);
        retornoLexador.simbolos = importacoesLocais.reescreverSimbolos(retornoLexador.simbolos);
        const retornoAvaliador = await avaliador.analisar(retornoLexador, hashArquivo);

        if (retornoAvaliador.erros.length > 0) {
            const descricoes = retornoAvaliador.erros.map((erro: any) => {
                const linhaErro = erro.simbolo?.linha ?? erro.linha;
                const mensagem = erro.message || erro.mensagem || JSON.stringify(erro);
                return `  ${caminhoAbsoluto}:${linhaErro}: ${mensagem}`;
            });
            throw new Error(`Erros ao analisar arquivo importado '${caminhoAbsoluto}':\n${descricoes.join('\n')}`);
        }

        // Arquivo importado com `tudo como`: seus membros recebem nomes qualificados, e as
        // referências a elementos importados de arquivos qualificados usam esses nomes.
        const renomeacoes = importacoesLocais.renomeacoes();
        if (contexto.espacosNomes.arquivosQualificados.has(caminhoAbsoluto)) {
            const membros = qualificarMembros(retornoAvaliador.declaracoes, caminhoAbsoluto, contexto.espacosNomes);
            membros.nomes.forEach((nomeQualificado, nome) => renomeacoes.set(nome, nomeQualificado));
        }
        renomearReferencias(retornoAvaliador.declaracoes, renomeacoes, hashArquivo);

        // Registra classes encontradas para arquivos seguintes.
        for (const decl of retornoAvaliador.declaracoes) {
            if (decl instanceof Classe) {
                registroClasses[(decl as Classe).simbolo.lexema] = decl;
            }
        }

        resultado.push(...retornoAvaliador.declaracoes);
        contexto.declaracoesAnalisadas.push(...retornoAvaliador.declaracoes);
    }

    return { declaracoes: resultado, mapaHash, contexto };
}
