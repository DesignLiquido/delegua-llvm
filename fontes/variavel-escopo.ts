import { Construto } from "@designliquido/delegua/construtos";

export class VariavelEscopo {
    variavelLlvm: llvm.Value;
    construtoVariavel: Construto;
    tipo: string;

    constructor(variavelLlvm: llvm.Value, construtoVariavel?: Construto, tipo?: string) {
        this.variavelLlvm = variavelLlvm;
        this.construtoVariavel = construtoVariavel;
        this.tipo = tipo;
    }
}