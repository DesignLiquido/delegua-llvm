import llvm, { APInt, ConstantInt } from '@designliquido/llvm-bindings';
import { Classe, FuncaoConstruto, FuncaoDeclaracao, Literal } from '@designliquido/delegua';

import type { CompiladorLLVM } from '../compilador-llvm';
import { ConstrutoInterface } from '@designliquido/delegua/interfaces';
import { ErroCompilador } from '../erros/erro-compilador';
import { VariavelEscopo } from '../variavel-escopo';
import { tipoEhDicionario, tipoEhPonteiro, tipoEhVetor } from '../ajudantes';

/**
 * Suporte a FFI além de escalares: estruturas C, ponteiros, vetores de texto e funções
 * de retorno (callbacks). Implementado como mixin de CompiladorLLVM (ver o fim de
 * compilador-llvm.ts), como os módulos em registro-modulos/.
 *
 * Tipos aceitos em assinaturas e campos de `classe estrangeira`:
 *
 *   Delégua      C                        LLVM
 *   inteiro      int / int32_t            i32
 *   longo        int64_t / size_t         i64
 *   número       double                   double
 *   lógico       bool                     i1
 *   byte         uint8_t / char           i8   (lido como inteiro)
 *   texto        const char*              ptr
 *   ponteiro     void* (opaco)            ptr
 *   função       ponteiro de função       ptr  (função Delégua via trampolim)
 *   texto[]      char** (só parâmetro)    ptr  (ponteiro dos elementos)
 *   Estrutura    struct Estrutura*        ptr  (classe estrangeira com campos)
 */

/** Como um campo de estrutura estrangeira é lido. */
export type ModoCampoFFI = 'valor' | 'endereco' | 'byte';

export interface EstruturaEstrangeira {
    modos: Map<string, ModoCampoFFI>;
    // Tipo Delégua declarado de cada campo (antes da tradução para o tipo visível).
    tiposDeclarados: Map<string, string>;
}

function lerAtributoDefinicao(decoradores: any[] | undefined, atributo: string): any {
    for (const decorador of decoradores ?? []) {
        const nome = String(decorador?.nome ?? '').replace(/^@/, '');
        if (nome !== 'definicao') continue;
        const valor = decorador.atributos?.[atributo];
        if (valor === undefined) continue;
        return valor instanceof Literal ? valor.valor : (valor?.valor ?? valor);
    }
    return undefined;
}

function erroFFI(mensagem: string, linha?: number): ErroCompilador {
    const erro = new ErroCompilador(mensagem);
    erro.linha = linha;
    return erro;
}

/** Tipo LLVM de um tipo Delégua na fronteira com C (assinaturas e campos). */
export function tipoFFIParaLlvm(this: CompiladorLLVM, tipoDelegua: string): llvm.Type {
    switch (tipoDelegua) {
        case 'vazio':
            return llvm.Type.getVoidTy(this.contexto);
        case 'byte':
            return llvm.Type.getInt8Ty(this.contexto);
        case 'numero':
        case 'número':
            return this.montador.getDoubleTy();
        default:
            // Vetores atravessam a fronteira como ponteiro dos elementos, nunca por valor.
            if (tipoEhVetor(tipoDelegua)) return this.montador.getPtrTy();
            return this.obterTipoLlvm(tipoDelegua);
    }
}

/**
 * Registra uma `classe estrangeira` com campos como estrutura C: o struct LLVM segue a
 * disposição de memória (alinhamento natural) do compilador C da plataforma, sem o campo
 * oculto __tipoId das classes Delégua. Instâncias são ponteiros para memória zerada.
 *
 *   classe estrangeira Retangulo {
 *       largura: inteiro
 *       @definicao(tamanho=20)
 *       id: byte                  // unsigned char id[20]
 *       origem: Ponto             // struct Ponto aninhada (por valor)
 *   }
 */
