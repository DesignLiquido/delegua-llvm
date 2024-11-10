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
            'funcao quadrado(n) {',
            '    retorna n * n',
            '}'
        ]);
        expect(resultado).toBeTruthy();
    });
});
