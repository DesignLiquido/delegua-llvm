/**
 * Ajudantes puros para inspecionar llvm.Value / llvm.Type e operandos do
 * compilador, sem depender de estado do compilador (LLVMContext, IRBuilder etc.).
 */
import llvm, { ConstantFP } from '@designliquido/llvm-bindings';

import { VariavelEscopo } from '../variavel-escopo';
import { OperandoInterface } from '../interfaces';
import { tipoEhInteiroDelegua } from './tipos-delegua';

/** Type guard: verdadeiro se `valor` é um llvm.Value (tem getType()). */
export function ehValorLlvm(valor: unknown): valor is llvm.Value {
    return !!valor && typeof (valor as { getType?: unknown }).getType === 'function';
}

// Discrimina pelo tipo via constructor (classe LLVM) — os métodos isXxx() do binding
// falham com "Illegal invocation" quando chamados em instâncias de subclasses via
// herança de protótipo Napi, daí a comparação por construtor em vez de isPointerTy().
export function tipoEhPonteiro(tipo: llvm.Type): boolean {
    return tipo?.constructor === llvm.PointerType;
}

/**
 * Verifica se operando é inteiro, considerando tipo AST, tipo de variável
 * de escopo, ou tipo LLVM real (quando não é VariavelEscopo).
 */
export function operandoEhInteiro(tipo: string, operando: llvm.Value | VariavelEscopo | ConstantFP): boolean {
    if (tipoEhInteiroDelegua(tipo)) {
        return true;
    }

    if (operando instanceof VariavelEscopo) {
        return tipoEhInteiroDelegua(operando.tipo);
    }

    return (operando as llvm.Value).getType?.()?.constructor === llvm.IntegerType;
}

/** Verdadeiro se o operando resolvido for texto ou qualquer outro valor mantido por ponteiro. */
export function operandoEhPonteiroOuTexto(operando: OperandoInterface): boolean {
    return operando.tipo === 'texto' || tipoEhPonteiro(operando.valor?.getType?.());
}
