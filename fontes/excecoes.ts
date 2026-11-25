import llvm, { APInt, ConstantInt } from '@designliquido/llvm-bindings';
import { BlocoPegue, Falhar, Tente } from '@designliquido/delegua';

import type { CompiladorLLVM } from './compilador-llvm';
import { ErroCompilador } from './erros/erro-compilador';
import { VariavelEscopo } from './variavel-escopo';

/**
 * Exceções (tente/pegue/senão/finalmente e falhar) com setjmp/longjmp, sem a ABI de
 * exceções de C++ — o mesmo mecanismo em Linux, macOS e Windows (MSVC e MinGW).
 * Implementado como mixin de CompiladorLLVM; o runtime está em bibliotecas/excecoes.c.
 *
 * Semântica do núcleo de Delégua:
 *   - `falhar <instância de classe>` lança o objeto; `falhar <outro valor>` lança uma
 *     instância da classe embutida `Excecao` com `mensagem` = o valor como texto;
 *   - `pegue (erro)` recebe o objeto; `pegue (erro: Tipo)` só trata instâncias de Tipo
 *     (ou subclasses); vale o primeiro bloco correspondente; sem correspondência, a
 *     exceção continua propagando (depois de `finalmente`);
 *   - exceção não tratada: a mensagem vai para a saída de erro e o programa termina com 1.
 *
 * Segurança do setjmp: variáveis alteradas dentro do `tente` não podem ficar em registradores
 * entre o setjmp e o longjmp. Funções com `tente` recebem `optnone noinline`, o que mantém as
 * variáveis na memória.
 */

export const NOME_CLASSE_EXCECAO = 'Excecao';
// Fora da faixa dos ids atribuídos às classes do programa (0, 1, 2...).
const ID_CLASSE_EXCECAO = 1000000;
// DELEGUA_TAMANHO_QUADRO_EXCECAO em excecoes.h.
const TAMANHO_QUADRO_EXCECAO = 1024;

function erroCompilacao(mensagem: string, linha?: number): ErroCompilador {
    const erro = new ErroCompilador(mensagem);
    erro.linha = linha;
    return erro;
}

/**
 * Registra a classe embutida `Excecao { mensagem: texto }`, com construtor(mensagem).
 * Deve ser chamada antes das classes do programa, para que `classe X herda Excecao`
 * encontre a superclasse.
 */
export function registrarClasseExcecao(this: CompiladorLLVM): void {
    const ptr = this.montador.getPtrTy();
    const i32 = this.montador.getInt32Ty();
    const tipoStruct = llvm.StructType.create(this.contexto, NOME_CLASSE_EXCECAO);
    tipoStruct.setBody([i32, ptr]);

    this.registroClasses.set(NOME_CLASSE_EXCECAO, tipoStruct);
    this.indicesPropriedades.set(NOME_CLASSE_EXCECAO, new Map([['__tipoId', 0], ['mensagem', 1]]));
    this.tiposPropriedades.set(NOME_CLASSE_EXCECAO, new Map([['__tipoId', 'inteiro'], ['mensagem', 'texto']]));
    this.idClasse.set(NOME_CLASSE_EXCECAO, ID_CLASSE_EXCECAO);
    this.metodosClasse.set(NOME_CLASSE_EXCECAO, new Map([['construtor', 'vazio']]));
    this.parametrosMetodosClasse.set(NOME_CLASSE_EXCECAO, new Map([['construtor', []]]));

    // Excecao_construtor(isto, mensagem): mesma convenção dos construtores Delégua (texto
    // chega por dupla indireção, ptr para o slot do valor).
    const construtor = llvm.Function.Create(
        llvm.FunctionType.get(llvm.Type.getVoidTy(this.contexto), [ptr, ptr], false),
        llvm.Function.LinkageTypes.InternalLinkage,
        `${NOME_CLASSE_EXCECAO}_construtor`,
        this.modulo
    );
    const montador = new llvm.IRBuilder(this.contexto);
    montador.SetInsertPoint(llvm.BasicBlock.Create(this.contexto, 'entrada', construtor));
    const slotMensagem = construtor.getArg(1);
    const temMensagem = montador.CreateICmpNE(slotMensagem, llvm.Constant.getNullValue(ptr) as unknown as llvm.Value, 'tem_mensagem');
    const mensagem = montador.CreateSelect(
        temMensagem,
        montador.CreateLoad(ptr, slotMensagem, 'mensagem'),
        llvm.Constant.getNullValue(ptr) as unknown as llvm.Value,
        'mensagem_ou_nulo'
    );
    const campo = montador.CreateInBoundsGEP(
        tipoStruct,
        construtor.getArg(0),
        [ConstantInt.get(this.contexto, new APInt(32, 0)), ConstantInt.get(this.contexto, new APInt(32, 1))],
        'mensagem_ptr'
    );
    montador.CreateStore(mensagem, campo);
    montador.CreateRetVoid();
}

