import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador', () => {
    // TODO: Corrigir Lexador antes de habilitar.
    it.skip('Trivial', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([]);
        expect(resultado).toBeTruthy();
    });

    it('Escreva', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar(['escreva(123)']);
        expect(resultado).toBeTruthy();
    });

    describe('Funções', () => {
        it('Quadrado, número', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao quadrado(n: numero): numero {',
                '    retorna n * n',
                '}'
            ]);
            
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define float @quadrado(float %0)');
            expect(resultado).toContain('  %1 = fmul float %0, %0');
            expect(resultado).toContain('  ret float %1');
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
            expect(resultado).toContain('  %2 = add i32 %0, %1');
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
            expect(resultado).toContain('define float @soma(i32 %0, float %1)');
            expect(resultado).toContain('  %2 = sitofp i32 %0 to float');
            expect(resultado).toContain('  %3 = fadd float %2, %1');
            expect(resultado).toContain('  ret float %3');
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
            expect(resultado).toContain('  %2 = sub i32 %0, %1');
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
            expect(resultado).toContain('  %3 = add i32 %0, %1');
            expect(resultado).toContain('  %4 = add i32 %3, %2');
            expect(resultado).toContain('  ret i32 %4');
        });
    });
});
