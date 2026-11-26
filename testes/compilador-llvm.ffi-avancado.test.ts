/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

async function compilar(linhas: string[]): Promise<string> {
    return await new CompiladorLLVM().compilar(linhas, false);
}

function corpoFuncao(ir: string, nome: string): string {
    const inicio = ir.indexOf(`@${nome}(`, ir.indexOf('define'));
    return ir.slice(inicio, ir.indexOf('\n}', inicio));
}

const DECLARACOES = [
    '@definicao(biblioteca="nativo", prefixo="ffi_")',
    'classe estrangeira FFI {',
    '  criar(saida: ponteiro, inicial: inteiro): inteiro',
    '  area(r: Retangulo, largura: inteiro): longo',
    '  para_cada(itens: texto[], n: inteiro, cb: função, carga: ponteiro): inteiro',
    '  byte(): byte',
    '  dobro(x: longo): longo',
    '  negar(b: lógico): lógico',
    '  calcular(c: Calculadora, a: inteiro): inteiro',
    '}',
    'classe estrangeira Ponto {',
    '  x: inteiro',
    '  y: inteiro',
    '}',
    'classe estrangeira Retangulo {',
    '  origem: Ponto',
    '  area: longo',
    '  escala: número',
    '  ativo: lógico',
    '  @definicao(tamanho=4)',
    '  id: byte',
    '  marca: byte',
    '  nome: texto',
    '  dados: ponteiro',
    '}',
    'classe estrangeira Calculadora {',
    '  operacao: função',
    '}',
];

describe('FFI - tipos em assinaturas', () => {
    it('declara ponteiro, longo, lógico, byte, estrutura e texto[] com os tipos C', async () => {
        const ir = await compilar([...DECLARACOES, 'escreva("ok")']);
        expect(ir).toContain('declare i32 @ffi_criar(ptr, i32)');
        expect(ir).toContain('declare i64 @ffi_area(ptr, i32)');
        expect(ir).toContain('declare i32 @ffi_para_cada(ptr, i32, ptr, ptr)');
        expect(ir).toContain('declare i8 @ffi_byte()');
        expect(ir).toContain('declare i64 @ffi_dobro(i64)');
        expect(ir).toContain('declare i1 @ffi_negar(i1)');
    });

    it('retorno byte é estendido para inteiro e longo aceita inteiro', async () => {
        const ir = await compilar([...DECLARACOES, 'var b = FFI.byte()', 'escreva(b)', 'escreva(FFI.dobro(21))']);
        expect(ir).toMatch(/zext i8 %\d+ to i32/);
        expect(ir).toContain('call i64 @ffi_dobro(i64 21)');
    });

    it('lógico é passado como i1', async () => {
        const ir = await compilar([...DECLARACOES, 'se FFI.negar(falso) {', '  escreva("x")', '}']);
        expect(ir).toContain('call i1 @ffi_negar(i1 false)');
    });

    it('argumentos a mais geram erro de compilação', async () => {
        await expect(compilar([...DECLARACOES, 'FFI.byte(1)'])).rejects.toThrow(
            "Método 'byte' da classe estrangeira 'FFI' recebe 0 argumento(s), mas recebeu 1."
        );
    });
});

