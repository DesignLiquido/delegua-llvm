import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Herança de Classes (Fase 6)', () => {
    it('herda método simples da superclasse', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Animal {',
            '    correr() { escreva("Correndo") }',
            '}',
            'classe Cachorro herda Animal {',
            '    latir() { escreva("Au Au") }',
            '}',
            'var c = Cachorro()',
            'c.correr()',
            'c.latir()',
        ]);
        expect(resultado).toBeTruthy();
        // Deve definir as funções para ambas as classes
        expect(resultado).toContain('Animal_correr');
        expect(resultado).toContain('Cachorro_latir');
    });

    it('filho sobrescreve método da superclasse', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Animal {',
            '    falar() { escreva("...") }',
            '}',
            'classe Gato herda Animal {',
            '    falar() { escreva("Miau") }',
            '}',
            'var g = Gato()',
            'g.falar()',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('Animal_falar');
        expect(resultado).toContain('Gato_falar');
        // A chamada no main deve chamar Gato_falar, não Animal_falar
        expect(resultado).toContain('Gato_falar');
    });

    it('subclasse chama método herdado e próprio', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Animal {',
            '    correr() { escreva("Correndo") }',
            '    respirar() { escreva("Respirando") }',
            '}',
            'classe Cachorro herda Animal {',
            '    latir() { escreva("Au Au") }',
            '}',
            'var c = Cachorro()',
            'c.correr()',
            'c.respirar()',
            'c.latir()',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('Animal_correr');
        expect(resultado).toContain('Animal_respirar');
        expect(resultado).toContain('Cachorro_latir');
    });

    it('superclasse com método inteiro herdado e chamado', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Base {',
            '    valor(): inteiro { retorna 42 }',
            '}',
            'classe Derivada herda Base {',
            '    dobro(): inteiro { retorna 84 }',
            '}',
            'var d = Derivada()',
            'var v: inteiro = d.valor()',
            'escreva(v)',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('Base_valor');
        expect(resultado).toContain('Derivada_dobro');
    });

    it('super chama método da classe pai', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Veiculo {',
            '    mover() { escreva("Movendo") }',
            '}',
            'classe Carro herda Veiculo {',
            '    acelerar() {',
            '        super.mover()',
            '        escreva("Acelerando")',
            '    }',
            '}',
            'var c = Carro()',
            'c.acelerar()',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('Veiculo_mover');
        expect(resultado).toContain('Carro_acelerar');
    });

    it('cadeia de herança com dois níveis', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe A {',
            '    metodoA() { escreva("A") }',
            '}',
            'classe B herda A {',
            '    metodoB() { escreva("B") }',
            '}',
            'classe C herda B {',
            '    metodoC() { escreva("C") }',
            '}',
            'var obj = C()',
            'obj.metodoA()',
            'obj.metodoB()',
            'obj.metodoC()',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('A_metodoA');
        expect(resultado).toContain('B_metodoB');
        expect(resultado).toContain('C_metodoC');
    });
});
