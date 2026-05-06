import { ConstrutoInterface } from "@designliquido/delegua/interfaces";

export interface AcessoNomeavel {
    simbolo?: { lexema?: string };
    nomeMetodo?: string;
    nomePropriedade?: string;
    entidadeChamada?: ConstrutoInterface;
    entidade?: ConstrutoInterface;
    variavel?: ConstrutoInterface;
    objeto?: ConstrutoInterface;
}
