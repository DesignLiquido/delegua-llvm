import llvm from '@designliquido/llvm-bindings';

// Entrada no mapaModulos: associa um FunctionCallee LLVM à assinatura da função.
export interface EntradaFuncaoModulo {
    callee: llvm.FunctionCallee;
    tiposParametros: string[];
    tipoRetorno: string;
}
