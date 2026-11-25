import { Constante, Vetor } from '@designliquido/delegua';
import { ConstrutoInterface } from '@designliquido/delegua/interfaces';
import llvm, { APInt, ConstantInt } from '@designliquido/llvm-bindings';
import { tipoEhDicionario, tipoEhVetor, tipoElementoVetor } from './ajudantes';
import { ErroCompilador } from './erros/erro-compilador';
import { VariavelEscopo } from './variavel-escopo';
import type { CompiladorLLVM } from './compilador-llvm';

/**
 * Vetores e dicionários: métodos embutidos, `mapear`, `encontrar`, e o empacotamento de valores
 * em dicionários. Implementado como mixin de CompiladorLLVM.
 */

export async function chamarMetodoDicionario(
    this: CompiladorLLVM,
    nomeMetodo: string,
    dicionarioPtr: llvm.Value,
    argumentos: ConstrutoInterface[],
    linha?: number
): Promise<llvm.Value> {
    const ptr = this.montador.getPtrTy();
    const i32 = this.montador.getInt32Ty();

    switch (nomeMetodo) {
        case 'tamanho':
            return this.montador.CreateCall(this.funcaoDicionarioTamanho, [dicionarioPtr], 'dict_tamanho');

        case 'contem':
        case 'contém': {
            const chave = await this.carregarArgumentoTexto(argumentos[0]);
            const resultado = this.montador.CreateCall(this.funcaoDicionarioContem, [dicionarioPtr, chave]);
            return this.inteiroParaLogico(resultado, 'dict_contem');
        }

        case 'remover': {
            const chave = await this.carregarArgumentoTexto(argumentos[0]);
            const funcao = this.obterFuncaoRuntime('delegua_dicionario_remover', i32, [ptr, ptr]);
            const resultado = this.montador.CreateCall(funcao, [dicionarioPtr, chave]);
            return this.inteiroParaLogico(resultado, 'dict_removido');
        }

        case 'chaves':
        case 'valores':
            return this.coletarDicionarioEmVetor(nomeMetodo, dicionarioPtr);

        default: {
            const erroDicionario = new ErroCompilador(`Método de dicionário '${nomeMetodo}' não implementado.`);
            erroDicionario.linha = linha;
            erroDicionario.tamanhoToken = nomeMetodo.length;
            throw erroDicionario;
        }
    }
}

// Preenche um %Vetor (alloca) com as chaves (char*) ou os valores (void*) do
// dicionário, em ordem de inserção.
export function coletarDicionarioEmVetor(
    this: CompiladorLLVM,
    qual: 'chaves' | 'valores',
    dicionarioPtr: llvm.Value
): llvm.Value {
    const ptr = this.montador.getPtrTy();
    const nomeC = qual === 'chaves' ? 'delegua_dicionario_chaves' : 'delegua_dicionario_valores';
    const funcao = this.obterFuncaoRuntime(nomeC, llvm.Type.getVoidTy(this.contexto), [ptr, ptr]);
    const saida = this.criarAllocaNoBlocoEntrada(this.tipoEstruturaVetor, `dict_${qual}`);
    this.montador.CreateCall(funcao, [dicionarioPtr, saida]);
    return saida;
}

