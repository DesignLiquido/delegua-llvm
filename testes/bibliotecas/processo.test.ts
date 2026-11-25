/// <reference types="jest" />
import { CompiladorLLVM } from '../../fontes/compilador-llvm';
import { obterBibliotecasParaCompilacao } from '../../fontes/bibliotecas-compilacao';

async function compilar(linhas: string[]): Promise<string> {
    return await new CompiladorLLVM().compilar(linhas, false);
}

describe('Compilador - módulo processo', () => {
    it('sair, escreverErro, sistemaOperacional e arquitetura', async () => {
        const ir = await compilar([
            'var processo = importar("processo")',
            'escreva(processo.sistemaOperacional())',
            'escreva(processo.arquitetura())',
            'processo.escreverErro("falhou")',
            'processo.sair(2)',
        ]);
        expect(ir).toContain('call ptr @delegua_processo_sistema_operacional()');
        expect(ir).toContain('call ptr @delegua_processo_arquitetura()');
        expect(ir).toContain('call void @delegua_processo_escrever_erro(');
        expect(ir).toContain('call void @delegua_processo_sair(i32 2)');
    });

    it('variavelAmbiente infere texto sem anotação de tipo', async () => {
        const ir = await compilar([
            'var processo = importar("processo")',
            'var casa = processo.variavelAmbiente("HOME")',
            'escreva(casa)',
        ]);
        expect(ir).toContain('call ptr @delegua_processo_variavel_ambiente(');
        expect(ir).toContain('c"%s\\0A\\00"');
    });

    it('definirVariavelAmbiente devolve lógico', async () => {
        const ir = await compilar([
            'var processo = importar("processo")',
            'se processo.definirVariavelAmbiente("X", "1") {',
            '  escreva("ok")',
            '}',
        ]);
        expect(ir).toContain('call i32 @delegua_processo_definir_variavel_ambiente(');
        expect(ir).toMatch(/icmp ne i32 %\d+, 0/);
    });

    it('executar recebe texto[] como Vetor* e completa argumentos omitidos com nulo', async () => {
        const ir = await compilar([
            'var processo = importar("processo")',
            'var codigo = processo.executar("git", ["status"])',
            'escreva(codigo)',
        ]);
        expect(ir).toMatch(/call i32 @delegua_processo_executar\(ptr getelementptr inbounds \(\{[^}]*\}, ptr @texto_arc_\d+, i32 0, i32 3, i32 0\), ptr %vetor, ptr null\)/);
    });

    it('executarCapturando e ultimoCodigoSaida', async () => {
        const ir = await compilar([
            'var processo = importar("processo")',
            'var args: texto[] = ["rev-parse", "HEAD"]',
            'var saida = processo.executarCapturando("git", args, "./repo")',
            'escreva(saida.aparar())',
            'escreva(processo.ultimoCodigoSaida())',
        ]);
        expect(ir).toContain('call ptr @delegua_processo_executar_capturando(');
        expect(ir).toContain('call i32 @delegua_processo_ultimo_codigo_saida()');
        expect(ir).toContain('call ptr @delegua_texto_aparar(');
    });

    it('função inexistente no módulo gera erro de compilação', async () => {
        await expect(compilar(['var processo = importar("processo")', 'processo.naoExiste()'])).rejects.toThrow(
            "Função 'naoExiste' não encontrada no módulo 'processo'."
        );
    });

    it('processo.c é ligado quando o módulo é importado', () => {
        const { arquivosC } = obterBibliotecasParaCompilacao(['processo'], '/bibliotecas');
        expect(arquivosC.some((arquivo) => arquivo.endsWith('processo.c'))).toBe(true);
    });
});

