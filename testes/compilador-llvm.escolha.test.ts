/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Escolha', () => {
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
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
    });

    it('Escolha com discriminante inteiro usa instrução switch nativa do LLVM', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao classificar(n: inteiro): inteiro {',
            '    var resultado: inteiro = 0',
            '    escolha (n) {',
            '        caso 1:',
            '            resultado = 10',
            '        caso 2:',
            '            resultado = 20',
            '        caso 3:',
            '            resultado = 30',
            '    }',
            '    retorna resultado',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        // Instrução switch nativa: sem blocos de comparação icmp.
        expect(resultado).toContain('switch i32');
        expect(resultado).toContain('escolha_corpo_');
        expect(resultado).toContain('escolha_apos');
        expect(resultado).not.toContain('escolha_caso_');
    });

    it('Escolha com discriminante inteiro e caso padrão usa switch nativa com destino padrão', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao rotulo(n: inteiro): inteiro {',
            '    var r: inteiro = 0',
            '    escolha (n) {',
            '        caso 1:',
            '            r = 1',
            '        caso 2:',
            '            r = 2',
            '        padrao:',
            '            r = 99',
            '    }',
            '    retorna r',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('switch i32');
        expect(resultado).toContain('escolha_padrao');
        expect(resultado).toContain('escolha_apos');
        expect(resultado).not.toContain('escolha_caso_');
    });
});