// Resolve um valor a ser armazenado como valor de dicionário (sempre void*).
// Ponteiros (qualquer/texto/vetor/instâncias) são usados diretamente; escalares
// (inteiro/número/lógico/longo) são embalados em uma célula no heap, já que um
// dicionário sobrevive ao escopo/pilha de onde o valor foi lido.
export function embalarValorParaDicionario(this: CompiladorLLVM, resolvido: any): llvm.Value {
    if (resolvido instanceof VariavelEscopo) {
        const tipo = resolvido.tipo;
        const ehPonteiro =
            tipoEhDicionario(tipo) ||
            tipo === 'texto' ||
            tipo === 'qualquer' ||
            tipoEhVetor(tipo) ||
            this.ehTipoObjeto(tipo);
        // Vetor: o dicionário guarda um cabeçalho %Vetor próprio no heap. Carregar o ponteiro
        // direto da variável traria só o primeiro campo (o buffer de elementos), e o endereço
        // da variável aponta para a pilha, que não sobrevive à função que a declarou.
        if (tipoEhVetor(tipo) && this.tipoEstruturaVetor) {
            const estrutura = this.montador.CreateLoad(this.tipoEstruturaVetor, resolvido.variavelLlvm, 'dict_vetor');
            return this.embalarValorEmHeap(estrutura, this.tipoEstruturaVetor);
        }
        if (ehPonteiro) {
            return this.resolverPonteiroDireto(resolvido);
        }
        const tipoLlvmEscalar = this.obterTipoLlvm(tipo);
        const valorCarregado = this.montador.CreateLoad(tipoLlvmEscalar, resolvido.variavelLlvm, 'dict_valor_escalar');
        return this.embalarValorEmHeap(valorCarregado, tipoLlvmEscalar);
    }

    const valorLlvm = resolvido as llvm.Value;
    const construtorTipo = valorLlvm?.getType()?.constructor;
    if (construtorTipo === llvm.PointerType) {
        return valorLlvm;
    }
    return this.embalarValorEmHeap(valorLlvm, valorLlvm.getType());
}

// Aloca uma célula no heap (malloc) do tamanho do tipo dado e armazena o valor nela.
export function embalarValorEmHeap(this: CompiladorLLVM, valor: llvm.Value, tipo: llvm.Type): llvm.Value {
    const construtorTipo = tipo?.constructor;
    // Estruturas (ex.: %Vetor devolvido por valor por uma função) ocupam mais de 8 bytes.
    const tamanhoBytes = tipo?.isStructTy?.()
        ? this.layoutDados.getTypeAllocSize(tipo)
        : construtorTipo === llvm.IntegerType && tipo.isIntegerTy(32)
          ? 4
          : construtorTipo === llvm.IntegerType && tipo.isIntegerTy(1)
            ? 1
            : 8;
    const tamanho = ConstantInt.get(this.contexto, new APInt(64, tamanhoBytes));
    const caixa = this.montador.CreateCall(this.funcaoMalloc, [tamanho], 'dict_caixa');
    this.montador.CreateStore(valor, caixa);
    return caixa;
}

export function tamElementoEmBytes(this: CompiladorLLVM, tipoElem: string): number {
    if (tipoElem === 'inteiro') return 4;
    // número, longo, texto (ponteiro 64-bit) → 8 bytes
    return 8;
}

// Constante i32 para tamanho de elemento.
export function constTamElem(this: CompiladorLLVM, tipoElem: string): llvm.Value {
    return ConstantInt.get(this.contexto, new APInt(32, this.tamElementoEmBytes(tipoElem)));
}

