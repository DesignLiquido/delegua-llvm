import * as path from 'path';

interface BibliotecaCompilacao {
    arquivosC: string[];
    flagsLink: string[];
    // Flags adicionais por sistema operacional do alvo ('windows', 'linux', 'darwin').
    flagsLinkPorSistema?: { [sistema: string]: string[] };
}

const BIBLIOTECAS_NUCLEO: BibliotecaCompilacao = {
    arquivosC: ['arc.c', 'padrao.c', 'texto.c', 'vetor.c', 'dicionario.c', 'excecoes.c'],
    // -lm: necessário para pow() (operador **), que é sintaxe núcleo, não opcional.
    flagsLink: ['-lm'],
};

const MAPA_MODULOS: Map<string, BibliotecaCompilacao> = new Map([
    ['matematica', { arquivosC: ['matematica.c'], flagsLink: ['-lm'] }],
    ['fisica', { arquivosC: ['fisica.c'], flagsLink: ['-lm'] }],
    ['estatistica', { arquivosC: ['estatistica.c'], flagsLink: ['-lm'] }],
    ['arquivos', { arquivosC: ['arquivos.c'], flagsLink: [] }],
    ['csv', { arquivosC: ['csv.c'], flagsLink: [] }],
    ['json', { arquivosC: ['json.c'], flagsLink: [] }],
    // WinHTTP (parte do sistema) no Windows; libcurl nos demais sistemas.
    [
        'http',
        {
            arquivosC: ['http.c'],
            flagsLink: [],
            flagsLinkPorSistema: { windows: ['-lwinhttp'], linux: ['-lcurl'], darwin: ['-lcurl'] },
        },
    ],
    [
        'criptografia',
        {
            arquivosC: ['criptografia.c', 'criptografia-hashes.c', 'criptografia-aes-rsa.c'],
            flagsLink: ['-lssl', '-lcrypto'],
        },
    ],
    ['dados', { arquivosC: ['dados.c'], flagsLink: [] }],
    // CommandLineToArgvW (shell32) no Windows, para ler os argumentos em UTF-16.
    ['argumentos', { arquivosC: ['argumentos.c'], flagsLink: [], flagsLinkPorSistema: { windows: ['-lshell32'] } }],
    ['processo', { arquivosC: ['processo.c'], flagsLink: [] }],
    ['memoria', { arquivosC: ['memoria.c'], flagsLink: [] }],
    // Winsock no Windows; nos demais sistemas os soquetes estão na biblioteca C.
    ['rede', { arquivosC: ['rede.c'], flagsLink: [], flagsLinkPorSistema: { windows: ['-lws2_32'] } }],
    ['tempo', { arquivosC: ['tempo.c'], flagsLink: [] }],
]);

// Verdadeiro se `nome` é um módulo embutido do compilador (tem prioridade sobre pacotes
// instalados de mesmo nome).
export function ehModuloEmbutido(nome: string): boolean {
    return MAPA_MODULOS.has(nome);
}

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
    diretorioBibliotecas: string,
    // Sistema operacional do alvo. Padrão: o da máquina atual.
    sistema: string = process.platform === 'win32' ? 'windows' : process.platform
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
            for (const flag of [...biblioteca.flagsLink, ...(biblioteca.flagsLinkPorSistema?.[sistema] ?? [])]) {
                flagsLink.add(flag);
            }
        }
    }

    return {
        arquivosC: Array.from(arquivosC),
        flagsLink: Array.from(flagsLink),
    };
}
