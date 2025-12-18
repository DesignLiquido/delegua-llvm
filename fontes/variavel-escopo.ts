import { Construto } from "@designliquido/delegua/construtos";

export class VariavelEscopo {
    variavelLlvm: llvm.Value;
    construtoVariavel: Construto;
    tipo: string;
    ehConstante: boolean;

    constructor(variavelLlvm: llvm.Value, construtoVariavel?: Construto, tipo?: string, ehConstante: boolean = false) {
        this.variavelLlvm = variavelLlvm;
        this.construtoVariavel = construtoVariavel;
        this.tipo = tipo;
        this.ehConstante = ehConstante;
    }
}