import llvm, { APInt, ConstantInt } from '@designliquido/llvm-bindings';
import { tipoEhPonteiro } from './ajudantes';
import type { CompiladorLLVM } from './compilador-llvm';

/**
 * Emissão de operações ARC (ver bibliotecas/arc.h) no IR gerado. Implementado como mixin de
 * CompiladorLLVM. Todas as primitivas aceitam NULL e ignoram ponteiros sem cabeçalho ARC.
 */

// Verdadeiro se um ponteiro guardado com este tipo Delégua deve ser tratado como gerenciado
// por ARC: texto, instâncias, vetores, dicionários, `qualquer`, handles opacos e também tipo
// desconhecido ou `nulo` (`var r = nulo` recebe objetos depois). Só tipos explicitamente não
// gerenciados ficam de fora: escalares, ponteiros de função, `ponteiro` bruto de FFI e
// estruturas estrangeiras (memória C). Quem chama ainda confere se o valor LLVM é um ponteiro;
// reter um ponteiro sem cabeçalho ARC não faz nada, então errar para o lado gerenciado é seguro,
// enquanto tratar como bruto um temporário +1 o deixaria pendente.
export function tipoGerenciadoArc(this: CompiladorLLVM, tipo: string | undefined): boolean {
    if (!tipo || tipo === 'nulo') return true;
    if (tipo === 'vazio') return false;
    if (!this.elementoVetorGerenciado(tipo)) return false;
    if (tipo.startsWith('classeEstrangeira:') || tipo.startsWith('modulo:')) return false;
    if (this.estruturasEstrangeiras?.has(tipo)) return false;
    return true;
}

function funcaoArc(compilador: CompiladorLLVM, nome: string, parametros: llvm.Type[]): llvm.FunctionCallee {
    return compilador.obterFuncaoRuntime(nome, llvm.Type.getVoidTy(compilador.contexto), parametros);
}

export function emitirArcReter(this: CompiladorLLVM, valor: llvm.Value): void {
    this.montador.CreateCall(funcaoArc(this, 'delegua_arc_reter', [this.montador.getPtrTy()]), [valor]);
}

export function emitirArcLiberar(this: CompiladorLLVM, valor: llvm.Value): void {
    this.montador.CreateCall(funcaoArc(this, 'delegua_arc_liberar', [this.montador.getPtrTy()]), [valor]);
}

/**
 * Descritor ARC (`ArcDescritor { nome, destrutor, visitar_filhos }`) de uma classe Delégua,
 * criado na primeira instanciação, quando o layout (inclusive campos herdados) já é conhecido.
 * O destrutor gerado `__destrutor_<Classe>(ptr)` libera cada campo gerenciado.
 */
