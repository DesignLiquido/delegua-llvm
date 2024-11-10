import { PilhaInterface } from "@designliquido/delegua";

export class PilhaVariaveisEscopo implements PilhaInterface<Map<string, llvm.Value>> {
    pilha: Map<string, llvm.Value>[];

    constructor() {
        this.pilha = [];
    }

    empilhar(item: Map<string, llvm.Value>): void {
        this.pilha.push(item);
    }

    eVazio(): boolean {
        return this.pilha.length === 0;
    }

    topoDaPilha(): Map<string, llvm.Value> {
        if (this.eVazio()) throw new Error('Pilha vazia.');
        return this.pilha[this.pilha.length - 1];
    }

    removerUltimo(): Map<string, llvm.Value> {
        if (this.eVazio()) throw new Error('Pilha vazia.');
        return this.pilha.pop();
    }
}