describe('FFI - estruturas', () => {
    it('gera o struct com a disposição C, sem __tipoId', async () => {
        // O struct só aparece no IR quando é referenciado (aqui, pelo acesso ao campo).
        const ir = await compilar([...DECLARACOES, 'var r = Retangulo()', 'r.area = 1']);
        expect(ir).toContain('%estrangeira.Ponto = type { i32, i32 }');
        expect(ir).toContain(
            '%estrangeira.Retangulo = type { %estrangeira.Ponto, i64, double, i1, [4 x i8], i8, ptr, ptr }'
        );
        // Memória zerada, sem construtor.
        expect(ir).toMatch(/call ptr @calloc\(i64 1, i64 48\)/);
    });

    it('tamanhoEmBytes devolve o sizeof da plataforma', async () => {
        const ir = await compilar([...DECLARACOES, 'escreva(Retangulo.tamanhoEmBytes())', 'escreva(Ponto.tamanhoEmBytes())']);
        expect(ir).toMatch(/@escreva\(ptr @fmt[.\d]*, i32 48\)/);
        expect(ir).toMatch(/@escreva\(ptr @fmt[.\d]*, i32 8\)/);
    });

    it('lê campos: byte com zext, vetor fixo e estrutura aninhada por endereço', async () => {
        const ir = await compilar([
            ...DECLARACOES,
            'var r = Retangulo()',
            'var m = r.marca',
            'var p = r.id',
            'var x = r.origem.x',
            'escreva(m)',
            'escreva(x)',
        ]);
        expect(ir).toMatch(/%marca_byte = load i8, ptr %marca_ptr/);
        expect(ir).toMatch(/%marca = zext i8 %marca_byte to i32/);
        // id: endereço do primeiro elemento, sem load do vetor.
        expect(ir).not.toMatch(/load \[4 x i8\]/);
        expect(ir).toMatch(/%x_ptr = getelementptr inbounds %estrangeira.Ponto, ptr %origem_ptr, i32 0, i32 0/);
    });

    it('escreve campos convertendo para o tipo C (byte, longo, estrutura aninhada)', async () => {
        const ir = await compilar([
            ...DECLARACOES,
            'var r = Retangulo()',
            'r.marca = 300',
            'r.area = 7',
            'r.origem.y = 2',
            'r.nome = "quadro"',
        ]);
        expect(ir).toMatch(/store i8 44, ptr %marca_ptr/);
        expect(ir).toMatch(/store i64 7, ptr %area_ptr/);
        expect(ir).toMatch(/store i32 2, ptr %y_ptr/);
        expect(ir).toMatch(/store ptr getelementptr inbounds \(\{[^}]*\}, ptr @texto_arc_\d+, i32 0, i32 3, i32 0\), ptr %nome_ptr/);
    });

    it('estrutura é passada a C como ponteiro do objeto', async () => {
        const ir = await compilar([...DECLARACOES, 'var r = Retangulo()', 'var a = FFI.area(r, 3)', 'escreva(a)']);
        expect(ir).toMatch(/call i64 @ffi_area\(ptr %load_obj_ptr[\d]*, i32 3\)/);
    });

    it('rejeita atribuição a vetor fixo ou estrutura aninhada', async () => {
        await expect(compilar([...DECLARACOES, 'var r = Retangulo()', 'r.origem = Ponto()'])).rejects.toThrow(
            "Campo 'origem' de 'Retangulo' é um vetor de tamanho fixo ou estrutura aninhada"
        );
    });

    it('rejeita estrutura criada com argumentos', async () => {
        await expect(compilar([...DECLARACOES, 'var p = Ponto(1, 2)'])).rejects.toThrow(
            "Estrutura estrangeira 'Ponto' é criada sem argumentos: Ponto()."
        );
    });

    it('rejeita campo vetor sem tamanho e estrutura não declarada', async () => {
        await expect(compilar(['classe estrangeira A {', '  v: inteiro[]', '}'])).rejects.toThrow(
            'use @definicao(tamanho=N)'
        );
        await expect(compilar(['classe estrangeira A {', '  b: Inexistente', '}'])).rejects.toThrow(
            "estrutura 'Inexistente' precisa ser declarada antes"
        );
    });

    it('ponteiro reinterpretado como instância de classe Delégua', async () => {
        const ir = await compilar([
            'classe Contexto {',
            '  total: inteiro',
            '}',
            'funcao f(carga: ponteiro): inteiro {',
            '  var contexto: Contexto = carga',
            '  retorna contexto.total',
            '}',
            'escreva(f(nulo))',
        ]);
        // O valor do parâmetro é o próprio ponteiro do objeto (não o endereço de um slot).
        expect(corpoFuncao(ir, 'f')).toContain('call void @delegua_arc_atribuir(ptr %contexto, ptr %0)');
        expect(corpoFuncao(ir, 'f')).toMatch(/getelementptr inbounds %Contexto, ptr %load_obj_ptr/);
    });
});

