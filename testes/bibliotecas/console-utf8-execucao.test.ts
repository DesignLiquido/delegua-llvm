/// <reference types="jest" />
import { execFile, execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// No Windows, o tempo de execução muda a página de código de saída do console para UTF-8 (65001) ao
// iniciar e restaura a original ao terminar. O teste roda o programa num cmd.exe com
// `chcp 850` e consulta a página de saída com um auxiliar em C, durante e depois.
const temClang = spawnSync('clang', ['--version'], { stdio: 'ignore' }).status === 0;
const descrever = process.platform === 'win32' && temClang ? describe : describe.skip;

descrever('Runtime - saída do console em UTF-8 (Windows)', () => {
    let diretorio = '';

    beforeAll(() => {
        diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'delegua-console-'));
    });

    afterAll(() => {
        fs.rmSync(diretorio, { recursive: true, force: true });
    });

    it('usa UTF-8 durante o programa e restaura a página de código ao terminar', async () => {
        // Auxiliar que só escreve a página de código de saída atual (0: sem console).
        const auxiliarC = path.join(diretorio, 'pagina.c');
        const auxiliar = path.join(diretorio, 'pagina.exe');
        fs.writeFileSync(
            auxiliarC,
            [
                '#include <stdio.h>',
                '__declspec(dllimport) unsigned int __stdcall GetConsoleOutputCP(void);',
                'int main(void) { printf("pagina=%u\\n", GetConsoleOutputCP()); return 0; }',
            ].join('\n')
        );
        execFileSync('clang', [auxiliarC, '-o', auxiliar], { stdio: 'pipe' });

        const fonte = path.join(diretorio, 'console.delegua');
        fs.writeFileSync(
            fonte,
            [
                'var processo = importar("processo")',
                'escreva("durante:")',
                `processo.executar("${auxiliar.replace(/\\/g, '/')}", [], "")`,
            ].join('\n')
        );
        const raiz = path.resolve(__dirname, '..', '..');
        execFileSync(process.execPath, [require.resolve('ts-node/dist/bin'), path.join(raiz, 'fontes', 'ilc.ts'), fonte], {
            cwd: raiz,
            stdio: 'pipe',
        });
        const programa = path.join(diretorio, 'console.exe');

        const saida = await new Promise<string>((resolver, rejeitar) =>
            execFile(
                'cmd.exe',
                ['/d', '/s', '/c', `"chcp 850 >nul & "${programa}" & echo depois: & "${auxiliar}""`],
                { encoding: 'utf-8', windowsVerbatimArguments: true },
                (erro, stdout) => (erro ? rejeitar(erro) : resolver(stdout))
            )
        );
        const paginas = [...saida.matchAll(/pagina=(\d+)/g)].map((correspondencia) => Number(correspondencia[1]));
        expect(paginas).toHaveLength(2);

        // Sem console anexado (ex.: alguns ambientes de CI), não há o que mudar.
        if (paginas[1] === 0) return;
        expect(paginas[0]).toBe(65001);
        expect(paginas[1]).toBe(850);
    }, 300000);
});
