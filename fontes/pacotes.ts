import * as fs from 'fs';
import * as caminho from 'path';

/**
 * Localização de pacotes instalados pelo gerenciador `pacote` em `pacotes/llvm/<nome>/`
 * e leitura do seu manifesto (`pacoteca.jsonc`).
 *
 * Manifesto (campos usados aqui):
 *
 *   {
 *     "nome": "git",
 *     "pontoDeEntrada": "git.delegua",
 *     "nativo": {
 *       // Fontes C compiladas e ligadas junto com o programa (relativos à raiz do pacote).
 *       "fontes": ["c/git.c"],
 *       // Bibliotecas do sistema (-l). Lista única ou por sistema operacional.
 *       "bibliotecas": { "linux": ["git2"], "darwin": ["git2"], "windows": ["git2"] }
 *     }
 *   }
 */

export const DIRETORIO_PACOTES = 'pacotes';
export const REALIZACAO = 'llvm';
export const NOME_MANIFESTO = 'pacoteca.jsonc';

// Mesmo formato de nome aceito pela Pacoteca: impede que o nome escape de pacotes/llvm/.
const padraoNomePacote = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export interface PacoteLocalizado {
    nome: string;
    diretorio: string;
    pontoDeEntrada: string;
    fontesNativas: string[];
    bibliotecasNativas: string[];
}

export function nomePacoteValido(nome: string): boolean {
    return padraoNomePacote.test(nome);
}

// Sistema operacional no formato usado pelos manifestos ("windows", "darwin", "linux"...).
export function sistemaOperacionalAtual(): string {
    return process.platform === 'win32' ? 'windows' : process.platform;
}

/**
 * Remove comentários `//` e `/* *\/` de um documento JSONC, preservando strings.
 */
export function removerComentariosJsonc(texto: string): string {
    let saida = '';
    let i = 0;
    while (i < texto.length) {
        const c = texto[i];
        if (c === '"') {
            let j = i + 1;
            while (j < texto.length && texto[j] !== '"') {
                j += texto[j] === '\\' ? 2 : 1;
            }
            saida += texto.slice(i, j + 1);
            i = j + 1;
            continue;
        }
        if (c === '/' && texto[i + 1] === '/') {
            while (i < texto.length && texto[i] !== '\n') i++;
            continue;
        }
        if (c === '/' && texto[i + 1] === '*') {
            const fim = texto.indexOf('*/', i + 2);
            if (fim < 0) throw new Error('comentário de bloco não fechado');
            i = fim + 2;
            continue;
        }
        saida += c;
        i++;
    }
    return saida;
}

// Garante que `relativo` aponta para dentro de `raiz` (sem `..` nem caminho absoluto).
function resolverDentroDe(raiz: string, relativo: string, descricao: string): string {
    if (typeof relativo !== 'string' || relativo.length === 0 || caminho.isAbsolute(relativo)) {
        throw new Error(`${descricao} inválido: ${JSON.stringify(relativo)}`);
    }
    const absoluto = caminho.resolve(raiz, relativo);
    const relativoNormalizado = caminho.relative(raiz, absoluto);
    if (relativoNormalizado.startsWith('..') || caminho.isAbsolute(relativoNormalizado)) {
        throw new Error(`${descricao} fora do pacote: ${relativo}`);
    }
    return absoluto;
}

function lerBibliotecasNativas(valor: unknown, nomePacote: string): string[] {
    if (valor === undefined || valor === null) return [];
    const lista = Array.isArray(valor) ? valor : (valor as { [so: string]: unknown })[sistemaOperacionalAtual()] ?? [];
    if (!Array.isArray(lista)) {
        throw new Error(`pacote '${nomePacote}': "nativo.bibliotecas" deve ser uma lista ou um objeto de listas`);
    }
    for (const biblioteca of lista) {
        // Apenas nomes de biblioteca: impede injeção de opções arbitrárias no ligador.
        if (typeof biblioteca !== 'string' || !/^[A-Za-z0-9_.+-]+$/.test(biblioteca) || biblioteca.startsWith('-')) {
            throw new Error(`pacote '${nomePacote}': biblioteca nativa inválida: ${JSON.stringify(biblioteca)}`);
        }
    }
    return lista as string[];
}

/**
 * Lê o manifesto de um pacote já localizado em `diretorio`.
 */
export function lerPacote(nome: string, diretorio: string): PacoteLocalizado {
    const caminhoManifesto = caminho.join(diretorio, NOME_MANIFESTO);
    let manifesto: any;
    try {
        manifesto = JSON.parse(removerComentariosJsonc(fs.readFileSync(caminhoManifesto, 'utf-8')));
    } catch (erro: any) {
        throw new Error(`Erro ao ler ${caminhoManifesto}: ${erro?.message ?? erro}`);
    }

    const pontoDeEntrada = resolverDentroDe(
        diretorio,
        manifesto?.pontoDeEntrada ?? `${nome}.delegua`,
        `pacote '${nome}': pontoDeEntrada`
    );
    if (!pontoDeEntrada.endsWith('.delegua')) {
        throw new Error(`pacote '${nome}': pontoDeEntrada deve ser um arquivo .delegua`);
    }

    const nativo = manifesto?.nativo ?? {};
    const fontes = nativo.fontes ?? [];
    if (!Array.isArray(fontes)) {
        throw new Error(`pacote '${nome}': "nativo.fontes" deve ser uma lista`);
    }
    const fontesNativas = fontes.map((fonte: string) => {
        const absoluto = resolverDentroDe(diretorio, fonte, `pacote '${nome}': fonte nativa`);
        if (!absoluto.endsWith('.c')) {
            throw new Error(`pacote '${nome}': fonte nativa deve ser um arquivo .c: ${fonte}`);
        }
        if (!fs.existsSync(absoluto)) {
            throw new Error(`pacote '${nome}': fonte nativa não encontrada: ${fonte}`);
        }
        return absoluto;
    });

    return {
        nome,
        diretorio,
        pontoDeEntrada,
        fontesNativas,
        bibliotecasNativas: lerBibliotecasNativas(nativo.bibliotecas, nome),
    };
}

/**
 * Procura `pacotes/llvm/<nome>/pacoteca.jsonc` a partir de `diretorioInicial`, subindo até a
 * raiz do sistema de arquivos. Assim um pacote encontra suas dependências instaladas na raiz
 * do projeto (o `pacote` instala todas as dependências, diretas e transitivas, no mesmo nível).
 */
export function localizarPacote(nome: string, diretorioInicial: string): PacoteLocalizado | null {
    if (!nomePacoteValido(nome)) return null;
    let atual = caminho.resolve(diretorioInicial);
    for (;;) {
        const candidato = caminho.join(atual, DIRETORIO_PACOTES, REALIZACAO, nome);
        if (fs.existsSync(caminho.join(candidato, NOME_MANIFESTO))) {
            return lerPacote(nome, candidato);
        }
        const pai = caminho.dirname(atual);
        if (pai === atual) return null;
        atual = pai;
    }
}
