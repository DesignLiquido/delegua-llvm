import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Leia', () => {
    it('Leia texto com prompt', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var nome: texto = leia("Digite seu nome")'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('call i8* @leia');
        expect(resultado).toContain('store i8* %0, i8** %nome, align 8');
    });

    it('Leia e escreva', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var idade: número = numero(leia("Digite sua idade: "))',
            'escreva(idade)'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('call i8* @leia');
        expect(resultado).toContain('call double @numero(i8* %0)');
        expect(resultado).toContain('store double %1, double* %idade, align 8');
        expect(resultado).toContain('call i32 (i8*, ...) @escreva');
    });
});
