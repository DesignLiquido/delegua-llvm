/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Despacho dinâmico de métodos', () => {
    it('chamada por variável da superclasse passa pela função de despacho', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Animal {',
            '    nome(): texto { retorna "animal" }',
            '}',
            'classe Ave herda Animal {',
            '    nome(): texto { retorna "ave" }',
            '}',
            'funcao mostrar(a: Animal) { escreva(a.nome()) }',
            'mostrar(Ave())',
        ]);

        expect(resultado).toContain('define internal ptr @__despacho_Animal_nome(ptr %0)');
        expect(resultado).toContain('switch i32 %tipo_id');
        expect(resultado).toContain('call ptr @Ave_nome(ptr %0)');
        expect(resultado).toContain('call ptr @Animal_nome(ptr %0)');
        expect(resultado).toContain('call ptr @__despacho_Animal_nome(');
    });

    it('método da superclasse que chama isto.metodo() alcança a sobrescrita', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Animal {',
            '    nome(): texto { retorna "animal" }',
            '    apresentar(): texto { retorna "sou " + isto.nome() }',
            '}',
            'classe Ave herda Animal {',
            '    nome(): texto { retorna "ave" }',
            '}',
            'escreva(Ave().apresentar())',
        ]);

        const corpoApresentar = resultado.slice(resultado.indexOf('define ptr @Animal_apresentar'));
        expect(corpoApresentar.slice(0, corpoApresentar.indexOf('\n}'))).toContain('@__despacho_Animal_nome');
    });

    it('sem sobrescrita, a chamada continua direta', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Animal {',
            '    nome(): texto { retorna "animal" }',
            '}',
            'classe Ave herda Animal {',
            '    voar(): texto { retorna "voando" }',
            '}',
            'funcao mostrar(a: Animal) { escreva(a.nome()) }',
            'mostrar(Ave())',
        ]);

        expect(resultado).not.toContain('__despacho_');
        expect(resultado).toContain('call ptr @Animal_nome(');
    });

    it('super.metodo() chama a versão da superclasse diretamente', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Animal {',
            '    nome(): texto { retorna "animal" }',
            '}',
            'classe Ave herda Animal {',
            '    nome(): texto { retorna "ave, um " + super.nome() }',
            '}',
            'escreva(Ave().nome())',
        ]);

        const corpoAve = resultado.slice(resultado.indexOf('define ptr @Ave_nome'));
        const corpo = corpoAve.slice(0, corpoAve.indexOf('\n}'));
        expect(corpo).toContain('call ptr @Animal_nome(');
        expect(corpo).not.toContain('__despacho_');
    });

    it('chamada por interface despacha para as classes que a implementam', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'interface Fonte {',
            '    versoes(nome: texto): texto[]',
            '}',
            'classe FonteMemoria implementa Fonte {',
            '    versoes(nome: texto): texto[] { retorna ["1.0.0"] }',
            '}',
            'classe FonteRegistro implementa Fonte {',
            '    versoes(nome: texto): texto[] { retorna ["2.0.0"] }',
            '}',
            'funcao usar(f: Fonte) {',
            '    var vs: texto[] = f.versoes("a")',
            '    escreva(vs[0])',
            '}',
            'usar(FonteMemoria())',
        ]);

        expect(resultado).toContain('@__despacho_Fonte_versoes(ptr %0, ptr %1)');
        expect(resultado).toContain('call ptr @FonteMemoria_versoes(ptr %0, ptr %1)');
        expect(resultado).toContain('call ptr @FonteRegistro_versoes(ptr %0, ptr %1)');
        expect(resultado).toContain('@msg_despacho');
    });

    it('vetor devolvido por método pode ser indexado diretamente', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Fonte {',
            '    versoes(): texto[] { retorna ["1.0.0"] }',
            '}',
            'funcao usar(f: Fonte) { escreva(f.versoes()[0]) }',
            'usar(Fonte())',
        ]);

        expect(resultado).toContain('call ptr @Fonte_versoes(');
        expect(resultado).not.toContain('%Vetor @');
    });
});

describe('Compilador - longo em campos e conversões', () => {
    it('inteiro atribuído a campo longo é estendido com sinal', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe V {',
            '    maior: longo',
            '    construtor(m: inteiro) { isto.maior = m }',
            '}',
            'var v = V(3)',
        ]);

        expect(resultado).toContain('sext i32 %1 to i64');
        expect(resultado).toContain('store i64');
    });

    it('longo(texto) chama a conversão de 64 bits do tempo de execução', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar(['var n: longo = longo("12345678901")', 'escreva(n)']);

        expect(resultado).toContain('declare i64 @longo(ptr)');
        expect(resultado).toContain('call i64 @longo(');
        expect(resultado).toContain('%lld');
    });

    it('escreva de expressão com campo longo usa o formato pelo valor gerado', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe V {',
            '    maior: longo',
            '    construtor(m: longo) { isto.maior = m }',
            '}',
            'var v = V(9999999999)',
            'escreva(v.maior + 1)',
        ]);

        expect(resultado).not.toContain('c"%g\\0A\\00"');
        expect(resultado).toContain('c"%lld\\0A\\00"');
    });
});

describe('Compilador - escreva de valor de dicionário', () => {
    it('sem tipo declarado é erro de compilação, com orientação', async () => {
        const compilador = new CompiladorLLVM();
        await expect(
            compilador.compilar(['var d = {"tipo": "classe"}', 'escreva(d["tipo"])'])
        ).rejects.toThrow(/valor de dicionário sem tipo conhecido/);
    });

    it('com tipo declarado na variável, escreve normalmente', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var d = {"tipo": "classe"}',
            'var tipoDado: texto = d["tipo"]',
            'escreva(tipoDado)',
        ]);

        expect(resultado).toContain('c"%s\\0A\\00"');
    });
});
