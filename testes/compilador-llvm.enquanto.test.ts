import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Fazer', () => {
    it('Laço fazer enquanto executa corpo ao menos uma vez', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var i: inteiro = 0',
            'fazer {',
            '    i = i + 1',
            '} enquanto (i < 5)'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('fazer_corpo:');
        expect(resultado).toContain('fazer_cond:');
        expect(resultado).toContain('fazer_apos:');
        // Corpo deve ser alcançado antes da condição (estrutura do-while).
        expect(resultado).toContain('br label %fazer_corpo');
    });

    it('Laço fazer enquanto com escreva no corpo', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var n: inteiro = 3',
            'fazer {',
            '    escreva(n)',
            '    n = n + 1',
            '} enquanto (n < 10)'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('fazer_corpo:');
        expect(resultado).toContain('fazer_cond:');
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
    });
});

describe('Compilador - Enquanto', () => {
    it('Laço simples enquanto', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var i: inteiro = 0',
            'enquanto (i < 10) {',
            '    i = i + 1',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('%i = alloca i32, align 4');
        expect(resultado).toContain('while_cond:');
        expect(resultado).toContain('while_body:');
        expect(resultado).toContain('while_after:');
        expect(resultado).toContain('br label %while_cond');
    });

    it('Laço enquanto com escreva', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var i: inteiro = 1',
            'enquanto (i <= 5) {',
            '    escreva(i)',
            '    i = i + 1',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('while_cond:');
        expect(resultado).toContain('while_body:');
        expect(resultado).toContain('while_after:');
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
    });

    it('Laço enquanto com condição de número', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var x: número = 0.0',
            'enquanto (x < 1.0) {',
            '    x = x + 0.1',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('%x = alloca double, align 8');
        expect(resultado).toContain('while_cond:');
        expect(resultado).toContain('while_body:');
        expect(resultado).toContain('while_after:');
        expect(resultado).toContain('fcmp');
    });
});