/** Verdadeiro se a classe é `Excecao` ou herda dela. */
export function herdaDeExcecao(this: CompiladorLLVM, nomeClasse: string): boolean {
    let atual: string | undefined = nomeClasse;
    while (atual) {
        if (atual === NOME_CLASSE_EXCECAO) return true;
        atual = this.superClasses.get(atual);
    }
    return false;
}

/** Ids de tipo da classe e de todas as suas subclasses conhecidas. */
export function idsDescendentes(this: CompiladorLLVM, nomeClasse: string): number[] {
    const ids: number[] = [];
    for (const [candidata, id] of this.idClasse) {
        let atual: string | undefined = candidata;
        while (atual) {
            if (atual === nomeClasse) {
                ids.push(id);
                break;
            }
            atual = this.superClasses.get(atual);
        }
    }
    return ids;
}

/** `mensagem` de um objeto de classe derivada de Excecao. */
export function mensagemDeExcecao(this: CompiladorLLVM, objeto: llvm.Value, nomeClasse: string): llvm.Value {
    const indice = this.indicesPropriedades.get(nomeClasse)?.get('mensagem') ?? 1;
    const campo = this.montador.CreateInBoundsGEP(
        this.registroClasses.get(nomeClasse),
        objeto,
        [ConstantInt.get(this.contexto, new APInt(32, 0)), ConstantInt.get(this.contexto, new APInt(32, indice))],
        'mensagem_excecao_ptr'
    );
    return this.montador.CreateLoad(this.montador.getPtrTy(), campo, 'mensagem_excecao');
}

/** Nova instância de Excecao com a mensagem (char*). */
export function criarObjetoExcecao(this: CompiladorLLVM, mensagem: llvm.Value): llvm.Value {
    const tipoStruct = this.registroClasses.get(NOME_CLASSE_EXCECAO);
    const objeto = this.alocarObjetoArc(NOME_CLASSE_EXCECAO, 'excecao');
    const zero = ConstantInt.get(this.contexto, new APInt(32, 0));
    const campoTipo = this.montador.CreateInBoundsGEP(tipoStruct, objeto, [zero, zero], 'excecao_tipo_ptr');
    this.montador.CreateStore(ConstantInt.get(this.contexto, new APInt(32, ID_CLASSE_EXCECAO)), campoTipo);
    const campoMensagem = this.montador.CreateInBoundsGEP(
        tipoStruct,
        objeto,
        [zero, ConstantInt.get(this.contexto, new APInt(32, 1))],
        'excecao_mensagem_ptr'
    );
    this.montador.CreateStore(mensagem, campoMensagem);
    return objeto;
}

function funcaoLancar(compilador: CompiladorLLVM): llvm.FunctionCallee {
    const ptr = compilador.montador.getPtrTy();
    const funcao = compilador.obterFuncaoRuntime('delegua_excecao_lancar', llvm.Type.getVoidTy(compilador.contexto), [ptr, ptr]);
    compilador.modulo.getFunction('delegua_excecao_lancar')?.addFnAttr(
        llvm.Attribute.get(compilador.contexto, llvm.Attribute.AttrKind.NoReturn)
    );
    return funcao;
}

