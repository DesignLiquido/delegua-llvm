/// <reference types="jest" />
import { execFile, execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Compila e executa programas com o ARC em modo estrito (DELEGUA_ARC_DEPURACAO=estrito): o
// programa sai com código 99 se alguma alocação gerenciada ainda estiver viva ao terminar.
// A saída confere que nada foi liberado cedo demais; o código de saída, que nada vazou.
// Precisa do clang para ligar o executável (o ambiente de testes de unidade pode não ter).
const temClang = spawnSync('clang', ['--version'], { stdio: 'ignore' }).status === 0;
const descrever = temClang ? describe : describe.skip;

descrever('ARC - execução sem vazamentos', () => {
    let diretorio = '';

    beforeAll(() => {
        diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'delegua-arc-'));
    });

    afterAll(() => {
        fs.rmSync(diretorio, { recursive: true, force: true });
    });

    async function compilarEExecutar(nome: string, linhas: string[]): Promise<string[]> {
        const fonte = path.join(diretorio, `${nome}.delegua`);
        fs.writeFileSync(fonte, linhas.join('\n'));
        const raiz = path.resolve(__dirname, '..');
        const executavel = path.join(diretorio, process.platform === 'win32' ? `${nome}.exe` : nome);
        execFileSync(
            process.execPath,
            [require.resolve('ts-node/dist/bin'), path.join(raiz, 'fontes', 'ilc.ts'), fonte, '-o', executavel],
            { cwd: raiz, stdio: 'pipe' }
        );
        const saida = await new Promise<string>((resolver, rejeitar) =>
            execFile(
                executavel,
                [],
                { encoding: 'utf-8', env: { ...process.env, DELEGUA_ARC_DEPURACAO: 'estrito' } },
                (erro, stdout, stderr) =>
                    erro ? rejeitar(new Error(`código de saída ${erro.code}: ${stderr}`)) : resolver(stdout)
            )
        );
        return saida.split(/\r?\n/).filter((linha) => linha !== '');
    }

    it('textos temporários em laços, retornos e funções', async () => {
        const linhas = await compilarEExecutar('textos', [
            'funcao saudacao(nome: texto): texto {',
            '    var prefixo = "Olá, "',
            '    se nome == "" { retorna prefixo + "ninguém" }',
            '    retorna prefixo + nome + "!"',
            '}',
            'var s = ""',
            'para (var i = 0; i < 20000; i = i + 1) { s = s + "x" }',
            'escreva(s.tamanho())',
            'var partes = "a,b,c".dividir(",")',
            'var juntos = ""',
            'para cada p em partes { juntos = juntos + p.maiusculo() }',
            'escreva(juntos)',
            'escreva(saudacao("Ana"))',
            'escreva(saudacao(""))',
            'var contagem = 0',
            'para cada c em "abcabc".substituir("b", "") { se c == "a" { contagem = contagem + 1 } }',
            'escreva(contagem)',
            'var total = s.tamanho()',
            'escreva("${total} caracteres")',
        ]);
        expect(linhas).toEqual(['20000', 'ABC', 'Olá, Ana!', 'Olá, ninguém', '2', '20000 caracteres']);
    }, 300000);

    it('objetos em campos, vetores e dicionários', async () => {
        const linhas = await compilarEExecutar('objetos', [
            'classe No {',
            '    nome: texto',
            '    filhos: No[]',
            '    construtor(nome: texto) { isto.nome = nome }',
            '    adicionar(filho: No) { isto.filhos.adicionar(filho) }',
            '}',
            'classe Arvore {',
            '    raiz: No',
            '    nos: No[]',
            '    construtor() {',
            '        isto.nos = []',
            '        isto.raiz = No("raiz")',
            '    }',
            '    criar(nome: texto): No {',
            '        var no = No(nome)',
            '        isto.nos.adicionar(no)',
            '        isto.raiz.adicionar(no)',
            '        retorna no',
            '    }',
            '}',
            'var arvore = Arvore()',
            'para (var i = 0; i < 100; i = i + 1) { arvore.criar("no" + texto(i)) }',
            'escreva(arvore.raiz.filhos.tamanho())',
            'escreva(arvore.nos[99].nome)',
            'arvore.nos.removerUltimo()',
            'escreva(arvore.raiz.filhos[99].nome)',
            'arvore.raiz = No("nova")',
            'escreva(arvore.raiz.nome)',
            'var porNome = {}',
            'porNome["a"] = No("A")',
            'porNome["a"] = No("B")',
            'var achado: No = nulo',
            'achado = porNome["a"]',
            'escreva(achado.nome)',
            'porNome.remover("a")',
            'escreva(achado.nome)',
            // `var r = nulo` (tipo nulo) que depois recebe um objeto temporário.
            'var ultimo = nulo',
            'para (var j = 0; j < 3; j = j + 1) { ultimo = arvore.criar("extra") }',
            'se ultimo == nulo { escreva("nulo") } senao { escreva("objeto") }',
        ]);
        expect(linhas).toEqual(['100', 'no99', 'no99', 'nova', 'B', 'B', 'objeto']);
    }, 300000);

    it('exceções atravessando funções liberam as variáveis das funções abandonadas', async () => {
        const linhas = await compilarEExecutar('excecoes', [
            'classe ErroRede herda Excecao {',
            '    codigo: inteiro',
            '    construtor(mensagem: texto, codigo: inteiro) {',
            '        super.construtor(mensagem)',
            '        isto.codigo = codigo',
            '    }',
            '}',
            'classe Recurso {',
            '    nome: texto',
            '    construtor(nome: texto) { isto.nome = nome }',
            '}',
            'funcao profunda(n: inteiro): texto {',
            '    var local = "nivel " + texto(n)',
            '    var recurso = Recurso(local)',
            '    var itens: Recurso[] = [recurso, Recurso("outro")]',
            '    se n == 0 { falhar ErroRede("falhou em " + local, 503) }',
            '    retorna profunda(n - 1) + local',
            '}',
            'funcao comTexto(): texto {',
            '    var temporario = "a" + "b"',
            '    falhar "simples " + temporario',
            '}',
            'var capturadas = 0',
            'var ultima = ""',
            'para (var i = 0; i < 200; i = i + 1) {',
            '    tente {',
            '        escreva(profunda(5))',
            '    } pegue (erro: ErroRede) {',
            '        capturadas = capturadas + 1',
            '        ultima = erro.mensagem + " " + texto(erro.codigo)',
            '    }',
            '}',
            'escreva(capturadas)',
            'escreva(ultima)',
            // Sem pegue correspondente: finalmente roda e a exceção chega ao tente de fora.
            'tente {',
            '    tente {',
            '        comTexto()',
            '    } pegue (erro: ErroRede) {',
            '        escreva("não deveria")',
            '    } finalmente {',
            '        escreva("finalmente")',
            '    }',
            '} pegue (erro) {',
            '    escreva(erro.mensagem)',
            '}',
        ]);
        expect(linhas).toEqual(['200', 'falhou em nivel 0 503', 'finalmente', 'simples ab']);
    }, 300000);

    it('exceção não tratada mantém o código de saída 1 no modo estrito', async () => {
        await expect(compilarEExecutar('nao-tratada', ['var s = "x" + "y"', 'falhar "fim " + s'])).rejects.toThrow(
            /código de saída 1: Erro não tratado: fim xy/
        );
    }, 300000);

    it('iterável temporário, módulos e vetores devolvidos', async () => {
        const linhas = await compilarEExecutar('modulos', [
            'var json = importar("json")',
            'funcao numeros(n: inteiro): inteiro[] {',
            '    var r: inteiro[] = []',
            '    para (var i = 0; i < n; i = i + 1) { r.adicionar(i) }',
            '    retorna r',
            '}',
            'var soma = 0',
            'para cada x em numeros(10).fatiar(5) { soma = soma + x }',
            'escreva(soma)',
            'var doc = json.textoParaJson("{\\"itens\\": [1, 2, 3]}")',
            'var itens = json.obterCampo(doc, "itens")',
            'escreva(json.tamanho(itens))',
            'escreva(json.objetoParaTextoJson(doc))',
            'var chaves = json.chaves(doc)',
            'escreva(chaves[0])',
        ]);
        expect(linhas).toEqual(['35', '3', '{"itens":[1,2,3]}', 'itens']);
    }, 300000);
});
