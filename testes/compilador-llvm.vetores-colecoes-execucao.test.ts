/// <reference types="jest" />
import { execFile, execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { CompiladorLLVM } from '../fontes/compilador-llvm';

// Correções encontradas ao compilar um programa maior (o DelProps): vetores guardados em
// dicionários, vetores devolvidos por funções passados a métodos, `inclui` como lógico e
// interfaces declaradas em outro arquivo.
const diretorioImportacoes = path.join(__dirname, 'exemplos', 'importacoes');

describe('Vetores, coleções e interfaces - IR', () => {
    it('inclui de vetor<texto> é lógico e pode ser retornado', async () => {
        const ir = await new CompiladorLLVM().compilar(
            [
                'funcao temA(lista: texto[]): lógico {',
                '    retorna lista.inclui("a")',
                '}',
                'escreva(temA(["a"]))',
            ],
            false
        );
        expect(ir).toMatch(/define i1 @temA\(ptr[^]*?icmp ne i32[^]*?ret i1/);
    });

    it('classe implementa interface declarada em arquivo importado', async () => {
        const ir = await new CompiladorLLVM().compilar(
            [
                'importar { Fala } de "./interface-fala"',
                'importar { Gato } de "./implementa-fala"',
                'funcao usar(f: Fala): texto { retorna f.falar() }',
                'escreva(usar(Gato()))',
            ],
            false,
            diretorioImportacoes
        );
        expect(ir).toContain('define ptr @Gato_falar(');
        expect(ir).toContain('@__despacho_Fala_falar');
    });
});

// Precisa do clang para ligar o executável.
const temClang = spawnSync('clang', ['--version'], { stdio: 'ignore' }).status === 0;
const descrever = temClang ? describe : describe.skip;

descrever('Vetores e coleções - execução', () => {
    let diretorio = '';

    beforeAll(() => {
        diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'delegua-vetores-colecoes-'));
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

    it('vetores guardados em dicionários sobrevivem à função e são compartilhados pelas leituras', async () => {
        const linhas = await compilarEExecutar('vetores-dicionario', [
            'classe Item {',
            '    nome: texto',
            '    construtor(nome: texto) { isto.nome = nome }',
            '}',
            'classe Registro {',
            '    grupos: dicionário',
            '    construtor() { isto.grupos = {} }',
            '    registrar(chave: texto, nome: texto) {',
            '        se (nao isto.grupos.contem(chave)) {',
            '            var novos: Item[] = []',
            '            isto.grupos[chave] = novos',
            '        }',
            '        var grupo: Item[] = isto.grupos[chave]',
            '        grupo.adicionar(Item(nome))',
            '    }',
            '    obter(chave: texto): Item[] {',
            '        var grupo: Item[] = isto.grupos[chave]',
            '        retorna grupo',
            '    }',
            '}',
            'funcao criar(): texto[] {',
            '    var lista: texto[] = []',
            '    lista.adicionar("w")',
            '    retorna lista',
            '}',
            'var registro = Registro()',
            'registro.registrar("a", "x")',
            'registro.registrar("a", "y")',
            'registro.registrar("b", "z")',
            'var itens: Item[] = registro.obter("a")',
            'escreva(texto(itens.tamanho()) + " " + itens[1].nome)',
            'var d: dicionário = {}',
            'd["k"] = criar()',
            'var lido: texto[] = d["k"]',
            'escreva(lido[0])',
        ]);
        expect(linhas).toEqual(['2 y', 'w']);
    }, 300000);

    it('vetor devolvido por função passado direto a um método', async () => {
        const linhas = await compilarEExecutar('vetor-argumento-metodo', [
            'classe Caixa {',
            '    itens: texto[]',
            '    construtor(itens: texto[]) { isto.itens = itens }',
            '}',
            'classe Guarda {',
            '    caixas: Caixa[]',
            '    construtor() { isto.caixas = [] }',
            '    guardar(itens: texto[]) { isto.caixas.adicionar(Caixa(itens)) }',
            '    total(): inteiro {',
            '        var caixa: Caixa = isto.caixas[0]',
            '        retorna caixa.itens.tamanho()',
            '    }',
            '}',
            'funcao criar(): texto[] {',
            '    var lista: texto[] = []',
            '    lista.adicionar("a")',
            '    lista.adicionar("b")',
            '    retorna lista',
            '}',
            'var guarda = Guarda()',
            'guarda.guardar(criar())',
            'escreva(texto(guarda.total()))',
        ]);
        expect(linhas).toEqual(['2']);
    }, 300000);
});
