import { Retorna } from '@designliquido/delegua';
import llvm from '@designliquido/llvm-bindings';
import type { CompiladorLLVM } from './compilador-llvm';

/**
 * Informações de depuração DWARF (`-g`): tipos, subprogramas, localizações e declarações
 * de variáveis e parâmetros. Implementado como mixin de CompiladorLLVM.
 */

// Mapeia o nome de tipo Delégua para o DIBasicType correspondente.
export function obterTipoDebug(this: CompiladorLLVM, nomeTipo: string): llvm.DIBasicType | null {
    if (!this.construtorDebug) return null;
    switch (nomeTipo) {
        case 'inteiro':
            return this.construtorDebug.createBasicType('inteiro', 32, llvm.dwarf.TypeKind.DW_ATE_signed);
        case 'longo':
            return this.construtorDebug.createBasicType('longo', 64, llvm.dwarf.TypeKind.DW_ATE_signed);
        case 'número':
            return this.construtorDebug.createBasicType('numero', 64, llvm.dwarf.TypeKind.DW_ATE_float);
        case 'lógico':
            return this.construtorDebug.createBasicType('logico', 1, llvm.dwarf.TypeKind.DW_ATE_boolean);
        case 'texto':
            // texto é ponteiro para char; usa DW_ATE_address (64 bits) como tipo DWARF.
            // createPointerType não está disponível na API llvm-bindings, por isso
            // usamos um tipo básico de endereço. No LLDB/CodeLLDB use (char*)var ou ,s
            // no watch para ver o conteúdo da string.
            return this.construtorDebug.createBasicType('texto', 64, llvm.dwarf.TypeKind.DW_ATE_address);
        default:
            return null;
    }
}

// Define a localização de depuração atual para a próxima instrução emitida.
// Não faz nada se não há subprograma ativo ou debug desabilitado.
export function definirLocalizacaoDebug(this: CompiladorLLVM, linha: number, coluna: number): void {
    if (!this.construtorDebug || this.pilhaSubprogramas.length === 0) return;
    const escopoAtual = this.pilhaSubprogramas[this.pilhaSubprogramas.length - 1];
    const loc = llvm.DILocation.get(this.contexto, linha, coluna, escopoAtual);
    this.montador.SetCurrentDebugLocation(loc);
}

// Cria um DISubprogram e o associa a uma Function LLVM.
// Empilha o subprograma para uso nas instruções internas.
export function criarSubprogramaDebug(
    this: CompiladorLLVM,
    funcaoLlvm: llvm.Function,
    nome: string,
    linha: number,
    arquivo?: llvm.DIFile | null
): void {
    if (!this.construtorDebug || !this.arquivoDebug) return;
    const arquivoEfetivo = arquivo ?? this.arquivoDebug;
    const tipoSubrotina = this.construtorDebug.createSubroutineType(this.construtorDebug.getOrCreateTypeArray([null]));
    const spFlags = llvm.DISubprogram.DISPFlags.SPFlagDefinition;
    const diFlags = llvm.DINode.DIFlags.FlagPrototyped;
    const subprograma = this.construtorDebug.createFunction(
        arquivoEfetivo,
        nome,
        nome,
        arquivoEfetivo,
        linha,
        tipoSubrotina,
        linha,
        diFlags,
        spFlags
    );
    funcaoLlvm.setSubprogram(subprograma);
    this.pilhaSubprogramas.push(subprograma);
    this.arquivoDebugFuncaoAtual = arquivoEfetivo;
    // Substitui localização legada da função anterior pelo início desta função.
    // Garante que toda instrução emitida antes do primeiro definirLocalizacaoDebug
    // tenha um !dbg válido apontando para o subprograma correto.
    const linhaInicial = linha > 0 ? linha : 1;
    this.montador.SetCurrentDebugLocation(llvm.DILocation.get(this.contexto, linhaInicial, 0, subprograma));
}

