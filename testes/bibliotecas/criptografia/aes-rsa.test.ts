/// <reference types="jest" />
import { CompiladorLLVM } from '../../../fontes/compilador-llvm';

describe('Compilador - delegua-criptografia F.1c: AES-256-GCM e RSA', () => {
    describe('AES-256-GCM', () => {
        it('criptografarAes256 gera declare para delegua_cript_aes256_cifrar', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var cifrado: texto = cript.criptografarAes256("mensagem", "chave-secreta", "iv-nonce")',
                'escreva(cifrado)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_aes256_cifrar');
        });

        it('descriptografarAes256 gera declare para delegua_cript_aes256_decifrar', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var plain: texto = cript.descriptografarAes256("deadbeef", "chave-secreta", "iv-nonce")',
                'escreva(plain)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_aes256_decifrar');
        });

        it('cifrar e descriptografar AES256 no mesmo programa', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var cifrado: texto = cript.criptografarAes256("ola", "k", "v")',
                'var plain: texto = cript.descriptografarAes256(cifrado, "k", "v")',
                'escreva(plain)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_aes256_cifrar');
            expect(resultado).toContain('delegua_cript_aes256_decifrar');
        });
    });

    describe('RSA — geração de chaves', () => {
        it('gerarChavePrivadaRsa gera declare para delegua_cript_rsa_gerar_privada', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var priv: texto = cript.gerarChavePrivadaRsa(2048)',
                'escreva(priv)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_rsa_gerar_privada');
        });

        it('derivarChavePublicaRsa gera declare para delegua_cript_rsa_derivar_publica', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var priv: texto = cript.gerarChavePrivadaRsa(2048)',
                'var pub: texto = cript.derivarChavePublicaRsa(priv)',
                'escreva(pub)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_rsa_gerar_privada');
            expect(resultado).toContain('delegua_cript_rsa_derivar_publica');
        });
    });

    describe('RSA — cifrar / decifrar', () => {
        it('criptografarRsa gera declare para delegua_cript_rsa_cifrar', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var cifrado: texto = cript.criptografarRsa("segredo", "chave-publica-pem")',
                'escreva(cifrado)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_rsa_cifrar');
        });

        it('descriptografarRsa gera declare para delegua_cript_rsa_decifrar', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var plain: texto = cript.descriptografarRsa("deadbeef", "chave-privada-pem")',
                'escreva(plain)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_rsa_decifrar');
        });
    });

    describe('RSA — assinatura digital', () => {
        it('assinarRsa gera declare para delegua_cript_rsa_assinar', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var assinatura: texto = cript.assinarRsa("documento", "chave-privada-pem")',
                'escreva(assinatura)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_rsa_assinar');
        });

        it('verificarAssinaturaRsa gera declare para delegua_cript_rsa_verificar', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var valido: inteiro = cript.verificarAssinaturaRsa("documento", "assinatura-hex", "chave-publica-pem")',
                'escreva(valido)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_rsa_verificar');
        });

        it('assinar e verificar RSA no mesmo programa', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var priv: texto = cript.gerarChavePrivadaRsa(2048)',
                'var pub: texto = cript.derivarChavePublicaRsa(priv)',
                'var assinatura: texto = cript.assinarRsa("doc", priv)',
                'var valido: inteiro = cript.verificarAssinaturaRsa("doc", assinatura, pub)',
                'escreva(valido)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_rsa_gerar_privada');
            expect(resultado).toContain('delegua_cript_rsa_derivar_publica');
            expect(resultado).toContain('delegua_cript_rsa_assinar');
            expect(resultado).toContain('delegua_cript_rsa_verificar');
        });
    });

    describe('Importação estruturada F.1c', () => {
        it('importa criptografarAes256 e gerarChavePrivadaRsa juntos', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'importar { criptografarAes256, gerarChavePrivadaRsa } de "criptografia"',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_aes256_cifrar');
            expect(resultado).toContain('delegua_cript_rsa_gerar_privada');
        });
    });

    describe('Coexistência F.1a + F.1b + F.1c', () => {
        it('usa sha256 (F.1b) e criptografarAes256 (F.1c) no mesmo programa', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var cript = importar("criptografia")',
                'var hash: texto = cript.sha256("dados")',
                'var cifrado: texto = cript.criptografarAes256("dados", hash, "iv")',
                'escreva(cifrado)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_cript_sha256');
            expect(resultado).toContain('delegua_cript_aes256_cifrar');
        });
    });
});
