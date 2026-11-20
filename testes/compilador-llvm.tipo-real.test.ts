/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';
import { normalizarTipoReal } from '../fontes/ajudantes';

// O núcleo (1.27+) tipa literais com parte decimal como `real` e envolve em `real(...)` os
// retornos de funções `: real`. Para o compilador, `real` (e `decimal`) é `número` (double).
describe('Compilador - tipo real', () => {
    it('normalizarTipoReal troca real e decimal, inclusive em tipos compostos', () => {
        expect(normalizarTipoReal('real')).toBe('número');
        expect(normalizarTipoReal('decimal[]')).toBe('número[]');
        expect(normalizarTipoReal('função<real>')).toBe('função<número>');
        expect(normalizarTipoReal('Realidade')).toBe('Realidade');
        expect(normalizarTipoReal('irreal')).toBe('irreal');
    });

    it('compila literais decimais, variáveis, vetores e funções real', async () => {
        const ir = await new CompiladorLLVM().compilar([
            'funcao dobro(a: real): real {',
            '    retorna a * 2',
            '}',
            'var x = 2.5',
            'var y: real = 1.25',
            'var v: real[] = [0.5, 1.5]',
            'escreva(dobro(x) + y + v[1])',
        ]);
        expect(ir).toMatch(/define double @dobro\(double/);
    });

    it('real(x) converte inteiro para double', async () => {
        const ir = await new CompiladorLLVM().compilar(['var n: inteiro = 3', 'var r = real(n)', 'escreva(r)']);
        expect(ir).toContain('sitofp');
    });
});
