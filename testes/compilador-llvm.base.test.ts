import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Base', () => {
    it('Trivial', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([]);
        expect(resultado).toBeTruthy();
    });

    it('Escreva', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar(['escreva(123)']);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('call i32 (ptr, ...) @escreva(ptr @fmt, double 1.230000e+02)');
    });

    it('Escreva com texto', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar(['escreva(123, "teste")']);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('@fmt = private unnamed_addr constant [8 x i8] c"%g %s');
    });
});
