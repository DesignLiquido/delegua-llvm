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
        expect(resultado).toContain('call i32 (i8*, ...) @escreva(i8* getelementptr inbounds ([5 x i8], [5 x i8]* @fmt, i32 0, i32 0), double 1.230000e+02)');
    });

    it('Escreva', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar(['escreva(123, "teste")']);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('@fmt = private unnamed_addr constant [8 x i8] c"%g %s')
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
            expect(resultado).toContain('call i8* @leia')
            expect(resultado).toContain('store i8* %0, i8** %nome, align 8')
        });

        it('Leia e escreva', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var idade: número = numero(leia("Digite sua idade: "))',
                'escreva(idade)'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('call i8* @leia')
            expect(resultado).toContain('call double @numero(i8* %0)')
            expect(resultado).toContain('store double %1, double* %idade, align 8')
            expect(resultado).toContain('call i32 (i8*, ...) @escreva')
        });
    });

    describe('Se', () => {
        it('Simples com senão', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var idade: inteiro = 18',
                'se (idade >= 18) {',
                '    escreva("maior de idade");',
                '} senao {',
                '    escreva("menor de idade");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('fcmp oge double');
            expect(resultado).toContain('se_entao:');
            expect(resultado).toContain('se_senao:');
            expect(resultado).toContain('se_apos:');
            expect(resultado).toContain('br i1 %1, label %se_entao, label %se_senao');
            expect(resultado).toContain('call i32 (i8*, ...) @escreva');
        });

        it('Sem senão', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var nota: inteiro = 7',
                'se (nota >= 6) {',
                '    escreva("Aprovado");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('fcmp oge double');
            expect(resultado).toContain('se_entao:');
            expect(resultado).toContain('se_senao:');
            expect(resultado).toContain('se_apos:');
            expect(resultado).toContain('br i1');
            expect(resultado).toContain('call i32 (i8*, ...) @escreva');
        });

        it('Com senão se', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var nota: inteiro = 7',
                'se (nota >= 9) {',
                '    escreva("Excelente");',
                '} senao se (nota >= 7) {',
                '    escreva("Bom");',
                '} senao {',
                '    escreva("Insuficiente");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('fcmp oge double');
            expect(resultado).toContain('se_entao:');
            expect(resultado).toContain('se_senao:');
            expect(resultado).toContain('se_apos:');
            expect(resultado).toContain('call i32 (i8*, ...) @escreva');
        });

        it('Múltiplos senão se', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var nota: inteiro = 8',
                'se (nota >= 9) {',
                '    escreva("A");',
                '} senao se (nota >= 8) {',
                '    escreva("B");',
                '} senao se (nota >= 7) {',
                '    escreva("C");',
                '} senao se (nota >= 6) {',
                '    escreva("D");',
                '} senao {',
                '    escreva("F");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('fcmp oge double');
            expect(resultado).toContain('se_entao:');
            expect(resultado).toContain('se_senao:');
            expect(resultado).toContain('se_apos:');
            expect(resultado).toContain('call i32 (i8*, ...) @escreva');
        });

        it('Operador menor que', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var temperatura: inteiro = 15',
                'se (temperatura < 20) {',
                '    escreva("Frio");',
                '} senao {',
                '    escreva("Quente");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('fcmp olt double');
            expect(resultado).toContain('se_entao:');
            expect(resultado).toContain('se_senao:');
            expect(resultado).toContain('se_apos:');
        });

        it('Operador igual', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var x: inteiro = 10',
                'se (x == 10) {',
                '    escreva("Igual a dez");',
                '} senao {',
                '    escreva("Diferente de dez");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('fcmp oeq double');
            expect(resultado).toContain('se_entao:');
            expect(resultado).toContain('se_senao:');
            expect(resultado).toContain('se_apos:');
        });

        it('Operador menor ou igual', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var saldo: inteiro = 100',
                'se (saldo <= 100) {',
                '    escreva("Saldo baixo");',
                '} senao {',
                '    escreva("Saldo alto");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('fcmp ole double');
            expect(resultado).toContain('se_entao:');
            expect(resultado).toContain('se_senao:');
            expect(resultado).toContain('se_apos:');
        });

        it('Operador maior que', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var pontuacao: inteiro = 85',
                'se (pontuacao > 80) {',
                '    escreva("Pontuação alta");',
                '} senao {',
                '    escreva("Pontuação baixa");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('fcmp ogt double');
            expect(resultado).toContain('se_entao:');
            expect(resultado).toContain('se_senao:');
            expect(resultado).toContain('se_apos:');
        });

        it('Operador diferente', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var status: inteiro = 1',
                'se (status != 0) {',
                '    escreva("Ativo");',
                '} senao {',
                '    escreva("Inativo");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('fcmp one double');
            expect(resultado).toContain('se_entao:');
            expect(resultado).toContain('se_senao:');
            expect(resultado).toContain('se_apos:');
        });

        it('Se aninhado', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var idade: inteiro = 20',
                'var estudante: inteiro = 1',
                'se (idade >= 18) {',
                '    se (estudante == 1) {',
                '        escreva("Adulto estudante");',
                '    } senao {',
                '        escreva("Adulto não estudante");',
                '    }',
                '} senao {',
                '    escreva("Menor de idade");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('fcmp oge double');
            expect(resultado).toContain('fcmp oeq double');
            expect(resultado).toContain('se_entao:');
            expect(resultado).toContain('se_senao:');
            expect(resultado).toContain('se_apos:');
        });
    })

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
            expect(resultado).toContain('call i32 (i8*, ...) @escreva');
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

            expect(resultado).toContain('call i32 (i8*, ...) @escreva');
        });
    });

    describe('Escolha', () => {
        it('Escolha básica com casos numéricos', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'escolha (1) {',
                '    caso 1:',
                '        escreva("um");',
                '    caso 2:',
                '        escreva("dois");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('escolha_caso_');
            expect(resultado).toContain('escolha_apos');
            expect(resultado).toContain('escolha_corpo_');
        });

        it('Escolha com caso padrão', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'escolha (3) {',
                '    caso 1:',
                '        escreva("um");',
                '    caso 2:',
                '        escreva("dois");',
                '    padrao:',
                '        escreva("outro");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('escolha_caso_');
            expect(resultado).toContain('escolha_padrao');
            expect(resultado).toContain('escolha_apos');
        });

        it('Múltiplos casos compartilhando bloco', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'escolha (2) {',
                '    caso 1:',
                '    caso 2:',
                '        escreva("um ou dois");',
                '    caso 3:',
                '        escreva("tres");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('escolha_caso_');
            expect(resultado).toContain('escolha_apos');
        });

        it('Escolha com variável', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var x = 2',
                'escolha (x) {',
                '    caso 1:',
                '        escreva("um");',
                '    caso 2:',
                '        escreva("dois");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('escolha_caso_');
            expect(resultado).toContain('escolha_apos');
            expect(resultado).toContain('fcmp oeq double');
        });

        it('Escolha aninhada dentro de escolha', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var x = 1',
                'var y = 2',
                'escolha (x) {',
                '    caso 1:',
                '        escolha (y) {',
                '            caso 1:',
                '                escreva("x=1, y=1");',
                '            caso 2:',
                '                escreva("x=1, y=2");',
                '        }',
                '    caso 2:',
                '        escreva("x=2");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('escolha_caso_');
            expect(resultado).toContain('escolha_apos');
        });

        it('Escolha com se aninhado', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var x = 1',
                'var y = 10',
                'escolha (x) {',
                '    caso 1:',
                '        se (y > 5) {',
                '            escreva("x=1 e y>5");',
                '        } senao {',
                '            escreva("x=1 e y<=5");',
                '        }',
                '    caso 2:',
                '        escreva("x=2");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('escolha_caso_');
            expect(resultado).toContain('se_entao');
            expect(resultado).toContain('se_senao');
            expect(resultado).toContain('fcmp ogt double');
        });

        it('Se com escolha aninhada', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var condicao = 1',
                'var opcao = 2',
                'se (condicao > 0) {',
                '    escolha (opcao) {',
                '        caso 1:',
                '            escreva("opcao 1");',
                '        caso 2:',
                '            escreva("opcao 2");',
                '        padrao:',
                '            escreva("outra opcao");',
                '    }',
                '} senao {',
                '    escreva("condicao falsa");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('se_entao');
            expect(resultado).toContain('se_senao');
            expect(resultado).toContain('escolha_caso_');
            expect(resultado).toContain('escolha_padrao');
        });

        it('Escolha dentro de loop para', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'para (var i = 1; i <= 3; i++) {',
                '    escolha (i) {',
                '        caso 1:',
                '            escreva("primeiro");',
                '        caso 2:',
                '            escreva("segundo");',
                '        caso 3:',
                '            escreva("terceiro");',
                '    }',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('para_cabeca');
            expect(resultado).toContain('para_corpo');
            expect(resultado).toContain('escolha_caso_');
            expect(resultado).toContain('escolha_apos');
        });

        it('Escolha tripla aninhada', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var a = 1',
                'var b = 2',
                'var c = 3',
                'escolha (a) {',
                '    caso 1:',
                '        escolha (b) {',
                '            caso 2:',
                '                escolha (c) {',
                '                    caso 3:',
                '                        escreva("a=1, b=2, c=3");',
                '                    padrao:',
                '                        escreva("a=1, b=2, c!=3");',
                '                }',
                '            padrao:',
                '                escreva("a=1, b!=2");',
                '        }',
                '    padrao:',
                '        escreva("a!=1");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('escolha_caso_');
            expect(resultado).toContain('escolha_padrao');
            expect(resultado).toContain('escolha_apos');
        });

        it('Escolha com múltiplas operações em cada caso', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var x = 1',
                'escolha (x) {',
                '    caso 1:',
                '        escreva("inicio caso 1");',
                '        escreva("fim caso 1");',
                '    caso 2:',
                '        escreva("inicio caso 2");',
                '        escreva("meio caso 2");',
                '        escreva("fim caso 2");',
                '    padrao:',
                '        escreva("caso padrao");',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('escolha_caso_');
            expect(resultado).toContain('escolha_padrao');
            expect(resultado).toContain('call i32 (i8*, ...) @escreva');
        });
    });

    describe('Constantes', () => {
        it('Declaração de constante com tipo inferido (número)', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'const pi = 3.14',
                'escreva(pi)'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('%pi = alloca double, align 8');
            expect(resultado).toContain('store double');
            expect(resultado).toContain('call i32 (i8*, ...) @escreva');
        });

        it('Declaração de constante com tipo explícito inteiro', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'const idade: inteiro = 25',
                'escreva(idade)'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('%idade = alloca i32, align 4');
            expect(resultado).toContain('store i32');
            expect(resultado).toContain('call i32 (i8*, ...) @escreva');
        });

        it('Declaração de constante com tipo explícito texto', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'const nome: texto = "Delegua"',
                'escreva(nome)'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('%nome = alloca i8*, align 8');
            expect(resultado).toContain('store i8*');
            expect(resultado).toContain('call i32 (i8*, ...) @escreva');
        });

        it('Reatribuição de constante deve lançar erro', async () => {
            const compilador = new CompiladorLLVM();
            
            await expect(compilador.compilar([
                'const valor = 10',
                'valor = 20'
            ])).rejects.toThrow("Não é possível reatribuir a constante 'valor'.");
        });

        it('Constante em expressão aritmética', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'const a = 5',
                'const b = 3',
                'var resultado = a + b',
                'escreva(resultado)'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('%a = alloca double, align 8');
            expect(resultado).toContain('%b = alloca double, align 8');
            expect(resultado).toContain('%resultado = alloca double, align 8');
            expect(resultado).toContain('fadd double');
        });

        it('Constante usada em condicional', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'const limite: inteiro = 18',
                'var idade: inteiro = 20',
                'se (idade >= limite) {',
                '    escreva("maior de idade")',
                '}'
            ]);

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('%limite = alloca i32, align 4');
            expect(resultado).toContain('se_entao:');
            expect(resultado).toContain('se_apos:');
        });
    });

    describe('Exceções', () => {
        it('Trivial', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'tente {  ',
                '  falhar "falhou"',
                '  escreva("sucesso")',
                '} pegue {',
                '  escreva("Ocorreu uma exceção.")',
                '} finalmente {',
                '  escreva("Ocorrendo exceção ou não, eu sempre executo")',
                '}'
            ])

            expect(resultado).toBeTruthy()
            expect(resultado).toContain('tente_corpo');
            expect(resultado).toContain('falhar_normal');
            expect(resultado).toContain('tente_apos');
            expect(resultado).toContain('finalmente_corpo');
            expect(resultado).toContain('pegue_corpo');
            expect(resultado).toContain('pegue_landing');
            expect(resultado).toContain('pegue_corpo');
            expect(resultado).toContain('declare i32 @__gxx_personality_v0(i32, i32, i64, i8*, i8*)');
        })

        it('Try-catch simples (sem finally)', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'tente {',
                '  falhar "erro"',
                '  escreva("sucesso")',
                '} pegue {',
                '  escreva("Exceção capturada")',
                '}'
            ])

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('tente_corpo');
            expect(resultado).toContain('pegue_corpo');
            expect(resultado).toContain('pegue_landing');
            expect(resultado).toContain('tente_apos');
            expect(resultado).not.toContain('finalmente_corpo');
            expect(resultado).toContain('declare i32 @__gxx_personality_v0(i32, i32, i64, i8*, i8*)');
        })

        it('Try-catch com parâmetro de erro', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'tente {',
                '  falhar "Erro ocorrido"',
                '} pegue (erro) {',
                '  escreva(erro)',
                '}'
            ])

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('tente_corpo');
            expect(resultado).toContain('pegue_corpo');
            expect(resultado).toContain('pegue_landing');
            expect(resultado).toContain('call i8* @__cxa_begin_catch');
            expect(resultado).toContain('call void @__cxa_end_catch');
            expect(resultado).toContain('declare i32 @__gxx_personality_v0(i32, i32, i64, i8*, i8*)');
        })

        it('Try-catch-finally com parâmetro de erro', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'tente {',
                '  falhar "Erro ocorrido"',
                '} pegue (erro) {',
                '  escreva(erro)',
                '} finalmente {',
                '  escreva("Sempre executa")',
                '}'
            ])

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('tente_corpo');
            expect(resultado).toContain('pegue_corpo');
            expect(resultado).toContain('pegue_landing');
            expect(resultado).toContain('finalmente_corpo');
            expect(resultado).toContain('tente_apos');
            expect(resultado).toContain('call i8* @__cxa_begin_catch');
            expect(resultado).toContain('call void @__cxa_end_catch');
            expect(resultado).toContain('declare i32 @__gxx_personality_v0(i32, i32, i64, i8*, i8*)');
        })

        it('Try apenas com finally (sem catch)', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'tente {',
                '  escreva("tentando")',
                '} finalmente {',
                '  escreva("Sempre executa")',
                '}'
            ])

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('tente_corpo');
            expect(resultado).toContain('finalmente_corpo');
            expect(resultado).toContain('tente_apos');
            expect(resultado).not.toContain('pegue_corpo');
            expect(resultado).toContain('pegue_landing');
            expect(resultado).toContain('relancar_excecao');

        })

        it('Try com sucesso (sem exceção)', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'tente {',
                '  escreva("sucesso")',
                '} pegue {',
                '  escreva("Exceção")',
                '}'
            ])

            expect(resultado).toBeTruthy();
            expect(resultado).toContain('tente_corpo');
            expect(resultado).toContain('tente_apos');
            expect(resultado).toContain('pegue_corpo');
            expect(resultado).toContain('pegue_landing');
            expect(resultado).toContain('call i32 (i8*, ...) @escreva');
            expect(resultado).toContain('declare i32 @__gxx_personality_v0(i32, i32, i64, i8*, i8*)');
        })

        it('Try aninhado', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'tente {',
                '  tente {',
                '    falhar "erro interno"',
                '  } pegue {',
                '    escreva("Erro interno capturado")',
                '  }',
                '} pegue {',
                '  escreva("Erro externo capturado")',
                '}'
            ])

            expect(resultado).toBeTruthy();
            // Deve ter múltiplos blocos tente_corpo e pegue_landing
            const matchesTenteCorpo = (resultado.match(/tente_corpo/g) || []).length;
            const matchesPegueLanding = (resultado.match(/pegue_landing/g) || []).length;
            expect(matchesTenteCorpo).toBeGreaterThanOrEqual(2);
            expect(matchesPegueLanding).toBeGreaterThanOrEqual(2);
            expect(resultado).toContain('pegue_corpo');
            expect(resultado).toContain('declare i32 @__gxx_personality_v0(i32, i32, i64, i8*, i8*)');
        })

        it('Falhar sem try-catch', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'falhar "mensagem de erro"'
            ])

            expect(resultado).toBeTruthy();
            // Quando não há try-catch, falhar deve usar call direto, não invoke
            expect(resultado).toContain('call void @falhar');
            expect(resultado).not.toContain('invoke void @falhar');
            expect(resultado).not.toContain('pegue_landing');
        })
    })
});

