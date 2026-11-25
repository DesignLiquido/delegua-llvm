import llvm, { APInt, ConstantInt } from '@designliquido/llvm-bindings';
import { tipoEhPonteiro } from './ajudantes';
import type { CompiladorLLVM } from './compilador-llvm';

/**
 * Emissão de operações ARC (ver bibliotecas/arc.h) no IR gerado. Implementado como mixin de
 * CompiladorLLVM. Todas as primitivas aceitam NULL e ignoram ponteiros sem cabeçalho ARC.
 */

// Verdadeiro se valores deste tipo Delégua são ponteiros gerenciados por ARC: texto,
// instâncias, vetores, dicionários, `qualquer` e handles opacos. Escalares, ponteiros de função,
// `ponteiro` bruto de FFI e estruturas estrangeiras (memória C) não são.
export function tipoGerenciadoArc(this: CompiladorLLVM, tipo: string | undefined): boolean {
    if (!tipo || tipo === 'vazio' || tipo === 'nulo') return false;
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
    const objeto = destrutor.getArg(0);
    for (const [nomeCampo, indice] of [...indices.entries()].sort((a, b) => a[1] - b[1])) {
        if (nomeCampo === '__tipoId' || !this.tipoGerenciadoArc(tipos.get(nomeCampo))) continue;
        const campo = montadorDestrutor.CreateInBoundsGEP(
            tipoStruct,
            objeto,
            [ConstantInt.get(this.contexto, new APInt(32, 0)), ConstantInt.get(this.contexto, new APInt(32, indice))],
            `${nomeCampo}_ptr`
        );
        const valor = montadorDestrutor.CreateLoad(ptr, campo, nomeCampo);
        montadorDestrutor.CreateCall(liberar, [valor]);
    }
    montadorDestrutor.CreateRetVoid();

    const tipoDescritor = llvm.StructType.get(this.contexto, [ptr, ptr, ptr]);
    const descritor = new llvm.GlobalVariable(
        this.modulo,
        tipoDescritor,
        true,
        llvm.GlobalValue.LinkageTypes.PrivateLinkage,
        llvm.ConstantStruct.get(tipoDescritor, [
            this.literalTextoArc(nomeClasse) as unknown as llvm.Constant,
            destrutor,
            llvm.ConstantPointerNull.get(ptr),
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
    retornos: llvm.Instruction[];
    subprogramaDebug: llvm.DISubprogram | null;
}

// Abre o quadro da função cujo corpo começa a ser emitido. As funções são compiladas de forma
// estritamente aninhada (uma lambda ou função declarada dentro de outra termina antes de a de
// fora continuar), então o topo da pilha é sempre a função em emissão.
export function iniciarQuadroArc(this: CompiladorLLVM): void {
    this.pilhaQuadrosArc.push({
        slots: [],
        temporarios: [],
        retornos: [],
        subprogramaDebug: this.pilhaSubprogramas[this.pilhaSubprogramas.length - 1] ?? null,
    });
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
    nomeClasse: string | undefined
): void {
    const ehEstrangeira = !!nomeClasse && this.estruturasEstrangeiras.has(nomeClasse);
    if (ehEstrangeira || !this.tipoGerenciadoArc(tipoCampo) || !valor || !tipoEhPonteiro(valor.getType())) {
        this.montador.CreateStore(valor, campo);
        return;
    }
    this.emitirArcAtribuir(campo, valor);
}

/** Retém um valor gerenciado que será devolvido (+1 para quem chama). */
export function reterRetornoArc(this: CompiladorLLVM, valor: llvm.Value, tipo: string | undefined): void {
    if (!this.quadroArcAtual() || !this.tipoGerenciadoArc(tipo) || !valor || !tipoEhPonteiro(valor.getType())) return;
    this.emitirArcReter(valor);
}

/** Insere, antes de cada `ret` registrado, a liberação dos temporários e slots da função. */
export function finalizarQuadrosArc(this: CompiladorLLVM): void {
    const ptr = this.montador.getPtrTy();
    const blocoAnterior = this.montador.GetInsertBlock();
    for (const quadro of this.quadrosArcConcluidos) {
        const liberaveis = [...quadro.temporarios, ...quadro.slots];
        if (liberaveis.length === 0) continue;
        for (const retorno of quadro.retornos) {
            this.montador.SetInsertPoint(retorno);
            if (quadro.subprogramaDebug) {
                this.montador.SetCurrentDebugLocation(llvm.DILocation.get(this.contexto, 0, 0, quadro.subprogramaDebug));
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
