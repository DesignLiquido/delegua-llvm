import llvm from '@designliquido/llvm-bindings';
import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';

export type RegistradorFuncaoModulo = (
    nomeCFunc: string,
    tiposParametros: string[],
    tipoRetorno: string
) => EntradaFuncaoModulo;

/**
 * Cria a função que declara as funções C de um módulo e monta sua entrada no mapaModulos.
 *
 * ABI dos módulos (tipos Delégua → C):
 *   - inteiro, lógico → int (lógico é convertido de/para i1 no despacho);
 *   - longo           → int64_t;
 *   - número          → double;
 *   - vazio           → void (apenas retorno);
 *   - texto, vetores (`texto[]`), objetos opacos → ponteiro.
 */
export function criarRegistradorFuncaoModulo(compilador: CompiladorLLVM): RegistradorFuncaoModulo {
    const ptr = compilador.montador.getPtrTy();
    const i32 = compilador.montador.getInt32Ty();
    const double = compilador.montador.getDoubleTy();
    const vazio = llvm.Type.getVoidTy(compilador.contexto);

    const paraLlvm = (tipo: string): llvm.Type => {
        switch (tipo) {
            case 'inteiro':
            case 'lógico':
            case 'logico':
                return i32;
            case 'longo':
                return llvm.Type.getInt64Ty(compilador.contexto);
            case 'numero':
            case 'número':
                return double;
            case 'vazio':
                return vazio;
            default:
                return ptr;
        }
    };

    return (nomeCFunc, tiposParametros, tipoRetorno) => {
        const tipo = llvm.FunctionType.get(paraLlvm(tipoRetorno), tiposParametros.map(paraLlvm), false);
        const callee = compilador.modulo.getOrInsertFunction(nomeCFunc, tipo);
        return { callee, tiposParametros, tipoRetorno };
    };
}
