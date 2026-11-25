/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

async function compilar(linhas: string[]): Promise<string> {
    return await new CompiladorLLVM().compilar(linhas, false);
}

// Corpo IR de uma função definida no módulo.
function corpoFuncao(ir: string, nome: string): string {
    const inicio = ir.indexOf(`@${nome}(`, ir.indexOf('define'));
    const fim = ir.indexOf('\n}', inicio);
    return ir.slice(inicio, fim);
}

describe('Compilador - métodos de texto adicionais', () => {
    it.each([
        ['aparar', 'delegua_texto_aparar'],
        ['apararInicio', 'delegua_texto_aparar_inicio'],
        ['apararFim', 'delegua_texto_aparar_fim'],
        ['inverter', 'delegua_texto_inverter'],
    ])('%s chama %s', async (metodo, funcaoC) => {
        const ir = await compilar(['var t: texto = "  a  "', `var r = t.${metodo}()`, 'escreva(r)']);
        expect(ir).toContain(`call ptr @${funcaoC}(`);
    });

    it('dividir devolve texto[] preenchido pelo runtime e itera com para cada', async () => {
        const ir = await compilar([
            'var t: texto = "a,b"',
            'var partes = t.dividir(",")',
            'para cada p em partes {',
            '  escreva(p)',
            '}',
        ]);
        // O runtime devolve um novo Vetor* no heap (sem parâmetro de saída).
        expect(ir).toMatch(/%texto_dividido = call ptr @delegua_texto_dividir\(ptr .*, ptr .*, i32 0\)/);
        expect(ir).toContain('call void @delegua_arc_atribuir(ptr %partes, ptr %texto_dividido)');
        expect(ir).toMatch(/call i32 @delegua_vetor_tamanho\(ptr %vetor_ptr\d*\)/);
    });

    it('dividir aceita limite', async () => {
        const ir = await compilar(['var t: texto = "a,b,c"', 'var partes = t.dividir(",", 2)', 'escreva(partes[1])']);
        expect(ir).toMatch(/call ptr @delegua_texto_dividir\(ptr .*, ptr .*, i32 2\)/);
    });

    it('encontrar, encontrarUltimo e concatenar', async () => {
        const ir = await compilar([
            'var t: texto = "@a/b@1"',
            'var i = t.encontrar("@", 1)',
            'var j = t.encontrarUltimo("@")',
            'var c = t.concatenar("!")',
            'escreva(i)',
            'escreva(j)',
            'escreva(c)',
        ]);
        expect(ir).toMatch(/call i32 @delegua_texto_encontrar\(ptr .*, ptr .*, i32 1\)/);
        expect(ir).toContain('call i32 @delegua_texto_encontrar_ultimo(');
        expect(ir).toContain('call ptr @delegua_texto_concatenar(');
        // Tipos inferidos: i e j inteiros (%d), c texto (%s).
        expect(ir).toContain('c"%d\\0A\\00"');
    });

    it('comecaCom e terminaCom devolvem lógico (i1)', async () => {
        const ir = await compilar([
            'var t: texto = "v1.2.0"',
            'se t.comecaCom("v") e t.terminaCom(".0") {',
            '  escreva("ok")',
            '}',
        ]);
        expect(ir).toContain('call i32 @delegua_texto_comeca_com(');
        expect(ir).toContain('call i32 @delegua_texto_termina_com(');
        expect(ir).toMatch(/%comecaCom = icmp ne i32 %\d+, 0/);
    });
});

