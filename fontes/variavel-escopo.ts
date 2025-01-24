import { Construto } from "@designliquido/delegua/construtos";

export class VariavelEscopo {
    variavelLlvm: llvm.Value;
    construtoVariavel: Construto;

    constructor(variavelLlvm: llvm.Value, construtoVariavel?: Construto) {
        this.variavelLlvm = variavelLlvm;
        this.construtoVariavel = construtoVariavel;
    }
}