/** `falhar <expressão>`. */
export async function compilarFalhar(this: CompiladorLLVM, expressao: Falhar): Promise<void> {
    const valor = expressao.explicacao;
    if (!valor) throw erroCompilacao('Falhar precisa de uma mensagem', expressao.linha);

    const ptr = this.montador.getPtrTy();
    const tipo = this.resolverTipoConstruto(valor);
    let objeto: llvm.Value;
    let mensagem: llvm.Value;

    if (tipo && this.registroClasses.has(tipo) && !this.estruturasEstrangeiras.has(tipo)) {
        const resolvido = await valor.aceitar(this);
        objeto = resolvido instanceof VariavelEscopo ? this.carregarPtrClasseSePreciso(resolvido) : (resolvido as llvm.Value);
        mensagem = this.herdaDeExcecao(tipo)
            ? this.mensagemDeExcecao(objeto, tipo)
            : this.literalTextoArc(`<objeto ${tipo}>`);
    } else {
        // Qualquer outro valor vira a mensagem de uma Excecao (como no núcleo de Delégua).
        mensagem = await this.chamarFuncaoTexto([valor]);
        objeto = this.criarObjetoExcecao(mensagem);
    }
    this.montador.CreateCall(funcaoLancar(this), [objeto, mensagem]);
    // O lançamento não retorna; o código seguinte no mesmo bloco fica num bloco inalcançável.
    this.montador.CreateUnreachable();
    const funcaoAtual = this.montador.GetInsertBlock().getParent();
    this.montador.SetInsertPoint(llvm.BasicBlock.Create(this.contexto, 'apos_falhar', funcaoAtual));
}

/** Remove `quantidade` tratadores (saída de corpos de `tente` por retorna/sustar/continua). */
export function emitirSaidaDeTentes(this: CompiladorLLVM, quantidade: number): void {
    if (quantidade <= 0) return;
    const desempilhar = this.obterFuncaoRuntime('delegua_excecao_desempilhar', llvm.Type.getVoidTy(this.contexto), []);
    for (let i = 0; i < quantidade; i++) {
        this.montador.CreateCall(desempilhar, []);
    }
}

function blocoTerminado(compilador: CompiladorLLVM): boolean {
    return !!compilador.montador.GetInsertBlock().getTerminator();
}

function declaracoesDe(caminho: any): any[] {
    if (!caminho) return [];
    if (Array.isArray(caminho)) return caminho;
    if (Array.isArray(caminho.declaracoes)) return caminho.declaracoes;
    return [caminho];
}