export function obterDescritorArcClasse(this: CompiladorLLVM, nomeClasse: string): llvm.Value {
    const existente = this.descritoresArcClasse.get(nomeClasse);
    if (existente) return existente;

    const ptr = llvm.PointerType.get(this.contexto, 0);
    const vazio = llvm.Type.getVoidTy(this.contexto);
    const tipoStruct = this.registroClasses.get(nomeClasse);
    const indices = this.indicesPropriedades.get(nomeClasse) ?? new Map<string, number>();
    const tipos = this.tiposPropriedades.get(nomeClasse) ?? new Map<string, string>();

    // Destrutor emitido com um construtor de IR próprio, sem mexer no ponto de inserção atual.
    const destrutor = llvm.Function.Create(
        llvm.FunctionType.get(vazio, [ptr], false),
        llvm.GlobalValue.LinkageTypes.InternalLinkage,
        `__destrutor_${nomeClasse}`,
        this.modulo
    );
    const montadorDestrutor = new llvm.IRBuilder(llvm.BasicBlock.Create(this.contexto, 'entrada', destrutor));
    const liberar = this.modulo.getOrInsertFunction('delegua_arc_liberar', llvm.FunctionType.get(vazio, [ptr], false));
    const fracoAtribuir = this.modulo.getOrInsertFunction(
        'delegua_arc_fraco_atribuir',
        llvm.FunctionType.get(vazio, [ptr, ptr], false)
    );
    const fracos = this.camposFracosArc.get(nomeClasse) ?? new Set<string>();
    const nulo = llvm.ConstantPointerNull.get(ptr) as unknown as llvm.Value;
    const camposGerenciados = [...indices.entries()]
        .sort((a, b) => a[1] - b[1])
        .filter(([nomeCampo]) => nomeCampo !== '__tipoId' && this.tipoGerenciadoArc(tipos.get(nomeCampo)));
    const gepCampo = (montador: llvm.IRBuilder, objeto: llvm.Value, nomeCampo: string, indice: number) =>
        montador.CreateInBoundsGEP(
            tipoStruct,
            objeto,
            [ConstantInt.get(this.contexto, new APInt(32, 0)), ConstantInt.get(this.contexto, new APInt(32, indice))],
            `${nomeCampo}_ptr`
        );

    const objeto = destrutor.getArg(0);
    for (const [nomeCampo, indice] of camposGerenciados) {
        const campo = gepCampo(montadorDestrutor, objeto, nomeCampo, indice);
        if (fracos.has(nomeCampo)) {
            // Referência fraca: só cancela o registro (o alvo não era retido por este objeto).
            montadorDestrutor.CreateCall(fracoAtribuir, [campo, nulo]);
        } else {
            montadorDestrutor.CreateCall(liberar, [montadorDestrutor.CreateLoad(ptr, campo, nomeCampo)]);
        }
    }
    montadorDestrutor.CreateRetVoid();

    // Visitante de filhos para o coletor de ciclos (Fase 4.1): só para classes com campos que
    // podem fechar um ciclo (texto e handles opacos nunca referenciam objetos Delégua). Campos
    // @fraco não são arestas: não mantêm o alvo vivo.
    const camposCiclicos = camposGerenciados.filter(
        ([nomeCampo]) =>
            !fracos.has(nomeCampo) && tipos.get(nomeCampo) !== 'texto' && !tipos.get(nomeCampo)?.startsWith('opaco:')
    );
    let visitante: llvm.Constant = llvm.ConstantPointerNull.get(ptr);
    if (camposCiclicos.length > 0) {
        const tipoVisitanteFilho = llvm.FunctionType.get(vazio, [ptr, ptr], false);
        const funcaoVisitar = llvm.Function.Create(
            llvm.FunctionType.get(vazio, [ptr, ptr, ptr], false),
            llvm.GlobalValue.LinkageTypes.InternalLinkage,
            `__visitar_${nomeClasse}`,
            this.modulo
        );
        const funcao = funcaoVisitar;
        const montadorVisitar = new llvm.IRBuilder(llvm.BasicBlock.Create(this.contexto, 'entrada', funcao));
        for (const [nomeCampo, indice] of camposCiclicos) {
            const valor = montadorVisitar.CreateLoad(ptr, gepCampo(montadorVisitar, funcao.getArg(0), nomeCampo, indice), nomeCampo);
            // O runtime ignora filhos nulos, imortais ou sem cabeçalho ARC.
            montadorVisitar.CreateCall(tipoVisitanteFilho, funcao.getArg(1), [valor, funcao.getArg(2)]);
        }
        montadorVisitar.CreateRetVoid();
        visitante = funcaoVisitar;
    }

    const tipoDescritor = llvm.StructType.get(this.contexto, [ptr, ptr, ptr]);
    const descritor = new llvm.GlobalVariable(
        this.modulo,
        tipoDescritor,
        true,
        llvm.GlobalValue.LinkageTypes.PrivateLinkage,
        llvm.ConstantStruct.get(tipoDescritor, [
            this.literalTextoArc(nomeClasse) as unknown as llvm.Constant,
            destrutor,
            visitante,
        ]),
        `__arc_desc_${nomeClasse}`
    );
    this.descritoresArcClasse.set(nomeClasse, descritor);
    return descritor;
}

