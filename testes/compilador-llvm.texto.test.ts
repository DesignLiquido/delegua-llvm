import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Métodos de Texto', () => {
    it('maiusculo', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var t: texto = "ser ou não ser"',
            'escreva(t.maiusculo())',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('@delegua_texto_maiusculo');
    });

    it('minusculo', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var t: texto = "SER OU NÃO SER"',
            'escreva(t.minusculo())',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('@delegua_texto_minusculo');
    });

    it('inclui', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var t: texto = "Ser ou não ser, eis a questão"',
            'escreva(t.inclui("ser"))',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('@delegua_texto_inclui');
    });

    it('subtexto', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var t: texto = "Ser ou não ser, eis a questão"',
            'escreva(t.subtexto(0, 3))',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('@delegua_texto_subtexto');
    });

    it('substituir', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var t: texto = "Ser ou não ser"',
            'escreva(t.substituir("Ser", "Salmão"))',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('@delegua_texto_substituir');
    });

    it('Erro para método de texto desconhecido', async () => {
        const compilador = new CompiladorLLVM();
        await expect(
            compilador.compilar([
                'var t: texto = "olá"',
                't.inexistente()',
            ])
        ).rejects.toThrow("Método de texto 'inexistente' não implementado.");
    });
});