describe('FFI - funções de retorno (callbacks) e texto[]', () => {
    it('função nomeada é passada por um trampolim com convenção C', async () => {
        const ir = await compilar([
            ...DECLARACOES,
            'funcao contar(item: texto, indice: inteiro, carga: ponteiro): inteiro {',
            '  retorna item.tamanho()',
            '}',
            'var itens: texto[] = ["a", "b"]',
            'escreva(FFI.para_cada(itens, 2, contar, nulo))',
        ]);
        const trampolim = corpoFuncao(ir, '__ffi_trampolim_contar_0');
        expect(ir).toContain('define internal i32 @__ffi_trampolim_contar_0(ptr %0, i32 %1, ptr %2)');
        // texto chega como char* e vai numa caixa para a convenção ptr* da função Delégua.
        expect(trampolim).toContain('%caixa = alloca ptr');
        expect(trampolim).toContain('store ptr %0, ptr %caixa');
        expect(trampolim).toContain('call i32 @contar(ptr %caixa, i32 %1, ptr %2)');
        // texto[] → char**: ponteiro dos elementos.
        expect(ir).toMatch(/%elementos = load ptr, ptr %campo_elementos/);
        expect(ir).toMatch(/call i32 @ffi_para_cada\(ptr %elementos, i32 2, ptr @__ffi_trampolim_contar_0, ptr null\)/);
    });

    it('função anônima com parâmetros tipados', async () => {
        const ir = await compilar([
            ...DECLARACOES,
            'var itens: texto[] = ["a"]',
            'var r = FFI.para_cada(itens, 1, funcao(item: texto, indice: inteiro, carga: ponteiro): inteiro {',
            '  retorna 1',
            '}, nulo)',
            'escreva(r)',
        ]);
        expect(ir).toMatch(/define internal i32 @__ffi_trampolim_anonima_0\(ptr %0, i32 %1, ptr %2\)/);
        expect(ir).toMatch(/call i32 @__lambda_\d+\(ptr %caixa, i32 %1, ptr %2\)/);
    });

    it('função anônima sem tipos nos parâmetros gera erro', async () => {
        await expect(
            compilar([
                ...DECLARACOES,
                'var itens: texto[] = ["a"]',
                'FFI.para_cada(itens, 1, funcao(item, indice, carga) {',
                '  retorna 1',
                '}, nulo)',
            ])
        ).rejects.toThrow('precisa de tipo declarado');
    });

    it('o mesmo trampolim é reutilizado e o campo função de estrutura também usa trampolim', async () => {
        const ir = await compilar([
            ...DECLARACOES,
            'funcao somar(a: inteiro, b: inteiro): inteiro {',
            '  retorna a + b',
            '}',
            'var c = Calculadora()',
            'c.operacao = somar',
            'c.operacao = somar',
            'escreva(FFI.calcular(c, 1))',
        ]);
        expect(ir.match(/define internal i32 @__ffi_trampolim_somar_\d+/g)).toHaveLength(1);
        expect(ir).toMatch(/store ptr @__ffi_trampolim_somar_0, ptr %operacao_ptr/);
    });
});