export function registrarEstruturaEstrangeira(this: CompiladorLLVM, declaracao: Classe): void {
    const nomeEstrutura = declaracao.simbolo.lexema;
    const tiposLlvm: llvm.Type[] = [];
    const indices = new Map<string, number>();
    const tiposVisiveis = new Map<string, string>();
    const estrutura: EstruturaEstrangeira = { modos: new Map(), tiposDeclarados: new Map() };

    for (const propriedade of declaracao.propriedades) {
        const nomeCampo = propriedade.nome.lexema;
        const tipoCampo = propriedade.tipo || 'inteiro';
        const linha = (propriedade.nome as any).linha;

        if (tipoEhVetor(tipoCampo)) {
            throw erroFFI(
                `Campo '${nomeCampo}' de '${nomeEstrutura}': use @definicao(tamanho=N) com o tipo do elemento para vetores de tamanho fixo.`,
                linha
            );
        }

        const estruturaAninhada = this.estruturasEstrangeiras.has(tipoCampo);
        if (!estruturaAninhada && this.registroClasses.has(tipoCampo)) {
            throw erroFFI(
                `Campo '${nomeCampo}' de '${nomeEstrutura}': classes Delégua não podem ser campos de estrutura estrangeira; use 'ponteiro'.`,
                linha
            );
        }
        if (!estruturaAninhada && /^[A-Z]/.test(tipoCampo)) {
            throw erroFFI(
                `Campo '${nomeCampo}' de '${nomeEstrutura}': estrutura '${tipoCampo}' precisa ser declarada antes.`,
                linha
            );
        }

        let tipoLlvm: llvm.Type = estruturaAninhada ? this.registroClasses.get(tipoCampo) : this.tipoFFIParaLlvm(tipoCampo);
        let modo: ModoCampoFFI = estruturaAninhada ? 'endereco' : tipoCampo === 'byte' ? 'byte' : 'valor';
        let tipoVisivel = estruturaAninhada ? tipoCampo : tipoCampo === 'byte' ? 'inteiro' : tipoCampo;

        const tamanho = lerAtributoDefinicao((propriedade as any).decoradores, 'tamanho');
        if (tamanho !== undefined) {
            const quantidade = Number(tamanho);
            if (!Number.isInteger(quantidade) || quantidade <= 0) {
                throw erroFFI(`Campo '${nomeCampo}' de '${nomeEstrutura}': tamanho inválido: ${tamanho}.`, linha);
            }
            // Vetor C de tamanho fixo: ler o campo devolve o endereço do primeiro elemento.
            tipoLlvm = llvm.ArrayType.get(tipoLlvm, quantidade) as unknown as llvm.Type;
            modo = 'endereco';
            tipoVisivel = 'ponteiro';
        }

        tiposLlvm.push(tipoLlvm);
        indices.set(nomeCampo, tiposLlvm.length - 1);
        tiposVisiveis.set(nomeCampo, tipoVisivel);
        estrutura.modos.set(nomeCampo, modo);
        estrutura.tiposDeclarados.set(nomeCampo, tipoCampo);
    }

    const tipoStruct = llvm.StructType.create(this.contexto, `estrangeira.${nomeEstrutura}`);
    tipoStruct.setBody(tiposLlvm);

    this.registroClasses.set(nomeEstrutura, tipoStruct);
    this.indicesPropriedades.set(nomeEstrutura, indices);
    this.tiposPropriedades.set(nomeEstrutura, tiposVisiveis);
    this.estruturasEstrangeiras.set(nomeEstrutura, estrutura);
}

/** Tamanho em bytes de uma estrutura estrangeira (sizeof), na plataforma alvo. */
export function tamanhoEstruturaEstrangeira(this: CompiladorLLVM, nomeEstrutura: string): number {
    return Number(this.layoutDados.getTypeAllocSize(this.registroClasses.get(nomeEstrutura)));
}

/**
 * Leitura de campo de estrutura estrangeira a partir do GEP do campo. Retorna undefined
 * para campos comuns (o chamador faz o load padrão).
 */
export function lerCampoEstruturaEstrangeira(
    this: CompiladorLLVM,
    nomeEstrutura: string,
    nomeCampo: string,
    ponteiroCampo: llvm.Value
): llvm.Value | undefined {
    const modo = this.estruturasEstrangeiras.get(nomeEstrutura)?.modos.get(nomeCampo);
    if (modo === 'endereco') return ponteiroCampo;
    if (modo === 'byte') {
        const valor = this.montador.CreateLoad(llvm.Type.getInt8Ty(this.contexto), ponteiroCampo, `${nomeCampo}_byte`);
        return this.montador.CreateZExt(valor, this.montador.getInt32Ty(), nomeCampo);
    }
    return undefined;
}

