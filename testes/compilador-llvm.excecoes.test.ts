/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

async function compilar(linhas: string[]): Promise<string> {
    // Sem otimização: os testes conferem a forma do IR (nomes de blocos e valores).
    return await new CompiladorLLVM().compilar(linhas, false);
}

function corpoFuncao(ir: string, nome: string): string {
    const inicio = ir.indexOf(`@${nome}(`, ir.indexOf('define'));
    return ir.slice(inicio, ir.indexOf('\n}', inicio));
}

const CLASSES_ERRO = [
    'classe ErroRede herda Excecao {',
    '  codigo: inteiro',
    '  construtor(mensagem: texto, codigo: inteiro) {',
    '    super.construtor(mensagem)',
    '    isto.codigo = codigo',
    '  }',
    '}',
    'classe ErroTempoEsgotado herda ErroRede {',
    '}',
];

describe('Compilador - Exceções (setjmp/longjmp)', () => {
    it('tente empilha um tratador e chama _setjmp; o corpo desempilha ao terminar', async () => {
        const ir = await compilar(['tente {', '  escreva("corpo")', '} pegue {', '  escreva("pego")', '}']);
        expect(ir).toContain('call void @delegua_excecao_empilhar(ptr %quadro_excecao)');
        expect(ir).toMatch(/call i32 @_setjmp\(ptr %quadro_excecao(, ptr null)?\)/);
        expect(ir).toContain('call void @delegua_excecao_desempilhar()');
        expect(ir).toMatch(/declare i32 @_setjmp\(ptr(, ptr)?\) #\d+/);
        expect(ir).toMatch(/attributes #\d+ = \{[^}]*returns_twice/);
        // Nada da ABI de exceções de C++.
        expect(ir).not.toContain('__gxx_personality');
        expect(ir).not.toContain('__cxa_');
        expect(ir).not.toContain('landingpad');
    });

    it('a função com tente recebe optnone noinline (variáveis ficam na memória)', async () => {
        const ir = await compilar([
            'funcao f(): inteiro {',
            '  var x: inteiro = 1',
            '  tente {',
            '    x = 2',
            '  } pegue {',
            '    retorna x',
            '  }',
            '  retorna x',
            '}',
            'escreva(f())',
        ]);
        const atributos = /define i32 @f\(\) #(\d+)/.exec(ir);
        expect(atributos).not.toBeNull();
        expect(ir).toMatch(new RegExp(`attributes #${atributos[1]} = \\{[^}]*noinline[^}]*optnone`));
    });

    it('falhar com texto lança uma Excecao com a mensagem', async () => {
        const ir = await compilar(['falhar "erro proposital"']);
        expect(ir).toContain('%Excecao = type { i32, ptr }');
        expect(ir).toMatch(/store i32 1000000, ptr %excecao_tipo_ptr/);
        expect(ir).toMatch(/call void @delegua_excecao_lancar\(ptr %excecao, ptr getelementptr inbounds \(\{[^}]*\}, ptr @texto_arc_\d+, i32 0, i32 3, i32 0\)\)/);
        expect(ir).toMatch(/declare void @delegua_excecao_lancar\(ptr, ptr\) #\d+/);
    });

    it('falhar com instância de classe lança o próprio objeto e sua mensagem', async () => {
        const ir = await compilar([...CLASSES_ERRO, 'falhar ErroRede("sem rede", 7)']);
        expect(ir).toContain('call void @ErroRede_construtor(');
        expect(ir).toMatch(/%mensagem_excecao = load ptr, ptr %mensagem_excecao_ptr/);
        expect(ir).toMatch(/call void @delegua_excecao_lancar\(ptr %obj_ErroRede, ptr %mensagem_excecao\)/);
    });

    it('pegue tipado compara o id de tipo com a classe e suas subclasses', async () => {
        const ir = await compilar([
            ...CLASSES_ERRO,
            'tente {',
            '  falhar ErroTempoEsgotado("lento", 504)',
            '} pegue (erro: ErroRede) {',
            '  escreva(erro.codigo)',
            '} pegue (erro) {',
            '  escreva(erro)',
            '}',
        ]);
        // ErroRede (id 0) e ErroTempoEsgotado (id 1).
        expect(ir).toMatch(/icmp eq i32 %id_tipo_excecao, 0/);
        expect(ir).toMatch(/icmp eq i32 %id_tipo_excecao, 1/);
        expect(ir).toContain('pegue_0:');
        expect(ir).toContain('pegue_1:');
        // escreva(erro) escreve a mensagem.
        expect(ir).toContain('%mensagem_excecao');
    });

    it('sem pegue correspondente, finalmente roda e a exceção é relançada', async () => {
        const ir = await compilar([
            ...CLASSES_ERRO,
            'tente {',
            '  falhar "x"',
            '} pegue (erro: ErroRede) {',
            '  escreva("rede")',
            '} finalmente {',
            '  escreva("finalmente")',
            '}',
        ]);
        const despacho = ir.slice(ir.indexOf('pegue_0_seguinte:'));
        expect(despacho).toMatch(/call void @delegua_excecao_lancar\(ptr %objeto, ptr %mensagem_atual\)/);
    });

    it('exceção do runtime C (sem objeto) vira uma Excecao no despacho', async () => {
        const ir = await compilar(['tente {', '  escreva("x")', '} pegue (erro) {', '  escreva(erro.mensagem)', '}']);
        expect(ir).toContain('call ptr @delegua_excecao_atual()');
        expect(ir).toContain('pegue_criar_excecao:');
    });

    it('retorna dentro de tente desempilha o tratador antes de sair', async () => {
        const ir = await compilar([
            'funcao f(): inteiro {',
            '  tente {',
            '    retorna 1',
            '  } pegue {',
            '    retorna 2',
            '  }',
            '  retorna 3',
            '}',
            'escreva(f())',
        ]);
        const corpo = corpoFuncao(ir, 'f');
        const posRetornoUm = corpo.indexOf('ret i32 1');
        expect(corpo.lastIndexOf('call void @delegua_excecao_desempilhar()', posRetornoUm)).toBeGreaterThan(-1);
        // No pegue o tratador já foi removido pelo runtime: retorna 2 não desempilha.
        const trechoPegue = corpo.slice(corpo.indexOf('pegue_0:'), corpo.indexOf('ret i32 2'));
        expect(trechoPegue).not.toContain('delegua_excecao_desempilhar');
    });

    it('sustar dentro de tente num laço desempilha só os tentes de dentro do laço', async () => {
        const ir = await compilar([
            'tente {',
            '  para cada n em [1, 2] {',
            '    tente {',
            '      sustar',
            '    } pegue {',
            '      escreva("x")',
            '    }',
            '  }',
            '} pegue {',
            '  escreva("y")',
            '}',
        ]);
        const antesDoSustar = ir.slice(0, ir.indexOf('sustar_morto:'));
        const ultimoBloco = antesDoSustar.slice(antesDoSustar.lastIndexOf('tente_corpo'));
        expect(ultimoBloco.match(/call void @delegua_excecao_desempilhar\(\)/g)).toHaveLength(1);
    });

    it('senão roda só no caminho sem exceção', async () => {
        const ir = await compilar([
            'tente {',
            '  escreva("corpo")',
            '} pegue {',
            '  escreva("pego")',
            '} senão {',
            '  escreva("senao")',
            '}',
        ]);
        const caminhoSucesso = ir.slice(ir.indexOf('tente_corpo:'), ir.indexOf('pegue_despacho:'));
        expect(caminhoSucesso).toMatch(/@str[.\d]* = |escreva/);
        expect(ir.indexOf('tente_corpo:')).toBeLessThan(ir.indexOf('pegue_despacho:'));
    });

    it('tipo desconhecido em pegue é erro de compilação', async () => {
        await expect(compilar(['tente {', '  falhar "x"', '} pegue (erro: NaoExiste) {', '  escreva("y")', '}'])).rejects.toThrow(
            "Tipo de exceção desconhecido em pegue: 'NaoExiste'."
        );
    });

    it('classe derivada sem construtor usa o construtor da superclasse', async () => {
        const ir = await compilar(['classe ErroDisco herda Excecao {', '}', 'falhar ErroDisco("disco cheio")']);
        expect(ir).toContain('call void @Excecao_construtor(ptr %obj_ErroDisco');
    });
});
