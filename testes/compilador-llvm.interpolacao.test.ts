/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Interpolação de Texto (Fase 3)', () => {
    it('interpola variável número no meio de um texto', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var tempo: número = 42',
            'escreva("Tempo gasto: ${tempo} minutos")',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('@delegua_formatar');
        expect(resultado).toContain('fmt_interp');
    });

    it('interpola variável inteiro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var distancia: inteiro = 30',
            'escreva("Distância: ${distancia} km")',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('@delegua_formatar');
        // inteiro usa formato %d
        expect(resultado).toContain('%d');
    });

    it('interpola variável texto', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var nome: texto = "Mundo"',
            'escreva("Olá, ${nome}!")',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('@delegua_formatar');
        // texto usa formato %s
        expect(resultado).toContain('%s');
    });

    it('interpola múltiplas variáveis', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var a: inteiro = 1',
            'var b: inteiro = 2',
            'escreva("${a} + ${b}")',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('@delegua_formatar');
    });

    it('string sem interpolação não chama delegua_formatar', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'escreva("Olá, Mundo!")',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).not.toContain('call ptr @delegua_formatar');
    });

    it('interpola variável no início do texto', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var x: número = 3.14',
            'escreva("${x} é pi")',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('@delegua_formatar');
    });

    it('lança erro para variável inexistente na interpolação', async () => {
        const compilador = new CompiladorLLVM();
        await expect(
            compilador.compilar(['escreva("valor: ${inexistente}")'])
        ).rejects.toThrow("inexistente");
    });
});
