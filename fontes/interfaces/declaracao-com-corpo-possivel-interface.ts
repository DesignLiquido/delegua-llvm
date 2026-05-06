import { Declaracao } from "@designliquido/delegua/declaracoes";

export interface DeclaracaoComCorpoPossivel {
    corpo?: { declaracoes?: Declaracao[] };
    declaracoes?: Declaracao[];
}
