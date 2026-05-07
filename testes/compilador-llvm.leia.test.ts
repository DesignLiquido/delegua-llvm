/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Leia', () => {
    it('Leia texto com prompt', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var nome: texto = leia("Digite seu nome")'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('call ptr @leia');
        expect(resultado).toContain('store ptr %0, ptr %nome, align 8');
    });

    it('Leia e escreva', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var idade: número = numero(leia("Digite sua idade: "))',
            'escreva(idade)'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('call ptr @leia');
        expect(resultado).toContain('call double @numero(ptr %0)');
        expect(resultado).toContain('store double %1, ptr %idade, align 8');
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
    });
});
