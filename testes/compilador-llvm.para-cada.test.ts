import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Para Cada', () => {
    it('Iteração sobre vetor de inteiros', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var v: inteiro[] = [1, 2, 3];',
            'para cada elemento em v {',
            '    escreva(elemento);',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('para_cada_cab');
        expect(resultado).toContain('para_cada_corpo');
        expect(resultado).toContain('para_cada_inc');
        expect(resultado).toContain('para_cada_apos');
        expect(resultado).toContain('icmp slt i32');
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
    });

    it('Iteração sobre vetor de textos', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var palavras: texto[] = ["ola", "mundo"];',
            'para cada p em palavras {',
            '    escreva(p);',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('para_cada_cab');
        expect(resultado).toContain('para_cada_corpo');
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
    });

    it('Iteração sobre texto (caracteres)', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var t: texto = "abc";',
            'para cada c em t {',
            '    escreva(c);',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('para_cada_cab');
        expect(resultado).toContain('strlen');
        expect(resultado).toContain('para_cada_apos');
    });

    it('Sustar dentro de para cada', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var v: inteiro[] = [1, 2, 3];',
            'para cada elemento em v {',
            '    sustar;',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('para_cada_apos');
        expect(resultado).toContain('sustar_morto');
    });
});
