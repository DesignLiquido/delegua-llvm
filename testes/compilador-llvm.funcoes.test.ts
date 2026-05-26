/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Funções', () => {
    it('Quadrado, número', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao quadrado(n: numero): numero {',
            '    retorna n * n',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define double @quadrado(double %0)');
        expect(resultado).toContain('  %1 = fmul double %0, %0');
        expect(resultado).toContain('  ret double %1');
    });

    it('Soma, inteiro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao soma(a: inteiro, b: inteiro): inteiro {',
            '    retorna a + b',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define i32 @soma(i32 %0, i32 %1)');
        expect(resultado).toContain('  %2 = add nsw i32 %0, %1');
        expect(resultado).toContain('  ret i32 %2');
    });

    it('Soma, inteiro com número', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao soma(a: inteiro, b: número): número {',
            '    retorna a + b',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define double @soma(i32 %0, double %1)');
        expect(resultado).toContain('  %2 = sitofp i32 %0 to double');
        expect(resultado).toContain('  %3 = fadd double %2, %1');
        expect(resultado).toContain('  ret double %3');
    });

    it('Subtração, inteiro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao subtracao(a: inteiro, b: inteiro): inteiro {',
            '    retorna a - b',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define i32 @subtracao(i32 %0, i32 %1)');
        expect(resultado).toContain('  %2 = sub nsw i32 %0, %1');
        expect(resultado).toContain('  ret i32 %2');
    });

    it('Divisão inteira, inteiro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao divisao_inteira(a: inteiro, b: inteiro): inteiro {',
            '    retorna a \\ b',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define i32 @divisao_inteira(i32 %0, i32 %1)');
        expect(resultado).toContain('  %2 = sdiv i32 %0, %1');
        expect(resultado).toContain('  ret i32 %2');
    });

    it('Operações encadeadas, operandos inteiros', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao encadeadas(a: inteiro, b: inteiro, c: inteiro): inteiro {',
            '    retorna a + b + c',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define i32 @encadeadas(i32 %0, i32 %1, i32 %2)');
        expect(resultado).toContain('  %3 = add nsw i32 %0, %1');
        expect(resultado).toContain('  %4 = add nsw i32 %3, %2');
        expect(resultado).toContain('  ret i32 %4');
    });

    it('Operações encadeadas, operandos inteiros e números', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao encadeadas(a: inteiro, b: número, c: inteiro): número {',
            '    retorna a + b + c',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define double @encadeadas(i32 %0, double %1, i32 %2)');
        expect(resultado).toContain('  %3 = sitofp i32 %0 to double');
        expect(resultado).toContain('  %4 = fadd double %3, %1');
        expect(resultado).toContain('  %5 = sitofp i32 %2 to double');
        expect(resultado).toContain('  %6 = fadd double %4, %5');
        expect(resultado).toContain('  ret double %6');
    });

    it('Chamada de função, inteiro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao soma(a: inteiro, b: inteiro): inteiro {',
            '    retorna a + b',
            '}',
            'var c = soma(1, 2)'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define i32 @soma(i32 %0, i32 %1)');
        expect(resultado).toContain('  %2 = add nsw i32 %0, %1');
        expect(resultado).toContain('  ret i32 %2');
        expect(resultado).toContain('  %c = alloca i32, align 4');
        expect(resultado).toContain('  %0 = call i32 @soma(i32 1, i32 2)');
        expect(resultado).toContain('  store i32 %0, ptr %c, align 4');
    });

    it('Função recursiva (fibonacci)', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao fib(n: inteiro): inteiro {',
            '    se n <= 1 {',
            '        retorna n',
            '    }',
            '    retorna fib(n - 1) + fib(n - 2)',
            '}',
            'escreva(fib(10))',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define i32 @fib(i32 %0)');
        expect(resultado).toContain('call i32 @fib(');
    });

    it('Chamada de função, número', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao soma(a: inteiro, b: número): número {',
            '    retorna a + b',
            '}',
            'var c = soma(1, 2)'
        ]);

        expect(resultado).toBeTruthy();
    });

    it('Negação unária em retorna', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao negar(n: inteiro): inteiro {',
            '    retorna -n',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define i32 @negar(i32 %0)');
    });

    it('Função que retorna resultado de comparação', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao maiorQue(a: inteiro, b: inteiro): lógico {',
            '    retorna a > b',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define i1 @maiorQue(i32 %0, i32 %1)');
        expect(resultado).toContain('icmp sgt i32');
        expect(resultado).toContain('ret i1');
    });
});
