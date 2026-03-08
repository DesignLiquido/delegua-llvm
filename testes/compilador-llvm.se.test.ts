import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Se', () => {
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
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
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
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
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
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
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
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
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
});
