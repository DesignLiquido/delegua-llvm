import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador', () => {
    it('Trivial', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([]);
        expect(resultado).toBeTruthy();
    });

    describe('Funções', () => {
        it('Quadrado', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao quadrado(n: numero): numero {',
                '    retorna n * n',
                '}'
            ]);
            
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @quadrado(i32 %0)');
            expect(resultado).toContain('  %1 = mul i32 %0, %0');
            expect(resultado).toContain('  ret i32 %1');
        });

        it('Soma', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao soma(a: numero, b: numero): numero {',
                '    retorna a + b',
                '}'
            ]);
            
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @soma(i32 %0, i32 %1)');
            expect(resultado).toContain('  %2 = add i32 %0, %1');
            expect(resultado).toContain('  ret i32 %2');
        });

        it('Subtração', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao subtracao(a: numero, b: numero): numero {',
                '    retorna a - b',
                '}'
            ]);
            
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @subtracao(i32 %0, i32 %1)');
            expect(resultado).toContain('  %2 = sub i32 %0, %1');
            expect(resultado).toContain('  ret i32 %2');
        });

        it('Divisão inteira', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao divisao_inteira(a: numero, b: numero): numero {',
                '    retorna a \\ b',
                '}'
            ]);
            
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @divisao_inteira(i32 %0, i32 %1)');
            expect(resultado).toContain('  %2 = sdiv i32 %0, %1');
            expect(resultado).toContain('  ret i32 %2');
        });
    });
});
