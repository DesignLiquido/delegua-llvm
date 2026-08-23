/// <reference types="jest" />
import { Unario } from '@designliquido/delegua';

import { definirTipoPrevalente } from '../fontes/ajudantes/tipos-delegua';
import { operandoEhPonteiroOuTexto } from '../fontes/ajudantes/valores-llvm';
import { incrementoEhPositivo } from '../fontes/ajudantes/construtos';

describe('definirTipoPrevalente', () => {
    it('prevalece texto quando um dos dois tipos é texto', () => {
        expect(definirTipoPrevalente('texto', 'inteiro')).toBe('texto');
        expect(definirTipoPrevalente('número', 'texto')).toBe('texto');
    });

    it('prevalece número quando um dos dois tipos é número', () => {
        expect(definirTipoPrevalente('número', 'inteiro')).toBe('número');
    });

    it('prevalece longo quando um dos dois tipos é longo', () => {
        expect(definirTipoPrevalente('longo', 'inteiro')).toBe('longo');
    });

    it('padrão é inteiro quando nenhum tipo especial está presente', () => {
        expect(definirTipoPrevalente('inteiro', 'inteiro')).toBe('inteiro');
    });
});

describe('operandoEhPonteiroOuTexto', () => {
    it('verdadeiro quando o tipo do operando é texto', () => {
        expect(operandoEhPonteiroOuTexto({ tipo: 'texto', valor: undefined } as any)).toBe(true);
    });

    it('falso quando o tipo não é texto e o valor não é ponteiro', () => {
        const operando = { tipo: 'inteiro', valor: { getType: () => ({ constructor: Object }) } } as any;
        expect(operandoEhPonteiroOuTexto(operando)).toBe(false);
    });
});

describe('incrementoEhPositivo', () => {
    it('falso quando construto é nulo ou indefinido', () => {
        expect(incrementoEhPositivo(null, 'i')).toBe(false);
        expect(incrementoEhPositivo(undefined, 'i')).toBe(false);
    });

    it('falso quando construto não é um Unario', () => {
        expect(incrementoEhPositivo({} as any, 'i')).toBe(false);
    });

    it('verdadeiro para i++ da mesma variável', () => {
        const operando = { tipo: 'inteiro', simbolo: { lexema: 'i' } } as any;
        const operador = { lexema: '++' } as any;
        const unario = new Unario(-1, operador, operando);
        expect(incrementoEhPositivo(unario, 'i')).toBe(true);
    });

    it('falso para ++i de outra variável', () => {
        const operando = { tipo: 'inteiro', simbolo: { lexema: 'j' } } as any;
        const operador = { lexema: '++' } as any;
        const unario = new Unario(-1, operador, operando, 'ANTES');
        expect(incrementoEhPositivo(unario, 'i')).toBe(false);
    });

    it('falso para i-- (decremento) da mesma variável', () => {
        const operando = { tipo: 'inteiro', simbolo: { lexema: 'i' } } as any;
        const operador = { lexema: '--' } as any;
        const unario = new Unario(-1, operador, operando);
        expect(incrementoEhPositivo(unario, 'i')).toBe(false);
    });
});