// Finaliza o subprograma no topo da pilha e o remove.
export function finalizarSubprogramaDebug(this: CompiladorLLVM): void {
    if (!this.construtorDebug) return;
    const sp = this.pilhaSubprogramas.pop();
    if (sp) this.construtorDebug.finalizeSubprogram(sp);
}

// Retorna o DIFile para o arquivo identificado pelo hash, criando-o se necessário.
export function obterArquivoDebugParaHash(this: CompiladorLLVM, hashArquivo: number | undefined): llvm.DIFile | null {
    if (!this.construtorDebug) return null;
    if (hashArquivo === undefined) return this.arquivoDebug;
    if (this.cacheArquivosDebug.has(hashArquivo)) return this.cacheArquivosDebug.get(hashArquivo)!;
    const caminho = this.mapaHashParaCaminho.get(hashArquivo);
    if (!caminho) return this.arquivoDebug;
    const arquivo = this.construtorDebug.createFile(
        caminho.replace(/\\/g, '/').split('/').pop() ?? caminho,
        caminho.replace(/\\/g, '/').split('/').slice(0, -1).join('/') || '.'
    );
    this.cacheArquivosDebug.set(hashArquivo, arquivo);
    return arquivo;
}

// Emite llvm.dbg.declare para uma variável local alocada via alloca.
export function emitirDeclaracaoVariavelDebug(
    this: CompiladorLLVM,
    alocacao: llvm.Value,
    nome: string,
    tipo: string,
    linha: number
): void {
    if (!this.construtorDebug || !this.arquivoDebug || this.pilhaSubprogramas.length === 0) return;
    const subPrograma = this.pilhaSubprogramas[this.pilhaSubprogramas.length - 1];
    const tipoDebug = this.obterTipoDebug(tipo);
    // Tipos sem mapeamento DWARF (ex.: classes, qualquer) retornam null.
    // Omitir o declare evita crash no emissor DWARF do clang 19 ao derreferenciar
    // um DIType nulo ao gerar informações de tipo da variável.
    if (!tipoDebug) return;
    const varDebug = this.construtorDebug.createAutoVariable(
        subPrograma,
        nome,
        this.arquivoDebugFuncaoAtual ?? this.arquivoDebug,
        linha,
        tipoDebug
    );
    const localizacao = llvm.DILocation.get(this.contexto, linha, 0, subPrograma);
    this.construtorDebug.insertDeclare(
        alocacao,
        varDebug,
        this.construtorDebug.createExpression(),
        localizacao,
        this.montador.GetInsertBlock()
    );
}

// Emite llvm.dbg.declare para um parâmetro de função (argNo é 1-based).
export function emitirDeclaracaoParametroDebug(
    this: CompiladorLLVM,
    alocacao: llvm.Value,
    nome: string,
    tipo: string,
    linha: number,
    argNo: number
): void {
    if (!this.construtorDebug || !this.arquivoDebug || this.pilhaSubprogramas.length === 0) return;
    const subPrograma = this.pilhaSubprogramas[this.pilhaSubprogramas.length - 1];
    const tipoDebug = this.obterTipoDebug(tipo);
    // Tipos sem mapeamento DWARF (ex.: classes, qualquer) retornam null.
    // Omitir o declare evita crash no emissor DWARF do clang 19 ao derreferenciar
    // um DIType nulo ao gerar informações de tipo do parâmetro.
    if (!tipoDebug) return;
    const varDebug = this.construtorDebug.createParameterVariable(
        subPrograma,
        nome,
        argNo,
        this.arquivoDebugFuncaoAtual ?? this.arquivoDebug,
        linha,
        tipoDebug
    );
    const localizacao = llvm.DILocation.get(this.contexto, linha, 0, subPrograma);
    this.construtorDebug.insertDeclare(
        alocacao,
        varDebug,
        this.construtorDebug.createExpression(),
        localizacao,
        this.montador.GetInsertBlock()
    );
}
