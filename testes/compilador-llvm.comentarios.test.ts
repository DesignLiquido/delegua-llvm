import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Comentários', () => {
    it('Comentário de linha única não interfere na compilação', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            '// Este é um comentário',
            'var x: inteiro = 10',
            'escreva(x)'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('%x = alloca i32, align 4');
        expect(resultado).toContain('call i32 (i8*, ...) @escreva');
    });

    it('Comentário entre declarações não interfere na compilação', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var a: inteiro = 5',
            '// comentário entre declarações',
            'var b: inteiro = 3',
            'escreva(a)'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('%a = alloca i32, align 4');
        expect(resultado).toContain('%b = alloca i32, align 4');
        expect(resultado).toContain('call i32 (i8*, ...) @escreva');
    });

    it('Comentário dentro de função não interfere na compilação', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao quadrado(n: inteiro): inteiro {',
            '    // calcula o quadrado de n',
            '    retorna n * n',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define i32 @quadrado(i32 %0)');
        expect(resultado).toContain('mul i32');
        expect(resultado).toContain('ret i32');
    });
});
