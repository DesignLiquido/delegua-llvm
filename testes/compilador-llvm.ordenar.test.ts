/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

async function compilar(linhas: string[]): Promise<string> {
    return await new CompiladorLLVM().compilar(linhas, false);
}

describe('Compilador - vetor.ordenar', () => {
    it.each([
        ['inteiro', '[3, 1]', 0],
        ['número', '[2.5, 1.5]', 1],
        ['texto', '["b", "a"]', 2],
    ])('ordenar() de %s informa o tipo do elemento ao runtime', async (tipo, literal, codigo) => {
        const ir = await compilar([`var v: ${tipo}[] = ${literal}`, 'v.ordenar()']);
        expect(ir).toMatch(new RegExp(`call void @delegua_vetor_ordenar\\(ptr %vetor_ptr\\d*, i32 \\d, i32 ${codigo}\\)`));
    });

    it('ordenar(funcao anônima) gera um comparador que chama a função', async () => {
        const ir = await compilar(['var v: inteiro[] = [3, 1, 2]', 'v.ordenar(funcao(a, b) {', '  retorna b - a', '})']);
        expect(ir).toMatch(/define internal i32 @__comparador_anonima_0\(ptr %0, ptr %1\)/);
        expect(ir).toMatch(/call i32 @__lambda_\d+\(i32 %elemento0, i32 %elemento1\)/);
        expect(ir).toMatch(/icmp sgt i32 %comparacao, 0/);
        expect(ir).toMatch(/call void @delegua_vetor_ordenar_com_funcao\(ptr %vetor_ptr\d*, i32 4, ptr @__comparador_anonima_0\)/);
    });

    it('comparador de função nomeada com texto passa os elementos em caixas', async () => {
        const ir = await compilar([
            'funcao porTamanho(a: texto, b: texto): inteiro {',
            '  retorna a.tamanho() - b.tamanho()',
            '}',
            'var v: texto[] = ["ccc", "a"]',
            'v.ordenar(porTamanho)',
        ]);
        expect(ir).toMatch(/define internal i32 @__comparador_porTamanho_0\(ptr %0, ptr %1\)/);
        expect(ir).toContain('call i32 @porTamanho(ptr %caixa0, ptr %caixa1)');
        expect(ir).toMatch(/call void @delegua_vetor_ordenar_com_funcao\(ptr %vetor_ptr\d*, i32 8, ptr @__comparador_porTamanho_0\)/);
    });

    it('comparador com resultado número compara com 0.0', async () => {
        const ir = await compilar(['var v: número[] = [2.5, 1.5]', 'v.ordenar(funcao(a, b) {', '  retorna a - b', '})']);
        expect(ir).toMatch(/fcmp ogt double %comparacao, 0\.0+e\+00/);
    });

    it('função de comparação com aridade errada é erro de compilação', async () => {
        await expect(
            compilar(['funcao um(a: inteiro): inteiro {', '  retorna a', '}', 'var v: inteiro[] = [1]', 'v.ordenar(um)'])
        ).rejects.toThrow('A função de comparação de ordenar deve receber 2 parâmetros (recebe 1).');
    });
});

describe('Compilador - vetores como parâmetros de função', () => {
    it('parâmetro vetor é ponteiro e literal recebe o tipo do elemento do parâmetro', async () => {
        const ir = await compilar([
            'funcao soma(numeros: inteiro[]): inteiro {',
            '  var total: inteiro = 0',
            '  para cada n em numeros {',
            '    total = total + n',
            '  }',
            '  retorna total',
            '}',
            'escreva(soma([3, 5]))',
        ]);
        expect(ir).toContain('define i32 @soma(ptr %0)');
        // Literal de inteiros (i32), não de números (double).
        expect(ir).toMatch(/store i32 3, ptr %ptr_arr_0/);
        expect(ir).not.toMatch(/store double 3\.0+e\+00/);
    });
});
