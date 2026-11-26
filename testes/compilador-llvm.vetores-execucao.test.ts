/// <reference types="jest" />
import { execFile, execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Compila e executa programas que exercitam vetores como referências `Vetor*` no heap
// (Fase 0 do plano ARC). A saída do executável é a especificação: o IR sozinho não mostra
// cópias rasas, campos não inicializados ou elementos gravados com o layout errado.
// Precisa do clang para ligar o executável (o ambiente de testes de unidade pode não ter).
const temClang = spawnSync('clang', ['--version'], { stdio: 'ignore' }).status === 0;
const descrever = temClang ? describe : describe.skip;

descrever('Vetores como referências no heap - execução', () => {
    let diretorio = '';

    beforeAll(() => {
        diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'delegua-vetores-'));
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
            execFile(executavel, [], { encoding: 'utf-8' }, (erro, stdout) => (erro ? rejeitar(erro) : resolver(stdout)))
        );
        return saida.split(/\r?\n/).filter((linha) => linha !== '');
    }

    it('retorno, cópia de referência, fatiar, mapear, filtrarPor e crescimento', async () => {
        const linhas = await compilarEExecutar('vetores', [
            'funcao criar(): inteiro[] {',
            '    var r: inteiro[] = [3, 1, 2]',
            '    r.adicionar(9)',
            '    retorna r',
            '}',
            'funcao literal(): inteiro[] { retorna [7, 8] }',
            'funcao dobro(x: inteiro): inteiro { retorna x * 2 }',
            'funcao par(x: inteiro): inteiro { retorna x % 2 == 0 }',
            'var v = criar()',
            'escreva(v.tamanho())',
            'v.ordenar()',
            'escreva(v[0])',
            // `var w = v`: mesma referência — adicionar por w é visível em v.
            'var w = v',
            'w.adicionar(100)',
            'escreva(v.tamanho())',
            // Sem anotação: o tipo do elemento vem do vetor de origem, não `qualquer[]`.
            'var f = v.fatiar(1, 3)',
            'escreva(f[0])',
            'var m = v.mapear(dobro)',
            'escreva(m[4])',
            'escreva(v.filtrarPor(par).tamanho())',
            // Literal retornado assume o tipo de elemento declarado pela função.
            'escreva(literal()[1])',
            'var grande: inteiro[] = []',
            'para (var i = 0; i < 100000; i = i + 1) { grande.adicionar(i) }',
            'escreva(grande[99999])',
            'grande[100005] = 7',
            'escreva(grande.tamanho())',
        ]);
        expect(linhas).toEqual(['4', '1', '5', '2', '200', '2', '8', '99999', '100006']);
    }, 300000);

    it('campos vetor de classe começam vazios e aceitam adicionar', async () => {
        const linhas = await compilarEExecutar('campos', [
            'classe Pilha {',
            '    itens: inteiro[]',
            '    nomes: texto[]',
            '    empilhar(x: inteiro) { isto.itens.adicionar(x) }',
            '}',
            'classe Caixa {',
            '    itens: texto[]',
            '    construtor(itens: texto[]) { isto.itens = itens }',
            '    todos(): texto[] { retorna isto.itens }',
            '}',
            'var p = Pilha()',
            'p.empilhar(5)',
            'p.empilhar(6)',
            'escreva(p.itens.tamanho())',
            'escreva(p.itens[1])',
            'p.nomes.adicionar("oi")',
            'escreva(p.nomes[0])',
            'var c = Caixa("a,b,c".dividir(","))',
            'escreva(c.todos()[2])',
            'c.itens = ["x", "y"]',
            'escreva(c.itens[1])',
        ]);
        expect(linhas).toEqual(['2', '6', 'oi', 'c', 'y']);
    }, 300000);

    it('para cada sobre texto (variável e literal) e sobre dicionário', async () => {
        const linhas = await compilarEExecutar('para-cada', [
            'var palavra = "abc"',
            'var guardados: texto[] = []',
            // Cada caractere é um texto próprio: guardá-lo num vetor não aponta para a pilha.
            'para cada ch em palavra { guardados.adicionar(ch) }',
            'para cada ch em "xyz" { guardados.adicionar(ch) }',
            'escreva(guardados[0] + guardados[2] + guardados[5])',
            'var d = {"um": 1, "dois": 2}',
            'escreva(d.chaves().tamanho())',
            'para cada k em d { escreva(k) }',
        ]);
        expect(linhas).toEqual(['acz', '2', 'um', 'dois']);
    }, 300000);
});
