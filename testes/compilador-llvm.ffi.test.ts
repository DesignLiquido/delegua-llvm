/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - FFI (classe estrangeira)', () => {
    it('Gera declare para função de biblioteca matemática', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            '@definicao(biblioteca="m", prefixo="")',
            'classe estrangeira LibM {',
            '    cos(x: numero): numero',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('declare double @cos');
    });

    it('Gera chamada FFI com CreateCall', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            '@definicao(biblioteca="m", prefixo="")',
            'classe estrangeira LibM {',
            '    cos(x: numero): numero',
            '}',
            'var r = LibM.cos(0.0)',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('declare double @cos');
        expect(resultado).toContain('call double @cos');
    });

    it('Gera metadados !llvm.linker.options e comentário ffi-link', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            '@definicao(biblioteca="m", prefixo="")',
            'classe estrangeira LibM {',
            '    cosseno(x: numero): numero',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('; ffi-link: -lm');
        expect(resultado).toContain('!llvm.linker.options');
        expect(resultado).toContain('"-lm"');
    });

    it('Usa símbolo explícito de @definicao no método', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            '@definicao(biblioteca="ssl", prefixo="SSL_")',
            'classe estrangeira LibSSL {',
            '    @definicao(simbolo="SSL_CTX_new")',
            '    novoContexto(): qualquer',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('declare ptr @SSL_CTX_new');
    });

    it('Usa prefixo quando método não tem @definicao próprio', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            '@definicao(biblioteca="ssl", prefixo="SSL_")',
            'classe estrangeira LibSSL {',
            '    conectar(socket: inteiro): inteiro',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('declare i32 @SSL_conectar');
    });

    it('Deduplica bibliotecas repetidas no linker.options', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            '@definicao(biblioteca="m", prefixo="")',
            'classe estrangeira LibM1 {',
            '    sin(x: numero): numero',
            '}',
            '@definicao(biblioteca="m", prefixo="")',
            'classe estrangeira LibM2 {',
            '    cos(x: numero): numero',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        const ocorrencias = (resultado.match(/ffi-link: -lm/g) || []).length;
        expect(ocorrencias).toBe(1);
    });
});
