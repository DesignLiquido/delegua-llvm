import llvm, { APInt, ConstantInt } from '@designliquido/llvm-bindings';
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

// *slot = valor, retendo `valor` e liberando o anterior (seguro quando são o mesmo).
export function emitirArcAtribuir(this: CompiladorLLVM, slot: llvm.Value, valor: llvm.Value): void {
    const ptr = this.montador.getPtrTy();
    this.montador.CreateCall(funcaoArc(this, 'delegua_arc_atribuir', [ptr, ptr]), [slot, valor]);
}