/**
 * Prepara o valor a ser gravado em um campo de estrutura estrangeira. Retorna undefined
 * se o campo não é de estrutura estrangeira (o chamador segue o caminho padrão).
 */
export async function valorParaCampoEstruturaEstrangeira(
    this: CompiladorLLVM,
    nomeEstrutura: string,
    nomeCampo: string,
    valor: ConstrutoInterface,
    linha?: number
): Promise<llvm.Value | undefined> {
    const estrutura = this.estruturasEstrangeiras.get(nomeEstrutura);
    if (!estrutura) return undefined;
    const modo = estrutura.modos.get(nomeCampo);
    const tipoDeclarado = estrutura.tiposDeclarados.get(nomeCampo);
    if (modo === 'endereco') {
        throw erroFFI(
            `Campo '${nomeCampo}' de '${nomeEstrutura}' é um vetor de tamanho fixo ou estrutura aninhada: escreva nos seus elementos/campos.`,
            linha
        );
    }
    return await this.carregarArgumentoFFI(valor, tipoDeclarado);
}

/** Converte um valor para i64. */
function paraLongo(compilador: CompiladorLLVM, valor: llvm.Value): llvm.Value {
    const tipo = valor.getType();
    const i64 = llvm.Type.getInt64Ty(compilador.contexto);
    if (tipo.isIntegerTy(64)) return valor;
    if (tipo.isIntegerTy(1) || tipo.isIntegerTy(8)) return compilador.montador.CreateZExt(valor, i64, 'para_longo');
    if (tipo.isIntegerTy(32)) return compilador.montador.CreateSExt(valor, i64, 'para_longo');
    if (tipo?.constructor === llvm.Type) return compilador.montador.CreateFPToSI(valor, i64, 'para_longo');
    return valor;
}

/** Converte um valor escalar para o tipo inteiro LLVM pedido (i1, i8 ou i32). */
function paraInteiroDeLargura(compilador: CompiladorLLVM, valor: llvm.Value, bits: 1 | 8 | 32): llvm.Value {
    const tipo = valor.getType();
    const destino = bits === 1 ? llvm.Type.getInt1Ty(compilador.contexto) : bits === 8 ? llvm.Type.getInt8Ty(compilador.contexto) : compilador.montador.getInt32Ty();
    if (tipo.isIntegerTy(bits)) return valor;
    if (tipo?.constructor === llvm.Type) {
        const inteiro = compilador.montador.CreateFPToSI(valor, compilador.montador.getInt32Ty(), 'numero_para_int');
        return bits === 32 ? inteiro : paraInteiroDeLargura(compilador, inteiro, bits);
    }
    if (bits === 1) {
        const largura = [8, 32, 64].find((w) => tipo.isIntegerTy(w));
        if (largura === undefined) return valor;
        const zero = ConstantInt.get(compilador.contexto, new APInt(largura, 0));
        return compilador.montador.CreateICmpNE(valor, zero, 'para_logico');
    }
    // Lógico (i1) é estendido sem sinal; demais inteiros, com sinal.
    return tipo.isIntegerTy(1)
        ? compilador.montador.CreateZExtOrTrunc(valor, destino, `para_i${bits}`)
        : compilador.montador.CreateSExtOrTrunc(valor, destino, `para_i${bits}`);
}

async function resolverValorEscalar(compilador: CompiladorLLVM, argumento: ConstrutoInterface, tipoPadrao: string): Promise<llvm.Value> {
    const resolvido = await argumento.aceitar(compilador);
    if (resolvido instanceof VariavelEscopo) {
        const tipoLlvm = compilador.tipoFFIParaLlvm(resolvido.tipo || tipoPadrao);
        return tipoEhPonteiro(resolvido.variavelLlvm.getType())
            ? compilador.montador.CreateLoad(tipoLlvm, resolvido.variavelLlvm, 'load_arg_ffi')
            : resolvido.variavelLlvm;
    }
    return resolvido as llvm.Value;
}

/**
 * Valor de ponteiro (void*) de um argumento: instância de classe/estrutura → o objeto;
 * texto → char*; vetor → %Vetor*; dicionário → o dicionário; variável `ponteiro` → o valor.
 */
