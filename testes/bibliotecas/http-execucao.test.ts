/// <reference types="jest" />
import { execFile, execFileSync } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import { AddressInfo } from 'net';
import * as os from 'os';
import * as path from 'path';

// Compila e executa um programa com o módulo `http` contra um servidor local. Só no
// Windows, onde o módulo usa o WinHTTP do sistema; nos demais sistemas ele depende do
// libcurl, que o ambiente de testes não instala.
const descrever = process.platform === 'win32' ? describe : describe.skip;

descrever('Biblioteca http - execução (WinHTTP)', () => {
    let servidor: http.Server;
    let porta = 0;
    let diretorio = '';

    beforeAll(async () => {
        servidor = http.createServer((req, res) => {
            let corpo = '';
            req.on('data', (pedaco) => (corpo += pedaco));
            req.on('end', () => {
                if (req.url === '/redirecionar') {
                    res.writeHead(302, { Location: '/eco?veio=redirecionado' });
                    return res.end();
                }
                if (req.url === '/ausente') {
                    res.writeHead(404);
                    return res.end('nada');
                }
                if (req.url === '/grande') {
                    res.writeHead(200);
                    return res.end('x'.repeat(200000));
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(
                    JSON.stringify({
                        metodo: req.method,
                        url: req.url,
                        autorizacao: req.headers['authorization'] ?? '',
                        tipo: req.headers['content-type'] ?? '',
                        corpo,
                    })
                );
            });
        });
        await new Promise<void>((resolver) => servidor.listen(0, '127.0.0.1', () => resolver()));
        porta = (servidor.address() as AddressInfo).port;
        diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'delegua-http-'));
    });

    afterAll(async () => {
        await new Promise<void>((resolver) => servidor.close(() => resolver()));
        fs.rmSync(diretorio, { recursive: true, force: true });
    });

    it('faz requisições GET, POST, PUT, DELETE e PATCH, segue redirecionamentos e trata falhas', async () => {
        const fonte = path.join(diretorio, 'cliente.delegua');
        fs.writeFileSync(
            fonte,
            [
                'var http = importar("http")',
                'var processo = importar("processo")',
                'var cliente = http.novoClienteHttp("http://127.0.0.1:" + processo.variavelAmbiente("PORTA_TESTE"), 5000)',
                'http.adicionarCabecalho(cliente, "Authorization: Bearer abc")',
                'escreva(http.dados(http.requisicaoGet(cliente, "/eco?a=1")))',
                'escreva(http.dados(http.requisicaoPost(cliente, "/eco", "{}")))',
                'escreva(http.dados(http.requisicaoPut(cliente, "/eco", "p")))',
                'escreva(http.dados(http.requisicaoDelete(cliente, "/eco/7")))',
                'escreva(http.dados(http.requisicaoPatch(cliente, "/eco", "q")))',
                'var ausente = http.requisicaoGet(cliente, "/ausente")',
                'escreva(texto(http.codigoStatus(ausente)) + " " + http.dados(ausente))',
                'escreva(http.dados(http.requisicaoGet(cliente, "/redirecionar")))',
                'var grande: texto = http.dados(http.requisicaoGet(cliente, "/grande"))',
                'escreva(texto(grande.tamanho()))',
                'var inacessivel = http.novoClienteHttp("http://127.0.0.1:1", 2000)',
                'escreva(texto(http.requisicaoGet(inacessivel, "/") == nulo))',
            ].join('\n')
        );

        const raiz = path.resolve(__dirname, '..', '..');
        execFileSync(process.execPath, [require.resolve('ts-node/dist/bin'), path.join(raiz, 'fontes', 'ilc.ts'), fonte], {
            cwd: raiz,
            stdio: 'pipe',
        });
        // Assíncrono: o servidor roda neste mesmo processo e precisa do laço de eventos livre.
        const saida = await new Promise<string>((resolver, rejeitar) =>
            execFile(
                path.join(diretorio, 'cliente.exe'),
                { env: { ...process.env, PORTA_TESTE: String(porta) }, encoding: 'utf-8' },
                (erro, stdout) => (erro ? rejeitar(erro) : resolver(stdout))
            )
        );
        const linhas = saida.split(/\r?\n/).map((linha) => linha.trim()).filter((linha) => linha !== '');

        const eco = (indice: number) => JSON.parse(linhas[indice]);
        expect(eco(0)).toEqual({ metodo: 'GET', url: '/eco?a=1', autorizacao: 'Bearer abc', tipo: '', corpo: '' });
        expect(eco(1)).toEqual({
            metodo: 'POST',
            url: '/eco',
            autorizacao: 'Bearer abc',
            // Como no libcurl: corpo sem Content-Type recebe o tipo de formulário.
            tipo: 'application/x-www-form-urlencoded',
            corpo: '{}',
        });
        expect(eco(2)).toMatchObject({ metodo: 'PUT', corpo: 'p' });
        expect(eco(3)).toMatchObject({ metodo: 'DELETE', url: '/eco/7', corpo: '' });
        expect(eco(4)).toMatchObject({ metodo: 'PATCH', corpo: 'q' });
        expect(linhas[5]).toBe('404 nada');
        expect(eco(6)).toMatchObject({ metodo: 'GET', url: '/eco?veio=redirecionado' });
        expect(linhas[7]).toBe('200000');
        expect(linhas[8]).toBe('verdadeiro');
    }, 300000);
});
