/// <reference types="jest" />
import { execFile, execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Compila e executa um programa que escreve os argumentos recebidos. No Windows, eles são
// lidos em UTF-16 (CommandLineToArgvW) e convertidos para UTF-8, independentemente da
// página de código ANSI do sistema; no Linux, de /proc/self/cmdline.
// Precisa do clang para ligar o executável (o ambiente de testes de unidade pode não ter).
const temClang = spawnSync('clang', ['--version'], { stdio: 'ignore' }).status === 0;
const descrever = temClang && (process.platform === 'win32' || process.platform === 'linux') ? describe : describe.skip;

descrever('Biblioteca argumentos - execução', () => {
    let diretorio = '';

    beforeAll(() => {
        diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'delegua-argumentos-'));
    });

    afterAll(() => {
        fs.rmSync(diretorio, { recursive: true, force: true });
    });

    it('recebe argumentos em UTF-8, com espaços, aspas e vazios', async () => {
        const fonte = path.join(diretorio, 'argumentos.delegua');
        fs.writeFileSync(
            fonte,
            [
                'var argumentos = importar("argumentos")',
                'var total: inteiro = argumentos.quantidadeArgumentos()',
                'escreva(texto(total))',
                'para (var i = 0; i < total; i = i + 1) {',
                '    var argumento: texto = argumentos.argumento(i)',
                '    escreva("[" + argumento + "] " + texto(argumento.tamanho()))',
                '}',
            ].join('\n')
        );

        const raiz = path.resolve(__dirname, '..', '..');
        execFileSync(process.execPath, [require.resolve('ts-node/dist/bin'), path.join(raiz, 'fontes', 'ilc.ts'), fonte], {
            cwd: raiz,
            stdio: 'pipe',
        });
        const executavel = path.join(diretorio, process.platform === 'win32' ? 'argumentos.exe' : 'argumentos');
        const longo = 'x'.repeat(10000);
        const entradas = ['matemática', 'ação com espaço', '日本語', 'aspas "internas"', '', longo];
        const saida = await new Promise<string>((resolver, rejeitar) =>
            execFile(executavel, entradas, { encoding: 'utf-8' }, (erro, stdout) => (erro ? rejeitar(erro) : resolver(stdout)))
        );
        const linhas = saida.split(/\r?\n/).filter((linha) => linha !== '');

        expect(linhas[0]).toBe(String(entradas.length));
        entradas.forEach((entrada, indice) => {
            // tamanho() conta bytes UTF-8.
            expect(linhas[indice + 1]).toBe(`[${entrada}] ${Buffer.byteLength(entrada, 'utf-8')}`);
        });
    }, 300000);
});
