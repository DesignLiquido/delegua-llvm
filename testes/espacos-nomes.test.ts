/// <reference types="jest" />
import { execFile, execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as caminho from 'path';

import { resolverEMesclarDeclaracoes } from '../fontes/resolucao-importacoes';
import { CompiladorLLVM } from '../fontes/compilador-llvm';

const diretorioEspacos = caminho.join(__dirname, 'exemplos', 'importacoes', 'espacos-nomes');

function nomesDeclarados(declaracoes: any[]): string[] {
    return declaracoes.map((declaracao) => declaracao.simbolo?.lexema).filter((nome) => nome !== undefined);
}

describe('Espaços de nomes: importar tudo como m de "./arquivo"', () => {
    it('qualifica os membros do nível superior do arquivo importado, exceto classes', async () => {
        const { declaracoes } = await resolverEMesclarDeclaracoes(['importar tudo como a de "./a"'], diretorioEspacos);
        expect(nomesDeclarados(declaracoes)).toEqual([
            'a__saudacao',
            'a__nome',
            'a__dobro',
            'a__dobroMaisUm',
            'a__apresentar',
            'CaixaA',
        ]);
    });

    it('não qualifica arquivos importados só com { ... }', async () => {
        const { declaracoes } = await resolverEMesclarDeclaracoes(['importar { nome } de "./b"'], diretorioEspacos);
        expect(nomesDeclarados(declaracoes)).toEqual(['nome', 'exclamar']);
    });

    it('dois arquivos com funções de mesmo nome não colidem', async () => {
        const ir = await new CompiladorLLVM().compilar(
            ['importar tudo como a de "./a"', 'importar tudo como b de "./b"', 'escreva(a.nome() + b.nome())'],
            false,
            diretorioEspacos
        );
        expect(ir).toContain('define ptr @a__nome(');
        expect(ir).toContain('define ptr @b__nome(');
        expect(ir).toContain('call ptr @a__nome(');
        expect(ir).toContain('call ptr @b__nome(');
    });

    it('chamadas internas do arquivo usam o nome qualificado, inclusive em métodos', async () => {
        const ir = await new CompiladorLLVM().compilar(
            ['importar tudo como a de "./a"', 'escreva(a.dobroMaisUm(1))', 'escreva(a.CaixaA(2).dobrado())'],
            false,
            diretorioEspacos
        );
        expect(ir).toMatch(/define i32 @a__dobroMaisUm\(i32[^]*?call i32 @a__dobro\(/);
        expect(ir).toMatch(/define i32 @CaixaA_dobrado\(ptr[^]*?call i32 @a__dobro\(/);
    });

    it('parâmetro com o nome de um membro esconde o membro dentro da função', async () => {
        const { declaracoes } = await resolverEMesclarDeclaracoes(['importar tudo como b de "./b"'], diretorioEspacos);
        const exclamar: any = declaracoes.find((declaracao: any) => declaracao.simbolo?.lexema === 'b__exclamar');
        const retorno = JSON.stringify(exclamar.funcao.corpo, (chave, valor) => (chave === 'hashArquivo' ? undefined : valor));
        expect(retorno).toContain('"lexema":"nome"');
        expect(retorno).not.toContain('b__nome');
    });

    it('elemento de { ... } vindo de arquivo qualificado usa o nome qualificado', async () => {
        const ir = await new CompiladorLLVM().compilar(
            ['importar tudo como a de "./a"', 'importar { quadruplo } de "./usa-a"', 'escreva(quadruplo(3))'],
            false,
            diretorioEspacos
        );
        expect(ir).toMatch(/define i32 @quadruplo\(i32[^]*?call i32 @a__dobro\(/);
    });

    it('arquivo qualificado importado antes só com { ... } recebe os mesmos nomes', async () => {
        // usa-a é analisado antes da linha `tudo como`: a marcação prévia do grafo garante que
        // a.delegua já é qualificado quando usa-a o importa.
        const ir = await new CompiladorLLVM().compilar(
            ['importar { quadruplo } de "./usa-a"', 'importar tudo como a de "./a"', 'escreva(quadruplo(a.dobro(1)))'],
            false,
            diretorioEspacos
        );
        expect(ir).toContain('define i32 @a__dobro(');
        expect(ir).not.toContain('define i32 @dobro(');
    });

    it('espaço de nomes dentro de arquivo importado com espaço de nomes', async () => {
        const ir = await new CompiladorLLVM().compilar(
            ['importar tudo como aninhado de "./aninhado"', 'escreva(aninhado.nome())'],
            false,
            diretorioEspacos
        );
        expect(ir).toMatch(/define ptr @aninhado__nome\([^]*?call ptr @b__nome\(/);
    });

    it('acusa membro inexistente no espaço de nomes', async () => {
        await expect(
            resolverEMesclarDeclaracoes(['importar tudo como m de "./membro-inexistente"'], diretorioEspacos)
        ).rejects.toThrow(/'naoExiste' não é declarado em 'b'/);
        await expect(
            new CompiladorLLVM().compilar(['importar tudo como b de "./b"', 'escreva(b.naoExiste())'], false, diretorioEspacos)
        ).rejects.toThrow(/'naoExiste' não é declarado em 'b'/);
    });
});

// Precisa do clang para ligar o executável.
const temClang = spawnSync('clang', ['--version'], { stdio: 'ignore' }).status === 0;
const descrever = temClang ? describe : describe.skip;

descrever('Espaços de nomes - execução', () => {
    let diretorio = '';

    beforeAll(() => {
        diretorio = fs.mkdtempSync(caminho.join(os.tmpdir(), 'delegua-espacos-'));
    });

    afterAll(() => {
        fs.rmSync(diretorio, { recursive: true, force: true });
    });

    it('executa programa com vários espaços de nomes', async () => {
        const raiz = caminho.resolve(__dirname, '..');
        const executavel = caminho.join(diretorio, process.platform === 'win32' ? 'principal.exe' : 'principal');
        execFileSync(
            process.execPath,
            [
                require.resolve('ts-node/dist/bin'),
                caminho.join(raiz, 'fontes', 'ilc.ts'),
                caminho.join(diretorioEspacos, 'principal.delegua'),
                '-o',
                executavel,
            ],
            { cwd: raiz, stdio: 'pipe' }
        );
        const saida = await new Promise<string>((resolver, rejeitar) =>
            execFile(executavel, [], { encoding: 'utf-8' }, (erro, stdout) => (erro ? rejeitar(erro) : resolver(stdout)))
        );
        expect(saida.split(/\r?\n/).filter((linha) => linha !== '')).toEqual([
            'a',
            'b',
            'aninhado/b',
            'sou a',
            '9',
            '12',
            'oi!',
            '14',
            'olá de a',
        ]);
    }, 300000);
});
