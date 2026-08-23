/**
 * Ajudantes puros para literais numéricos: reconhecimento na AST e construção
 * de constantes LLVM inteiras a partir deles.
 */
import llvm, { APInt, ConstantInt } from '@designliquido/llvm-bindings';
import { Literal } from '@designliquido/delegua';
import { ConstrutoInterface } from '@designliquido/delegua/interfaces';

/** Verifica se expressão é um literal numérico inteiro. */
export function expressaoEhLiteralInteiro(expressao: ConstrutoInterface): boolean {
    return (
        expressao.constructor === Literal &&
        typeof (expressao as Literal).valor === 'number' &&
        Number.isInteger((expressao as Literal).valor)
    );
}

/** Cria uma constante LLVM inteira de `bits` bits a partir de um número. */
export function criarConstanteInteira(contexto: llvm.LLVMContext, bits: number, valor: number): ConstantInt {
    return ConstantInt.get(contexto, new APInt(bits, valor));
}
