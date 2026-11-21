import llvm from '@designliquido/llvm-bindings';
import { definirTipoPrevalente, operandoEhPonteiroOuTexto, tipoEhInteiroDelegua } from './ajudantes';
import { OperandoInterface } from './interfaces';
import type { CompiladorLLVM } from './compilador-llvm';

/**
 * Operações aritméticas, comparações e conversões entre tipos escalares (`inteiro`, `longo`,
 * `número`, `texto`). Implementado como mixin de CompiladorLLVM.
 */

/** Largura em bits de um valor inteiro LLVM (0 se não for inteiro). */
export function larguraInteira(this: CompiladorLLVM, valor: llvm.Value): number {
    return this.larguraTipoInteiro(valor?.getType?.());
}

/** Largura em bits de um tipo inteiro LLVM (0 se não for inteiro). */
export function larguraTipoInteiro(this: CompiladorLLVM, tipo: llvm.Type | undefined): number {
    if (!tipo || tipo.getTypeID() !== llvm.Type.TypeID.IntegerTyID) return 0;
    for (const bits of [1, 8, 16, 32, 64, 128]) {
        if (tipo.isIntegerTy(bits)) return bits;
    }
    return 0;
}

/**
 * Converte um valor escalar para o tipo LLVM de destino: inteiros de larguras diferentes
 * (`inteiro` i32 ↔ `longo` i64) são estendidos com sinal ou truncados, e inteiros ↔
 * `número` (double) são convertidos. `lógico` (i1), ponteiros e demais tipos passam sem
 * alteração.
 */
export function coagirEscalar(
    this: CompiladorLLVM,
    valor: llvm.Value,
    tipoDestino: llvm.Type,
    nome: string
): llvm.Value {
    const tipoOrigem = valor?.getType?.();
    if (!tipoOrigem || !tipoDestino) return valor;
    const larguraOrigem = this.larguraTipoInteiro(tipoOrigem);
    const larguraDestino = this.larguraTipoInteiro(tipoDestino);
    const origemEhDouble = tipoOrigem.getTypeID() === llvm.Type.TypeID.DoubleTyID;
    const destinoEhDouble = tipoDestino.getTypeID() === llvm.Type.TypeID.DoubleTyID;

    if (larguraOrigem > 1 && larguraDestino > 1 && larguraOrigem !== larguraDestino) {
        return larguraOrigem < larguraDestino
            ? this.montador.CreateSExt(valor, tipoDestino, `${nome}_sext`)
            : this.montador.CreateTrunc(valor, tipoDestino, `${nome}_trunc`);
    }
    if (origemEhDouble && larguraDestino > 1) {
        return this.montador.CreateFPToSI(valor, tipoDestino, `${nome}_fptosi`);
    }
    if (larguraOrigem > 1 && destinoEhDouble) {
        return this.montador.CreateSIToFP(valor, tipoDestino, `${nome}_sitofp`);
    }
    return valor;
}

/**
 * Operandos inteiros de larguras diferentes (`inteiro` i32 com `longo` i64): estende o mais
 * estreito, com sinal, para a largura do mais largo, e marca os dois com o tipo dele.
 */
export function igualarLargurasInteiras(
    this: CompiladorLLVM,
    esquerdo: OperandoInterface,
    direito: OperandoInterface
): void {
    if (!tipoEhInteiroDelegua(esquerdo.tipo) || !tipoEhInteiroDelegua(direito.tipo)) return;
    const larguraEsquerda = this.larguraInteira(esquerdo.valor);
    const larguraDireita = this.larguraInteira(direito.valor);
    if (larguraEsquerda <= 1 || larguraDireita <= 1 || larguraEsquerda === larguraDireita) return;
    const [estreito, largo] = larguraEsquerda < larguraDireita ? [esquerdo, direito] : [direito, esquerdo];
    estreito.valor = this.montador.CreateSExt(estreito.valor, largo.valor.getType(), 'estender_inteiro');
    estreito.tipo = largo.tipo;
}

export function resolverMultiplicacao(
    this: CompiladorLLVM,
    operandoEsquerdo: OperandoInterface,
    operandoDireito: OperandoInterface
): Promise<llvm.Value> {
    if (tipoEhInteiroDelegua(operandoEsquerdo.tipo) && tipoEhInteiroDelegua(operandoDireito.tipo)) {
        // NSW (No Signed Wrap): overflow é comportamento indefinido em Delégua,
        // o que permite ao SCEV do LLVM 21 analisar e otimizar laços com esses operandos.
        return Promise.resolve(this.montador.CreateNSWMul(operandoEsquerdo.valor, operandoDireito.valor));
    }

    return Promise.resolve(this.montador.CreateFMul(operandoEsquerdo.valor, operandoDireito.valor));
}

export function resolverAdicao(
    this: CompiladorLLVM,
    operandoEsquerdo: OperandoInterface,
    operandoDireito: OperandoInterface
): Promise<llvm.Value> {
    if (operandoEhPonteiroOuTexto(operandoEsquerdo) || operandoEhPonteiroOuTexto(operandoDireito)) {
        const fmtConcatenar = this.montador.CreateGlobalStringPtr('%s%s', 'fmt_concat', 0, this.modulo);
        const esquerdaTextoSeguro = this.normalizarOperandoParaTextoSeguro(operandoEsquerdo, 'concat_esq');
        const direitaTextoSeguro = this.normalizarOperandoParaTextoSeguro(operandoDireito, 'concat_dir');
        return Promise.resolve(
            this.montador.CreateCall(this.funcaoFormatar, [fmtConcatenar, esquerdaTextoSeguro, direitaTextoSeguro])
        );
    }

    if (tipoEhInteiroDelegua(operandoEsquerdo.tipo) && tipoEhInteiroDelegua(operandoDireito.tipo)) {
        return Promise.resolve(this.montador.CreateNSWAdd(operandoEsquerdo.valor, operandoDireito.valor));
    }

    return Promise.resolve(this.montador.CreateFAdd(operandoEsquerdo.valor, operandoDireito.valor));
}

