/// <reference types="jest" />
import * as caminho from 'path';
import { Classe } from '@designliquido/delegua';

import { ehImportacaoArquivo, resolverEMesclarDeclaracoes } from '../fontes/resolucao-importacoes';
import { CompiladorLLVM } from '../fontes/compilador-llvm';

const diretorioExemplos = caminho.join(__dirname, 'exemplos', 'importacoes');

describe('ehImportacaoArquivo', () => {
    it('reconhece importação desestruturada de arquivo relativo', () => {
        expect(ehImportacaoArquivo('importar { triplo } de "./folha"')).toBe(true);
    });

    it('reconhece importação de arquivo com caminho de diretório pai', () => {
        expect(ehImportacaoArquivo('importar tudo como m de "../modulo"')).toBe(true);
    });

    it('não reconhece importação de módulo nomeado sem caminho relativo', () => {
        expect(ehImportacaoArquivo('importar { soma } de "matematica"')).toBe(false);
    });

    it('não reconhece linha sem importar', () => {
        expect(ehImportacaoArquivo('escreva("ola")')).toBe(false);
    });
});

describe('resolverEMesclarDeclaracoes', () => {
    it('resolve uma importação simples de arquivo', async () => {
        const { declaracoes } = await resolverEMesclarDeclaracoes(
            ['importar { triplo } de "./folha"', 'escreva(triplo(2))'],
            diretorioExemplos
        );

        expect(declaracoes.length).toBe(1);
        expect((declaracoes[0] as any).simbolo.lexema).toBe('triplo');
    });

    it('resolve importações recursivas em cadeia', async () => {
        const { declaracoes } = await resolverEMesclarDeclaracoes(
            ['importar { dobroA } de "./ramo-a"'],
            diretorioExemplos
        );

        const nomes = declaracoes.map((d: any) => d.simbolo?.lexema);
        expect(nomes).toEqual(['triplo', 'dobroA']);
    });

    it('não duplica arquivo importado por múltiplos caminhos (dependência em diamante)', async () => {
        const { declaracoes } = await resolverEMesclarDeclaracoes(
            [
                'importar { dobroA } de "./ramo-a"',
                'importar { dobroB } de "./ramo-b"',
            ],
            diretorioExemplos
        );

        const nomes = declaracoes.map((d: any) => d.simbolo?.lexema);
        expect(nomes).toEqual(['triplo', 'dobroA', 'dobroB']);
    });

    it('registra classes importadas para reconhecimento em arquivos subsequentes', async () => {
        const { declaracoes } = await resolverEMesclarDeclaracoes(
            ['importar { origem } de "./usa-classe"'],
            diretorioExemplos
        );

        const nomes = declaracoes.map((d: any) => d.simbolo?.lexema);
        expect(nomes).toEqual(['Ponto', 'origem']);
        expect(declaracoes[0]).toBeInstanceOf(Classe);
    });

    it('lança erro para arquivo importado inexistente', async () => {
        await expect(
            resolverEMesclarDeclaracoes(['importar { x } de "./nao-existe"'], diretorioExemplos)
        ).rejects.toThrow('Arquivo importado não encontrado');
    });

    it('lança erro para arquivo importado com erro sintático', async () => {
        await expect(
            resolverEMesclarDeclaracoes(['importar { quebrada } de "./com-erro-sintatico"'], diretorioExemplos)
        ).rejects.toThrow(/Erros ao analisar arquivo importado/);
    });

    it('normalizarRetornosEstruturados não transforma "retorna {" sem assinatura tipada anterior', async () => {
        // Sem tipo de retorno declarado, a linha "retorna {" é deixada como está,
        // o que produz sintaxe de dicionário inválida e falha ao analisar o arquivo.
        await expect(
            resolverEMesclarDeclaracoes(['importar { foo } de "./sem-tipo-retorno"'], diretorioExemplos)
        ).rejects.toThrow(/Erros ao analisar arquivo importado/);
    });

    it('normalizarRetornosEstruturados não transforma bloco com linha de argumento inválida', async () => {
        // Uma linha dentro do bloco "retorna {" que não corresponde a "chave: valor,"
        // invalida a transformação e a linha original é mantida.
        await expect(
            resolverEMesclarDeclaracoes(['importar { bar } de "./argumento-invalido"'], diretorioExemplos)
        ).rejects.toThrow(/Erros ao analisar arquivo importado/);
    });

    it('linha sem importação de arquivo é ignorada', async () => {
        const { declaracoes } = await resolverEMesclarDeclaracoes(['escreva("ok")'], diretorioExemplos);
        expect(declaracoes).toEqual([]);
    });
});

describe('Compilador - integração com importação de arquivo (diretorioBase)', () => {
    it('compila programa principal que importa função de outro arquivo (emite definição da função)', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar(
            ['importar { triplo } de "./folha"', 'escreva("ok")'],
            false,
            diretorioExemplos
        );

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define i32 @triplo(i32');
    });

    it('compila programa principal que instancia classe importada de outro arquivo', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar(
            ['importar { Ponto } de "./classe-base"', 'var p = Ponto(3.0, 4.0)', 'escreva(p.x)'],
            false,
            diretorioExemplos
        );

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('call ptr @malloc(i64');
        expect(resultado).toContain('call void @Ponto_construtor(ptr');
    });
});
