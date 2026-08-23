/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Operadores bit a bit, deslocamento e exponenciação', () => {
    it('exponenciação (**) chama pow e converte resultado de volta a inteiro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao potencia(a: inteiro, b: inteiro): inteiro {',
            '    retorna a ** b',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('declare double @pow(double, double)');
        expect(resultado).toContain('call double @pow(double');
        expect(resultado).toContain('fptosi double');
    });

    it('exponenciação (**) entre números permanece em ponto flutuante', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao potencia(a: número, b: número): número {',
            '    retorna a ** b',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('call double @pow(double');
        expect(resultado).not.toContain('fptosi double');
    });

    it('deslocamento à esquerda (<<) gera shl', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao deslocar(a: inteiro, b: inteiro): inteiro {',
            '    retorna a << b',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('shl i32');
    });

    it('deslocamento à direita (>>) gera ashr', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao deslocar(a: inteiro, b: inteiro): inteiro {',
            '    retorna a >> b',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('ashr i32');
    });

    it('E bit a bit (&) gera and', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao mascara(a: inteiro, b: inteiro): inteiro {',
            '    retorna a & b',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('and i32');
    });

    it('OU bit a bit (|) gera or', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao combinar(a: inteiro, b: inteiro): inteiro {',
            '    retorna a | b',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('or i32');
    });
});