// Novo objeto ARC (+1, memória zerada) com o descritor da classe.
export function alocarObjetoArc(this: CompiladorLLVM, nomeClasse: string, nome: string): llvm.Value {
    const tamanho = this.layoutDados.getTypeAllocSize(this.registroClasses.get(nomeClasse));
    const alocar = this.obterFuncaoRuntime('delegua_arc_alocar', this.montador.getPtrTy(), [
        llvm.Type.getInt64Ty(this.contexto),
        this.montador.getPtrTy(),
    ]);
    return this.montador.CreateCall(
        alocar,
        [
            ConstantInt.get(this.contexto, new APInt(64, tamanho)),
            this.obterDescritorArcClasse(nomeClasse),
        ],
        nome
    );
}

// ─── Quadros ARC por função ──────────────────────────────────────────────────
//
// Cada função Delégua (inclusive `main` e lambdas) tem um quadro com:
// - slots: variáveis locais gerenciadas, donas de +1 (gravadas sempre com atribuir);
// - temporarios: slots de resultados +1 ainda não liberados (ver Fase 2.3);
// - retornos: as instruções `ret` emitidas.
// Ao fim da compilação, antes de cada `ret` são inseridas as liberações de todos os slots e
// temporários da função. Como todo slot nasce nulo no bloco de entrada, liberar um slot cuja
// declaração não chegou a executar é inofensivo.

export interface QuadroArc {
    slots: llvm.Value[];
    temporarios: llvm.Value[];
    // Temporários criados desde o último fim de instrução.
    pendentes: llvm.Value[];
    retornos: llvm.Instruction[];
    subprogramaDebug: llvm.DISubprogram | null;
    // Instrução morta no início do corpo (depois das allocas): ponto onde o quadro de limpeza
    // é montado e empilhado ao finalizar, se o programa usar exceções (Fase 3).
    ancora: llvm.Instruction | null;
}

// Abre o quadro da função cujo corpo começa a ser emitido. As funções são compiladas de forma
// estritamente aninhada (uma lambda ou função declarada dentro de outra termina antes de a de
// fora continuar), então o topo da pilha é sempre a função em emissão.
export function iniciarQuadroArc(this: CompiladorLLVM): void {
    this.pilhaQuadrosArc.push({
        slots: [],
        temporarios: [],
        pendentes: [],
        retornos: [],
        subprogramaDebug: this.pilhaSubprogramas[this.pilhaSubprogramas.length - 1] ?? null,
        ancora: null,
    });
    // As allocas vão sempre para o topo do bloco de entrada; esta carga fica depois delas e
    // antes do corpo. Sem uso, o otimizador a remove.
    const slotAncora = this.criarAllocaNoBlocoEntrada(this.montador.getPtrTy(), 'arc_ancora', true);
    this.quadroArcAtual().ancora = this.montador.CreateLoad(this.montador.getPtrTy(), slotAncora, 'arc_ancora') as unknown as llvm.Instruction;
}

// Fecha o quadro da função atual (depois do seu `ret` implícito, se houver).
export function encerrarQuadroArc(this: CompiladorLLVM): void {
    const quadro = this.pilhaQuadrosArc.pop();
    if (quadro) this.quadrosArcConcluidos.push(quadro);
}

export function quadroArcAtual(this: CompiladorLLVM): QuadroArc | undefined {
    return this.pilhaQuadrosArc[this.pilhaQuadrosArc.length - 1];
}

// Registra um `ret` de função Delégua (as liberações são inseridas antes dele ao finalizar).
export function registrarRetornoArc(this: CompiladorLLVM, instrucao: llvm.Instruction): void {
    this.quadroArcAtual()?.retornos.push(instrucao);
}

/**
 * Grava `valor` no slot de uma variável local. Para tipos gerenciados, o slot passa a ser dono
 * de uma referência (atribuir retém o novo valor e libera o anterior, inclusive o da iteração
 * anterior de um laço) e é liberado nos retornos da função.
 */
export function armazenarVariavelArc(this: CompiladorLLVM, slot: llvm.Value, valor: llvm.Value, tipo: string): void {
    const quadro = this.quadroArcAtual();
    if (!quadro || !this.tipoGerenciadoArc(tipo) || !tipoEhPonteiro(valor.getType())) {
        this.montador.CreateStore(valor, slot);
        return;
    }
    if (!quadro.slots.includes(slot)) quadro.slots.push(slot);
    this.emitirArcAtribuir(slot, valor);
}

