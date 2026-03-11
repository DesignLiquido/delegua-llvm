import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Longo', () => {
    it('Declaração de variável longo', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var x: longo = 1000000000'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('%x = alloca i64');
        expect(resultado).toContain('store i64');
    });

    it('Literal longo em escreva usa formato %ld', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var x: longo = 9999999999',
            'escreva(x)'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('%x = alloca i64');
        expect(resultado).toContain('%ld');
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
    });

    it('Função com parâmetro e retorno longo', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao dobro(n: longo): longo {',
            '    retorna n + n',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define i64 @dobro(i64 %0)');
        expect(resultado).toContain('add nsw i64');
        expect(resultado).toContain('ret i64');
    });

    it('Aritmética com longo', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao soma(a: longo, b: longo): longo {',
            '    retorna a + b',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define i64 @soma(i64 %0, i64 %1)');
        expect(resultado).toContain('  %2 = add nsw i64 %0, %1');
        expect(resultado).toContain('  ret i64 %2');
    });

    it('Subtração com longo', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao diferenca(a: longo, b: longo): longo {',
            '    retorna a - b',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define i64 @diferenca(i64 %0, i64 %1)');
        expect(resultado).toContain('sub nsw i64');
        expect(resultado).toContain('ret i64');
    });

    it('Chamada de função longo', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao identidade(n: longo): longo {',
            '    retorna n',
            '}',
            'var r: longo = identidade(42)'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define i64 @identidade(i64 %0)');
        expect(resultado).toContain('%r = alloca i64');
        expect(resultado).toContain('call i64 @identidade');
    });

    it('Constante longo', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'const max: longo = 9000000000',
            'escreva(max)'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('%max = alloca i64');
        expect(resultado).toContain('store i64');
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
    });
});