export async function chamarMetodoVetor(
    this: CompiladorLLVM,
    nomeMetodo: string,
    vetorPtr: llvm.Value,
    tipoElem: string,
    argumentos: ConstrutoInterface[],
    linha?: number
): Promise<llvm.Value> {
    const tamElem = this.constTamElem(tipoElem);
    const ehNumero = ConstantInt.get(
        this.contexto,
        new APInt(32, tipoElem === 'número' || tipoElem === 'numero' ? 1 : 0)
    );

    switch (nomeMetodo) {
        case 'adicionar':
        case 'empilhar': {
            // Aloca um slot temporário no bloco de entrada para evitar stack overflow em loops.
            const tipoLlvmElem = this.obterTipoLlvm(tipoElem);
            const alocElem = this.criarAllocaNoBlocoEntrada(tipoLlvmElem, 'novo_elem');
            let valorElem: llvm.Value;
            if (tipoElem === 'inteiro') {
                valorElem = await this.carregarArgumentoInteiro(argumentos[0]);
            } else if (tipoElem === 'número' || tipoElem === 'numero') {
                valorElem = await this.carregarArgumentoNumero(argumentos[0]);
            } else if (this.ehTipoObjeto(tipoElem)) {
                // Objeto de classe: elemento do vetor é o ponteiro direto do objeto, não o
                // conteúdo — mesma convenção de carregarPtrClasseSePreciso. Sem isso, uma
                // VariavelEscopo alocada (AllocaInst) guardaria o endereço do slot da
                // pilha em vez do ponteiro do objeto, virando um ponteiro pendurado assim
                // que a função que a declarou retornar.
                const argResolvido = await argumentos[0].aceitar(this);
                valorElem =
                    argResolvido instanceof VariavelEscopo
                        ? this.carregarPtrClasseSePreciso(argResolvido)
                        : (argResolvido as llvm.Value);
            } else {
                valorElem = await this.carregarArgumentoTexto(argumentos[0]);
            }
            this.montador.CreateStore(valorElem, alocElem);
            this.cachePointerVetor.clear();
            return this.montador.CreateCall(this.funcaoVetorAdicionar, [vetorPtr, alocElem, tamElem]);
        }

        case 'removerUltimo':
            return this.montador.CreateCall(this.funcaoVetorRemoverUltimo, [vetorPtr]);

        case 'removerPrimeiro':
            return this.montador.CreateCall(this.funcaoVetorRemoverPrimeiro, [vetorPtr, tamElem]);

        case 'inverter':
            return this.montador.CreateCall(this.funcaoVetorInverter, [vetorPtr, tamElem]);

        case 'ordenar': {
            // ordenar(funcaoComparacao): ordenação estável guiada pela função.
            if (argumentos[0]) {
                return await this.ordenarComFuncao(vetorPtr, tipoElem, argumentos[0], linha);
            }
            // Ordem crescente: 0 = inteiro, 1 = número, 2 = texto (strcmp).
            const tipoOrdenacao = ConstantInt.get(
                this.contexto,
                new APInt(32, tipoElem === 'número' || tipoElem === 'numero' ? 1 : tipoElem === 'texto' ? 2 : 0)
            );
            this.montador.CreateCall(this.funcaoVetorOrdenar, [vetorPtr, tamElem, tipoOrdenacao]);
            return vetorPtr;
        }

        case 'fatiar': {
            const inicio = await this.carregarArgumentoInteiro(argumentos[0]);
            const fim = argumentos[1]
                ? await this.carregarArgumentoInteiro(argumentos[1])
                : ConstantInt.get(this.contexto, new APInt(32, 0x7fffffff));
            const alocSaida = this.criarAllocaNoBlocoEntrada(this.tipoEstruturaVetor, 'fatia');
            this.montador.CreateCall(this.funcaoVetorFatiar, [vetorPtr, inicio, fim, tamElem, alocSaida]);
            return alocSaida;
        }

        case 'juntar': {
            const sep = await this.carregarArgumentoTexto(argumentos[0]);
            if (tipoElem === 'inteiro') {
                return this.montador.CreateCall(this.funcaoVetorJuntarInteiro, [vetorPtr, sep]);
            } else if (tipoElem === 'número' || tipoElem === 'numero') {
                return this.montador.CreateCall(this.funcaoVetorJuntarNumero, [vetorPtr, sep]);
            } else {
                return this.montador.CreateCall(this.funcaoVetorJuntarTexto, [vetorPtr, sep]);
            }
        }

        case 'filtrarPor': {
            const fnPtr = await this.resolverPonteiroDeFuncao(
                argumentos[0],
                [tipoElem],
                'inteiro' // predicado retorna inteiro (0/1)
            );
            const alocSaida = this.criarAllocaNoBlocoEntrada(this.tipoEstruturaVetor, 'filtrado');
            if (tipoElem === 'inteiro') {
                this.montador.CreateCall(this.funcaoVetorFiltrarInteiro, [vetorPtr, fnPtr, alocSaida]);
            } else {
                this.montador.CreateCall(this.funcaoVetorFiltrarNumero, [vetorPtr, fnPtr, alocSaida]);
            }
            return alocSaida;
        }

        case 'mapear': {
            const tipoRetorno = tipoElem;
            const fnPtr = await this.resolverPonteiroDeFuncao(argumentos[0], [tipoElem], tipoRetorno);
            const alocSaida = this.criarAllocaNoBlocoEntrada(this.tipoEstruturaVetor, 'mapeado');
            if (tipoElem === 'inteiro') {
                this.montador.CreateCall(this.funcaoVetorMapearInteiro, [vetorPtr, fnPtr, alocSaida]);
            } else if (tipoElem === 'número' || tipoElem === 'numero') {
                this.montador.CreateCall(this.funcaoVetorMapearNumero, [vetorPtr, fnPtr, alocSaida]);
            } else {
                this.montador.CreateCall(this.funcaoVetorMapearTexto, [vetorPtr, fnPtr, alocSaida]);
            }
            return alocSaida;
        }
        case 'tamanho':
            return this.montador.CreateCall(this.funcaoVetorTamanho, [vetorPtr]);

        case 'inclui': {
            if (tipoElem === 'texto') {
                const valorBusca = await this.carregarArgumentoTexto(argumentos[0]);
                const encontrado = this.montador.CreateCall(this.funcaoVetorIncluiTexto, [vetorPtr, valorBusca]);
                // O runtime devolve int; `inclui` é lógico (i1) para poder ser retornado e
                // atribuído como tal.
                return this.montador.CreateICmpNE(
                    encontrado,
                    ConstantInt.get(this.contexto, new APInt(32, 0)),
                    'vetor_inclui'
                );
            }
            const erroInclui = new ErroCompilador(`Método 'inclui' só suportado para vetor<texto>.`);
            erroInclui.linha = linha;
            throw erroInclui;
        }

        default: {
            const erroVetor = new ErroCompilador(`Método de vetor '${nomeMetodo}' não implementado.`);
            erroVetor.linha = linha;
            erroVetor.tamanhoToken = nomeMetodo.length;
            throw erroVetor;
        }
    }
}

