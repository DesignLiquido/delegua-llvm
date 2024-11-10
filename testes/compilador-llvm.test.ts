import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador', () => {
    it('Trivial', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([]);
        expect(resultado).toBeTruthy();
    });

    it('Funções', async () => {
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
});
