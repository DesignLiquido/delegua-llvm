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

        it('Soma, número', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao soma(a: numero, b: numero): numero {',
                '    retorna a + b',
                '}'
            ]);
            
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define float @soma(float %0, float %1)');
            expect(resultado).toContain('  %2 = fadd float %0, %1');
            expect(resultado).toContain('  ret float %2');
        });

        it('Subtração, número', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao subtracao(a: numero, b: numero): numero {',
                '    retorna a - b',
                '}'
            ]);
            
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define float @subtracao(float %0, float %1)');
            expect(resultado).toContain('  %2 = fsub float %0, %1');
            expect(resultado).toContain('  ret float %2');
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

        it.skip('Operações encadeadas', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                // 'funcao encadeadas(a: numero, b: numero, c: numero): numero {',
                'funcao encadeadas(a: inteiro, b: inteiro, c: inteiro): inteiro {',
                '    retorna a + c + 1 * b + 7',
                '}'
            ]);
            
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @divisao_inteira(float %0, float %1, float %2)');
            // expect(resultado).toContain('  %2 = sdiv i32 %0, %1');
            // expect(resultado).toContain('  ret i32 %2');
        });
    });
});
