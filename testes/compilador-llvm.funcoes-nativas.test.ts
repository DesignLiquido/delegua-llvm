/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Funções Nativas (Fase 2)', () => {
    describe('aleatorio()', () => {
        it('gera chamada para @aleatorio sem argumentos', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var r: número = aleatorio()',
                'escreva(r)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('@aleatorio');
        });

        it('resultado de aleatorio() pode ser usado em expressão', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var r: número = aleatorio()',
                'se (r > 0.5) { escreva("alto") }',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('@aleatorio');
        });
    });

    describe('aleatorioEntre()', () => {
        it('gera chamada para @aleatorioEntre com dois argumentos', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var n: inteiro = aleatorioEntre(1, 10)',
                'escreva(n)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('@aleatorioEntre');
        });

        it('aleatorioEntre aceita variáveis como limites', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var a: número = 1',
                'var b: número = 100',
                'var n: inteiro = aleatorioEntre(a, b)',
                'escreva(n)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('@aleatorioEntre');
        });
    });

    describe('texto()', () => {
        it('converte número para texto', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var t: texto = texto(3.14)',
                'escreva(t)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('@texto_de_numero');
        });

        it('converte inteiro para texto sem notação científica', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var x: inteiro = 42',
                'var t: texto = texto(x)',
                'escreva(t)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('@texto_de_inteiro');
        });

        it('texto de texto retorna o valor diretamente sem chamada de conversão', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var s: texto = "olá"',
                'var t: texto = texto(s)',
                'escreva(t)',
            ]);
            expect(resultado).toBeTruthy();
            // Funções de conversão são declaradas mas não devem ser chamadas
            expect(resultado).not.toContain('call ptr @texto_de_numero');
            expect(resultado).not.toContain('call ptr @texto_de_inteiro');
        });
    });
});
