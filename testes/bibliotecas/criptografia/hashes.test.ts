import { CompiladorLLVM } from '../../../fontes/compilador-llvm';

describe('Compilador - delegua-criptografia F.1b: hashes, HMAC, aleatório, UUID, PBKDF2', () => {
    describe('Hashes', () => {
        it('md5 gera declare para delegua_cript_md5', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var h: texto = cript.md5("delegua")',
                'escreva(h)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_md5');
        });

        it('sha1 gera declare para delegua_cript_sha1', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var h: texto = cript.sha1("delegua")',
                'escreva(h)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_sha1');
        });

        it('sha256 gera declare para delegua_cript_sha256', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var h: texto = cript.sha256("delegua")',
                'escreva(h)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_sha256');
        });

        it('sha512 gera declare para delegua_cript_sha512', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var h: texto = cript.sha512("delegua")',
                'escreva(h)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_sha512');
        });
    });

    describe('HMAC', () => {
        it('hmacSha256 gera declare para delegua_cript_hmac_sha256', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var h: texto = cript.hmacSha256("mensagem", "chave-secreta")',
                'escreva(h)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_hmac_sha256');
        });

        it('hmacSha512 gera declare para delegua_cript_hmac_sha512', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var h: texto = cript.hmacSha512("mensagem", "chave-secreta")',
                'escreva(h)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_hmac_sha512');
        });
    });

    describe('Geração de valores aleatórios', () => {
        it('gerarBytesAleatorios gera declare para delegua_cript_bytes_aleatorios', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var b: texto = cript.gerarBytesAleatorios(16)',
                'escreva(b)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_bytes_aleatorios');
        });

        it('gerarTextoAleatorio gera declare para delegua_cript_texto_aleatorio', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var t: texto = cript.gerarTextoAleatorio(32)',
                'escreva(t)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_texto_aleatorio');
        });

        it('gerarUuid gera declare para delegua_cript_uuid', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var uuid: texto = cript.gerarUuid()',
                'escreva(uuid)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_uuid');
        });
    });

    describe('PBKDF2', () => {
        it('derivarChavePbkdf2 gera declare para delegua_cript_pbkdf2', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var chave: texto = cript.derivarChavePbkdf2("senha", "sal-aleatorio", 100000, 32)',
                'escreva(chave)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_pbkdf2');
        });
    });

    describe('Importação estruturada', () => {
        it('importa sha256 e hmacSha256 juntos', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'importar { sha256, hmacSha256 } de "criptografia"',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_sha256');
            expect(resultado).toContain('delegua_cript_hmac_sha256');
        });
    });

    describe('Coexistência F.1a + F.1b', () => {
        it('usa rot13 (F.1a) e sha256 (F.1b) no mesmo programa', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var cifrado: texto = cript.rot13("Ola")',
                'var hash: texto = cript.sha256("Ola")',
                'escreva(cifrado)',
                'escreva(hash)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_rot13');
            expect(resultado).toContain('delegua_cript_sha256');
        });

        it('usa codificarBase64 (F.1a) com gerarTextoAleatorio (F.1b)', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var aleatorio: texto = cript.gerarTextoAleatorio(16)',
                'var b64: texto = cript.codificarBase64(aleatorio)',
                'escreva(b64)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_texto_aleatorio');
            expect(resultado).toContain('delegua_cript_base64_codificar');
        });
    });
});
