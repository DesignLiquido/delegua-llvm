import { CompiladorLLVM } from '../../fontes/compilador-llvm';

describe('Compilador - Biblioteca delegua-http (Fase E.1)', () => {
    describe('Importação dinâmica: var http = importar("http")', () => {
        it('importar("http") gera IR válido', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var http = importar("http")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @main()');
        });

        it('chama http.novoClienteHttp e gera declare para delegua_http_novo_cliente', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var http = importar("http")',
                'var cliente: texto = http.novoClienteHttp("https://api.exemplo.com", 5000)',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_http_novo_cliente');
        });

        it('chama http.adicionarCabecalho (retorno vazio) e gera declare para delegua_http_add_cabecalho', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var http = importar("http")',
                'var cliente: texto = http.novoClienteHttp("https://api.exemplo.com", 5000)',
                'http.adicionarCabecalho(cliente, "Content-Type: application/json")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_http_add_cabecalho');
        });

        it('chama http.requisicaoGet e gera declare para delegua_http_get', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var http = importar("http")',
                'var cliente: texto = http.novoClienteHttp("https://api.exemplo.com", 5000)',
                'var resp: texto = http.requisicaoGet(cliente, "/usuarios")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_http_get');
        });

        it('chama http.requisicaoPost e gera declare para delegua_http_post', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var http = importar("http")',
                'var cliente: texto = http.novoClienteHttp("https://api.exemplo.com", 5000)',
                'var resp: texto = http.requisicaoPost(cliente, "/usuarios", "{}")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_http_post');
        });

        it('chama http.requisicaoPut e gera declare para delegua_http_put', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var http = importar("http")',
                'var cliente: texto = http.novoClienteHttp("https://api.exemplo.com", 5000)',
                'var resp: texto = http.requisicaoPut(cliente, "/usuarios/1", "{}")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_http_put');
        });

        it('chama http.requisicaoDelete e gera declare para delegua_http_delete', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var http = importar("http")',
                'var cliente: texto = http.novoClienteHttp("https://api.exemplo.com", 5000)',
                'var resp: texto = http.requisicaoDelete(cliente, "/usuarios/1")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_http_delete');
        });

        it('chama http.requisicaoPatch e gera declare para delegua_http_patch', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var http = importar("http")',
                'var cliente: texto = http.novoClienteHttp("https://api.exemplo.com", 5000)',
                'var resp: texto = http.requisicaoPatch(cliente, "/usuarios/1", "{}")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_http_patch');
        });

        it('chama http.codigoStatus e gera declare para delegua_http_codigo_status', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var http = importar("http")',
                'var cliente: texto = http.novoClienteHttp("https://api.exemplo.com", 5000)',
                'var resp: texto = http.requisicaoGet(cliente, "/ping")',
                'var codigo: inteiro = http.codigoStatus(resp)',
                'escreva(codigo)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_http_codigo_status');
        });

        it('chama http.dados e gera declare para delegua_http_dados', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var http = importar("http")',
                'var cliente: texto = http.novoClienteHttp("https://api.exemplo.com", 5000)',
                'var resp: texto = http.requisicaoGet(cliente, "/ping")',
                'var corpo: texto = http.dados(resp)',
                'escreva(corpo)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_http_dados');
        });

        it('chama http.liberarResposta e gera declare para delegua_http_liberar_resp', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var http = importar("http")',
                'var cliente: texto = http.novoClienteHttp("https://api.exemplo.com", 5000)',
                'var resp: texto = http.requisicaoGet(cliente, "/ping")',
                'http.liberarResposta(resp)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_http_liberar_resp');
        });

        it('chama http.liberarCliente e gera declare para delegua_http_liberar_cliente', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var http = importar("http")',
                'var cliente: texto = http.novoClienteHttp("https://api.exemplo.com", 5000)',
                'http.liberarCliente(cliente)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_http_liberar_cliente');
        });

        it('lança erro ao chamar método inexistente no módulo http', async () => {
            const compilador = new CompiladorLLVM();
            await expect(compilador.compilar([
                'var http = importar("http")',
                'http.funcaoInexistente()',
            ])).rejects.toThrow("Função 'funcaoInexistente' não encontrada no módulo 'http'");
        });
    });

    describe('Importação estruturada: importar { fn } de "http"', () => {
        it('importa novoClienteHttp e declara função no IR', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'importar { novoClienteHttp } de "http"',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_http_novo_cliente');
        });
    });

    describe('Coexistência com outras bibliotecas', () => {
        it('usa http junto com json', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var http = importar("http")',
                'var json = importar("json")',
                'var cliente: texto = http.novoClienteHttp("https://api.exemplo.com", 5000)',
                'var resp: texto = http.requisicaoGet(cliente, "/dados")',
                'var corpo: texto = http.dados(resp)',
                'var obj: texto = json.textoParaJson(corpo)',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_http_get');
            expect(resultado).toContain('delegua_json_texto_para_objeto');
        });
    });
});