export async function carregarArgumentoPonteiro(this: CompiladorLLVM, argumento: ConstrutoInterface): Promise<llvm.Value> {
    const resolvido = await argumento.aceitar(this);
    if (resolvido instanceof VariavelEscopo) {
        const tipo = resolvido.tipo;
        const valor = resolvido.variavelLlvm;
        if (!valor) return llvm.Constant.getNullValue(this.montador.getPtrTy()) as unknown as llvm.Value;
        if (this.registroClasses.has(tipo)) return this.carregarPtrClasseSePreciso(resolvido);
        if (tipoEhVetor(tipo)) return this.resolverPonteiroEstruturaVetor(valor);
        if (tipoEhDicionario(tipo)) return this.resolverPonteiroDireto(resolvido);
        if (tipo === 'texto') {
            return valor.constructor === llvm.Argument || valor.constructor === llvm.AllocaInst
                ? this.montador.CreateLoad(this.montador.getPtrTy(), valor, 'texto_ptr')
                : valor;
        }
        // ponteiro / qualquer: alloca guarda o valor; argumento de função já é o valor.
        if (valor.constructor === llvm.AllocaInst) {
            return this.montador.CreateLoad(this.montador.getPtrTy(), valor, 'ponteiro_val');
        }
        return valor;
    }
    if (!resolvido || !(resolvido as llvm.Value).getType) {
        return llvm.Constant.getNullValue(this.montador.getPtrTy()) as unknown as llvm.Value;
    }
    const valor = resolvido as llvm.Value;
    if (valor.getType().isStructTy()) return this.resolverPonteiroEstruturaVetor(valor);
    return valor;
}

/**
 * Converte um argumento Delégua para o tipo C esperado por uma função estrangeira
 * (ou por um campo de estrutura estrangeira).
 */
export async function carregarArgumentoFFI(this: CompiladorLLVM, argumento: ConstrutoInterface, tipoPar: string): Promise<llvm.Value> {
    switch (tipoPar) {
        case 'inteiro':
            return paraInteiroDeLargura(this, await resolverValorEscalar(this, argumento, 'inteiro'), 32);
        case 'longo':
            return paraLongo(this, await resolverValorEscalar(this, argumento, 'longo'));
        case 'numero':
        case 'número':
            return await this.carregarArgumentoNumero(argumento);
        case 'lógico':
        case 'logico':
            return paraInteiroDeLargura(this, await resolverValorEscalar(this, argumento, 'lógico'), 1);
        case 'byte':
            return paraInteiroDeLargura(this, await resolverValorEscalar(this, argumento, 'inteiro'), 8);
        case 'texto':
            return await this.carregarArgumentoTexto(argumento);
        case 'função':
        case 'funcao':
            return await this.carregarArgumentoFuncaoFFI(argumento);
        default:
            if (tipoEhVetor(tipoPar)) {
                // texto[] → char**, inteiro[] → int*...: ponteiro dos elementos do vetor.
                const vetorPtr = await this.carregarArgumentoPonteiro(argumento);
                const campoElementos = this.montador.CreateInBoundsGEP(
                    this.tipoEstruturaVetor,
                    vetorPtr,
                    [ConstantInt.get(this.contexto, new APInt(32, 0)), ConstantInt.get(this.contexto, new APInt(32, 0))],
                    'campo_elementos'
                );
                return this.montador.CreateLoad(this.montador.getPtrTy(), campoElementos, 'elementos');
            }
            if (tipoPar?.startsWith('função<') || tipoPar?.startsWith('funcao<')) {
                return await this.carregarArgumentoFuncaoFFI(argumento);
            }
            return await this.carregarArgumentoPonteiro(argumento);
    }
}

/**
 * Ponteiro de função C para um argumento `função`: função nomeada ou lambda Delégua
 * (envolvida em trampolim), variável `ponteiro` com um ponteiro de função C, ou nulo.
 */
