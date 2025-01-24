import { PilhaInterface } from "@designliquido/delegua";
import { VariavelEscopo } from "./variavel-escopo";

export class PilhaVariaveisEscopo implements PilhaInterface<Map<string, VariavelEscopo>> {
    pilha: Map<string, VariavelEscopo>[];

    constructor() {
        this.pilha = [];
    }

    empilhar(item: Map<string, VariavelEscopo>): void {
        this.pilha.push(item);
    }

    eVazio(): boolean {
        return this.pilha.length === 0;
    }

    topoDaPilha(): Map<string, VariavelEscopo> {
        if (this.eVazio()) throw new Error('Pilha vazia.');
        return this.pilha[this.pilha.length - 1];
    }

    removerUltimo(): Map<string, VariavelEscopo> {
        if (this.eVazio()) throw new Error('Pilha vazia.');
        return this.pilha.pop();
    }

    obterValor(nome: string): VariavelEscopo {
        for (let i = 1; i <= this.pilha.length; i++) {
            const escopoAtual = this.pilha[this.pilha.length - i];
            if (escopoAtual.has(nome)) {
                return escopoAtual.get(nome);
            }
        }

        throw new Error(`Variável não definida: '${nome}'.`);
    }
}