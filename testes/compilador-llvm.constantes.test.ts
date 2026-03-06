import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Constantes', () => {
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
