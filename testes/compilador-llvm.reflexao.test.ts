/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Reflexão (eInstanciaDe)', () => {
    it('instância verificada contra a própria classe gera comparação de id', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Animal {',
            '    construtor() { }',
            '}',
            'var a: Animal = Animal()',
            'escreva(a.eInstanciaDe(Animal))',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('icmp eq');
        expect(resultado).toContain('tipo_id_receptor');
    });

    it('subclasse verificada contra a superclasse inclui o id da subclasse na comparação', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Animal {',
            '    construtor() { }',
            '}',
            'classe Cachorro herda Animal {',
            '}',
            'var c: Cachorro = Cachorro()',
            'escreva(c.eInstanciaDe(Animal))',
        ]);

        expect(resultado).toBeTruthy();
        // Deve comparar contra os ids de Animal e de Cachorro (duas classes descendentes).
        expect(resultado).toContain('icmp eq');
        expect(resultado).toContain('or i1');
    });

    it('classe estampa o id no campo oculto ao instanciar', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Animal {',
            '    construtor() { }',
            '}',
            'var a: Animal = Animal()',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('tipo_id_ptr');
        expect(resultado).toContain('store i32 0');
    });

    it('eInstanciaDe com argumento que não é uma classe conhecida lança erro', async () => {
        const compilador = new CompiladorLLVM();

        await expect(
            compilador.compilar([
                'classe Animal {',
                '    construtor() { }',
                '}',
                'var a: Animal = Animal()',
                'var x: inteiro = 5',
                'escreva(a.eInstanciaDe(x))',
            ])
        ).rejects.toThrow(/eInstanciaDe espera o nome de uma classe conhecida/);
    });
});
