/// <reference types="jest" />
import { PilhaVariaveisEscopo } from '../fontes/pilha-variaveis-escopo';
import { VariavelEscopo } from '../fontes/variavel-escopo';

describe('PilhaVariaveisEscopo', () => {
    it('inicia vazia', () => {
        const pilha = new PilhaVariaveisEscopo();
        expect(pilha.eVazio()).toBe(true);
    });

    it('empilhar adiciona escopo e deixa de estar vazia', () => {
        const pilha = new PilhaVariaveisEscopo();
        pilha.empilhar(new Map());
        expect(pilha.eVazio()).toBe(false);
    });

    it('topoDaPilha retorna o último escopo empilhado', () => {
        const pilha = new PilhaVariaveisEscopo();
        const escopoBase = new Map<string, VariavelEscopo>();
        const escopoTopo = new Map<string, VariavelEscopo>();
        pilha.empilhar(escopoBase);
        pilha.empilhar(escopoTopo);
        expect(pilha.topoDaPilha()).toBe(escopoTopo);
    });

    it('topoDaPilha lança erro com pilha vazia', () => {
        const pilha = new PilhaVariaveisEscopo();
        expect(() => pilha.topoDaPilha()).toThrow('Pilha vazia.');
    });

    it('removerUltimo remove e retorna o escopo do topo', () => {
        const pilha = new PilhaVariaveisEscopo();
        const escopo = new Map<string, VariavelEscopo>();
        pilha.empilhar(escopo);
        expect(pilha.removerUltimo()).toBe(escopo);
        expect(pilha.eVazio()).toBe(true);
    });

    it('removerUltimo lança erro com pilha vazia', () => {
        const pilha = new PilhaVariaveisEscopo();
        expect(() => pilha.removerUltimo()).toThrow('Pilha vazia.');
    });

    it('fundoDaPilha retorna o primeiro escopo empilhado', () => {
        const pilha = new PilhaVariaveisEscopo();
        const escopoBase = new Map<string, VariavelEscopo>();
        const escopoTopo = new Map<string, VariavelEscopo>();
        pilha.empilhar(escopoBase);
        pilha.empilhar(escopoTopo);
        expect(pilha.fundoDaPilha()).toBe(escopoBase);
    });

    it('fundoDaPilha lança erro com pilha vazia', () => {
        const pilha = new PilhaVariaveisEscopo();
        expect(() => pilha.fundoDaPilha()).toThrow('Pilha vazia.');
    });

    it('obterValor encontra variável no escopo mais próximo do topo', () => {
        const pilha = new PilhaVariaveisEscopo();
        const variavelBase = new VariavelEscopo({} as any, undefined, 'inteiro');
        const variavelTopo = new VariavelEscopo({} as any, undefined, 'texto');
        pilha.empilhar(new Map([['x', variavelBase]]));
        pilha.empilhar(new Map([['x', variavelTopo]]));
        expect(pilha.obterValor('x')).toBe(variavelTopo);
    });

    it('obterValor busca em escopos mais externos quando não encontra no topo', () => {
        const pilha = new PilhaVariaveisEscopo();
        const variavelBase = new VariavelEscopo({} as any, undefined, 'inteiro');
        pilha.empilhar(new Map([['y', variavelBase]]));
        pilha.empilhar(new Map());
        expect(pilha.obterValor('y')).toBe(variavelBase);
    });

    it('obterValor lança erro para variável não definida em nenhum escopo', () => {
        const pilha = new PilhaVariaveisEscopo();
        pilha.empilhar(new Map());
        expect(() => pilha.obterValor('inexistente')).toThrow("Variável não definida: 'inexistente'.");
    });
});
