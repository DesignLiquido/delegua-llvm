/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - FFI (classes estrangeiras)', () => {
    it('Classe estrangeira com @definicao emite declare para cada método', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            '@definicao(biblioteca="m")',
            'classe estrangeira LibM {',
            '    cosseno(x: numero): numero',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('declare double @cosseno(double');
    });

    it('Classe estrangeira não gera struct type nem type marker', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            '@definicao(biblioteca="m")',
            'classe estrangeira LibM {',
            '    cosseno(x: numero): numero',
            '}',
        ]);

        expect(resultado).not.toContain('%LibM = type {');
        expect(resultado).not.toContain('@__delegua_tipo_LibM');
    });

    it('bibliotecasEstrangeiras contém a biblioteca declarada', async () => {
        const compilador = new CompiladorLLVM();
        await compilador.compilar([
            '@definicao(biblioteca="m")',
            'classe estrangeira LibM {',
            '    cosseno(x: numero): numero',
            '}',
        ]);

        expect(compilador.bibliotecasEstrangeiras.has('m')).toBe(true);
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

    it('Prefixo é aplicado ao nome do símbolo quando não há @definicao no método', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            '@definicao(biblioteca="ssl", prefixo="SSL_")',
            'classe estrangeira ConexaoSSL {',
            '    conectar(socket: inteiro): inteiro',
            '}',
        ]);

        expect(resultado).toContain('declare i32 @SSL_conectar(i32');
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

    it('Método com retorno vazio emite declare void', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            '@definicao(biblioteca="mylib")',
            'classe estrangeira MinhaLib {',
            '    inicializar(): vazio',
            '}',
        ]);

        expect(resultado).toContain('declare void @inicializar()');
    });

    it('Múltiplos métodos geram múltiplos declares', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            '@definicao(biblioteca="m", prefixo="")',
            'classe estrangeira LibM {',
            '    seno(x: numero): numero',
            '    cosseno(x: numero): numero',
            '}',
        ]);

        expect(resultado).toContain('declare double @seno(double');
        expect(resultado).toContain('declare double @cosseno(double');
    });

    it('Classe estrangeira sem @definicao é ignorada sem erro', async () => {
        const compilador = new CompiladorLLVM();
        await expect(
            compilador.compilar([
                'classe estrangeira SemDecorador {',
                '    metodo(): vazio',
                '}',
            ])
        ).resolves.toBeTruthy();
    });

    it('Múltiplas bibliotecas são adicionadas a bibliotecasEstrangeiras', async () => {
        const compilador = new CompiladorLLVM();
        await compilador.compilar([
            '@definicao(biblioteca="m")',
            'classe estrangeira LibM {',
            '    cosseno(x: numero): numero',
            '}',
            '@definicao(biblioteca="ssl")',
            'classe estrangeira LibSSL {',
            '    inicializar(): vazio',
            '}',
        ]);

        expect(compilador.bibliotecasEstrangeiras.has('m')).toBe(true);
        expect(compilador.bibliotecasEstrangeiras.has('ssl')).toBe(true);
        expect(compilador.bibliotecasEstrangeiras.size).toBe(2);
    });

    it('Chamada de método estrangeiro gera call no IR', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            '@definicao(biblioteca="m")',
            'classe estrangeira LibM {',
            '    cosseno(x: numero): numero',
            '}',
            'escreva(LibM.cosseno(1.0))',
        ]);

        expect(resultado).toContain('declare double @cosseno(double');
        expect(resultado).toContain('call double @cosseno(');
    });

    it('Tipo inteiro no parâmetro do método estrangeiro emite i32', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            '@definicao(biblioteca="libc")',
            'classe estrangeira LibC {',
            '    abs(x: inteiro): inteiro',
            '}',
        ]);

        expect(resultado).toContain('declare i32 @abs(i32');
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