describe('FFI - módulo memoria', () => {
    it('parâmetro de saída: alocar, ler ponteiro e liberar', async () => {
        const ir = await compilar([
            ...DECLARACOES,
            'var memoria = importar("memoria")',
            'var saida = memoria.alocar(memoria.tamanhoPonteiro())',
            'FFI.criar(saida, 1)',
            'var objeto = memoria.lerPonteiro(saida, 0)',
            'memoria.liberar(saida)',
            'escreva(memoria.lerInteiro(objeto, 4))',
        ]);
        expect(ir).toContain('call i32 @delegua_memoria_tamanho_ponteiro()');
        expect(ir).toMatch(/call ptr @delegua_memoria_alocar\(i32 %\d+\)/);
        expect(ir).toMatch(/call i32 @ffi_criar\(ptr %ponteiro_val, i32 1\)/);
        expect(ir).toMatch(/call ptr @delegua_memoria_ler_ponteiro\(ptr %ponteiro_val\d*, i64 0\)/);
        expect(ir).toMatch(/call void @delegua_memoria_liberar\(ptr %ponteiro_val\d*\)/);
        expect(ir).toMatch(/call i32 @delegua_memoria_ler_inteiro\(ptr %ponteiro_val\d*, i64 4\)/);
    });

    it.each([
        ['escreverInteiro(p, 0, 1)', 'call void @delegua_memoria_escrever_inteiro(ptr %ponteiro_val, i64 0, i32 1)'],
        ['escreverLongo(p, 8, 2)', 'call void @delegua_memoria_escrever_longo(ptr %ponteiro_val, i64 8, i64 2)'],
        ['escreverNumero(p, 0, 1.5)', 'call void @delegua_memoria_escrever_numero(ptr %ponteiro_val, i64 0, double 1.500000e+00)'],
        ['escreverByte(p, 3, 65)', 'call void @delegua_memoria_escrever_byte(ptr %ponteiro_val, i64 3, i32 65)'],
        ['escreverPonteiro(p, 0, nulo)', 'call void @delegua_memoria_escrever_ponteiro(ptr %ponteiro_val, i64 0, ptr null)'],
    ])('memoria.%s', async (chamada, esperado) => {
        const ir = await compilar(['var memoria = importar("memoria")', 'var p = memoria.alocar(16)', `memoria.${chamada}`]);
        expect(ir).toContain(esperado);
    });

    it('textoDe, textoDeTamanho, lerTexto, deslocar e copiar', async () => {
        const ir = await compilar([
            'var memoria = importar("memoria")',
            'var p = memoria.alocar(16)',
            'var q = memoria.deslocar(p, 4)',
            'memoria.copiar(q, p, 4)',
            'escreva(memoria.textoDe(p))',
            'escreva(memoria.textoDeTamanho(p, 3))',
            'escreva(memoria.lerTexto(p, 0))',
        ]);
        expect(ir).toMatch(/call ptr @delegua_memoria_deslocar\(ptr %ponteiro_val, i64 4\)/);
        expect(ir).toContain('call void @delegua_memoria_copiar(');
        expect(ir).toContain('call ptr @delegua_memoria_texto_de(');
        expect(ir).toMatch(/call ptr @delegua_memoria_texto_de_tamanho\(ptr %ponteiro_val\d*, i64 3\)/);
        expect(ir).toMatch(/call ptr @delegua_memoria_ler_texto\(ptr %ponteiro_val\d*, i64 0\)/);
    });
});

describe('texto() conforme o tipo LLVM do valor', () => {
    it('converte longo com texto_de_longo e lógico para verdadeiro/falso', async () => {
        const ir = await compilar([
            ...DECLARACOES,
            'escreva(texto(FFI.dobro(2)))',
            'escreva(texto(FFI.negar(verdadeiro)))',
            'escreva(texto(FFI.byte()))',
        ]);
        expect(ir).toMatch(/call ptr @texto_de_longo\(i64 %\d+\)/);
        expect(ir).toMatch(/select i1 %\d+, ptr getelementptr inbounds \(\{[^}]*\}, ptr @texto_arc_\d+, i32 0, i32 3, i32 0\), ptr getelementptr inbounds \(\{[^}]*\}, ptr @texto_arc_\d+, i32 0, i32 3, i32 0\)/);
        expect(ir).toMatch(/call ptr @texto_de_inteiro\(i32 %byte_byte\)/);
    });
});