export async function carregarArgumentoFuncaoFFI(this: CompiladorLLVM, argumento: ConstrutoInterface): Promise<llvm.Value> {
    if (argumento?.constructor === FuncaoConstruto) {
        const lambda = argumento as FuncaoConstruto;
        const tiposParametros = lambda.parametros.map((parametro) => {
            if (!parametro.tipoDado || parametro.tipoDado === 'qualquer') {
                throw erroFFI(
                    `Parâmetro '${parametro.nome?.lexema}' de função passada a código C precisa de tipo declarado.`,
                    lambda.linha
                );
            }
            return parametro.tipoDado;
        });
        const tipoRetorno = lambda.tipo && lambda.tipo !== 'qualquer' ? lambda.tipo : 'vazio';
        const funcaoLambda = await this.compilarLambda(lambda, tiposParametros, tipoRetorno);
        return this.obterTrampolimFFI(funcaoLambda, tiposParametros, tipoRetorno, 'anonima');
    }

    if (argumento?.constructor === Literal && (argumento as Literal).valor === null) {
        return llvm.Constant.getNullValue(this.montador.getPtrTy()) as unknown as llvm.Value;
    }

    const resolvido = await argumento.aceitar(this);
    if (resolvido instanceof VariavelEscopo) {
        const declaracaoFuncao = resolvido.construtoVariavel as unknown as FuncaoDeclaracao;
        if (declaracaoFuncao?.funcao && resolvido.variavelLlvm?.constructor === llvm.Function) {
            const tiposParametros = declaracaoFuncao.funcao.parametros.map((parametro) => parametro.tipoDado ?? 'qualquer');
            const tipoRetorno = declaracaoFuncao.funcao.tipo ?? 'vazio';
            return this.obterTrampolimFFI(
                resolvido.variavelLlvm as llvm.Function,
                tiposParametros,
                tipoRetorno,
                declaracaoFuncao.simbolo?.lexema ?? 'funcao'
            );
        }
        // Variável `ponteiro` que já guarda um ponteiro de função C.
        return await this.carregarArgumentoPonteiro(argumento);
    }
    if (resolvido && (resolvido as llvm.Value).getType && tipoEhPonteiro((resolvido as llvm.Value).getType())) {
        return resolvido as llvm.Value;
    }
    throw erroFFI(`Argumento do tipo 'função' deve ser uma função Delégua, uma função anônima ou nulo.`, (argumento as any)?.linha);
}

/**
 * Gera (uma vez por função) uma função com convenção C que chama a função Delégua.
 *
 * Funções Delégua recebem texto e dicionário por dupla indireção (ptr para o slot do
 * valor); C passa o valor direto (char*). O trampolim recebe os valores C, guarda cada
 * texto/dicionário numa caixa na pilha e chama a função Delégua com as caixas.
 */
export function obterTrampolimFFI(
    this: CompiladorLLVM,
    funcaoAlvo: llvm.Function,
    tiposParametros: string[],
    tipoRetorno: string,
    nomeAlvo: string
): llvm.Function {
    // A chave é o próprio objeto da função: getName() lança "Illegal invocation" em
    // alguns objetos llvm.Function vindos do escopo.
    const existente = this.trampolinsFFI.get(funcaoAlvo);
    if (existente) return existente;

    for (const tipo of tiposParametros) {
        if (tipoEhVetor(tipo)) {
            throw erroFFI(`Função '${nomeAlvo}' não pode ser passada a código C: parâmetros de vetor não são suportados.`);
        }
    }

    const retornoVazio = tipoRetorno === 'vazio' || tipoRetorno === 'nulo';
    const tipoRetornoC = retornoVazio ? llvm.Type.getVoidTy(this.contexto) : this.obterTipoLlvm(tipoRetorno);
    const tiposC = tiposParametros.map((tipo) => this.obterTipoLlvm(tipo));
    const trampolim = llvm.Function.Create(
        llvm.FunctionType.get(tipoRetornoC, tiposC, false),
        llvm.Function.LinkageTypes.InternalLinkage,
        `__ffi_trampolim_${nomeAlvo}_${this.trampolinsFFI.size}`,
        this.modulo
    );

    const montador = new llvm.IRBuilder(this.contexto);
    montador.SetInsertPoint(llvm.BasicBlock.Create(this.contexto, 'entrada', trampolim));
    const argumentos: llvm.Value[] = tiposParametros.map((tipo, indice) => {
        const argumento = trampolim.getArg(indice);
        if (tipo === 'texto' || tipoEhDicionario(tipo)) {
            const caixa = montador.CreateAlloca(this.montador.getPtrTy(), null, 'caixa');
            montador.CreateStore(argumento, caixa);
            return caixa;
        }
        return argumento;
    });
    const resultado = montador.CreateCall(funcaoAlvo, argumentos);
    if (retornoVazio) {
        montador.CreateRetVoid();
    } else {
        montador.CreateRet(resultado);
    }

    this.trampolinsFFI.set(funcaoAlvo, trampolim);
    return trampolim;
}
