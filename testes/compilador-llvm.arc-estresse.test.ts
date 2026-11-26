/// <reference types="jest" />
import { execFile, execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Fase 5.2 do ARC: programas longos (até 1 milhão de iterações) que exercitam textos, objetos,
// coleções, ciclos, exceções e módulos. Cada um roda no modo estrito (0 alocações vivas ao
// fim) e confere o pico de alocações vivas: a memória precisa ser recuperada durante a
// execução, não só no fim.
//
// Lentos para a suíte comum: só rodam com DELEGUA_TESTES_ESTRESSE=1 (como no CI com
// sanitizadores, ver .github/workflows/principal.yml). Precisam do clang.
const temClang = spawnSync('clang', ['--version'], { stdio: 'ignore' }).status === 0;
const descrever = temClang && process.env.DELEGUA_TESTES_ESTRESSE === '1' ? describe : describe.skip;

interface ResultadoExecucao {
    linhas: string[];
    pico: number;
    alocacoes: number;
}

descrever('ARC - estresse', () => {
    let diretorio = '';

    beforeAll(() => {
        diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'delegua-arc-estresse-'));
    });

    afterAll(() => {
        fs.rmSync(diretorio, { recursive: true, force: true });
    });

    async function compilarEExecutar(nome: string, linhas: string[]): Promise<ResultadoExecucao> {
        const fonte = path.join(diretorio, `${nome}.delegua`);
        fs.writeFileSync(fonte, linhas.join('\n'));
        const raiz = path.resolve(__dirname, '..');
        const executavel = path.join(diretorio, process.platform === 'win32' ? `${nome}.exe` : nome);
        execFileSync(
            process.execPath,
            [require.resolve('ts-node/dist/bin'), path.join(raiz, 'fontes', 'ilc.ts'), fonte, '-o', executavel],
            { cwd: raiz, stdio: 'pipe' }
        );
        return new Promise<ResultadoExecucao>((resolver, rejeitar) =>
            execFile(
                executavel,
                [],
                {
                    cwd: diretorio,
                    encoding: 'utf-8',
                    maxBuffer: 64 * 1024 * 1024,
                    env: { ...process.env, DELEGUA_ARC_DEPURACAO: 'estrito' },
                },
                (erro, stdout, stderr) => {
                    if (erro) return rejeitar(new Error(`código de saída ${erro.code}: ${stderr}`));
                    const relatorio = /alocacoes=(\d+) .* pico=(\d+)/.exec(stderr);
                    if (!relatorio) return rejeitar(new Error(`sem relatório do ARC: ${stderr}`));
                    resolver({
                        linhas: stdout.split(/\r?\n/).filter((linha) => linha !== ''),
                        alocacoes: Number(relatorio[1]),
                        pico: Number(relatorio[2]),
                    });
                }
            )
        );
    }

    it('textos: concatenação, interpolação, indexação, dividir e juntar em 1 milhão de iterações', async () => {
        const n = 1_000_000;
        const resultado = await compilarEExecutar('textos', [
            'var total: inteiro = 0',
            `para (var i = 0; i < ${n}; i = i + 1) {`,
            '    var s = "item " + texto(i)',
            '    var t = "${s}!"',
            '    total = total + t.tamanho()',
            '    se i % 1000 == 0 {',
            '        var partes = (s + ",a,b").dividir(",")',
            '        total = total + partes.juntar("-").tamanho()',
            '        var c = s[0]',
            '        total = total + c.tamanho()',
            '    }',
            '}',
            'escreva(total)',
        ]);
        let esperado = 0;
        for (let i = 0; i < n; i++) {
            const s = `item ${i}`;
            esperado += s.length + 1;
            if (i % 1000 === 0) esperado += `${s}-a-b`.length + 1;
        }
        expect(resultado.linhas).toEqual([String(esperado)]);
        expect(resultado.alocacoes).toBeGreaterThan(3 * n);
        expect(resultado.pico).toBeLessThan(100);
    }, 600000);

    it('objetos, vetores e dicionários sobrescritos e removidos', async () => {
        const n = 200_000;
        const resultado = await compilarEExecutar('colecoes', [
            'classe Pessoa {',
            '    nome: texto',
            '    amigos: Pessoa[]',
            '    construtor(nome: texto) { isto.nome = nome }',
            '}',
            'var porChave = {}',
            'var fila: Pessoa[] = []',
            'var anterior = Pessoa("primeira")',
            'var soma: inteiro = 0',
            `para (var i = 0; i < ${n}; i = i + 1) {`,
            '    var p = Pessoa("p" + texto(i))',
            '    p.amigos.adicionar(anterior)',
            '    anterior = p',
            '    porChave["k" + texto(i % 100)] = p',
            '    fila.adicionar(p)',
            '    se fila.tamanho() > 50 { fila.removerPrimeiro() }',
            '    se i % 7 == 0 { porChave.remover("k" + texto(i % 100)) }',
            '    p.amigos = [p.amigos[0]]',
            '    soma = soma + fila.tamanho()',
            '}',
            'escreva(soma)',
            'escreva(porChave.tamanho())',
        ]);
        let soma = 0;
        let fila = 0;
        const chaves = new Set<string>();
        for (let i = 0; i < n; i++) {
            chaves.add(`k${i % 100}`);
            fila = Math.min(fila + 1, 50);
            if (i % 7 === 0) chaves.delete(`k${i % 100}`);
            soma += fila;
        }
        expect(resultado.linhas).toEqual([String(soma), String(chaves.size)]);
        // Cada pessoa referencia a anterior: `anterior` mantém viva uma cadeia de 200 mil
        // pessoas, destruída de uma vez no fim (sem recursão: antes estourava a pilha de C).
        // Cada elo vivo são 3 alocações (pessoa, nome, vetor de amigos); os vetores substituídos
        // por `p.amigos = [...]` e os textos das chaves precisam ser liberados durante o laço.
        expect(resultado.pico).toBeLessThan(3 * n + 2000);
    }, 600000);

    it('ciclos pai ↔ filho coletados durante a execução', async () => {
        const n = 200_000;
        const resultado = await compilarEExecutar('ciclos', [
            'classe No {',
            '    pai: No',
            '    filhos: No[]',
            '}',
            'var criados = 0',
            `para (var i = 0; i < ${n}; i = i + 1) {`,
            '    var pai = No()',
            '    var filho = No()',
            '    filho.pai = pai',
            '    pai.filhos.adicionar(filho)',
            '    criados = criados + pai.filhos.tamanho()',
            '}',
            'escreva(criados)',
        ]);
        expect(resultado.linhas).toEqual([String(n)]);
        // Sem o coletor, as 4 alocações de cada iteração (2 nós + 2 vetores) ficariam todas vivas.
        expect(resultado.pico).toBeLessThan(n);
    }, 600000);

    it('exceções atravessando funções em 100 mil iterações', async () => {
        const n = 100_000;
        const resultado = await compilarEExecutar('excecoes', [
            'classe ErroValidacao herda Excecao {',
            '    campo: texto',
            '    construtor(mensagem: texto, campo: texto) {',
            '        super.construtor(mensagem)',
            '        isto.campo = campo',
            '    }',
            '}',
            'funcao validar(n: inteiro): texto {',
            '    var rotulo = "valor " + texto(n)',
            '    se n % 3 == 0 { falhar ErroValidacao("inválido: " + rotulo, rotulo) }',
            '    retorna rotulo',
            '}',
            'funcao intermediaria(n: inteiro): inteiro {',
            '    var lista: texto[] = [validar(n), "x"]',
            '    retorna lista[0].tamanho()',
            '}',
            'var validos = 0',
            'var invalidos = 0',
            `para (var i = 0; i < ${n}; i = i + 1) {`,
            '    tente {',
            '        validos = validos + intermediaria(i)',
            '    } pegue (erro: ErroValidacao) {',
            '        invalidos = invalidos + erro.campo.tamanho()',
            '    }',
            '}',
            'escreva(validos)',
            'escreva(invalidos)',
        ]);
        let validos = 0;
        let invalidos = 0;
        for (let i = 0; i < n; i++) {
            const rotulo = `valor ${i}`;
            if (i % 3 === 0) invalidos += rotulo.length;
            else validos += rotulo.length;
        }
        expect(resultado.linhas).toEqual([String(validos), String(invalidos)]);
        expect(resultado.pico).toBeLessThan(100);
    }, 600000);

    it('módulos json, csv e arquivos sem liberar à mão', async () => {
        const n = 3000;
        const resultado = await compilarEExecutar('modulos', [
            'var json = importar("json")',
            'var csv = importar("csv")',
            'var arquivos = importar("arquivos")',
            'var soma = 0',
            `para (var i = 0; i < ${n}; i = i + 1) {`,
            '    var doc = json.textoParaJson("{\\"id\\": " + texto(i) + ", \\"tags\\": [\\"a\\", \\"b\\"]}")',
            '    var tags = json.obterCampo(doc, "tags")',
            '    soma = soma + json.tamanho(tags) + json.objetoParaTextoJson(doc).tamanho()',
            '    var tabela = csv.textoParaObjetoCsv("a,b\\n" + texto(i) + ",2\\n", 44)',
            '    soma = soma + csv.obterCelula(tabela, 1, 0).tamanho()',
            '    arquivos.escreverTexto("estresse.txt", "linha " + texto(i))',
            '    var arquivo = arquivos.abrir("estresse.txt")',
            '    arquivos.recarregar(arquivo)',
            '    soma = soma + arquivos.paraTexto(arquivo).tamanho()',
            '}',
            'arquivos.remover("estresse.txt")',
            'escreva(soma)',
        ]);
        let soma = 0;
        for (let i = 0; i < n; i++) {
            soma += 2 + `{"id":${i},"tags":["a","b"]}`.length;
            soma += String(i).length;
            soma += `linha ${i}`.length;
        }
        expect(resultado.linhas).toEqual([String(soma)]);
        expect(resultado.pico).toBeLessThan(200);
    }, 600000);
});
