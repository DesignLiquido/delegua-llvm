import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador', () => {
    it('Trivial', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([]);
        expect(resultado).toBeTruthy();
    });

    it('Escreva', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar(['escreva(123)']);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('%printf = call i32 (i8*, ...) @printf(i8* getelementptr inbounds ([4 x i8], [4 x i8]* @\"formato_printf_n\\C3\\BAmero\", i32 0, i32 0), double 1.230000e+02)');
    });

    describe('Funções', () => {
        it('Quadrado, número', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao quadrado(n: numero): numero {',
                '    retorna n * n',
                '}'
            ]);
            
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define double @quadrado(double %0)');
            expect(resultado).toContain('  %1 = fmul double %0, %0');
            expect(resultado).toContain('  ret double %1');
        });

        it('Soma, inteiro', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao soma(a: inteiro, b: inteiro): inteiro {',
                '    retorna a + b',
                '}'
            ]);
            
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @soma(i32 %0, i32 %1)');
            expect(resultado).toContain('  %2 = add i32 %0, %1');
            expect(resultado).toContain('  ret i32 %2');
        });

        it('Soma, inteiro com número', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao soma(a: inteiro, b: número): número {',
                '    retorna a + b',
                '}'
            ]);
            
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define double @soma(i32 %0, double %1)');
            expect(resultado).toContain('  %2 = sitofp i32 %0 to double');
            expect(resultado).toContain('  %3 = fadd double %2, %1');
            expect(resultado).toContain('  ret double %3');
        });

        it('Subtração, inteiro', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao subtracao(a: inteiro, b: inteiro): inteiro {',
                '    retorna a - b',
                '}'
            ]);
            
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @subtracao(i32 %0, i32 %1)');
            expect(resultado).toContain('  %2 = sub i32 %0, %1');
            expect(resultado).toContain('  ret i32 %2');
        });

        it('Divisão inteira, inteiro', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao divisao_inteira(a: inteiro, b: inteiro): inteiro {',
                '    retorna a \\ b',
                '}'
            ]);
            
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @divisao_inteira(i32 %0, i32 %1)');
            expect(resultado).toContain('  %2 = sdiv i32 %0, %1');
            expect(resultado).toContain('  ret i32 %2');
        });

        it('Operações encadeadas, operandos inteiros', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao encadeadas(a: inteiro, b: inteiro, c: inteiro): inteiro {',
                '    retorna a + b + c',
                '}'
            ]);
            
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @encadeadas(i32 %0, i32 %1, i32 %2)');
            expect(resultado).toContain('  %3 = add i32 %0, %1');
            expect(resultado).toContain('  %4 = add i32 %3, %2');
            expect(resultado).toContain('  ret i32 %4');
        });

        it('Operações encadeadas, operandos inteiros e números', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao encadeadas(a: inteiro, b: número, c: inteiro): número {',
                '    retorna a + b + c',
                '}'
            ]);
            
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define double @encadeadas(i32 %0, double %1, i32 %2)');
            expect(resultado).toContain('  %3 = sitofp i32 %0 to double');
            expect(resultado).toContain('  %4 = fadd double %3, %1');
            expect(resultado).toContain('  %5 = sitofp i32 %2 to double');
            expect(resultado).toContain('  %6 = fadd double %4, %5');
            expect(resultado).toContain('  ret double %6');
        });

        it('Chamada de função, inteiro', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao soma(a: inteiro, b: inteiro): inteiro {',
                '    retorna a + b',
                '}',
                'var c = soma(1, 2)'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @soma(i32 %0, i32 %1)');
            expect(resultado).toContain('  %2 = add i32 %0, %1');
            expect(resultado).toContain('  ret i32 %2');
            expect(resultado).toContain('  %c = alloca i32, align 4');
            expect(resultado).toContain('  %0 = call i32 @soma(i32 1, i32 2)');
            expect(resultado).toContain('  store i32 %0, i32* %c, align 4');
        });

        it('Chamada de função, número', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'funcao soma(a: inteiro, b: número): número {',
                '    retorna a + b',
                '}',
                'var c = soma(1, 2)'
            ]);

            expect(resultado).toBeTruthy();
        });
    });

    describe('Leia', () => {
        it('Leia texto com prompt', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var nome: texto = leia("Digite seu nome")'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('declare i32 @scanf(i8*, ...)');
            expect(resultado).toContain('declare i32 @puts(i8*)');
            expect(resultado).toContain('call i32 @puts');
            expect(resultado).toContain('%temp_leia = alloca i8*');
            expect(resultado).toContain('call i32 (i8*, ...) @scanf');
            expect(resultado).toContain('%valor_lido = load i8*, i8** %temp_leia');
        });

        it('Leia e escreva', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var idade: texto = leia("Digite sua idade")',
                'escreva(idade)'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('call i32 @puts');
            expect(resultado).toContain('call i32 (i8*, ...) @scanf');
            expect(resultado).toContain('call i32 (i8*, ...) @printf');
        });
    });

    describe('Para', () => {
        it('Laço simples', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'para (var i = 1; i <= 10000; i++) {',
                '    escreva(i);',
                '}'
            ]);

            expect(resultado).toBeTruthy();

            expect(resultado).toContain('%i = alloca double, align 8');
            expect(resultado).toContain('store double 1.000000e+00, double* %i, align 8');
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
            expect(resultado).toContain('call i32 (i8*, ...) @printf');
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
            expect(resultado).toContain('store double 1.000000e+00, double* %i, align 8');
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

            expect(resultado).toContain('call i32 (i8*, ...) @printf');
        });
    });
});