export function resolverSubtracao(
    this: CompiladorLLVM,
    operandoEsquerdo: OperandoInterface,
    operandoDireito: OperandoInterface
): Promise<llvm.Value> {
    if (tipoEhInteiroDelegua(operandoEsquerdo.tipo) && tipoEhInteiroDelegua(operandoDireito.tipo)) {
        return Promise.resolve(this.montador.CreateNSWSub(operandoEsquerdo.valor, operandoDireito.valor));
    }

    return Promise.resolve(this.montador.CreateFSub(operandoEsquerdo.valor, operandoDireito.valor));
}

export function resolverDivisao(
    this: CompiladorLLVM,
    operandoEsquerdo: OperandoInterface,
    operandoDireito: OperandoInterface
): Promise<llvm.Value> {
    if (tipoEhInteiroDelegua(operandoEsquerdo.tipo) && tipoEhInteiroDelegua(operandoDireito.tipo)) {
        return Promise.resolve(this.montador.CreateSDiv(operandoEsquerdo.valor, operandoDireito.valor));
    }

    return Promise.resolve(this.montador.CreateFDiv(operandoEsquerdo.valor, operandoDireito.valor));
}

export function resolverModulo(
    this: CompiladorLLVM,
    operandoEsquerdo: OperandoInterface,
    operandoDireito: OperandoInterface
): Promise<llvm.Value> {
    if (tipoEhInteiroDelegua(operandoEsquerdo.tipo) && tipoEhInteiroDelegua(operandoDireito.tipo)) {
        return Promise.resolve(this.montador.CreateSRem(operandoEsquerdo.valor, operandoDireito.valor));
    }

    return Promise.resolve(this.montador.CreateFRem(operandoEsquerdo.valor, operandoDireito.valor));
}

export function resolverExponenciacao(
    this: CompiladorLLVM,
    operandoEsquerdo: OperandoInterface,
    operandoDireito: OperandoInterface
): Promise<llvm.Value> {
    // pow() do libm/ucrt só opera em double — promove os operandos e, se ambos eram
    // inteiros, converte o resultado de volta ao tipo (largura) inteiro original.
    const baseDouble =
        operandoEsquerdo.tipo === 'número'
            ? operandoEsquerdo.valor
            : this.montador.CreateSIToFP(operandoEsquerdo.valor, this.montador.getDoubleTy(), 'pot_base');
    const expoenteDouble =
        operandoDireito.tipo === 'número'
            ? operandoDireito.valor
            : this.montador.CreateSIToFP(operandoDireito.valor, this.montador.getDoubleTy(), 'pot_expoente');

    const resultado = this.montador.CreateCall(this.funcaoPotencia, [baseDouble, expoenteDouble], 'pot_resultado');

    const tipoResultado = definirTipoPrevalente(operandoEsquerdo.tipo, operandoDireito.tipo);
    if (tipoEhInteiroDelegua(tipoResultado)) {
        return Promise.resolve(this.montador.CreateFPToSI(resultado, this.obterTipoLlvm(tipoResultado), 'pot_int'));
    }
    return Promise.resolve(resultado);
}

export function compararTextos(
    this: CompiladorLLVM,
    a: llvm.Value,
    b: llvm.Value,
    tipoA: string = 'texto',
    tipoB: string = 'texto'
): llvm.Value {
    const aSeguro = this.normalizarOperandoParaTextoSeguro({ valor: a, tipo: tipoA }, 'cmp_a');
    const bSeguro = this.normalizarOperandoParaTextoSeguro({ valor: b, tipo: tipoB }, 'cmp_b');
    return this.montador.CreateCall(this.funcaoStrcmp, [aSeguro, bSeguro]);
}

export function resolverIgualdade(
    this: CompiladorLLVM,
    operandoEsquerdo: OperandoInterface,
    operandoDireito: OperandoInterface
): Promise<llvm.Value> {
    if (tipoEhInteiroDelegua(operandoEsquerdo.tipo) && tipoEhInteiroDelegua(operandoDireito.tipo)) {
        return Promise.resolve(this.montador.CreateICmpEQ(operandoEsquerdo.valor, operandoDireito.valor));
    }
    // Comparação com nulo: ICmpEQ(ptr, null) em vez de strcmp(ptr, null) que crasharia.
    if (operandoEsquerdo.tipo === 'nulo' || operandoDireito.tipo === 'nulo') {
        return Promise.resolve(this.montador.CreateICmpEQ(operandoEsquerdo.valor, operandoDireito.valor));
    }
    if (operandoEhPonteiroOuTexto(operandoEsquerdo) || operandoEhPonteiroOuTexto(operandoDireito)) {
        const resultado = this.compararTextos(
            operandoEsquerdo.valor,
            operandoDireito.valor,
            operandoEsquerdo.tipo,
            operandoDireito.tipo
        );
        return Promise.resolve(
            this.montador.CreateICmpEQ(resultado, llvm.ConstantInt.get(this.montador.getInt32Ty(), 0))
        );
    }
    return Promise.resolve(this.montador.CreateFCmpOEQ(operandoEsquerdo.valor, operandoDireito.valor));
}
