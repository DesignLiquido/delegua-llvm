/// <reference types="jest" />
import * as caminho from 'path';

import { localizarPacote, removerComentariosJsonc, sistemaOperacionalAtual } from '../fontes/pacotes';
import { ehImportacaoResolvida, resolverEMesclarDeclaracoes } from '../fontes/resolucao-importacoes';
import { CompiladorLLVM } from '../fontes/compilador-llvm';

const diretorioProjeto = caminho.join(__dirname, 'exemplos', 'pacotes', 'projeto');
const diretorioPacotes = caminho.join(diretorioProjeto, 'pacotes', 'llvm');

describe('removerComentariosJsonc', () => {
    it('remove comentários de linha e de bloco', () => {
        const texto = '{\n  // linha\n  "a": 1, /* bloco */ "b": 2\n}';
        expect(JSON.parse(removerComentariosJsonc(texto))).toEqual({ a: 1, b: 2 });
    });

    it('preserva barras dentro de textos', () => {
        const texto = '{ "url": "https://exemplo.com/a//b", "c": "/* não é comentário */", "e": "aspas \\" // x" }';
        expect(JSON.parse(removerComentariosJsonc(texto))).toEqual({
            url: 'https://exemplo.com/a//b',
            c: '/* não é comentário */',
            e: 'aspas " // x',
        });
    });

    it('rejeita comentário de bloco não fechado', () => {
        expect(() => removerComentariosJsonc('{ /* aberto ')).toThrow('comentário de bloco não fechado');
    });
});

describe('localizarPacote', () => {
    it('encontra o pacote em pacotes/llvm/<nome> e lê o ponto de entrada', () => {
        const pacote = localizarPacote('formato', diretorioProjeto);
        expect(pacote).not.toBeNull();
        expect(pacote.pontoDeEntrada).toBe(caminho.join(diretorioPacotes, 'formato', 'formato.delegua'));
        expect(pacote.fontesNativas).toEqual([]);
    });

    it('sobe a árvore de diretórios a partir do diretório inicial', () => {
        const pacote = localizarPacote('formato', caminho.join(diretorioProjeto, 'lib', 'mais', 'fundo'));
        expect(pacote?.nome).toBe('formato');
    });

    it('um pacote encontra suas dependências instaladas na raiz do projeto', () => {
        const pacote = localizarPacote('formato', caminho.join(diretorioPacotes, 'saudacao'));
        expect(pacote?.diretorio).toBe(caminho.join(diretorioPacotes, 'formato'));
    });

    it('lê fontes nativas e bibliotecas do sistema operacional atual', () => {
        const pacote = localizarPacote('saudacao', diretorioProjeto);
        expect(pacote.fontesNativas).toEqual([caminho.join(diretorioPacotes, 'saudacao', 'c', 'nativo.c')]);
        const esperadas = sistemaOperacionalAtual() === 'windows' ? [] : ['m'];
        expect(pacote.bibliotecasNativas).toEqual(esperadas);
    });

    it('retorna null para pacote não instalado', () => {
        expect(localizarPacote('nao-instalado', diretorioProjeto)).toBeNull();
    });

    it('não aceita nomes que escapariam de pacotes/llvm', () => {
        expect(localizarPacote('../formato', diretorioProjeto)).toBeNull();
        expect(localizarPacote('formato/../saudacao', diretorioProjeto)).toBeNull();
    });

    it('rejeita pontoDeEntrada fora do diretório do pacote', () => {
        expect(() => localizarPacote('fora-do-pacote', diretorioProjeto)).toThrow('fora do pacote');
    });

    it('rejeita bibliotecas nativas que não são nomes de biblioteca', () => {
        expect(() => localizarPacote('biblioteca-invalida', diretorioProjeto)).toThrow('biblioteca nativa inválida');
    });
});

describe('Importação de pacotes instalados', () => {
    it('ehImportacaoResolvida reconhece pacote instalado, mas não módulo embutido nem nome desconhecido', () => {
        expect(ehImportacaoResolvida('importar { saudar } de "saudacao"', diretorioProjeto)).toBe(true);
        expect(ehImportacaoResolvida('importar { tipo } de "json"', diretorioProjeto)).toBe(false);
        expect(ehImportacaoResolvida('importar { x } de "nao-instalado"', diretorioProjeto)).toBe(false);
        expect(ehImportacaoResolvida('importar { x } de "./lib/util"', diretorioProjeto)).toBe(true);
    });

    it('resolve o pacote e suas dependências, coletando fontes nativas', async () => {
        const { declaracoes, contexto } = await resolverEMesclarDeclaracoes(
            ['importar { saudar } de "saudacao"'],
            diretorioProjeto
        );
        const nomes = declaracoes.map((d: any) => d.simbolo?.lexema);
        // A dependência (formato) vem antes do pacote que a usa.
        expect(nomes.indexOf('entreColchetes')).toBeLessThan(nomes.indexOf('saudar'));
        expect([...contexto.pacotes.keys()].sort()).toEqual(['formato', 'saudacao']);
        expect([...contexto.fontesNativas]).toEqual([caminho.join(diretorioPacotes, 'saudacao', 'c', 'nativo.c')]);
    });

    it('registra módulos embutidos usados por arquivos importados', async () => {
        const { contexto } = await resolverEMesclarDeclaracoes(['importar { tipoDe } de "./lib/util"'], diretorioProjeto);
        expect([...contexto.modulosEmbutidos]).toEqual(['json']);
    });

    it('compila chamadas a funções de pacote, de dependência transitiva e de arquivo importado', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar(
            [
                'importar { saudar, dobrar } de "saudacao"',
                'importar { tipoDe } de "./lib/util"',
                'escreva(saudar("mundo"))',
                'escreva(dobrar(21))',
                'escreva(tipoDe("[1]"))',
            ],
            false,
            diretorioProjeto
        );
        expect(resultado).toContain('define ptr @saudar(');
        expect(resultado).toContain('define ptr @entreColchetes(');
        expect(resultado).toContain('define ptr @tipoDe(');
        // biblioteca="nativo": símbolo vem das fontes do pacote, sem -l.
        expect(resultado).toContain('declare i32 @saudacao_nativo_dobro(i32');
        expect(resultado).not.toContain('-lnativo');
        // json foi importado só por lib/util.delegua, mas precisa ser registrado e ligado.
        expect(resultado).toContain('delegua_json_tipo');
        expect([...compilador.modulosUtilizados]).toContain('json');
        expect([...compilador.fontesNativasPacotes]).toEqual([
            caminho.join(diretorioPacotes, 'saudacao', 'c', 'nativo.c'),
        ]);
    });
});