// Verdadeiro se `slot` é uma variável local dona de referência na função atual.
export function slotEhDonoArc(this: CompiladorLLVM, slot: llvm.Value): boolean {
    return !!this.quadroArcAtual()?.slots.includes(slot);
}

/**
 * Grava `valor` num campo de instância. Campos gerenciados pertencem ao objeto (o destrutor
 * gerado os libera): retém o novo valor e libera o anterior. Campos de estruturas estrangeiras
 * são memória C e recebem só o store.
 */
export function armazenarCampoArc(
    this: CompiladorLLVM,
    campo: llvm.Value,
    valor: llvm.Value,
    tipoCampo: string,
    nomeClasse: string | undefined,
    nomeCampo?: string
): void {
    const ehEstrangeira = !!nomeClasse && this.estruturasEstrangeiras.has(nomeClasse);
    if (ehEstrangeira || !this.tipoGerenciadoArc(tipoCampo) || !valor || !tipoEhPonteiro(valor.getType())) {
        this.montador.CreateStore(valor, campo);
        return;
    }
    if (nomeClasse && nomeCampo && this.camposFracosArc.get(nomeClasse)?.has(nomeCampo)) {
        // @fraco: não retém; o runtime zera o campo quando o alvo morrer.
        const ptr = this.montador.getPtrTy();
        this.montador.CreateCall(funcaoArc(this, 'delegua_arc_fraco_atribuir', [ptr, ptr]), [campo, valor]);
        return;
    }
    this.emitirArcAtribuir(campo, valor);
}

/**
 * Retém o ponteiro devolvido por `retorna` (+1 para quem chama). Usa a mesma regra que quem
 * chama usa para tratar o resultado como temporário próprio (retornoPonteiroEhProprio sobre o
 * tipo de retorno declarado da função), para que os dois lados nunca divirjam.
 */
export function reterRetornoArc(this: CompiladorLLVM, valor: llvm.Value): void {
    if (!this.quadroArcAtual() || !valor || !tipoEhPonteiro(valor.getType())) return;
    if (!this.retornoPonteiroEhProprio(this.tipoRetornoFuncaoAtual)) return;
    this.emitirArcReter(valor);
}

// ─── Temporários (Fase 2.3) ──────────────────────────────────────────────────
//
// Uma chamada que devolve +1 (função Delégua com retorno gerenciado, construtor via
// delegua_arc_alocar, runtime C que cria texto/vetor/dicionário/handle) gera um temporário:
// o resultado é guardado num slot próprio do ponto de criação. Gravar no slot libera o valor
// anterior (o mesmo ponto executado de novo num laço), e os slots pendentes são liberados ao
// fim de cada instrução e, por garantia, nos retornos da função. Quem guarda o valor (variável,
// campo, coleção, retorno) retém a sua própria referência.

// Retorno de ponteiro de uma função Delégua com este tipo declarado é +1 (retido pela função).
// Só tipos explicitamente não gerenciados ficam de fora; desconhecido/`qualquer` conta como
// gerenciado (reter um ponteiro sem cabeçalho ARC não faz nada).
export function retornoPonteiroEhProprio(this: CompiladorLLVM, tipo: string | undefined | null): boolean {
    if (!tipo) return true;
    if (tipo === 'ponteiro' || tipo === 'vazio') return false;
    if (tipo.startsWith('função') || tipo.startsWith('funcao')) return false;
    if (tipo.startsWith('classeEstrangeira:') || tipo.startsWith('modulo:')) return false;
    return !this.estruturasEstrangeiras.has(tipo);
}

// Funções do runtime C que devolvem um ponteiro emprestado (não +1).
const RUNTIME_EMPRESTADO = new Set([
    'delegua_dicionario_obter',
    'delegua_vetor_definir_indice',
    'delegua_excecao_atual',
    'delegua_excecao_mensagem_atual',
]);
// Do módulo memoria, só as cópias para texto são +1; o resto é memória bruta de FFI.
const MEMORIA_PROPRIO = new Set([
    'delegua_memoria_texto_de',
    'delegua_memoria_texto_de_tamanho',
    'delegua_memoria_ler_texto',
]);
const RUNTIME_SEM_PREFIXO_PROPRIO = new Set(['leia', 'texto_de_inteiro', 'texto_de_numero', 'texto_de_longo']);

