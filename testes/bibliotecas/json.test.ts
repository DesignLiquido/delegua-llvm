/// <reference types="jest" />
import { CompiladorLLVM } from '../../fontes/compilador-llvm';

describe('Compilador - Biblioteca delegua-json (Fase C.2)', () => {
    describe('Importação dinâmica: var json = importar("json")', () => {
        it('importar("json") gera IR válido', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var json = importar("json")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @main()');
        });

        it('chama json.textoParaJson e gera declare para delegua_json_texto_para_objeto', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var json = importar("json")',
                'var obj: texto = json.textoParaJson("[]")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_json_texto_para_objeto');
        });

        it('chama json.objetoParaTextoJson e gera declare para delegua_json_objeto_para_texto', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var json = importar("json")',
                'var obj: texto = json.textoParaJson("{}")',
                'var serializado: texto = json.objetoParaTextoJson(obj)',
                'escreva(serializado)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_json_objeto_para_texto');
        });

        it('chama json.importarArquivoJson e gera declare para delegua_json_importar_arquivo', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var json = importar("json")',
                'var obj: texto = json.importarArquivoJson("./dados.json")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_json_importar_arquivo');
        });

        it('chama json.exportarObjetoParaArquivoJson (retorno vazio) e gera declare para delegua_json_exportar_arquivo', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var json = importar("json")',
                'var obj: texto = json.textoParaJson("{}")',
                'json.exportarObjetoParaArquivoJson(obj, "./saida.json")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_json_exportar_arquivo');
        });

        it('chama json.obterCampo e gera declare para delegua_json_obter_campo', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var json = importar("json")',
                'var obj: texto = json.importarArquivoJson("./dados.json")',
                'var campo: texto = json.obterCampo(obj, "nome")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_json_obter_campo');
        });

        it('chama json.obterItem e gera declare para delegua_json_obter_item', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var json = importar("json")',
                'var arr: texto = json.textoParaJson("[1,2,3]")',
                'var item: texto = json.obterItem(arr, 0)',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_json_obter_item');
        });

        it('chama json.tamanho e gera declare para delegua_json_tamanho', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var json = importar("json")',
                'var arr: texto = json.textoParaJson("[1,2,3]")',
                'var n: inteiro = json.tamanho(arr)',
                'escreva(n)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_json_tamanho');
        });

        it('chama json.valorTexto e gera declare para delegua_json_valor_texto', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var json = importar("json")',
                'var obj: texto = json.importarArquivoJson("./dados.json")',
                'var campo: texto = json.obterCampo(obj, "x")',
                'var v: texto = json.valorTexto(campo)',
                'escreva(v)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_json_valor_texto');
        });

        it('chama json.valorNumero e gera declare para delegua_json_valor_numero', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var json = importar("json")',
                'var obj: texto = json.importarArquivoJson("./dados.json")',
                'var campo: texto = json.obterCampo(obj, "n")',
                'var v: numero = json.valorNumero(campo)',
                'escreva(v)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_json_valor_numero');
        });

        it('chama json.liberar (retorno vazio) e gera declare para delegua_json_liberar', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var json = importar("json")',
                'var obj: texto = json.textoParaJson("{}")',
                'json.liberar(obj)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_json_liberar');
        });

        it('lança erro ao chamar método inexistente no módulo json', async () => {
            const compilador = new CompiladorLLVM();
            await expect(compilador.compilar([
                'var json = importar("json")',
                'json.funcaoInexistente()',
            ])).rejects.toThrow("Função 'funcaoInexistente' não encontrada no módulo 'json'");
        });
    });

    describe('Importação estruturada: importar { fn } de "json"', () => {
        it('importa textoParaJson e declara função no IR', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'importar { textoParaJson } de "json"',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_json_texto_para_objeto');
        });
    });

    describe('Coexistência com outras bibliotecas', () => {
        it('usa json junto com arquivos', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var json = importar("json")',
                'var arq = importar("arquivos")',
                'var obj: texto = json.importarArquivoJson("./dados.json")',
                'var dir: texto = arq.diretorioAtual()',
                'escreva(dir)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_json_importar_arquivo');
            expect(resultado).toContain('delegua_arq_diretorio_atual');
        });
    });
});