/** `tente { } pegue (...) { } senão { } finalmente { }`. */
export async function compilarTente(this: CompiladorLLVM, declaracao: Tente): Promise<void> {
    this.contemExcecoes = true;
    const ptr = this.montador.getPtrTy();
    const i32 = this.montador.getInt32Ty();
    const vazio = llvm.Type.getVoidTy(this.contexto);
    const funcaoAtual = this.montador.GetInsertBlock().getParent();

    // Variáveis precisam ficar na memória entre setjmp e longjmp.
    funcaoAtual.addFnAttr(llvm.Attribute.get(this.contexto, llvm.Attribute.AttrKind.OptimizeNone));
    funcaoAtual.addFnAttr(llvm.Attribute.get(this.contexto, llvm.Attribute.AttrKind.NoInline));

    const blocosPegue: BlocoPegue[] = Array.isArray(declaracao.caminhoPegue) ? declaracao.caminhoPegue : [];
    const declaracoesSenao = declaracoesDe(declaracao.caminhoSenao);
    const declaracoesFinalmente = declaracoesDe(declaracao.caminhoFinalmente);

    const novoBloco = (nome: string) => llvm.BasicBlock.Create(this.contexto, nome, funcaoAtual);
    const blocoCorpo = novoBloco('tente_corpo');
    const blocoDespacho = novoBloco('pegue_despacho');
    const blocoApos = novoBloco('tente_apos');

    // Quadro do tratador: 1 KB alinhado em 16 bytes, com o jmp_buf no início.
    const tipoQuadro = llvm.ArrayType.get(llvm.Type.getInt128Ty(this.contexto), TAMANHO_QUADRO_EXCECAO / 16) as unknown as llvm.Type;
    const quadro = this.criarAllocaNoBlocoEntrada(tipoQuadro, 'quadro_excecao');
    const empilhar = this.obterFuncaoRuntime('delegua_excecao_empilhar', vazio, [ptr]);
    this.montador.CreateCall(empilhar, [quadro]);

    // setjmp de cada plataforma (precisa combinar com o longjmp de excecoes.c):
    //   - Windows x86-64 (MSVC e MinGW): _setjmp(buf, quadro de pilha); nulo = longjmp só
    //     restaura o contexto, sem desempilhar via SEH (não há o que limpar);
    //   - Windows ARM64 com MinGW: __mingw_setjmp(buf) (a CRT não tem _setjmp);
    //   - demais: _setjmp(buf).
    const triplo = this.alvo?.triplo ?? llvm.config.LLVM_DEFAULT_TARGET_TRIPLE;
    const ehWindows = /windows|mingw/.test(triplo);
    const ehMingwArm = ehWindows && /^(aarch64|arm)/.test(triplo) && /-gnu|mingw/.test(triplo);
    const nomeSetjmp = ehMingwArm ? '__mingw_setjmp' : '_setjmp';
    const comQuadroPilha = ehWindows && !ehMingwArm;
    const setjmp = this.obterFuncaoRuntime(nomeSetjmp, i32, comQuadroPilha ? [ptr, ptr] : [ptr]);
    this.modulo.getFunction(nomeSetjmp)?.addFnAttr(llvm.Attribute.get(this.contexto, llvm.Attribute.AttrKind.ReturnsTwice));
    const argumentosSetjmp = comQuadroPilha ? [quadro, llvm.Constant.getNullValue(ptr) as unknown as llvm.Value] : [quadro];
    const retornoSetjmp = this.montador.CreateCall(setjmp, argumentosSetjmp, 'setjmp');
    const primeiraVez = this.montador.CreateICmpEQ(retornoSetjmp, ConstantInt.get(this.contexto, new APInt(32, 0)), 'sem_excecao');
    this.montador.CreateCondBr(primeiraVez, blocoCorpo, blocoDespacho);

    // ── Corpo do tente (tratador ativo) ──
    this.montador.SetInsertPoint(blocoCorpo);
    this.tentesAtivos++;
    try {
        await this.aceitarListaDeclaracoes(declaracoesDe(declaracao.caminhoTente));
    } finally {
        this.tentesAtivos--;
    }
    if (!blocoTerminado(this)) {
        this.emitirSaidaDeTentes(1);
        // Sucesso: senão, depois finalmente.
        await this.aceitarListaDeclaracoes(declaracoesSenao);
        if (!blocoTerminado(this)) {
            await this.aceitarListaDeclaracoes(declaracoesFinalmente);
            if (!blocoTerminado(this)) this.montador.CreateBr(blocoApos);
        }
    }

    // ── Despacho da exceção (o runtime já removeu o tratador) ──
    this.montador.SetInsertPoint(blocoDespacho);
    const slotObjeto = this.criarAllocaNoBlocoEntrada(ptr, 'objeto_excecao');
    const objetoBruto = this.montador.CreateCall(this.obterFuncaoRuntime('delegua_excecao_atual', ptr, []), [], 'excecao_atual');
    const mensagemAtual = this.montador.CreateCall(
        this.obterFuncaoRuntime('delegua_excecao_mensagem_atual', ptr, []),
        [],
        'mensagem_atual'
    );
    this.montador.CreateStore(objetoBruto, slotObjeto);
    // Exceção lançada pelo runtime C (falhar(mensagem)): cria a Excecao aqui.
    const semObjeto = this.montador.CreateICmpEQ(objetoBruto, llvm.Constant.getNullValue(ptr) as unknown as llvm.Value, 'sem_objeto');
    const blocoCriarObjeto = novoBloco('pegue_criar_excecao');
    const blocoComObjeto = novoBloco('pegue_com_objeto');
    this.montador.CreateCondBr(semObjeto, blocoCriarObjeto, blocoComObjeto);
    this.montador.SetInsertPoint(blocoCriarObjeto);
    this.montador.CreateStore(this.criarObjetoExcecao(mensagemAtual), slotObjeto);
    this.montador.CreateBr(blocoComObjeto);
    this.montador.SetInsertPoint(blocoComObjeto);
    const objeto = this.montador.CreateLoad(ptr, slotObjeto, 'objeto');
    // Todas as classes Delégua têm o id de tipo no campo 0.
    const idTipo = this.montador.CreateLoad(i32, objeto, 'id_tipo_excecao');

    let tratamentoIncondicional = false;
    for (const [indice, bloco] of blocosPegue.entries()) {
        const blocoTratamento = novoBloco(`pegue_${indice}`);
        const blocoProximo = novoBloco(`pegue_${indice}_seguinte`);
        const nomeTipo = bloco.tipoExcecao?.lexema;
        if (nomeTipo) {
            if (!this.registroClasses.has(nomeTipo) || this.estruturasEstrangeiras.has(nomeTipo)) {
                throw erroCompilacao(`Tipo de exceção desconhecido em pegue: '${nomeTipo}'.`, (bloco.tipoExcecao as any).linha);
            }
            let corresponde: llvm.Value = ConstantInt.get(this.contexto, new APInt(1, 0)) as unknown as llvm.Value;
            for (const id of this.idsDescendentes(nomeTipo)) {
                const igual = this.montador.CreateICmpEQ(idTipo, ConstantInt.get(this.contexto, new APInt(32, id)), 'tipo_igual');
                corresponde = this.montador.CreateOr(corresponde, igual, 'corresponde');
            }
            this.montador.CreateCondBr(corresponde, blocoTratamento, blocoProximo);
        } else {
            this.montador.CreateBr(blocoTratamento);
            tratamentoIncondicional = true;
        }

        this.montador.SetInsertPoint(blocoTratamento);
        if (bloco.parametro?.lexema) {
            const tipoParametro = nomeTipo ?? NOME_CLASSE_EXCECAO;
            const slot = this.criarAllocaNoBlocoEntrada(ptr, bloco.parametro.lexema);
            this.montador.CreateStore(objeto, slot);
            this.pilhaVariaveisEscopo.topoDaPilha().set(bloco.parametro.lexema, new VariavelEscopo(slot, undefined, tipoParametro));
        }
        await this.aceitarListaDeclaracoes(declaracoesDe(bloco.corpo));
        if (!blocoTerminado(this)) {
            await this.aceitarListaDeclaracoes(declaracoesFinalmente);
            if (!blocoTerminado(this)) this.montador.CreateBr(blocoApos);
        }

        this.montador.SetInsertPoint(blocoProximo);
        if (tratamentoIncondicional) {
            // Blocos pegue depois de um sem tipo nunca são alcançados.
            this.montador.CreateUnreachable();
            break;
        }
    }

    if (!tratamentoIncondicional) {
        // Nenhum bloco correspondeu: finalmente e a exceção continua propagando.
        await this.aceitarListaDeclaracoes(declaracoesFinalmente);
        if (!blocoTerminado(this)) {
            this.montador.CreateCall(funcaoLancar(this), [objeto, mensagemAtual]);
            this.montador.CreateUnreachable();
        }
    }

    this.montador.SetInsertPoint(blocoApos);
}