function chamadaDevolveProprio(compilador: CompiladorLLVM, nome: string | undefined): boolean {
    if (!nome) return false;
    if (compilador.funcoesRetornoProprioArc.has(nome)) return true;
    if (nome.startsWith('__despacho_')) return true;
    if (RUNTIME_SEM_PREFIXO_PROPRIO.has(nome)) return true;
    if (!nome.startsWith('delegua_') || RUNTIME_EMPRESTADO.has(nome)) return false;
    if (nome.startsWith('delegua_memoria_')) return MEMORIA_PROPRIO.has(nome);
    if (nome.startsWith('delegua_excecao_')) return false;
    // delegua_arc_reter/liberar/atribuir devolvem void; os demais delegua_arc_* criam (+1).
    return true;
}

// Associa o objeto de função (wrapper JS) ao nome, para reconhecer o alvo em CreateCall.
export function registrarFuncaoDeleguaArc(
    this: CompiladorLLVM,
    funcao: llvm.Function,
    nome: string,
    tipoRetorno: string | undefined | null
): void {
    this.nomesFuncoesArc.set(funcao, nome);
    if (this.retornoPonteiroEhProprio(tipoRetorno)) this.funcoesRetornoProprioArc.add(nome);
}

// Instala os ganchos no módulo e no montador da compilação atual.
export function instalarRastreamentoArc(this: CompiladorLLVM): void {
    const compilador = this;
    const modulo = this.modulo as any;
    const getFunction = modulo.getFunction.bind(modulo);
    const getOrInsertFunction = modulo.getOrInsertFunction.bind(modulo);
    // Os métodos nativos são propriedades somente leitura: redefine-as na instância.
    Object.defineProperty(modulo, 'getFunction', {
        configurable: true,
        value: (nome: string) => {
            const funcao = getFunction(nome);
            if (funcao) compilador.nomesFuncoesArc.set(funcao, nome);
            return funcao;
        },
    });
    Object.defineProperty(modulo, 'getOrInsertFunction', {
        configurable: true,
        value: (nome: string, tipo: llvm.FunctionType) => {
            const alvo = getOrInsertFunction(nome, tipo);
            if (alvo) compilador.nomesFuncoesArc.set(alvo, nome);
            return alvo;
        },
    });

    const montador = this.montador as any;
    const createCall = montador.CreateCall.bind(montador);
    Object.defineProperty(montador, 'CreateCall', {
        configurable: true,
        value: (...argumentos: any[]) => {
            const chamada = createCall(...argumentos);
            if (compilador.quadroArcAtual() && chamada && tipoEhPonteiro(chamada.getType())) {
                // Chamada indireta (FunctionType, ponteiro) não tem nome conhecido: emprestada.
                const nome = compilador.nomesFuncoesArc.get(argumentos[0]);
                if (chamadaDevolveProprio(compilador, nome)) compilador.registrarTemporarioArc(chamada);
            }
            return chamada;
        },
    });
}

export function registrarTemporarioArc(this: CompiladorLLVM, valor: llvm.Value): void {
    const quadro = this.quadroArcAtual();
    if (!quadro) return;
    const ptr = this.montador.getPtrTy();
    const slot = this.criarAllocaNoBlocoEntrada(ptr, 'arc_tmp', true);
    // Mesmo ponto executado de novo (laço): solta o temporário da execução anterior.
    this.emitirArcLiberar(this.montador.CreateLoad(ptr, slot, 'arc_tmp_anterior'));
    this.montador.CreateStore(valor, slot);
    quadro.temporarios.push(slot);
    quadro.pendentes.push(slot);
}

