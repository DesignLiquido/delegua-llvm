import * as path from 'path';

interface BibliotecaCompilacao {
    arquivosC: string[];
    flagsLink: string[];
}

const BIBLIOTECAS_NUCLEO: BibliotecaCompilacao = {
    arquivosC: ['padrao.c', 'texto.c', 'vetor.c'],
    flagsLink: [],
};

const MAPA_MODULOS: Map<string, BibliotecaCompilacao> = new Map([
    ['matematica', { arquivosC: ['matematica.c'], flagsLink: ['-lm'] }],
    ['fisica', { arquivosC: ['fisica.c'], flagsLink: ['-lm'] }],
    ['estatistica', { arquivosC: ['estatistica.c'], flagsLink: ['-lm'] }],
    ['arquivos', { arquivosC: ['arquivos.c'], flagsLink: [] }],
    ['csv', { arquivosC: ['csv.c'], flagsLink: [] }],
    ['json', { arquivosC: ['json.c'], flagsLink: [] }],
    ['http', { arquivosC: ['http.c'], flagsLink: ['-lcurl'] }],
    ['criptografia', {
        arquivosC: ['criptografia.c', 'criptografia-hashes.c', 'criptografia-aes-rsa.c'],
        flagsLink: ['-lssl', '-lcrypto'],
    }],
    ['dados', { arquivosC: ['dados.c'], flagsLink: [] }],
]);

export function detectarModulosImportados(linhasCodigo: string[]): string[] {
    const modulos: Set<string> = new Set();
    const regex = /importar\s*\(\s*['"](\w+)['"]\s*\)/;
    const regexDe = /importar\s+.*\s+de\s+['"](\w+)['"]/;

    for (const linha of linhasCodigo) {
        const match = regex.exec(linha) || regexDe.exec(linha);
        if (match) {
            modulos.add(match[1]);
        }
    }

    return Array.from(modulos);
}

export function obterBibliotecasParaCompilacao(
    modulos: string[],
    diretorioBibliotecas: string
): { arquivosC: string[]; flagsLink: string[] } {
    const arquivosC: Set<string> = new Set();
    const flagsLink: Set<string> = new Set();

    for (const arquivo of BIBLIOTECAS_NUCLEO.arquivosC) {
        arquivosC.add(path.join(diretorioBibliotecas, arquivo));
    }

    for (const modulo of modulos) {
        const biblioteca = MAPA_MODULOS.get(modulo);
        if (biblioteca) {
            for (const arquivo of biblioteca.arquivosC) {
                arquivosC.add(path.join(diretorioBibliotecas, arquivo));
            }
            for (const flag of biblioteca.flagsLink) {
                flagsLink.add(flag);
            }
        }
    }

    return {
        arquivosC: Array.from(arquivosC),
        flagsLink: Array.from(flagsLink),
    };
}
