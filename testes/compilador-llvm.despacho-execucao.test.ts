/// <reference types="jest" />
import { execFile, execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Compila e executa programas com despacho dinâmico e `longo`. A saída do executável é a
// especificação: o IR sozinho não mostra que o `__tipoId` escolhe a implementação certa.
// Precisa do clang para ligar o executável (o ambiente de testes de unidade pode não ter).
const temClang = spawnSync('clang', ['--version'], { stdio: 'ignore' }).status === 0;
const descrever = temClang ? describe : describe.skip;

descrever('Despacho dinâmico e longo - execução', () => {
    let diretorio = '';

    beforeAll(() => {
        diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'delegua-despacho-'));
    });

    afterAll(() => {
        fs.rmSync(diretorio, { recursive: true, force: true });
    });

    async function compilarEExecutar(nome: string, linhas: string[]): Promise<string[]> {
        const fonte = path.join(diretorio, `${nome}.delegua`);
        fs.writeFileSync(fonte, linhas.join('\n'));
        const raiz = path.resolve(__dirname, '..');
        // Caminho absoluto em -o: o binário deve sair exatamente nele.
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

    it('sobrescritas, super, isto.metodo() e interfaces', async () => {
        const linhas = await compilarEExecutar('despacho', [
            'interface Fonte {',
            '    versoes(nome: texto): texto[]',
            '    descricao(): texto',
            '}',
            'classe FonteMemoria implementa Fonte {',
            '    versoes(nome: texto): texto[] { retorna ["1.0.0"] }',
            '    descricao(): texto { retorna "memoria" }',
            '}',
            'classe FonteRegistro implementa Fonte {',
            '    url: texto',
            '    construtor(url: texto) { isto.url = url }',
            '    versoes(nome: texto): texto[] { retorna ["2.0.0", "2.1.0"] }',
            '    descricao(): texto { retorna "registro " + isto.url }',
            '}',
            'classe FonteCache herda FonteMemoria {',
            '    descricao(): texto { retorna "cache sobre " + super.descricao() }',
            '}',
            'funcao usar(f: Fonte) {',
            '    var vs: texto[] = f.versoes("a")',
            '    escreva(f.descricao() + ": " + vs[0] + " (" + texto(vs.tamanho()) + ")")',
            '}',
            'usar(FonteMemoria())',
            'usar(FonteRegistro("http://x"))',
            'usar(FonteCache())',
            'classe Animal {',
            '    nome(): texto { retorna "animal" }',
            '    apresentar(): texto { retorna "sou " + isto.nome() }',
            '    patas(): inteiro { retorna 4 }',
            '}',
            'classe Ave herda Animal {',
            '    nome(): texto { retorna "ave" }',
            '    patas(): inteiro { retorna 2 }',
            '}',
            'classe Pinguim herda Ave {',
            '    nome(): texto { retorna "pinguim" }',
            '}',
            'funcao mostrar(a: Animal) { escreva(a.apresentar() + " com " + texto(a.patas()) + " patas") }',
            'mostrar(Animal())',
            'mostrar(Ave())',
            'mostrar(Pinguim())',
            'var p: Ave = Pinguim()',
            'escreva(p.nome())',
        ]);

        expect(linhas).toEqual([
            'memoria: 1.0.0 (1)',
            'registro http://x: 2.0.0 (2)',
            'cache sobre memoria: 1.0.0 (1)',
            'sou animal com 4 patas',
            'sou ave com 2 patas',
            'sou pinguim com 2 patas',
            'pinguim',
        ]);
    }, 300000);

    it('valor de interface repassado, guardado em campo e retornado', async () => {
        const linhas = await compilarEExecutar('interface-valor', [
            'interface F {',
            '    nome(): texto',
            '}',
            'classe M implementa F {',
            '    nome(): texto { retorna "m" }',
            '}',
            'classe N implementa F {',
            '    nome(): texto { retorna "n" }',
            '}',
            'funcao interna(f: F): texto { retorna f.nome() }',
            'funcao externa(f: F): texto { retorna interna(f) }',
            'classe Dono {',
            '    f: F',
            '    construtor(f: F) { isto.f = f }',
            '    direto(): texto { retorna isto.f.nome() }',
            '    repassar(): texto { retorna interna(isto.f) }',
            '}',
            'funcao criar(): F { retorna N() }',
            'funcao devolver(f: F): F { retorna f }',
            'escreva(externa(M()))',
            'var d = Dono(N())',
            'escreva(d.direto())',
            'escreva(d.repassar())',
            'var g: F = criar()',
            'escreva(interna(g))',
            'escreva(devolver(M()).nome())',
        ]);

        expect(linhas).toEqual(['m', 'n', 'n', 'n', 'm']);
    }, 300000);

    it('longo em campos de classe, longo(texto) e escreva', async () => {
        const linhas = await compilarEExecutar('longo', [
            'classe V {',
            '    maior: longo',
            '    construtor(m: longo) { isto.maior = m }',
            '}',
            'var v = V(9999999999)',
            'escreva(v.maior)',
            'escreva(v.maior + 1)',
            'escreva(longo("12345678901"))',
            'var t: texto = "98765432109"',
            'var n: longo = longo(t)',
            'escreva(n > v.maior)',
        ]);

        expect(linhas).toEqual(['9999999999', '10000000000', '12345678901', '1']);
    }, 300000);
});