export async function chamarMapear(this: CompiladorLLVM, argumentos: ConstrutoInterface[]): Promise<llvm.Value> {
    // mapear(lista, fn)  →  novo vetor com fn aplicada a cada elemento
    const vetorArg = argumentos[0];
    const fnArg = argumentos[1];

    // Resolve o vetor de entrada
    const vetorResolvido = await vetorArg.aceitar(this);
    const vetorPtr: llvm.Value =
        vetorResolvido instanceof VariavelEscopo ? vetorResolvido.variavelLlvm : (vetorResolvido as llvm.Value);

    // Determina o tipo do elemento
    const tipoVetor = vetorArg.tipo ?? this.resolverTipoConstruto(vetorArg);
    const tipoElem = tipoElementoVetor(tipoVetor);
    const ehNumero = tipoElem === 'número' || tipoElem === 'numero';

    const fnPtr = await this.resolverPonteiroDeFuncao(fnArg, [tipoElem], tipoElem);

    const alocSaida = this.criarAllocaNoBlocoEntrada(this.tipoEstruturaVetor, 'mapeado');
    if (ehNumero) {
        this.montador.CreateCall(this.funcaoVetorMapearNumero, [vetorPtr, fnPtr, alocSaida]);
    } else {
        this.montador.CreateCall(this.funcaoVetorMapearInteiro, [vetorPtr, fnPtr, alocSaida]);
    }
    return alocSaida;
}

export async function chamarEncontrar(this: CompiladorLLVM, argumentos: ConstrutoInterface[]): Promise<llvm.Value> {
    // encontrar(lista, fn) → novo vetor com todos os elementos que satisfazem fn
    const vetorArg = argumentos[0];
    const fnArg = argumentos[1];

    const vetorResolvido = await vetorArg.aceitar(this);
    const vetorPtr: llvm.Value =
        vetorResolvido instanceof VariavelEscopo ? vetorResolvido.variavelLlvm : (vetorResolvido as llvm.Value);

    const tipoVetor = vetorArg.tipo ?? this.resolverTipoConstruto(vetorArg);
    const tipoElem = tipoElementoVetor(tipoVetor);

    const fnPtr = await this.resolverPonteiroDeFuncao(fnArg, [tipoElem], 'inteiro');

    const alocSaida = this.criarAllocaNoBlocoEntrada(this.tipoEstruturaVetor, 'encontrado');
    if (tipoElem === 'inteiro') {
        this.montador.CreateCall(this.funcaoVetorFiltrarInteiro, [vetorPtr, fnPtr, alocSaida]);
    } else {
        this.montador.CreateCall(this.funcaoVetorFiltrarNumero, [vetorPtr, fnPtr, alocSaida]);
    }
    return alocSaida;
}
