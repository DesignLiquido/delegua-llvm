import { ConstrutoInterface, Declaracao } from '@designliquido/delegua';

export class VariavelEscopo {
    variavelLlvm: llvm.Value;
    construtoVariavel: ConstrutoInterface | Declaracao;
    tipo: string;
    ehConstante: boolean;

    constructor(
        variavelLlvm: llvm.Value,
        construtoVariavel?: ConstrutoInterface | Declaracao,
        tipo?: string,
        ehConstante: boolean = false
    ) {
        this.variavelLlvm = variavelLlvm;
        this.construtoVariavel = construtoVariavel;
        this.tipo = tipo;
        this.ehConstante = ehConstante;
    }
}