describe('Compilador - módulo arquivos (sistema de arquivos e caminhos)', () => {
    it.each([
        ['existe("x")', 'delegua_arq_existe', 'i32'],
        ['criarDiretorio("a/b")', 'delegua_arq_criar_diretorio', 'i32'],
        ['remover("a")', 'delegua_arq_remover', 'i32'],
        ['renomear("a", "b")', 'delegua_arq_renomear', 'i32'],
        ['escreverTexto("a", "b")', 'delegua_arq_escrever_texto', 'i32'],
        ['definirPermissoes("a", 448)', 'delegua_arq_definir_permissoes', 'i32'],
        ['lerTexto("a")', 'delegua_arq_ler_texto', 'ptr'],
        ['criarDiretorioTemporario("", "x-")', 'delegua_arq_criar_diretorio_temporario', 'ptr'],
        ['diretorioPessoal()', 'delegua_arq_diretorio_pessoal', 'ptr'],
        ['juntarCaminhos("a", "b")', 'delegua_arq_juntar_caminhos', 'ptr'],
        ['diretorioPai("a/b")', 'delegua_arq_diretorio_pai', 'ptr'],
        ['nomeBase("a/b")', 'delegua_arq_nome_base', 'ptr'],
        ['caminhoAbsoluto("a")', 'delegua_arq_caminho_absoluto', 'ptr'],
    ])('arquivos.%s chama %s', async (chamada, funcaoC, retorno) => {
        const ir = await compilar(['var arquivos = importar("arquivos")', `var r = arquivos.${chamada}`, 'escreva(r)']);
        expect(ir).toContain(`call ${retorno} @${funcaoC}(`);
    });

    it('listarDiretorio devolve texto[] iterável', async () => {
        const ir = await compilar([
            'var arquivos = importar("arquivos")',
            'var nomes = arquivos.listarDiretorio(".")',
            'para cada n em nomes {',
            '  escreva(n)',
            '}',
        ]);
        expect(ir).toMatch(/%(\d+) = call ptr @delegua_arq_listar_diretorio\(/);
        // O Vetor* devolvido pelo runtime fica no slot da variável e é carregado para iterar.
        expect(ir).toMatch(/call i32 @delegua_vetor_tamanho\(ptr %vetor_ptr\d*\)/);
    });
});

describe('Compilador - módulo json (inspeção e construção)', () => {
    it('tipo, valorLogico, contemCampo e chaves', async () => {
        const ir = await compilar([
            'var json = importar("json")',
            'var doc = json.textoParaJson("{}")',
            'escreva(json.tipo(doc))',
            'se json.valorLogico(json.obterCampo(doc, "a")) e json.contemCampo(doc, "a") {',
            '  escreva("sim")',
            '}',
            'var ks = json.chaves(doc)',
            'escreva(ks.tamanho())',
        ]);
        expect(ir).toContain('call ptr @delegua_json_tipo(');
        expect(ir).toContain('call i32 @delegua_json_valor_logico(');
        expect(ir).toContain('call i32 @delegua_json_contem_campo(');
        expect(ir).toContain('call ptr @delegua_json_chaves(');
    });

    it('criar e definir valores', async () => {
        const ir = await compilar([
            'var json = importar("json")',
            'var o = json.criarObjeto()',
            'var a = json.criarVetor()',
            'json.adicionarItem(a, json.criarTexto("x"))',
            'json.definirCampo(o, "lista", a)',
            'json.definirCampo(o, "n", json.criarNumero(2.5))',
            'json.definirCampo(o, "ok", json.criarLogico(verdadeiro))',
            'json.definirCampo(o, "nada", json.criarNulo())',
            'json.removerCampo(o, "nada")',
            'escreva(json.objetoParaTextoJsonFormatado(o))',
        ]);
        expect(ir).toContain('call ptr @delegua_json_criar_objeto()');
        expect(ir).toContain('call ptr @delegua_json_criar_vetor()');
        expect(ir).toContain('call i32 @delegua_json_adicionar_item(');
        expect(ir).toContain('call i32 @delegua_json_definir_campo(');
        expect(ir).toContain('call ptr @delegua_json_criar_numero(double 2.500000e+00)');
        expect(ir).toContain('call ptr @delegua_json_criar_logico(i32 1)');
        expect(ir).toContain('call ptr @delegua_json_criar_nulo()');
        expect(ir).toContain('call i32 @delegua_json_remover_campo(');
        expect(ir).toContain('call ptr @delegua_json_objeto_para_texto_formatado(');
    });
});
