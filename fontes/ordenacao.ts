import llvm, { APFloat, APInt, ConstantFP, ConstantInt } from '@designliquido/llvm-bindings';
import { FuncaoConstruto, FuncaoDeclaracao } from '@designliquido/delegua';
import { ConstrutoInterface } from '@designliquido/delegua/interfaces';

import type { CompiladorLLVM } from './compilador-llvm';
import { ErroCompilador } from './erros/erro-compilador';
import { VariavelEscopo } from './variavel-escopo';
import { tipoEhDicionario } from './ajudantes';

/**
 * `vetor.ordenar(funcaoComparacao)`: ordenação com função de comparação, como em Delégua
 * (núcleo): a função recebe dois elementos e devolve um valor > 0 quando o primeiro deve
 * vir depois do segundo. Implementado como mixin de CompiladorLLVM.
 *
 * O tempo de execução (delegua_vetor_ordenar_com_funcao) ordena com um comparador C que recebe
 * ponteiros para os elementos; o compilador gera esse comparador para cada função Delégua.
 */

function ehNumero(tipo: string): boolean {
    return tipo === 'número' || tipo === 'numero';
}

/** Tipo de retorno padrão de uma função anônima de comparação sem tipo declarado. */
function tipoRetornoPadrao(tipoElemento: string): string {
    return ehNumero(tipoElemento) ? 'número' : 'inteiro';
}

/**
 * Gera `i32 comparador(ptr a, ptr b)`: carrega os dois elementos, chama a função Delégua
 * (com a convenção dela: texto/dicionário por caixa ptr*) e devolve 1 se o resultado for
 * maior que zero (ou verdadeiro), 0 caso contrário.
 */
export function obterComparadorOrdenacao(
    this: CompiladorLLVM,
    funcaoAlvo: llvm.Function,
    tiposParametros: string[],
    tipoRetorno: string,
    tipoElemento: string,
    nomeAlvo: string
): llvm.Function {
    const chave = `${tipoElemento}`;
    const porElemento = this.comparadoresOrdenacao.get(funcaoAlvo) ?? new Map<string, llvm.Function>();
    const existente = porElemento.get(chave);
    if (existente) return existente;

    const ptr = this.montador.getPtrTy();
    const i32 = this.montador.getInt32Ty();
    const comparador = llvm.Function.Create(
        llvm.FunctionType.get(i32, [ptr, ptr], false),
        llvm.Function.LinkageTypes.InternalLinkage,
        `__comparador_${nomeAlvo}_${this.contadorComparadores++}`,
        this.modulo
    );

    const montador = new llvm.IRBuilder(this.contexto);
    montador.SetInsertPoint(llvm.BasicBlock.Create(this.contexto, 'entrada', comparador));
    const tipoElementoLlvm = this.obterTipoLlvm(tipoElemento);

    const argumentos = [0, 1].map((indice) => {
        let valor: llvm.Value = montador.CreateLoad(tipoElementoLlvm, comparador.getArg(indice), `elemento${indice}`);
        const tipoParametro = tiposParametros[indice] && tiposParametros[indice] !== 'qualquer' ? tiposParametros[indice] : tipoElemento;
        if (tipoParametro === 'texto' || tipoEhDicionario(tipoParametro)) {
            const caixa = montador.CreateAlloca(ptr, null, `caixa${indice}`);
            montador.CreateStore(valor, caixa);
            return caixa;
        }
        // Conversões numéricas entre o tipo do elemento e o do parâmetro.
        if (ehNumero(tipoParametro) && tipoElemento === 'inteiro') {
            valor = montador.CreateSIToFP(valor, this.montador.getDoubleTy(), `numero${indice}`);
        } else if (tipoParametro === 'inteiro' && ehNumero(tipoElemento)) {
            valor = montador.CreateFPToSI(valor, i32, `inteiro${indice}`);
        }
        return valor;
    });

    const resultado = montador.CreateCall(funcaoAlvo, argumentos, 'comparacao');
    const tipoResultado = resultado.getType();
    let maiorQueZero: llvm.Value;
    if (tipoResultado.isIntegerTy(1)) {
        maiorQueZero = resultado;
    } else if (tipoResultado.isIntegerTy(32) || tipoResultado.isIntegerTy(64)) {
        const largura = tipoResultado.isIntegerTy(64) ? 64 : 32;
        maiorQueZero = montador.CreateICmpSGT(resultado, ConstantInt.get(this.contexto, new APInt(largura, 0)), 'maior');
    } else if (tipoResultado?.constructor === llvm.Type) {
        // double (comparado pelo construtor, ver carregarArgumentoInteiro).
        maiorQueZero = montador.CreateFCmpOGT(
            resultado,
            ConstantFP.get(this.montador.getDoubleTy(), new APFloat(0)) as unknown as llvm.Value,
            'maior'
        );
    } else {
        throw new ErroCompilador(
            `A função de comparação '${nomeAlvo}' de ordenar deve devolver número, inteiro ou lógico (devolve '${tipoRetorno}').`
        );
    }
    montador.CreateRet(montador.CreateZExt(maiorQueZero, i32, 'troca'));

    porElemento.set(chave, comparador);
    this.comparadoresOrdenacao.set(funcaoAlvo, porElemento);
    return comparador;
}

