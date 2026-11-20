/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

// Regressões encontradas no porte do pacote (pacote-delegua).
describe('Compilador - ordem de declaração de funções e passagem de argumentos', () => {
    it('método chama função do nível superior', async () => {
        const ir = await new CompiladorLLVM().compilar([
            'funcao dobrar(n: inteiro): inteiro {',
            '    retorna n * 2',
            '}',
            'classe A {',
            '    x: inteiro',
            '    construtor(x: inteiro) { isto.x = x }',
            '    dobro(): inteiro {',
            '        var r: inteiro = dobrar(isto.x)',
            '        retorna r',
            '    }',
            '}',
            'escreva(A(4).dobro())',
        ]);
        expect(ir).toMatch(/call i32 @dobrar\(/);
    });

    it('parâmetro de método que é instância de classe é repassado sem load', async () => {
        const ir = await new CompiladorLLVM().compilar([
            'classe P {',
            '    x: inteiro',
            '    construtor(x: inteiro) { isto.x = x }',
            '}',
            'funcao soma(a: P, b: P): inteiro {',
            '    retorna a.x + b.x',
            '}',
            'classe Q {',
            '    comParam(outro: P): inteiro {',
            '        var r: inteiro = soma(outro, outro)',
            '        retorna r',
            '    }',
            '}',
            'escreva(Q().comParam(P(2)))',
        ]);
        const corpo = /define i32 @Q_comParam\([^)]*\) \{[\s\S]*?\n\}/.exec(ir)?.[0] ?? '';
        expect(corpo).toContain('@soma(');
        expect(corpo).not.toContain('load_arg');
    });

    it('vetor do nível superior passado a função é passado por ponteiro', async () => {
        const ir = await new CompiladorLLVM().compilar([
            'funcao contar(v: texto[]): inteiro {',
            '    var n: inteiro = v.tamanho()',
            '    retorna n',
            '}',
            'var lista: texto[] = ["a", "b"]',
            'escreva(contar(lista))',
        ]);
        expect(ir).toMatch(/call i32 @contar\(ptr /);
    });

    it('`retorna` sem valor em função sem tipo de retorno declarado', async () => {
        const ir = await new CompiladorLLVM().compilar([
            'funcao talvez(v: inteiro[], n: inteiro) {',
            '    se n < 0 {',
            '        retorna',
            '    }',
            '    v.adicionar(n)',
            '}',
            'var v: inteiro[] = []',
            'talvez(v, 1)',
        ]);
        expect(ir).toBeTruthy();
    });

    it('índice de vetor calculado (`v[i + 1]`)', async () => {
        const ir = await new CompiladorLLVM().compilar([
            'var termos: texto[] = ["a", "b", "c"]',
            'var i = 0',
            'var s: texto = termos[i + 1]',
            'escreva(s)',
        ]);
        expect(ir).toBeTruthy();
    });

    it('variável inicializada com chamada de função que devolve objeto', async () => {
        const ir = await new CompiladorLLVM().compilar([
            'classe Item {',
            '    x: inteiro',
            '    construtor(x: inteiro) { isto.x = x }',
            '}',
            'funcao criar(): Item {',
            '    retorna Item(3)',
            '}',
            'var item = criar()',
            'escreva(item.x)',
        ]);
        expect(ir).toBeTruthy();
    });

    it('método de vetor sobre o retorno de uma função (`lista().tamanho()`)', async () => {
        const ir = await new CompiladorLLVM().compilar([
            'funcao lista(): texto[] {',
            '    var r: texto[] = ["a"]',
            '    retorna r',
            '}',
            'escreva(lista().tamanho())',
        ]);
        expect(ir).toMatch(/call i32 @delegua_vetor_tamanho\(ptr /);
    });

    it('`retorna` de método de vetor que produz vetor (`retorna v.ordenar()`)', async () => {
        const ir = await new CompiladorLLVM().compilar([
            'funcao ordenadas(d: dicionário): texto[] {',
            '    var chaves: texto[] = d.chaves()',
            '    retorna chaves.ordenar()',
            '}',
            'var d: dicionário = {}',
            'd["b"] = "1"',
            'var o: texto[] = ordenadas(d)',
            'escreva(o.juntar(","))',
        ]);
        expect(ir).toBeTruthy();
    });

    it('`inteiro(x)` com x número converte o valor', async () => {
        const ir = await new CompiladorLLVM().compilar(['var x = 2.7', 'var n: inteiro = inteiro(x)', 'escreva(n)']);
        expect(ir).toContain('fptosi');
        expect(ir).not.toMatch(/call i32 @inteiro\(double/);
    });

    it('índice calculado em texto (`t[i + 1]`)', async () => {
        const ir = await new CompiladorLLVM().compilar(['var t = "abc"', 'var i = 0', 'var c: texto = t[i + 1]', 'escreva(c)']);
        expect(ir).toBeTruthy();
    });

    it('parâmetro de método que é instância de classe é guardado em dicionário sem load', async () => {
        const ir = await new CompiladorLLVM().compilar([
            'classe P {',
            '    v: texto',
            '    construtor(v: texto) { isto.v = v }',
            '}',
            'classe T {',
            '    m: dicionário',
            '    construtor() { isto.m = {} }',
            '    definir(nome: texto, p: P) {',
            '        isto.m[nome] = p',
            '    }',
            '}',
            'var t = T()',
            't.definir("x", P("ok"))',
        ]);
        const corpo = /define void @T_definir\(ptr %0, ptr %1, ptr %2\) \{[\s\S]*?\n\}/.exec(ir)?.[0] ?? '';
        expect(corpo).toContain('@delegua_dicionario_definir(');
        expect(corpo).not.toMatch(/load ptr, ptr %2/);
    });

    it('variável local lógico passada a parâmetro lógico de método vai por valor', async () => {
        const ir = await new CompiladorLLVM().compilar([
            'classe C {',
            '    marcar(sim: lógico): inteiro {',
            '        se sim {',
            '            retorna 1',
            '        }',
            '        retorna 0',
            '    }',
            '}',
            'var c = C()',
            'var ativo: lógico = verdadeiro',
            'escreva(c.marcar(ativo))',
        ]);
        expect(ir).toMatch(/call i32 @C_marcar\(ptr [^,]+, i1 /);
    });

    it('escreva não deixa espaço antes da quebra de linha', async () => {
        const ir = await new CompiladorLLVM().compilar(['escreva("a")', 'escreva(1, "b")']);
        expect(ir).toContain('c"%s\\0A\\00"');
        expect(ir).not.toContain(' \\0A\\00"');
    });
});
