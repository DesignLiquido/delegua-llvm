import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Para', () => {
    it('Laço simples', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'para (var i = 1; i <= 10000; i++) {',
            '    escreva(i);',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('%i = alloca double, align 8');
        expect(resultado).toContain('store double 1.000000e+00, ptr %i, align 8');
        expect(resultado).toContain('br label %para_cabeca');
        expect(resultado).toContain('para_cabeca:');
        expect(resultado).toContain('para_corpo:');
        expect(resultado).toContain('para_incremento:');
        expect(resultado).toContain('para_apos:');
        expect(resultado).toContain('fcmp ole double');
        expect(resultado).toContain('1.000000e+04');
        expect(resultado).toContain('br i1 %0, label %para_corpo, label %para_apos');
        expect(resultado).toContain('fadd double');
        expect(resultado).toContain('1.000000e+00');
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
    });

    it('Laço com condicional', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'para (var i = 1; i <= 10000; i++) {',
            '    se (i % 2 == 0) {',
            '        escreva("par");',
            '    } senao {',
            '        escreva("impar");',
            '    }',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('%i = alloca double, align 8');
        expect(resultado).toContain('store double 1.000000e+00, ptr %i, align 8');
        expect(resultado).toContain('br label %para_cabeca');
        expect(resultado).toContain('para_cabeca:');
        expect(resultado).toContain('para_corpo:');
        expect(resultado).toContain('para_incremento:');
        expect(resultado).toContain('para_apos:');
        expect(resultado).toContain('fcmp ole double');
        expect(resultado).toContain('1.000000e+04');
        expect(resultado).toContain('br i1 %0, label %para_corpo, label %para_apos');
        expect(resultado).toContain('frem double');
        expect(resultado).toContain('2.000000e+00');
        expect(resultado).toContain('fcmp oeq double');
        expect(resultado).toContain('se_entao');
        expect(resultado).toContain('se_senao');
        expect(resultado).toContain('se_apos');
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
    });
});
