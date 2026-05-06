import { ConstrutoInterface } from "@designliquido/delegua/interfaces";

export interface DicionarioDialeto {
    entradas?: Array<{ chave?: ConstrutoInterface; valor?: ConstrutoInterface }>;
    chaves?: ConstrutoInterface[];
    valores?: ConstrutoInterface[];
}