// Fim de instrução: libera os temporários criados desde a última liberação.
export function liberarTemporariosInstrucaoArc(this: CompiladorLLVM): void {
    const quadro = this.quadroArcAtual();
    if (!quadro || quadro.pendentes.length === 0) return;
    const bloco = this.montador.GetInsertBlock();
    // Bloco já terminado (retorna, falhar): os retornos registrados cuidam da liberação.
    if (!bloco || bloco.getTerminator()) return;
    const ptr = this.montador.getPtrTy();
    const nulo = llvm.Constant.getNullValue(ptr) as unknown as llvm.Value;
    for (const slot of quadro.pendentes) {
        this.emitirArcLiberar(this.montador.CreateLoad(ptr, slot, 'arc_tmp_fim'));
        this.montador.CreateStore(nulo, slot);
    }
    quadro.pendentes = [];
}

/** Insere, antes de cada `ret` registrado, a liberação dos temporários e slots da função. */
export function finalizarQuadrosArc(this: CompiladorLLVM): void {
    const ptr = this.montador.getPtrTy();
    const i32 = this.montador.getInt32Ty();
    const vazio = llvm.Type.getVoidTy(this.contexto);
    const blocoAnterior = this.montador.GetInsertBlock();
    for (const quadro of this.quadrosArcConcluidos) {
        const liberaveis = [...quadro.temporarios, ...quadro.slots];
        if (liberaveis.length === 0) continue;
        const definirLocalizacao = () => {
            if (quadro.subprogramaDebug) {
                this.montador.SetCurrentDebugLocation(llvm.DILocation.get(this.contexto, 0, 0, quadro.subprogramaDebug));
            }
        };

        // Fase 3: com exceções no programa, a função registra seus slots num quadro de
        // limpeza, liberado por delegua_excecao_lancar se um longjmp a atravessar.
        let quadroLimpeza: llvm.Value | null = null;
        if (this.contemExcecoes && quadro.ancora) {
            this.montador.SetInsertPoint(quadro.ancora);
            definirLocalizacao();
            const tipoQuadro = llvm.StructType.get(this.contexto, [
                ptr,
                i32,
                llvm.ArrayType.get(ptr, liberaveis.length) as unknown as llvm.Type,
            ]);
            quadroLimpeza = this.criarAllocaNoBlocoEntrada(tipoQuadro, 'arc_quadro_limpeza');
            const indice = (n: number) => ConstantInt.get(this.contexto, new APInt(32, n));
            this.montador.CreateStore(
                ConstantInt.get(this.contexto, new APInt(32, liberaveis.length)),
                this.montador.CreateInBoundsGEP(tipoQuadro, quadroLimpeza, [indice(0), indice(1)], 'arc_quadro_qtd')
            );
            liberaveis.forEach((slot, i) => {
                this.montador.CreateStore(
                    slot,
                    this.montador.CreateInBoundsGEP(tipoQuadro, quadroLimpeza, [indice(0), indice(2), indice(i)], 'arc_quadro_slot')
                );
            });
            this.montador.CreateCall(this.obterFuncaoRuntime('delegua_arc_quadro_empilhar', vazio, [ptr]), [quadroLimpeza]);
        }

        for (const retorno of quadro.retornos) {
            this.montador.SetInsertPoint(retorno);
            definirLocalizacao();
            if (quadroLimpeza) {
                this.montador.CreateCall(this.obterFuncaoRuntime('delegua_arc_quadro_desempilhar', vazio, [ptr]), [
                    quadroLimpeza,
                ]);
            }
            for (const slot of liberaveis) {
                this.emitirArcLiberar(this.montador.CreateLoad(ptr, slot, 'arc_saida'));
            }
        }
    }
    if (blocoAnterior) this.montador.SetInsertPoint(blocoAnterior);
    this.quadrosArcConcluidos = [];
}

// *slot = valor, retendo `valor` e liberando o anterior (seguro quando são o mesmo).
export function emitirArcAtribuir(this: CompiladorLLVM, slot: llvm.Value, valor: llvm.Value): void {
    const ptr = this.montador.getPtrTy();
    this.montador.CreateCall(funcaoArc(this, 'delegua_arc_atribuir', [ptr, ptr]), [slot, valor]);
}