describe('Compilador - métodos de dicionário', () => {
    it('tamanho, contem, remover e chaves', async () => {
        const ir = await compilar([
            'var d = {}',
            'd["a"] = "x"',
            'escreva(d.tamanho())',
            'se d.contem("a") {',
            '  d.remover("a")',
            '}',
            'var ks = d.chaves()',
            'escreva(ks.juntar(","))',
        ]);
        expect(ir).toContain('call i32 @delegua_dicionario_tamanho(');
        expect(ir).toContain('call i32 @delegua_dicionario_contem(');
        expect(ir).toContain('call i32 @delegua_dicionario_remover(');
        expect(ir).toMatch(/%dict_chaves = call ptr @delegua_dicionario_chaves\(ptr %/);
        expect(ir).toContain('call ptr @delegua_vetor_juntar_texto(');
    });

    it('para cada sobre dicionário itera as chaves', async () => {
        const ir = await compilar(['var d = {"a": 1}', 'para cada k em d {', '  escreva(k)', '}']);
        expect(ir).toContain('%dict_chaves = call ptr @delegua_dicionario_chaves(');
        expect(ir).toContain('call i32 @delegua_vetor_tamanho(ptr %dict_chaves)');
    });

    it('método de dicionário desconhecido gera erro de compilação', async () => {
        await expect(compilar(['var d = {}', 'd.naoExiste()'])).rejects.toThrow(
            "Método de dicionário 'naoExiste' não implementado."
        );
    });
});

describe('Compilador - correções de vetores e funções', () => {
    it('para cada sobre vetor local passa o Vetor* carregado do slot, não o ponteiro de elementos', async () => {
        const ir = await compilar([
            'var v: texto[] = ["a", "b"]',
            'var f: texto[] = v.fatiar(1)',
            'para cada x em f {',
            '  escreva(x)',
            '}',
        ]);
        expect(ir).toContain('call void @delegua_arc_atribuir(ptr %f, ptr %fatia)');
        expect(ir).toMatch(/(%vetor_ptr\d*) = load ptr, ptr %f[\s\S]*call i32 @delegua_vetor_tamanho\(ptr \1\)/);
    });

    it('vetor devolvido por função é um Vetor* guardado no slot da variável', async () => {
        const ir = await compilar([
            'funcao g(): texto[] {',
            '  var r: texto[] = ["q"]',
            '  retorna r',
            '}',
            'var z: texto[] = g()',
            'escreva(z[0])',
        ]);
        expect(ir).toContain('define ptr @g()');
        expect(ir).toMatch(/(%\d+) = call ptr @g\(\)[\s\S]*?call void @delegua_arc_atribuir\(ptr %z, ptr \1\)/);
        expect(ir).not.toContain('%Vetor %');
    });

    it('argumento texto de função livre vai em caixa ptr*, como em métodos', async () => {
        const ir = await compilar([
            'funcao f(t: texto): texto {',
            '  retorna t.maiusculo()',
            '}',
            'escreva(f("ab"))',
        ]);
        expect(ir).toMatch(/store ptr getelementptr inbounds \(\{[^}]*\}, ptr @texto_arc_\d+, i32 0, i32 3, i32 0\), ptr %arg_ptr_caixa/);
        expect(ir).toContain('call ptr @f(ptr %arg_ptr_caixa)');
    });

    it('função que termina sem retorna recebe um terminador', async () => {
        const ir = await compilar(['funcao f() {', '  escreva("x")', '}', 'f()']);
        expect(corpoFuncao(ir, 'f')).toContain('ret ptr null');
    });

    it('função com tipo inteiro sem retorna em todos os caminhos devolve 0', async () => {
        const ir = await compilar(['funcao g(n: inteiro): inteiro {', '  se n > 0 {', '    retorna n', '  }', '}', 'escreva(g(1))']);
        expect(corpoFuncao(ir, 'g')).toContain('ret i32 0');
    });

    it('escreva de lógico estende i1 para int antes do printf', async () => {
        const ir = await compilar(['var b: lógico = verdadeiro', 'escreva(b)']);
        expect(ir).toMatch(/zext i1 .* to i32/);
    });

    it('função pode usar módulo importado no nível superior', async () => {
        const ir = await compilar([
            'var json = importar("json")',
            'funcao tipoDe(t: texto): texto {',
            '  retorna json.tipo(json.textoParaJson(t))',
            '}',
            'escreva(tipoDe("[]"))',
        ]);
        expect(corpoFuncao(ir, 'tipoDe')).toContain('call ptr @delegua_json_tipo(');
    });
});