/** `vetor.ordenar(funcaoComparacao)`: ordena in-place e devolve o próprio vetor. */
export async function ordenarComFuncao(
    this: CompiladorLLVM,
    vetorPtr: llvm.Value,
    tipoElemento: string,
    argumento: ConstrutoInterface,
    linha?: number
): Promise<llvm.Value> {
    let funcaoAlvo: llvm.Function;
    let tiposParametros: string[];
    let tipoRetorno: string;
    let nomeAlvo: string;

    if (argumento?.constructor === FuncaoConstruto) {
        const lambda = argumento as FuncaoConstruto;
        tiposParametros = lambda.parametros.map((parametro) =>
            parametro.tipoDado && parametro.tipoDado !== 'qualquer' ? parametro.tipoDado : tipoElemento
        );
        // Sem tipo declarado, o avaliador marca a função anônima como 'vazio' ou 'qualquer'.
        tipoRetorno =
            lambda.tipo && lambda.tipo !== 'qualquer' && lambda.tipo !== 'vazio' ? lambda.tipo : tipoRetornoPadrao(tipoElemento);
        funcaoAlvo = await this.compilarLambda(lambda, tiposParametros, tipoRetorno);
        nomeAlvo = 'anonima';
    } else {
        const resolvido = await argumento.aceitar(this);
        const declaracao = resolvido instanceof VariavelEscopo ? (resolvido.construtoVariavel as unknown as FuncaoDeclaracao) : undefined;
        if (!declaracao?.funcao || resolvido.variavelLlvm?.constructor !== llvm.Function) {
            const erro = new ErroCompilador('O argumento de ordenar deve ser uma função de comparação (nomeada ou anônima).');
            erro.linha = linha;
            throw erro;
        }
        funcaoAlvo = resolvido.variavelLlvm as llvm.Function;
        tiposParametros = declaracao.funcao.parametros.map((parametro) => parametro.tipoDado ?? tipoElemento);
        tipoRetorno = declaracao.funcao.tipo ?? 'qualquer';
        nomeAlvo = declaracao.simbolo?.lexema ?? 'funcao';
    }

    if (tiposParametros.length !== 2) {
        const erro = new ErroCompilador(
            `A função de comparação de ordenar deve receber 2 parâmetros (recebe ${tiposParametros.length}).`
        );
        erro.linha = linha;
        throw erro;
    }

    const comparador = this.obterComparadorOrdenacao(funcaoAlvo, tiposParametros, tipoRetorno, tipoElemento, nomeAlvo);
    const ptr = this.montador.getPtrTy();
    const i32 = this.montador.getInt32Ty();
    const ordenar = this.obterFuncaoRuntime('delegua_vetor_ordenar_com_funcao', llvm.Type.getVoidTy(this.contexto), [ptr, i32, ptr]);
    this.montador.CreateCall(ordenar, [vetorPtr, this.constTamElem(tipoElemento), comparador]);
    return vetorPtr;
}
