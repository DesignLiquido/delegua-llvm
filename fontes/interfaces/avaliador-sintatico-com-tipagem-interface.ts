import { Declaracao } from "@designliquido/delegua/declaracoes";

export interface AvaliadorSintaticoComTipagem {
    tiposDefinidosPorBibliotecas?: Record<string, unknown>;
    __ajusteInferenciaMembroAplicado?: boolean;
    logicaComumInferenciaTiposAcessoMetodoOuPropriedade?: (entidadeChamada: unknown) => unknown;
    tiposDefinidosEmCodigo?: Record<string, Declaracao>;
    inicializarPilhaEscopos?: () => void;
}
