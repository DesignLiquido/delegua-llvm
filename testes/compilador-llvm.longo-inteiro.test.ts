/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

// `longo` (i64) com `inteiro` (i32) numa operação: o operando mais estreito é estendido.
describe('Compilador - aritmética entre longo e inteiro', () => {
    it('soma, subtração e comparação de longo com inteiro', async () => {
        const ir = await new CompiladorLLVM().compilar([
            'var tempo = importar("tempo")',
            'var limite: inteiro = 500',
            'var fim = tempo.monotonicoMilissegundos() + limite',
            'var restante = fim - tempo.monotonicoMilissegundos()',
            'se restante > limite {',
            '    escreva("maior")',
            '}',
        ]);
        expect(ir).toContain('sext i32');
        expect(ir).not.toMatch(/add nsw i64 %\d+, i32/);
    });

    it('variável inteiro com retorno longo dentro de função', async () => {
        const ir = await new CompiladorLLVM().compilar([
            'funcao restante(limiteMs: inteiro): inteiro {',
            '    var tempo = importar("tempo")',
            '    var limite: inteiro = tempo.monotonicoMilissegundos() + limiteMs',
            '    var agora: inteiro = limite - tempo.monotonicoMilissegundos()',
            '    retorna agora',
            '}',
            'escreva(restante(10))',
        ]);
        expect(ir).toBeTruthy();
    });
});
