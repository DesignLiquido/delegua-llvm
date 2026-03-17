import { CompiladorLLVM } from '../../../fontes/compilador-llvm';

describe('Compilador - Biblioteca delegua-criptografia F.1a (Fase F.1a)', () => {
    describe('Importação dinâmica: var cript = importar("criptografia")', () => {
        it('importar("criptografia") gera IR válido', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @main()');
        });

        it('chama cript.cifrarXor e gera declare para delegua_cript_cifrar_xor', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var hex: texto = cript.cifrarXor("ola", "chave")',
                'escreva(hex)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_cifrar_xor');
        });

        it('chama cript.decifrarXor e gera declare para delegua_cript_decifrar_xor', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var texto: texto = cript.decifrarXor("0a1b2c", "chave")',
                'escreva(texto)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_decifrar_xor');
        });

        it('chama cript.rot13 e gera declare para delegua_cript_rot13', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var r: texto = cript.rot13("Uryyb")',
                'escreva(r)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_rot13');
        });

        it('chama cript.rotN e gera declare para delegua_cript_rot_n', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var r: texto = cript.rotN("Khoor", 3)',
                'escreva(r)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_rot_n');
        });

        it('chama cript.decifrarRotN e gera declare para delegua_cript_decifrar_rot_n', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var r: texto = cript.decifrarRotN("Khoor", 3)',
                'escreva(r)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_decifrar_rot_n');
        });

        it('chama cript.codificarBase64 e gera declare para delegua_cript_base64_codificar', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var b64: texto = cript.codificarBase64("Ola mundo")',
                'escreva(b64)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_base64_codificar');
        });

        it('chama cript.decodificarBase64 e gera declare para delegua_cript_base64_decodificar', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var txt: texto = cript.decodificarBase64("T2xhIG11bmRv")',
                'escreva(txt)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_base64_decodificar');
        });

        it('chama cript.criptografarEmMeninoDoAcre e gera declare para delegua_cript_menino_do_acre_cif', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var runico: texto = cript.criptografarEmMeninoDoAcre("ola")',
                'escreva(runico)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_menino_do_acre_cif');
        });

        it('chama cript.descriptografarDeMeninoDoAcre e gera declare para delegua_cript_menino_do_acre_dec', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var orig: texto = cript.descriptografarDeMeninoDoAcre("ola")',
                'escreva(orig)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_menino_do_acre_dec');
        });

        it('lança erro ao chamar método inexistente no módulo criptografia', async () => {
            const compilador = new CompiladorLLVM();
            await expect(compilador.compilar([
                'var cript = importar("criptografia")',
                'cript.funcaoInexistente()',
            ])).rejects.toThrow("Função 'funcaoInexistente' não encontrada no módulo 'criptografia'");
        });
    });

    describe('Importação estruturada: importar { fn } de "criptografia"', () => {
        it('importa rot13 e declara função no IR', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'importar { rot13 } de "criptografia"',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_rot13');
        });

        it('importa codificarBase64 e decifrarXor juntos', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'importar { codificarBase64, decifrarXor } de "criptografia"',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_base64_codificar');
            expect(resultado).toContain('delegua_cript_decifrar_xor');
        });
    });

    describe('Coexistência com outras bibliotecas', () => {
        it('usa criptografia junto com http', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var http = importar("http")',
                'var token: texto = cript.codificarBase64("usuario:senha")',
                'var cliente: texto = http.novoClienteHttp("https://api.exemplo.com", 5000)',
                'escreva(token)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_base64_codificar');
            expect(resultado).toContain('delegua_http_novo_cliente');
        });
    });
});
