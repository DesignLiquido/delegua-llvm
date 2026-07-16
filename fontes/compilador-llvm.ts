import {
    Lexador,
    AvaliadorSintatico,
    AcessoElementoMatriz,
    AcessoIndiceVariavel,
    AcessoMetodoOuPropriedade,
    Agrupamento,
    AtribuicaoPorIndice,
    AtribuicaoPorIndicesMatriz,
    Atribuir,
    Binario,
    Bloco,
    CabecalhoPrograma,
    Chamada,
    Classe,
    Comentario,
    Const,
    Constante,
    ConstMultiplo,
    Continua,
    DefinirValor,
    Dicionario,
    Enquanto,
    Escolha,
    Escreva,
    EscrevaMesmaLinha,
    Expressao,
    ExpressaoRegular,
    Falhar,
    Fazer,
    FimPara,
    FormatacaoEscrita,
    FuncaoConstruto,
    FuncaoDeclaracao,
    Importar,
    InicioAlgoritmo,
    Isto,
    Leia,
    Literal,
    Logico,
    Para,
    ParaCada,
    Retorna,
    Se,
    Super,
    Sustar,
    TendoComo,
    Tente,
    TipoDe,
    Tupla,
    Unario,
    Var,
    Variavel,
    VarMultiplo,
    Vetor,
    Declaracao,
    AcessoMetodo,
    AcessoPropriedade,
    ArgumentoReferenciaFuncao,
    ReferenciaFuncao,
    Separador,
    Elvis,
    EnquantoComoConstruto,
    FazerComoConstruto,
    ImportarComoConstruto,
    ListaCompreensao,
    ParaCadaComoConstruto,
    ParaComoConstruto,
    SeTernario,
    AcessoIntervaloVariavel,
    TuplaN,
    AjudaComoConstruto,
    ComentarioComoConstruto,
    TextoDocumentacao,
    Ajuda,
    Extensao,
    InterfaceDeclaracao,
} from '@designliquido/delegua';
import { lerMetadadosClasse, lerMetadadosMetodo } from '@designliquido/delegua/ffi';
import { ConstrutoInterface, ParametroInterface, VisitanteDeleguaInterface } from '@designliquido/delegua/interfaces';
import { ContinuarQuebra, SustarQuebra } from '@designliquido/delegua/quebras';
import llvm, { APFloat, APInt, ConstantFP, ConstantInt } from '@designliquido/llvm-bindings';

import { PilhaVariaveisEscopo } from './pilha-variaveis-escopo';
import { VariavelEscopo } from './variavel-escopo';
import { AcessoIndiceOuMatrizDialeto, AcessoNomeavel, AvaliadorSintaticoComTipagem, DeclaracaoComCorpoPossivel, DicionarioDialeto, ListaCompreensaoDialeto, OperandoInterface, PassesModuloComRun, TipoDeDialeto, TuplaDialeto } from './interfaces';

import { EntradaFuncaoModulo } from './interfaces/entrada-funcao-modulo';
import {
    registrarModuloArquivos,
    registrarModuloCriptografia,
    registrarModuloCsv,
    registrarModuloDados,
    registrarModuloEstatistica,
    registrarModuloFisica,
    registrarModuloHttp,
    registrarModuloJson,
    registrarModuloMatematica,
} from './registro-modulos';
import { resolverEMesclarDeclaracoes, ehImportacaoArquivo } from './resolucao-importacoes';
import { ErroCompilador } from './erros/erro-compilador';

export class CompiladorLLVM implements VisitanteDeleguaInterface {
    lexador: Lexador;
    avaliadorSintatico: AvaliadorSintatico;

    contexto: llvm.LLVMContext;
    modulo: llvm.Module;
    montador: llvm.IRBuilder;
    maquinaAlvo: llvm.TargetMachine;

    pilhaVariaveisEscopo: PilhaVariaveisEscopo;
    funcaoEscreva: llvm.FunctionCallee;
    funcaoLeia: llvm.FunctionCallee;
    funcaoInteiro: llvm.FunctionCallee;
    funcaoNumero: llvm.FunctionCallee;
    funcaoFalhar: llvm.FunctionCallee;
    funcaoPersonalidade: llvm.Function;
    funcaoBeginCatch: llvm.FunctionCallee;
    funcaoEndCatch: llvm.FunctionCallee;
    funcaoTextoMaiusculo: llvm.FunctionCallee;
    funcaoTextoMinusculo: llvm.FunctionCallee;
    funcaoTextoInclui: llvm.FunctionCallee;
    funcaoTextoSubtexto: llvm.FunctionCallee;
    funcaoTextoSubstituir: llvm.FunctionCallee;
    funcaoAleatorio: llvm.FunctionCallee;
    funcaoAleatorioEntre: llvm.FunctionCallee;
    funcaoTextoDeInteiro: llvm.FunctionCallee;
    funcaoTextoDeNumero: llvm.FunctionCallee;
    funcaoFormatar: llvm.FunctionCallee;
    funcaoVetorAdicionar: llvm.FunctionCallee;
    funcaoVetorRemoverUltimo: llvm.FunctionCallee;
    funcaoVetorRemoverPrimeiro: llvm.FunctionCallee;
    funcaoVetorInverter: llvm.FunctionCallee;
    funcaoVetorOrdenar: llvm.FunctionCallee;
    funcaoVetorFatiar: llvm.FunctionCallee;
    funcaoVetorJuntarInteiro: llvm.FunctionCallee;
    funcaoVetorJuntarNumero: llvm.FunctionCallee;
    funcaoVetorJuntarTexto: llvm.FunctionCallee;
    funcaoVetorFiltrarInteiro: llvm.FunctionCallee;
    funcaoVetorFiltrarNumero: llvm.FunctionCallee;
    funcaoVetorMapearInteiro: llvm.FunctionCallee;
    funcaoVetorMapearNumero: llvm.FunctionCallee;
    funcaoVetorMapearTexto: llvm.FunctionCallee;
    funcaoVetorTamanho: llvm.FunctionCallee;
    funcaoVetorIncluiTexto: llvm.FunctionCallee;
    funcaoDicionarioCriar: llvm.FunctionCallee;
    funcaoDicionarioDefinir: llvm.FunctionCallee;
    funcaoDicionarioObter: llvm.FunctionCallee;
    funcaoDicionarioContem: llvm.FunctionCallee;
    funcaoDicionarioTamanho: llvm.FunctionCallee;
    funcaoPotencia: llvm.FunctionCallee;
    funcaoStrlen: llvm.FunctionCallee;
    funcaoStrcmp: llvm.FunctionCallee;
    funcaoMalloc: llvm.FunctionCallee;
    pontoPousoAtual: llvm.BasicBlock | null = null;

    protected registroClasses: Map<string, llvm.StructType> = new Map();
    protected indicesPropriedades: Map<string, Map<string, number>> = new Map();
    protected tiposPropriedades: Map<string, Map<string, string>> = new Map();
    protected metodosClasse: Map<string, Map<string, string>> = new Map();
    protected parametrosMetodosClasse: Map<string, Map<string, ParametroInterface[]>> = new Map();
    // Mapa de herança: nomeFIlho → nomePai (single inheritance).
    protected superClasses: Map<string, string> = new Map();
    // Id inteiro por classe, usado para identidade em tempo de execução (eInstanciaDe).
    // Atribuído incrementalmente à medida que classes são declaradas.
    protected idClasse: Map<string, number> = new Map();
    protected proximoIdClasse: number = 0;
    // Mapa de módulos importados: nomeModulo → (nomeFuncaoDelégua → FunctionCallee).
    // Populado em criarFuncaoNativa() à medida que as bibliotecas são implementadas.
    protected mapaModulos: Map<string, Map<string, EntradaFuncaoModulo>> = new Map();
    protected pilhaIsto: llvm.Value[] = [];
    protected classesComMarcadorTipo: Set<string> = new Set();
    protected contadoresNaoNegativos: Set<string> = new Set();
    protected tipoEstruturaVetor: llvm.StructType = null;
    protected pilhaBlocosLoop: Array<{ blocoSaida: llvm.BasicBlock; blocoRetorno: llvm.BasicBlock }> = [];
    protected contemExcecoes: boolean = false;
    // Tipo de retorno esperado da função sendo compilada no momento (null = main / desconhecido).
    // Usado para converter i1 → i32 quando a função declara retorno 'inteiro'/'lógico'.
    protected tipoRetornoFuncaoAtual: string | null = null;
    // Contador para gerar nomes únicos de lambdas.
    protected contadorLambda: number = 0;
    // Cache de ponteiros de elementos de vetores para evitar loads redundantes do struct %Vetor.
    // Invalidado em mudanças de bloco básico e chamadas que podem realocar.
    protected cachePointerVetor: Map<string, llvm.Value> = new Map();
    // Bloco básico onde o cache é válido.
    protected cacheBlocoAtual: llvm.BasicBlock | null = null;
    protected _contadorNomesAnonimos: number = 0;

    // Bibliotecas estrangeiras referenciadas por classes @definicao.
    // Campo público para que ilc.ts possa adicionar flags -l ao linker.
    bibliotecasEstrangeiras: Set<string> = new Set();
    // Nomes de classes estrangeiras declaradas — permite que visitarExpressaoDeVariavel
    // retorne um sentinela em vez de lançar erro ao acessar LibM.metodo().
    protected classesEstrangeiras: Set<string> = new Set();

    // Metadados de depuração DWARF (populados apenas quando emitirDebug=true em compilar()).
    protected construtorDebug: llvm.DIBuilder | null = null;
    protected arquivoDebug: llvm.DIFile | null = null;
    protected unidadeCompilacaoDebug: llvm.DICompileUnit | null = null;
    // Pilha de subprogramas ativos — o topo é o escopo de depuração corrente.
    protected pilhaSubprogramas: llvm.DISubprogram[] = [];
    // Mapa de hashArquivo → caminho absoluto e cache de DIFile por hash.
    protected mapaHashParaCaminho: Map<number, string> = new Map();
    protected cacheArquivosDebug: Map<number, llvm.DIFile> = new Map();
    // DIFile da função sendo compilada no momento (trocado em criarSubprogramaDebug).
    protected arquivoDebugFuncaoAtual: llvm.DIFile | null = null;

    printfFormatos: Map<string, string> = new Map<string, string>([
        ['inteiro', '%d'],
        ['longo', '%ld'],
        ['número', '%g'],
        ['texto', '%s'],
        ['lógico', '%d'],
    ]);

    scanfFormatos: Map<string, string> = new Map<string, string>([
        ['inteiro', '%d'],
        ['longo', '%ld'],
        ['número', '%lf'],
        ['texto', '%s'],
    ]);

    scanfFormatosCarregados: Map<string, llvm.Constant> = new Map<string, llvm.Constant>();

    protected static readonly METODOS_VETOR_BUILTIN = new Set([
        'adicionar', 'empilhar', 'removerUltimo', 'removerPrimeiro',
        'inverter', 'ordenar', 'fatiar', 'juntar', 'filtrarPor', 'mapear',
        'tamanho', 'inclui',
    ]);

    protected readonly NOMES_BLOCOS = {
        ESCOLHA_APOS: 'escolha_apos',
        ESCOLHA_CASO: 'escolha_caso',
        ESCOLHA_CORPO: 'escolha_corpo',
        ESCOLHA_PADRAO: 'escolha_padrao',
        SE_ENTAO: 'se_entao',
        SE_SENAO: 'se_senao',
        SE_APOS: 'se_apos',
        PARA_CABECA: 'para_cabeca',
        PARA_CORPO: 'para_corpo',
        PARA_INCREMENTO: 'para_incremento',
        PARA_APOS: 'para_apos',
        LOAD_ESCOLHA: 'load_escolha',
        LOAD_CONDICAO_SE: 'load_condicao_se',
        LOAD_CONDICAO_PARA: 'load_condicao_para',
        LOAD_OPERANDO: 'load_operando',
        CASO_OU: 'caso_ou',
        TENTE_CORPO: 'tente_corpo',
        TENTE_SENAO: 'tente_senao',
        TENTE_APOS: 'tente_apos',
        PEGUE_LANDING: 'pegue_landing',
        PEGUE_CORPO: 'pegue_corpo',
        FINALMENTE_CORPO: 'finalmente_corpo',
        TENTE_APOS_FINAL: 'tente_apos_final',
    };

    // Métodos de registro de módulos (implementados via mixin em registro-modulos/).
    registrarModuloArquivos: () => void;
    registrarModuloCriptografia: () => void;
    registrarModuloCsv: () => void;
    registrarModuloDados: () => void;
    registrarModuloEstatistica: () => void;
    registrarModuloFisica: () => void;
    registrarModuloHttp: () => void;
    registrarModuloJson: () => void;
    registrarModuloMatematica: () => void;

    constructor() {
        this.lexador = new Lexador();
        this.avaliadorSintatico = new AvaliadorSintatico();
        this.pilhaVariaveisEscopo = new PilhaVariaveisEscopo();
    }

    /**
     * Pequenos utilitários usados em várias visitas.
     */

    // Retorna verdadeiro se o incremento do laço garante que a variável
    // de nome `nomeVariavel` nunca decresce (ex.: i++, i += 1).
    protected incrementoEhPositivo(incrementar: ConstrutoInterface | null | undefined, nomeVariavel: string): boolean {
        if (!incrementar) return false;
        // Unário pós/pré-incremento: i++  ou  ++i
        if (incrementar instanceof Unario) {
            const operando = incrementar.operando as unknown as { simbolo?: { lexema?: string }; lexema?: string };
            const lexemaOperador = incrementar.operador?.lexema;
            const lexemaOperando = operando?.simbolo?.lexema ?? operando?.lexema;
            return lexemaOperador === '++' && lexemaOperando === nomeVariavel;
        }
        return false;
    }

    protected ehValorLlvm(valor: unknown): valor is llvm.Value {
        return !!valor && typeof (valor as { getType?: unknown }).getType === 'function';
    }

    protected arquivoDeSimbolo(simbolo: any): string | undefined {
        const hash = simbolo?.hashArquivo as number | undefined;
        return hash !== undefined ? this.mapaHashParaCaminho.get(hash) : undefined;
    }

    protected extrairNomeValorLlvm(valor: llvm.Value): string {
        try {
            const nome = valor.getName();
            if (nome && nome.length > 0) return nome;
        } catch {
            // getName() lança "Illegal invocation" em certos tipos de instrução LLVM
            // quando o binding nativo valida `this` contra o tipo C++ específico
        }
        try {
            const rep = valor.toString();
            if (rep && rep !== '[object Object]') return rep;
        } catch {
            // toString() também pode falhar em objetos nativos
        }
        return `_vec_${++this._contadorNomesAnonimos}`;
    }

    // Extrai o tipo do elemento de uma string de tipo vetor.
    // Aceita tanto 'vetor<inteiro>' como 'inteiro[]'.
    protected tipoElementoVetor(tipoVetor: string): string {
        if (tipoVetor?.endsWith('[]')) {
            return tipoVetor.slice(0, -2);
        }
        const correspondencia = tipoVetor?.match(/^vetor<(.+)>$/);
        return correspondencia ? correspondencia[1] : 'inteiro';
    }

    // Retorna verdadeiro se o tipo representa um vetor (qualquer notação).
    protected tipoEhVetor(tipo: string): boolean {
        return tipo?.startsWith('vetor<') || tipo === 'vetor' || tipo?.endsWith('[]');
    }

    // Retorna verdadeiro se o tipo representa um dicionário. Restrito a 'dicionário'/
    // 'dicionario' (inferido pelo avaliador sintático a partir de um literal {}, ou anotado
    // explicitamente) — NÃO inclui o `qualquer` bruto: um campo apenas anotado `qualquer`
    // pode ser qualquer coisa (ex.: uma instância de classe), e tratar esse acesso como
    // busca em dicionário sem essa confirmação seria uma adivinhação capaz de compilar
    // silenciosamente para código incorreto.
    protected tipoEhDicionario(tipo: string): boolean {
        return tipo === 'dicionário' || tipo === 'dicionario';
    }

    protected extrairNomesVariaveisIteracao(variavelIteracao: any): string[] {
        if (!variavelIteracao) {
            return [];
        }

        if (variavelIteracao.simbolo?.lexema) {
            return [variavelIteracao.simbolo.lexema];
        }

        if (variavelIteracao.primeiro && variavelIteracao.segundo) {
            return [variavelIteracao.primeiro?.valor, variavelIteracao.segundo?.valor].filter(Boolean);
        }

        return [];
    }

    protected criarVariavelEscopoIteracao(valor: any): VariavelEscopo {
        if (valor instanceof VariavelEscopo) {
            return valor;
        }

        if (valor?.variavelLlvm) {
            return valor as VariavelEscopo;
        }

        if (valor?.getType) {
            return new VariavelEscopo(valor as llvm.Value, undefined, 'qualquer');
        }

        return new VariavelEscopo(null as unknown as llvm.Value, undefined, 'qualquer');
    }

    protected async executarCorpoParaCada(
        variavelIteracao: any,
        vetorOuDicionario: any,
        corpo: Declaracao[] = []
    ): Promise<void> {
        const iteravelResolvido = vetorOuDicionario?.aceitar
            ? await vetorOuDicionario.aceitar(this)
            : vetorOuDicionario;
        const nomesIteracao = this.extrairNomesVariaveisIteracao(variavelIteracao);
        const iteracoes =
            Array.isArray(iteravelResolvido) && iteravelResolvido.length > 0 ? iteravelResolvido : [iteravelResolvido];

        for (const item of iteracoes) {
            const escopoIteracao = new Map<string, VariavelEscopo>();

            if (nomesIteracao.length >= 1) {
                escopoIteracao.set(nomesIteracao[0], this.criarVariavelEscopoIteracao(item));
            }

            if (nomesIteracao.length >= 2) {
                escopoIteracao.set(nomesIteracao[1], this.criarVariavelEscopoIteracao(item));
            }

            this.pilhaVariaveisEscopo.empilhar(escopoIteracao);

            try {
                await this.aceitarListaDeclaracoes(corpo);
            } finally {
                this.pilhaVariaveisEscopo.removerUltimo();
            }
        }
    }

    // Verifica se um `llvm.Type` é um ponteiro (PointerType).
    // Usa constructor.name em vez de `isPointerTy()` porque o binding LLVM só registra
    // `isPointerTy()` na classe `Type` base; chamá-la em subclasses como `IntegerType` via
    // herança de protótipo falha com "Illegal invocation" no runtime do Node.js.
    protected tipoEhPonteiro(tipo: llvm.Type): boolean {
        return tipo?.constructor?.name === 'PointerType';
    }

    protected garantirCondicaoI1(valor: llvm.Value): llvm.Value {
        const nomeTipo = valor?.getType()?.constructor?.name;
        // Double (construtor LLVM 'Type') usado como condição: comparar com 0.0
        if (nomeTipo === 'Type') {
            const zero = ConstantFP.get(this.contexto, new APFloat(0.0));
            return this.montador.CreateFCmpONE(valor, zero, 'cond_i1');
        }
        if (nomeTipo === 'IntegerType') {
            // getNullValue cria zero do mesmo tipo (i1, i32, i64...) sem precisar de getIntegerBitWidth.
            const zero = llvm.Constant.getNullValue(valor.getType());
            return this.montador.CreateICmpNE(valor, zero, 'cond_i1');
        }
        // ponteiro ou outro: passar adiante
        return valor;
    }

    protected inferirTipoRetornoCorpo(corpo: Declaracao[]): string {
        if (!corpo) return 'vazio';
        for (const instr of corpo) {
            if (instr instanceof Retorna && instr.valor != null) return 'lógico';
            const instrComCorpo = instr as unknown as DeclaracaoComCorpoPossivel;
            const sub = instrComCorpo.corpo?.declaracoes ?? instrComCorpo.declaracoes ?? [];
            if (Array.isArray(sub) && sub.length > 0) {
                const tipo = this.inferirTipoRetornoCorpo(sub);
                if (tipo !== 'vazio') return tipo;
            }
        }
        return 'vazio';
    }

    // Guarda um valor em uma VariavelEscopo (ou faz nothing se o destino não for ponteiro).
    // Faz conversões simples entre inteiro/número se necessário.
    protected armazenarEmVariavel(
        destino: VariavelEscopo | llvm.Value,
        valor: llvm.Value,
        tipoDestinoDelegua?: string,
        tipoValorDelegua?: string
    ): void {
        if (destino instanceof VariavelEscopo) {
            const destTipo = destino.variavelLlvm.getType();
            if (this.tipoEhPonteiro(destTipo)) {
                // Se for necessário ajustar o tipo entre inteiro <-> número:
                if (tipoDestinoDelegua && tipoValorDelegua && tipoDestinoDelegua !== tipoValorDelegua) {
                    if (tipoDestinoDelegua === 'inteiro' && tipoValorDelegua === 'número') {
                        valor = this.montador.CreateFPToSI(valor, this.montador.getInt32Ty(), 'double_para_int');
                    } else if (tipoDestinoDelegua === 'número' && tipoValorDelegua === 'inteiro') {
                        valor = this.montador.CreateSIToFP(valor, this.montador.getDoubleTy(), 'int_para_double');
                    }
                }
                this.montador.CreateStore(valor, destino.variavelLlvm);
            } else {
                // Destino já é valor direto: não faz sentido armazenar, mas podemos tentar sobrescrever
                // (isso é raro; normalmente destino será ponteiro).
                // No caso, não fazemos nada.
            }
        } else {
            // destino não é VariavelEscopo: nada a fazer.
        }
    }

    // Aceita (processa) todas as declarações de um bloco/arranjo.
    protected async aceitarListaDeclaracoes(declaracoes: Declaracao[] | undefined): Promise<void> {
        if (!declaracoes) return;
        for (const declaracao of declaracoes) {
            await declaracao.aceitar(this);
        }
    }

    // Conveniência para aceitar (resolver) um construto e carregar seu valor se for VariavelEscopo.
    protected async aceitarECarregar(
        possivelVariavel: ConstrutoInterface | VariavelEscopo | llvm.Value,
        tipo?: string,
        nomeLoad?: string
    ): Promise<llvm.Value | VariavelEscopo> {
        let resolvido: unknown;
        if (possivelVariavel && 'aceitar' in possivelVariavel && typeof possivelVariavel.aceitar === 'function') {
            resolvido = await (possivelVariavel as ConstrutoInterface).aceitar(this);
        } else {
            resolvido = possivelVariavel;
        }
        if (resolvido instanceof VariavelEscopo) {
            if (nomeLoad && tipo) {
                const tipoLlvm = this.obterTipoLlvm(tipo);
                return this.montador.CreateLoad(tipoLlvm, resolvido.variavelLlvm, nomeLoad);
            }
            return resolvido;
        }
        return resolvido as llvm.Value | VariavelEscopo;
    }

    // ─── Auxiliares de depuração DWARF ───────────────────────────────────────

    // Mapeia o nome de tipo Delégua para o DIBasicType correspondente.
    protected obterTipoDebug(nomeTipo: string): llvm.DIBasicType | null {
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
    protected definirLocalizacaoDebug(linha: number, coluna: number): void {
        if (!this.construtorDebug || this.pilhaSubprogramas.length === 0) return;
        const escopoAtual = this.pilhaSubprogramas[this.pilhaSubprogramas.length - 1];
        const loc = llvm.DILocation.get(this.contexto, linha, coluna, escopoAtual);
        this.montador.SetCurrentDebugLocation(loc);
    }

    // Cria um DISubprogram e o associa a uma Function LLVM.
    // Empilha o subprograma para uso nas instruções internas.
    protected criarSubprogramaDebug(
        funcaoLlvm: llvm.Function,
        nome: string,
        linha: number,
        arquivo?: llvm.DIFile | null
    ): void {
        if (!this.construtorDebug || !this.arquivoDebug) return;
        const arquivoEfetivo = arquivo ?? this.arquivoDebug;
        const tipoSubrotina = this.construtorDebug.createSubroutineType(
            this.construtorDebug.getOrCreateTypeArray([null])
        );
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
    protected finalizarSubprogramaDebug(): void {
        if (!this.construtorDebug) return;
        const sp = this.pilhaSubprogramas.pop();
        if (sp) this.construtorDebug.finalizeSubprogram(sp);
    }

    // Retorna o DIFile para o arquivo identificado pelo hash, criando-o se necessário.
    protected obterArquivoDebugParaHash(hashArquivo: number | undefined): llvm.DIFile | null {
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
    protected emitirDeclaracaoVariavelDebug(
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
    protected emitirDeclaracaoParametroDebug(
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

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Implementações úteis padrão para visitantes que eram esboços.
     *
     * Observação: as implementações aqui buscam oferecer comportamento útil
     * e conservador (traversal/armazenamento/carregamento), não suporte completo
     * a todas as construções complexas (ex.: métodos, indexações complexas, classes).
     */

    async visitarDeclaracaoCabecalhoPrograma(_: CabecalhoPrograma): Promise<any> {
        // Normalmente só marca metadados; não produz IR.
        return Promise.resolve();
    }

    // Mapeia tipo Delégua para LLVM, incluindo 'vazio' → void (que obterTipoLlvm não suporta).
    protected tipoFFIParaLlvm(tipoDelegua: string): llvm.Type {
        if (tipoDelegua === 'vazio') return llvm.Type.getVoidTy(this.contexto);
        return this.obterTipoLlvm(tipoDelegua);
    }

    async visitarDeclaracaoClasse(declaracao: Classe): Promise<any> {
        const nomeClasse = declaracao.simbolo.lexema;

        // Classe estrangeira com @definicao: emite `declare` via getOrInsertFunction
        // e registra no mapaModulos para despacho sem ponteiro self.
        if (declaracao.estrangeira) {
            const meta = lerMetadadosClasse(declaracao.decoradores);
            if (meta) {
                this.bibliotecasEstrangeiras.add(meta.biblioteca);
                this.classesEstrangeiras.add(nomeClasse);
                const funcoes = new Map<string, EntradaFuncaoModulo>();
                for (const metodo of declaracao.metodos) {
                    const nomeMetodo = metodo.simbolo.lexema;
                    const metaMetodo = lerMetadadosMetodo(metodo.decoradores, nomeMetodo, meta.prefixo);
                    const tiposParams = (metodo.funcao?.parametros ?? []).map(p => p.tipoDado ?? 'vazio');
                    const tipoRetorno = metodo.tipo ?? 'vazio';
                    const tiposLlvm = tiposParams.map(t => this.obterTipoLlvm(t));
                    const tipoRetornoLlvm = tipoRetorno === 'vazio'
                        ? llvm.Type.getVoidTy(this.contexto)
                        : this.obterTipoLlvm(tipoRetorno);
                    const tipoFuncao = llvm.FunctionType.get(tipoRetornoLlvm, tiposLlvm, false);
                    const callee = this.modulo.getOrInsertFunction(metaMetodo.simbolo, tipoFuncao);
                    funcoes.set(nomeMetodo, { callee, tiposParametros: tiposParams, tipoRetorno });
                }
                this.mapaModulos.set(nomeClasse, funcoes);
                this.metodosClasse.set(nomeClasse, new Map(
                    [...funcoes.entries()].map(([nome, e]) => [nome, e.tipoRetorno])
                ));
            }
            return;
        }

        // Detecta superclasse (primeira entrada em superClasses, se existir).
        const superClasseRef = declaracao.superClasses?.[0] as { simbolo?: { lexema?: string }; tipo?: string };
        const nomeSuperClasse: string | null = superClasseRef?.simbolo?.lexema ?? superClasseRef?.tipo ?? null;
        const temSuperClasseRegistrada = !!nomeSuperClasse && this.indicesPropriedades.has(nomeSuperClasse);

        this.idClasse.set(nomeClasse, this.proximoIdClasse++);

        // 1. Coletar tipos LLVM das propriedades e construir o struct.
        //    Com herança plana: campos do pai vêm primeiro, depois os próprios.
        const tiposPropsLlvm: llvm.Type[] = [];
        const mapaIndices: Map<string, number> = new Map();
        const mapaTipos: Map<string, string> = new Map();

        if (temSuperClasseRegistrada) {
            const indicesPai = this.indicesPropriedades.get(nomeSuperClasse);
            const tiposPai = this.tiposPropriedades.get(nomeSuperClasse);
            // Ordena pelo índice para garantir a ordem original dos campos.
            const camposPai = [...indicesPai.entries()].sort((a, b) => a[1] - b[1]);
            for (const [nomeCampo] of camposPai) {
                const tipoCampo = tiposPai.get(nomeCampo);
                tiposPropsLlvm.push(this.obterTipoLlvm(tipoCampo));
                mapaIndices.set(nomeCampo, tiposPropsLlvm.length - 1);
                mapaTipos.set(nomeCampo, tipoCampo);
            }
        } else {
            // Classe raiz (sem superclasse registrada): reserva o campo 0 oculto com o id de
            // identidade em tempo de execução (usado por eInstanciaDe). Subclasses herdam este
            // campo automaticamente pelo laço de cópia de campos do pai, acima.
            tiposPropsLlvm.push(this.obterTipoLlvm('inteiro'));
            mapaIndices.set('__tipoId', tiposPropsLlvm.length - 1);
            mapaTipos.set('__tipoId', 'inteiro');
        }

        for (const propriedade of declaracao.propriedades) {
            const tipoProp = propriedade.tipo || 'número';
            tiposPropsLlvm.push(this.obterTipoLlvm(tipoProp));
            mapaIndices.set(propriedade.nome.lexema, tiposPropsLlvm.length - 1);
            mapaTipos.set(propriedade.nome.lexema, tipoProp);
        }

        const tipoStruct = llvm.StructType.create(this.contexto, nomeClasse);
        tipoStruct.setBody(tiposPropsLlvm);

        this.registroClasses.set(nomeClasse, tipoStruct);
        this.indicesPropriedades.set(nomeClasse, mapaIndices);
        this.tiposPropriedades.set(nomeClasse, mapaTipos);

        if (!this.classesComMarcadorTipo.has(nomeClasse)) {
            const tipoFuncaoMarcador = llvm.FunctionType.get(
                llvm.Type.getVoidTy(this.contexto),
                [llvm.PointerType.get(this.contexto, 0)],
                false
            );
            llvm.Function.Create(
                tipoFuncaoMarcador,
                llvm.Function.LinkageTypes.ExternalLinkage,
                `__delegua_tipo_${nomeClasse}`,
                this.modulo
            );
            this.classesComMarcadorTipo.add(nomeClasse);
        }

        // 2. Compilar cada método como função LLVM com %NomeClasse* como primeiro parâmetro
        const tipoSelf = llvm.PointerType.get(this.contexto, 0);
        if (!this.metodosClasse.has(nomeClasse)) {
            this.metodosClasse.set(nomeClasse, new Map());
        }
        if (!this.parametrosMetodosClasse.has(nomeClasse)) {
            this.parametrosMetodosClasse.set(nomeClasse, new Map());
        }

        // Passo 2a: pré-declarar todas as funções antes de compilar qualquer corpo,
        // permitindo referências cruzadas entre métodos da mesma classe.
        const funcoesMetodos = new Map<string, llvm.Function>();
        for (const metodo of declaracao.metodos) {
            const ehConstrutor = metodo.simbolo.lexema === 'construtor';
            const nomeFuncaoLlvm = `${nomeClasse}_${metodo.simbolo.lexema}`;

            const tiposParametros: llvm.Type[] = [tipoSelf];
            for (const parametro of metodo.funcao.parametros) {
                // Vetores são sempre passados por ponteiro (ptr), nunca por valor (%Vetor).
                tiposParametros.push(
                    this.tipoEhVetor(parametro.tipoDado)
                        ? llvm.PointerType.get(this.contexto, 0)
                        : this.obterTipoLlvm(parametro.tipoDado)
                );
            }

            const tipoRetornoStr: string = ehConstrutor
                ? 'vazio'
                : (metodo.funcao.tipo ?? this.inferirTipoRetornoCorpo(metodo.funcao.corpo));
            // 'vazio' → void; 'nulo' e 'qualquer' → ptr (null pointer / opaque any).
            const tipoRetorno =
                tipoRetornoStr === 'vazio'
                    ? llvm.Type.getVoidTy(this.contexto)
                    : this.obterTipoLlvm(tipoRetornoStr);

            const tipoFuncao = llvm.FunctionType.get(tipoRetorno, tiposParametros, false);
            const objetoLlvmFuncaoPre = llvm.Function.Create(
                tipoFuncao,
                llvm.Function.LinkageTypes.ExternalLinkage,
                nomeFuncaoLlvm,
                this.modulo
            );
            funcoesMetodos.set(metodo.simbolo.lexema, objetoLlvmFuncaoPre);

            this.metodosClasse.get(nomeClasse).set(metodo.simbolo.lexema, ehConstrutor ? 'vazio' : metodo.funcao.tipo);
            this.parametrosMetodosClasse.get(nomeClasse).set(metodo.simbolo.lexema, metodo.funcao.parametros);
        }

        // Passo 2b: compilar os corpos usando as funções já declaradas.
        for (const metodo of declaracao.metodos) {
            const ehConstrutor = metodo.simbolo.lexema === 'construtor';
            const objetoLlvmFuncao = funcoesMetodos.get(metodo.simbolo.lexema);

            const tipoRetornoStr: string = ehConstrutor
                ? 'vazio'
                : (metodo.funcao.tipo ?? this.inferirTipoRetornoCorpo(metodo.funcao.corpo));

            // Escopo do método: arg 0 = %self (isto), restantes = parâmetros
            const mapaVariaveis: Map<string, VariavelEscopo> = new Map();
            const selfArg = objetoLlvmFuncao.getArg(0);
            mapaVariaveis.set('isto', new VariavelEscopo(selfArg, undefined, nomeClasse));

            for (const [indice, parametro] of metodo.funcao.parametros.entries()) {
                const argLlvm = objetoLlvmFuncao.getArg(indice + 1);
                mapaVariaveis.set(parametro.nome.lexema, new VariavelEscopo(argLlvm, undefined, parametro.tipoDado));
            }

            this.pilhaVariaveisEscopo.empilhar(mapaVariaveis);
            this.pilhaIsto.push(selfArg);
            const tipoRetornoAnteriorMetodo = this.tipoRetornoFuncaoAtual;
            this.tipoRetornoFuncaoAtual = tipoRetornoStr;
            const linhaMetodo = (metodo.simbolo as any).linha ?? 0;
            const hashMetodo = (metodo.simbolo as any).hashArquivo as number | undefined;
            this.criarSubprogramaDebug(objetoLlvmFuncao, metodo.simbolo.lexema, linhaMetodo, this.obterArquivoDebugParaHash(hashMetodo));
            // Prepara parâmetros do método para debug info; arg 0 é 'isto' (self).
            const parametrosDebugMetodo = this.construtorDebug
                ? metodo.funcao.parametros.map((parametro, indice) => ({
                      arg: objetoLlvmFuncao.getArg(indice + 1),
                      nome: parametro.nome.lexema,
                      tipo: parametro.tipoDado ?? 'qualquer',
                      argNo: indice + 2,
                      linha: linhaMetodo,
                  }))
                : undefined;
            await this.visitarCorpoFuncao(metodo.funcao, objetoLlvmFuncao, parametrosDebugMetodo);
            this.finalizarSubprogramaDebug();
            const blocoAtualMetodo = this.montador.GetInsertBlock();
            if (blocoAtualMetodo && !blocoAtualMetodo.getTerminator()) {
                if (tipoRetornoStr === 'vazio') {
                    this.montador.CreateRetVoid();
                } else if (tipoRetornoStr === 'nulo' || tipoRetornoStr === 'qualquer') {
                    this.montador.CreateRet(llvm.Constant.getNullValue(this.montador.getPtrTy()) as unknown as llvm.Value);
                } else {
                    this.montador.CreateUnreachable();
                }
            }
            this.tipoRetornoFuncaoAtual = tipoRetornoAnteriorMetodo;
            this.pilhaIsto.pop();
            this.pilhaVariaveisEscopo.removerUltimo();
        }

        // Registra relação de herança e copia métodos herdados não sobrescritos.
        if (nomeSuperClasse) {
            this.superClasses.set(nomeClasse, nomeSuperClasse);

            const metodosPai = this.metodosClasse.get(nomeSuperClasse);
            if (metodosPai) {
                const nomesPropriosFilho = new Set(declaracao.metodos.map((m) => m.simbolo.lexema));
                for (const [nomeMetodo, tipoRetorno] of metodosPai.entries()) {
                    if (!nomesPropriosFilho.has(nomeMetodo) && nomeMetodo !== 'construtor') {
                        this.metodosClasse.get(nomeClasse).set(nomeMetodo, tipoRetorno);
                    }
                }
            }
        }

        return Promise.resolve();
    }

    async visitarDeclaracaoComentario(_: Comentario): Promise<any> {
        // Comentários não são tratados no LLVM.
        return Promise.resolve();
    }

    async visitarDeclaracaoConst(declaracao: Const): Promise<any> {
        // Tratar similar a var mas imutável. Aloca e armazena o inicializador.
        const tipoVariavel =
            declaracao.tipo === 'qualquer' ? this.resolverTipoConstruto(declaracao.inicializador) : declaracao.tipo;
        const tipoLlvm = this.obterTipoLlvm(tipoVariavel);
        const linhaConst = (declaracao.simbolo as any).linha ?? 0;
        this.definirLocalizacaoDebug(linhaConst, 0);
        const aloc = this.montador.CreateAlloca(tipoLlvm, null, declaracao.simbolo.lexema);
        let valor = await declaracao.inicializador.aceitar(this);

        const tipoInicializador = this.resolverTipoConstruto(declaracao.inicializador);
        if (tipoVariavel === 'inteiro' && tipoInicializador === 'número') {
            valor = this.montador.CreateFPToSI(valor, this.montador.getInt32Ty(), 'double_para_int');
        } else if (tipoVariavel === 'número' && tipoInicializador === 'inteiro') {
            valor = this.montador.CreateSIToFP(valor, this.montador.getDoubleTy(), 'int_para_double');
        } else if (tipoVariavel === 'longo' && tipoInicializador === 'inteiro') {
            valor = this.montador.CreateSExt(valor, llvm.Type.getInt64Ty(this.contexto), 'int_para_longo');
        } else if (tipoVariavel === 'longo' && tipoInicializador === 'número') {
            valor = this.montador.CreateFPToSI(valor, llvm.Type.getInt64Ty(this.contexto), 'double_para_longo');
        }

        this.montador.CreateStore(valor, aloc);
        this.emitirDeclaracaoVariavelDebug(aloc, declaracao.simbolo.lexema, tipoVariavel, linhaConst);

        const topo = this.pilhaVariaveisEscopo.topoDaPilha();
        const variavelEscopo = new VariavelEscopo(aloc, declaracao, tipoVariavel, true);
        topo.set(declaracao.simbolo.lexema, variavelEscopo);
        return Promise.resolve();
    }

    async visitarDeclaracaoConstMultiplo(declaracao: ConstMultiplo): Promise<any> {
        const simbolos = declaracao.simbolos || [];
        const tipoDeclarado = declaracao.tipo;

        const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
        for (const [indice, simbolo] of simbolos.entries()) {
            const nomeSimbolo = simbolo?.lexema || `const_${indice}`;

            if (!this.montador || !declaracao.inicializador?.aceitar) {
                topoDaPilha.set(
                    nomeSimbolo,
                    new VariavelEscopo(
                        declaracao.inicializador as unknown as llvm.Value,
                        declaracao,
                        tipoDeclarado || 'qualquer',
                        true
                    )
                );
                continue;
            }

            const tipoVariavel =
                tipoDeclarado === 'qualquer' || !tipoDeclarado
                    ? this.resolverTipoConstruto(declaracao.inicializador)
                    : tipoDeclarado;

            const tipoLlvm = this.obterTipoLlvm(tipoVariavel);
            const alocacao = this.montador.CreateAlloca(tipoLlvm, null, nomeSimbolo);
            const valorResolvido = await declaracao.inicializador.aceitar(this);
            this.montador.CreateStore(valorResolvido, alocacao);

            topoDaPilha.set(nomeSimbolo, new VariavelEscopo(alocacao, declaracao, tipoVariavel, true));
        }

        return Promise.resolve();
    }

    async visitarDeclaracaoDeExpressao(declaracao: Expressao): Promise<any> {
        this.definirLocalizacaoDebug(declaracao.linha ?? 0, 0);
        await declaracao.expressao.aceitar(this);
        return Promise.resolve();
    }

    async visitarDeclaracaoEnquanto(declaracao: Enquanto): Promise<any> {
        this.definirLocalizacaoDebug(declaracao.linha ?? 0, 0);
        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        const blocoCond = llvm.BasicBlock.Create(this.contexto, 'enquanto_condicao', funcaoAtual);
        const blocoCorpo = llvm.BasicBlock.Create(this.contexto, 'enquanto_corpo', funcaoAtual);
        const blocoApos = llvm.BasicBlock.Create(this.contexto, 'enquanto_apos', funcaoAtual);

        this.montador.CreateBr(blocoCond);
        this.montador.SetInsertPoint(blocoCond);

        const condRaw = await declaracao.condicao.aceitar(this);
        const cond = this.carregarValorSeNecessario(condRaw, declaracao.condicao.tipo, 'enquanto_condicao_carga');

        this.montador.CreateCondBr(cond, blocoCorpo, blocoApos);

        this.montador.SetInsertPoint(blocoCorpo);
        this.pilhaBlocosLoop.push({ blocoSaida: blocoApos, blocoRetorno: blocoCond });
        await this.aceitarListaDeclaracoes(declaracao.corpo.declaracoes);
        this.pilhaBlocosLoop.pop();
        this.montador.CreateBr(blocoCond);

        this.montador.SetInsertPoint(blocoApos);
        return Promise.resolve();
    }

    async visitarDeclaracaoEscrevaMesmaLinha(declaracao: EscrevaMesmaLinha): Promise<any> {
        // Semelhante ao escrever com quebra, mas sem símbolo de nova linha: ajusta formato para não usar \n.
        const tipoPrimeiroArgumento = declaracao.argumentos[0].tipo;
        // Reutiliza o formato do printf, removendo o símbolo de nova linha final.
        let formato = this.printfFormatos.get(tipoPrimeiroArgumento) || '%s\n';
        formato = formato.replace(/\n$/, '');

        const argumentosResolvidos: llvm.Value[] = [];
        for (const argumento of declaracao.argumentos) {
            const arg = await argumento.aceitar(this);
            if (arg instanceof VariavelEscopo) {
                const tipoArg = this.obterTipoLlvm(argumento.tipo);
                let carregado: llvm.Value = this.montador.CreateLoad(tipoArg, arg.variavelLlvm, 'load_var');
                if (formato.includes('%s')) {
                    carregado = this.normalizarOperandoParaTextoSeguro(
                        { valor: carregado, tipo: argumento.tipo || 'texto' },
                        'escreva_sem_linha'
                    );
                }
                argumentosResolvidos.push(carregado);
            } else {
                if (formato.includes('%s')) {
                    argumentosResolvidos.push(
                        this.normalizarOperandoParaTextoSeguro(
                            { valor: arg as llvm.Value, tipo: argumento.tipo || 'texto' },
                            'escreva_sem_linha_val'
                        )
                    );
                } else {
                    argumentosResolvidos.push(arg);
                }
            }
        }
        const formatoPtr = this.montador.CreateGlobalStringPtr(
            formato,
            `formato_printf_${tipoPrimeiroArgumento}_sem_nl`,
            0,
            this.modulo
        );

        argumentosResolvidos.unshift(formatoPtr);
        this.montador.CreateCall(this.funcaoEscreva, argumentosResolvidos);
        return Promise.resolve();
    }

    async visitarDeclaracaoFazer(declaracao: Fazer): Promise<any> {
        // Guarda: se o compilador não estiver inicializado (sem montador ativo),
        // percorre corpo e condição sem emitir CFG — compatível com testes de visitantes isolados.
        if (!this.montador) {
            await this.aceitarListaDeclaracoes(
                declaracao.caminhoFazer?.declaracoes
            );

            if (declaracao.condicaoEnquanto?.aceitar) {
                await declaracao.condicaoEnquanto.aceitar(this);
            } 

            return Promise.resolve();
        }

        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        const blocoCorpo = llvm.BasicBlock.Create(this.contexto, 'fazer_corpo', funcaoAtual);
        const blocoCondicao = llvm.BasicBlock.Create(this.contexto, 'fazer_condicao', funcaoAtual);
        const blocoApos = llvm.BasicBlock.Create(this.contexto, 'fazer_apos', funcaoAtual);

        // Salta incondicionalmente para o corpo (executa pelo menos uma vez).
        this.montador.CreateBr(blocoCorpo);

        // Corpo do laço.
        this.montador.SetInsertPoint(blocoCorpo);
        this.pilhaBlocosLoop.push({ blocoSaida: blocoApos, blocoRetorno: blocoCondicao });
        await this.aceitarListaDeclaracoes(
            declaracao.caminhoFazer?.declaracoes
        );
        this.pilhaBlocosLoop.pop();
        this.montador.CreateBr(blocoCondicao);

        // Avaliação da condição de continuação.
        this.montador.SetInsertPoint(blocoCondicao);
        const condicaoBruta = declaracao.condicaoEnquanto?.aceitar
            ? await declaracao.condicaoEnquanto.aceitar(this) : null;

        if (condicaoBruta !== null) {
            const tipoCond = declaracao.condicaoEnquanto?.tipo ?? 'lógico';
            const condicao = this.carregarValorSeNecessario(condicaoBruta, tipoCond, 'fazer_condicao_carga');
            this.montador.CreateCondBr(condicao, blocoCorpo, blocoApos);
        } else {
            // Condição ausente: laço infinito (improvável em Delégua, mas seguro).
            this.montador.CreateBr(blocoCorpo);
        }

        this.montador.SetInsertPoint(blocoApos);
        return Promise.resolve();
    }

    async visitarDeclaracaoAjuda(_: Ajuda): Promise<any> {
        // Sistema de ajuda em tempo de execução não tem mapeamento em IR.
        return Promise.resolve();
    }

    async visitarDeclaracaoExtensao(declaracao: Extensao): Promise<any> {
        const membrosOuMetodos = (declaracao as any).membros ?? declaracao.metodos;
        if (Array.isArray(membrosOuMetodos)) {
            await this.aceitarListaDeclaracoes(membrosOuMetodos);
        }

        return Promise.resolve();
    }

    async visitarDeclaracaoImportar(declaracao: Importar): Promise<any> {
        // Resolve o nome do módulo a partir do caminho (normalmente um Literal com valor string).
        const nomeModulo: string = declaracao.caminho?.valor ?? '';

        if (!this.mapaModulos.has(nomeModulo)) {
            // Módulo desconhecido (ex: caminho de arquivo) — ignorado nesta fase.
            return Promise.resolve();
        }

        // Forma 2a: importar tudo como alias de 'modulo'
        if (declaracao.simboloTudo) {
            const alias = declaracao.simboloTudo.lexema;
            const sentinela = new VariavelEscopo(null, undefined, `modulo:${nomeModulo}`);
            this.pilhaVariaveisEscopo.topoDaPilha().set(alias, sentinela);
            return Promise.resolve();
        }

        // Forma 2b: importar { fn1, fn2 } de 'modulo'
        if (declaracao.elementosImportacao.length > 0) {
            const funcoes = this.mapaModulos.get(nomeModulo);
            for (const elemento of declaracao.elementosImportacao) {
                const nomeFuncao = elemento.lexema;
                const entrada = funcoes?.get(nomeFuncao);
                if (entrada) {
                    // getCallee() retorna o llvm.Value (llvm.Function) subjacente ao FunctionCallee.
                    const llvmFuncao = entrada.callee.getCallee();
                    this.pilhaVariaveisEscopo
                        .topoDaPilha()
                        .set(nomeFuncao, new VariavelEscopo(llvmFuncao, undefined, 'função'));
                }
            }
        }

        return Promise.resolve();
    }

    async visitarDeclaracaoInterface(_: InterfaceDeclaracao): Promise<any> {
        // Declarações de interface são apenas metadados de tipo; sem geração de IR.
        return Promise.resolve();
    }

    async visitarDeclaracaoInicioAlgoritmo(_: InicioAlgoritmo): Promise<any> {
        // Marca início — nada a gerar.
        return Promise.resolve();
    }

    async visitarDeclaracaoParaCada(declaracao: ParaCada): Promise<any> {
        const variavelIteracao = declaracao.variavelIteracao;
        const corpo = declaracao.corpo?.declaracoes || [];
        const nomeElemento = this.extrairNomesVariaveisIteracao(variavelIteracao)[0] ?? 'elemento';

        let iteravelResolvido = declaracao.vetorOuDicionario?.aceitar ? await declaracao.vetorOuDicionario.aceitar(this) : declaracao.vetorOuDicionario;

        // Quando o iterável resolve para um llvm.Value bruto (ex.: acesso a propriedade de classe),
        // tenta inferir o tipo via AST. O gepPtr já é o struct-ptr direto — armazena sem indireção extra.
        if (!(iteravelResolvido instanceof VariavelEscopo) && this.ehValorLlvm(iteravelResolvido)) {
            const tipoInferido = declaracao.vetorOuDicionario ? this.resolverTipoConstruto(declaracao.vetorOuDicionario as ConstrutoInterface) : null;
            if (tipoInferido && this.tipoEhVetor(tipoInferido)) {
                iteravelResolvido = new VariavelEscopo(iteravelResolvido as llvm.Value, undefined, tipoInferido);
            }
        }

        // Fallback para iteráveis JS (caso não seja VariavelEscopo LLVM com variavelLlvm válida).
        if (!(iteravelResolvido instanceof VariavelEscopo) || !iteravelResolvido.variavelLlvm) {
            await this.executarCorpoParaCada(variavelIteracao, declaracao.vetorOuDicionario, corpo);
            return Promise.resolve();
        }

        const tipoIterable = iteravelResolvido.tipo ?? 'vetor';
        const ehTexto = tipoIterable === 'texto';
        const ehVetor = this.tipoEhVetor(tipoIterable);

        if (!ehTexto && !ehVetor) {
            // Tipo desconhecido: fallback.
            await this.executarCorpoParaCada(variavelIteracao, declaracao.vetorOuDicionario, corpo);
            return Promise.resolve();
        }

        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        // Índice i = 0 na entrada da função.
        const alocIndice = this.criarAllocaNoBlocoEntrada(this.montador.getInt32Ty(), 'para_cada_i');
        this.montador.CreateStore(ConstantInt.get(this.contexto, new APInt(32, 0)), alocIndice);
        this.contadoresNaoNegativos.add(nomeElemento + '_i');

        // Determina se variavelLlvm já é o struct-ptr direto (argumento ou GEP de campo)
        // ou um ponteiro-para-ponteiro que precisa ser carregado (alloca local).
        const nomeConstrutorIter = iteravelResolvido.variavelLlvm.constructor.name;
        const ehArgumento = nomeConstrutorIter === 'Argument' || nomeConstrutorIter === 'GetElementPtrInst';

        // Tamanho do iterável.
        let tamanho: llvm.Value;
        if (ehVetor) {
            // Para vetor: se for argumento, o valor já é o struct-ptr; senão, carrega.
            const vetorPtr = ehArgumento
                ? iteravelResolvido.variavelLlvm
                : this.montador.CreateLoad(this.montador.getPtrTy(), iteravelResolvido.variavelLlvm, 'vetor_ptr');
            tamanho = this.montador.CreateCall(this.funcaoVetorTamanho, [vetorPtr], 'para_cada_tam');
        } else {
            // texto: strlen retorna i64; trunca para i32.
            const textoPtr = ehArgumento
                ? iteravelResolvido.variavelLlvm
                : this.montador.CreateLoad(this.montador.getPtrTy(), iteravelResolvido.variavelLlvm, 'texto_ptr');
            const len64 = this.montador.CreateCall(this.funcaoStrlen, [textoPtr], 'strlen_res');
            tamanho = this.montador.CreateTrunc(len64, this.montador.getInt32Ty(), 'para_cada_tam');
        }

        // Blocos.
        const blocoCabeca = llvm.BasicBlock.Create(this.contexto, 'para_cada_cab', funcaoAtual);
        const blocoCorpo = llvm.BasicBlock.Create(this.contexto, 'para_cada_corpo', funcaoAtual);
        const blocoInc = llvm.BasicBlock.Create(this.contexto, 'para_cada_inc', funcaoAtual);
        const blocoApos = llvm.BasicBlock.Create(this.contexto, 'para_cada_apos', funcaoAtual);

        this.montador.CreateBr(blocoCabeca);

        // Cabeça: i < tamanho.
        this.montador.SetInsertPoint(blocoCabeca);
        const iAtual = this.montador.CreateLoad(this.montador.getInt32Ty(), alocIndice, 'i_atual');
        const condicao = this.montador.CreateICmpSLT(iAtual, tamanho, 'para_cada_cond');
        this.montador.CreateCondBr(condicao, blocoCorpo, blocoApos);

        // Corpo: declara variável de elemento no escopo.
        this.montador.SetInsertPoint(blocoCorpo);

        let alocElemento: llvm.AllocaInst;
        let tipoElementoStr: string;

        if (ehVetor) {
            tipoElementoStr = this.tipoElementoVetor(tipoIterable);
            const tipoElemLlvm = this.obterTipoLlvm(tipoElementoStr);
            alocElemento = this.criarAllocaNoBlocoEntrada(tipoElemLlvm, nomeElemento + '_val');

            const iCorpo = this.montador.CreateLoad(this.montador.getInt32Ty(), alocIndice, 'i_corpo');
            // TODO: Como obter o nome do vetor aqui?
            const nomeVetor =
                declaracao.vetorOuDicionario instanceof Variavel
                    ? declaracao.vetorOuDicionario.simbolo.lexema
                    : nomeElemento + '_vec';
            const ponteiroElementos = this.carregarPonteiroElementosVetor(nomeVetor, iteravelResolvido.variavelLlvm);
            const gepElem = this.montador.CreateInBoundsGEP(tipoElemLlvm, ponteiroElementos, [iCorpo], 'ptr_elem', true);
            const valorElementos = this.montador.CreateLoad(tipoElemLlvm, gepElem, nomeElemento + '_carregado');
            this.montador.CreateStore(valorElementos, alocElemento);
        } else {
            // texto: cada elemento é um char, exposto como ptr para buffer [2 x i8] (char + '\0').
            tipoElementoStr = 'texto';
            const tipoBuf = llvm.ArrayType.get(this.montador.getInt8Ty(), 2);
            // alocBuf: dados do char na pilha (reutilizado a cada iteração).
            const alocBuf = this.criarAllocaNoBlocoEntrada(tipoBuf as unknown as llvm.Type, nomeElemento + '_buf');
            // alocElemento: ptr para alocBuf (é o que o corpo carrega como "texto").
            alocElemento = this.criarAllocaNoBlocoEntrada(this.montador.getPtrTy(), nomeElemento + '_ptr');

            const iCorpo = this.montador.CreateLoad(this.montador.getInt32Ty(), alocIndice, 'i_corpo');
            const textoPtr2 = ehArgumento
                ? iteravelResolvido.variavelLlvm
                : this.montador.CreateLoad(this.montador.getPtrTy(), iteravelResolvido.variavelLlvm, 'texto_ptr2');
            const gepChar = this.montador.CreateInBoundsGEP(
                this.montador.getInt8Ty(),
                textoPtr2,
                [iCorpo],
                'ptr_char',
                true
            );
            const charVal = this.montador.CreateLoad(this.montador.getInt8Ty(), gepChar, 'char_val');
            const idx0 = ConstantInt.get(this.contexto, new APInt(32, 0));
            const gepBuf0 = this.montador.CreateInBoundsGEP(
                tipoBuf as unknown as llvm.Type,
                alocBuf,
                [idx0, idx0],
                'buf0'
            );
            this.montador.CreateStore(charVal, gepBuf0);
            const gepBuf1 = this.montador.CreateInBoundsGEP(
                tipoBuf as unknown as llvm.Type,
                alocBuf,
                [idx0, ConstantInt.get(this.contexto, new APInt(32, 1))],
                'buf1'
            );
            this.montador.CreateStore(ConstantInt.get(this.contexto, new APInt(8, 0)), gepBuf1);
            // Armazena endereço do buffer no ptr-alloca exposto ao escopo.
            this.montador.CreateStore(gepBuf0, alocElemento);
        }

        const escopoIteracao = new Map<string, VariavelEscopo>();
        if (ehVetor && this.registroClasses.has(tipoElementoStr)) {
            // Elementos de classe são ponteiros no vetor; carrega o ptr do alloca
            // para que variavelLlvm seja o object ptr direto, igual a instanciarClasse.
            const objPtr = this.montador.CreateLoad(
                this.montador.getPtrTy(),
                alocElemento as unknown as llvm.Value,
                nomeElemento + '_obj'
            );
            escopoIteracao.set(nomeElemento, new VariavelEscopo(objPtr, undefined, tipoElementoStr));
        } else {
            escopoIteracao.set(
                nomeElemento,
                new VariavelEscopo(alocElemento as unknown as llvm.Value, undefined, tipoElementoStr)
            );
        }
        this.pilhaVariaveisEscopo.empilhar(escopoIteracao);
        this.pilhaBlocosLoop.push({ blocoSaida: blocoApos, blocoRetorno: blocoInc });

        await this.processarDeclaracoesBloco(corpo);

        this.pilhaBlocosLoop.pop();
        this.pilhaVariaveisEscopo.removerUltimo();

        this.montador.CreateBr(blocoInc);

        // Incremento: i++.
        this.montador.SetInsertPoint(blocoInc);
        const iInc = this.montador.CreateLoad(this.montador.getInt32Ty(), alocIndice, 'i_inc');
        const iMais1 = this.montador.CreateAdd(iInc, ConstantInt.get(this.contexto, new APInt(32, 1)), 'i_prox');
        this.montador.CreateStore(iMais1, alocIndice);
        this.montador.CreateBr(blocoCabeca);

        this.montador.SetInsertPoint(blocoApos);
        this.contadoresNaoNegativos.delete(nomeElemento + '_i');

        return Promise.resolve();
    }

    async visitarDeclaracaoTextoDocumentacao(_: TextoDocumentacao): Promise<any> {
        // Docstrings não geram IR.
        return Promise.resolve();
    }

    async visitarDeclaracaoTendoComo(declaracao: TendoComo): Promise<any> {
        // Semântica de "tendo como" (ex.: try-with-resources) não implementada; percorre corpo.
        await this.aceitarListaDeclaracoes(declaracao.corpo?.declaracoes);
        return Promise.resolve();
    }

    async visitarDeclaracaoTente(declaracao: Tente): Promise<any> {
        this.definirLocalizacaoDebug(declaracao.linha ?? 0, 0);
        this.contemExcecoes = true;
        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        const tipoPontoPouso = llvm.StructType.get(this.contexto, [
            this.montador.getPtrTy(),
            this.montador.getInt32Ty(),
        ]);

        const temFinally =
            declaracao.caminhoFinalmente &&
            (Array.isArray(declaracao.caminhoFinalmente) ? declaracao.caminhoFinalmente.length > 0 : true);
        const temBlocoPegue =
            declaracao.caminhoPegue &&
            (Array.isArray(declaracao.caminhoPegue) ? declaracao.caminhoPegue.length > 0 : true);
        const temSenao =
            declaracao.caminhoSenao &&
            (Array.isArray(declaracao.caminhoSenao) ? declaracao.caminhoSenao.length > 0 : true);

        const blocoTenteCorpo = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.TENTE_CORPO, funcaoAtual);
        const blocoTenteApos = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.TENTE_APOS, funcaoAtual);
        const blocoPegueLanding = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.PEGUE_LANDING, funcaoAtual);
        const blocoTenteAposFinal = llvm.BasicBlock.Create(
            this.contexto,
            this.NOMES_BLOCOS.TENTE_APOS_FINAL,
            funcaoAtual
        );

        const blocoSenao = temSenao
            ? llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.TENTE_SENAO, funcaoAtual)
            : null;
        const blocoPegueCorpo = temBlocoPegue
            ? llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.PEGUE_CORPO, funcaoAtual)
            : null;
        const blocoFinalmenteCorpo = temFinally
            ? llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.FINALMENTE_CORPO, funcaoAtual)
            : null;
        const blocoFinalmenteSucesso =
            temFinally && !temBlocoPegue ? llvm.BasicBlock.Create(this.contexto, 'finalmente_sucesso', funcaoAtual) : null;
        const blocoRelancarExcecao =
            temFinally && !temBlocoPegue ? llvm.BasicBlock.Create(this.contexto, 'relancar_excecao', funcaoAtual) : null;

        let alocPontoPouso: llvm.AllocaInst | null = null;
        if (blocoRelancarExcecao) {
            alocPontoPouso = this.montador.CreateAlloca(tipoPontoPouso, null, 'ponto_pouso_temp');
        }

        const pontoPousoAnterior = this.pontoPousoAtual;
        this.pontoPousoAtual = blocoPegueLanding;

        this.montador.CreateBr(blocoTenteCorpo);
        this.montador.SetInsertPoint(blocoTenteCorpo);

        await this.processarCaminhoTente(declaracao.caminhoTente);
        // On success: execute senao (if present) before the post-try merge point.
        this.montador.CreateBr(blocoSenao ?? blocoTenteApos);

        if (blocoSenao) {
            this.montador.SetInsertPoint(blocoSenao);
            await this.aceitarListaDeclaracoes(declaracao.caminhoSenao);
            this.montador.CreateBr(blocoTenteApos);
        }

        this.montador.SetInsertPoint(blocoPegueLanding);
        funcaoAtual.setPersonalityFn(this.funcaoPersonalidade);

        const pontoPouso = this.montador.CreateLandingPad(tipoPontoPouso, 1, 'landingpad');
        const nullPtr = llvm.Constant.getNullValue(this.montador.getPtrTy());
        pontoPouso.addClause(nullPtr);

        if (blocoPegueCorpo && temBlocoPegue) {
            this.montador.CreateBr(blocoPegueCorpo);
            this.montador.SetInsertPoint(blocoPegueCorpo);

            const ponteiroCabecalho = this.montador.CreateExtractValue(pontoPouso, [0], 'exception_header');
            const ponteiroExcecao = this.montador.CreateCall(
                this.funcaoBeginCatch,
                [ponteiroCabecalho],
                'exception_data'
            );

            if (declaracao.caminhoPegue instanceof FuncaoConstruto) {
                const parametroEncontrado = this.extrairParametroPegue(declaracao.caminhoPegue);
                const nomeParametro = parametroEncontrado.lexema || parametroEncontrado.nome || 'erro';
                const tipoTexto = this.obterTipoLlvm('texto');
                const alocErro = this.montador.CreateAlloca(tipoTexto, null, nomeParametro);
                this.montador.CreateStore(ponteiroExcecao, alocErro);

                const topo = this.pilhaVariaveisEscopo.topoDaPilha();
                topo.set(nomeParametro, new VariavelEscopo(alocErro, null, 'texto'));
            }

            await this.processarCaminhoPegue(declaracao.caminhoPegue);
            this.montador.CreateCall(this.funcaoEndCatch, []);

            if (blocoFinalmenteCorpo) {
                this.montador.CreateBr(blocoFinalmenteCorpo);
            } else {
                this.montador.CreateBr(blocoTenteAposFinal);
            }
        } else if (blocoFinalmenteCorpo && !temBlocoPegue) {
            if (alocPontoPouso) {
                this.montador.CreateStore(pontoPouso, alocPontoPouso);
            }
            this.montador.CreateBr(blocoFinalmenteCorpo);
        } else {
            this.montador.CreateResume(pontoPouso);
        }

        this.montador.SetInsertPoint(blocoTenteApos);
        if (blocoFinalmenteSucesso) {
            this.montador.CreateBr(blocoFinalmenteSucesso);
        } else if (blocoFinalmenteCorpo) {
            this.montador.CreateBr(blocoFinalmenteCorpo);
        } else {
            this.montador.CreateBr(blocoTenteAposFinal);
        }

        if (blocoFinalmenteSucesso) {
            this.montador.SetInsertPoint(blocoFinalmenteSucesso);
            await this.processarCaminhoFinalmente(declaracao.caminhoFinalmente);
            this.montador.CreateBr(blocoTenteAposFinal);
        }

        if (blocoFinalmenteCorpo) {
            this.montador.SetInsertPoint(blocoFinalmenteCorpo);
            await this.processarCaminhoFinalmente(declaracao.caminhoFinalmente);

            if (temBlocoPegue) {
                this.montador.CreateBr(blocoTenteAposFinal);
            } else if (blocoRelancarExcecao) {
                this.montador.CreateBr(blocoRelancarExcecao);
            }
        }

        if (blocoRelancarExcecao && alocPontoPouso) {
            this.montador.SetInsertPoint(blocoRelancarExcecao);
            const pontoPousoCarregado = this.montador.CreateLoad(tipoPontoPouso, alocPontoPouso, 'load_ponto_pouso');
            this.montador.CreateResume(pontoPousoCarregado);
        }

        this.pontoPousoAtual = pontoPousoAnterior;
        this.montador.SetInsertPoint(blocoTenteAposFinal);
        return Promise.resolve();
    }

    protected extrairParametroPegue(caminhoPegue: FuncaoConstruto): any {
        if (!caminhoPegue) return null;

        if (caminhoPegue.parametros?.length > 0) {
            return caminhoPegue.parametros[0].nome;
        }

        return null;
    }

    protected async processarCaminhoTente(caminhoTente: any): Promise<void> {
        if (!caminhoTente) return;

        if (Array.isArray(caminhoTente)) {
            await this.aceitarListaDeclaracoes(caminhoTente);
            return;
        }

        if (caminhoTente?.aceitar) {
            await caminhoTente.aceitar(this);
            return;
        }

        if (Array.isArray(caminhoTente?.declaracoes)) {
            await this.aceitarListaDeclaracoes(caminhoTente.declaracoes);
        }
    }

    protected async processarCaminhoPegue(caminhoPegue: FuncaoConstruto | Declaracao[] | any): Promise<void> {
        if (!caminhoPegue) return;

        if (Array.isArray(caminhoPegue)) {
            await this.aceitarListaDeclaracoes(caminhoPegue);
            return;
        }

        const corpoResolvido = (caminhoPegue as FuncaoConstruto).corpo;
        if (Array.isArray(corpoResolvido)) {
            await this.aceitarListaDeclaracoes(corpoResolvido);
            return;
        }

        if (Array.isArray((caminhoPegue as any).declaracoes)) {
            await this.aceitarListaDeclaracoes((caminhoPegue as any).declaracoes);
        }
    }

    protected async processarCaminhoFinalmente(caminhoFinalmente: any): Promise<void> {
        if (!caminhoFinalmente) return;

        if (Array.isArray(caminhoFinalmente)) {
            await this.aceitarListaDeclaracoes(caminhoFinalmente);
            return;
        }

        if (caminhoFinalmente?.aceitar) {
            await caminhoFinalmente.aceitar(this);
            return;
        }

        if (Array.isArray(caminhoFinalmente?.declaracoes)) {
            await this.aceitarListaDeclaracoes(caminhoFinalmente.declaracoes);
        }
    }

    async visitarDeclaracaoVarMultiplo(declaracao: VarMultiplo): Promise<any> {
        const simbolos = declaracao.simbolos || [];
        const tipoDeclarado = declaracao.tipo;

        const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
        for (const [indice, simbolo] of simbolos.entries()) {
            const nomeSimbolo = simbolo?.lexema || `var_${indice}`;

            if (!this.montador || !declaracao.inicializador?.aceitar) {
                topoDaPilha.set(
                    nomeSimbolo,
                    new VariavelEscopo(
                        declaracao.inicializador as unknown as llvm.Value,
                        declaracao,
                        tipoDeclarado || 'qualquer',
                        false
                    )
                );
                continue;
            }

            const tipoVariavel =
                tipoDeclarado === 'qualquer' || !tipoDeclarado
                    ? this.resolverTipoConstruto(declaracao.inicializador)
                    : tipoDeclarado;

            const tipoLlvm = this.obterTipoLlvm(tipoVariavel);
            const alocacao = this.montador.CreateAlloca(tipoLlvm, null, nomeSimbolo);
            const valorResolvido = await declaracao.inicializador.aceitar(this);
            this.montador.CreateStore(valorResolvido, alocacao);

            topoDaPilha.set(nomeSimbolo, new VariavelEscopo(alocacao, declaracao, tipoVariavel, false));
        }

        return Promise.resolve();
    }

    async visitarExpressaoDeAtribuicao(expressao: Atribuir): Promise<any> {
        this.definirLocalizacaoDebug(expressao.linha ?? 0, 0);
        const alvoResolvido = await expressao.alvo.aceitar(this);

        if (alvoResolvido instanceof VariavelEscopo) {
            if (alvoResolvido.ehConstante) {
                const nomeConstante = (expressao.alvo as Variavel).simbolo?.lexema || 'desconhecida';
                const erroConstante = new ErroCompilador(`Não é possível reatribuir a constante '${nomeConstante}'.`);
                erroConstante.linha = expressao.linha;
                erroConstante.tamanhoToken = nomeConstante.length;
                throw erroConstante;
            }
            const tipoAlvo = alvoResolvido.tipo || 'qualquer';

            if (expressao.simboloOperador) {
                // Atribuição composta: Atribuir.valor é Binario(LHS, OP_IGUAL, RHS) completo.
                // Extrai apenas o RHS (direita do Binario) para aplicar a operação sobre o valor atual.
                const binario = expressao.valor as Binario;
                const rhs = binario.direita;
                const valorRhsResolvido = await rhs.aceitar(this);
                const tipoRhs = this.resolverTipoConstruto(rhs);
                const tipoEfetivo = tipoAlvo !== 'qualquer' ? tipoAlvo : (tipoRhs || 'qualquer');

                const operandoEsquerdo = this.resolverOperando(alvoResolvido, tipoEfetivo);
                const valorRhsLlvm = this.carregarValorSeNecessario(valorRhsResolvido, tipoRhs || tipoEfetivo, 'load_rhs_composto');
                const operandoDireito: OperandoInterface = { valor: valorRhsLlvm, tipo: tipoRhs || tipoEfetivo };

                let resultadoOperacao: llvm.Value;
                switch (expressao.simboloOperador.tipo) {
                    case 'MAIS_IGUAL':
                        resultadoOperacao = await this.resolverAdicao(operandoEsquerdo, operandoDireito);
                        break;
                    case 'MENOS_IGUAL':
                        resultadoOperacao = await this.resolverSubtracao(operandoEsquerdo, operandoDireito);
                        break;
                    case 'MULTIPLICACAO_IGUAL':
                        resultadoOperacao = await this.resolverMultiplicacao(operandoEsquerdo, operandoDireito);
                        break;
                    case 'DIVISAO_IGUAL':
                        resultadoOperacao = await this.resolverDivisao(operandoEsquerdo, operandoDireito);
                        break;
                    case 'MODULO_IGUAL':
                        resultadoOperacao = await this.resolverModulo(operandoEsquerdo, operandoDireito);
                        break;
                    default:
                        const erroOperador = new ErroCompilador(`Operador composto '${expressao.simboloOperador.tipo}' não suportado.`);
                        erroOperador.linha = expressao.simboloOperador.linha;
                        throw erroOperador;
                }
                this.armazenarEmVariavel(alvoResolvido, resultadoOperacao, tipoEfetivo, tipoEfetivo);
                return Promise.resolve(resultadoOperacao);
            }

            const valorResolvido = await expressao.valor.aceitar(this);
            const tipoValor = this.resolverTipoConstruto(expressao.valor);
            const valorLlvm = this.carregarValorSeNecessario(
                valorResolvido,
                tipoValor ||
                    (valorResolvido instanceof VariavelEscopo ? valorResolvido.tipo : null) ||
                    tipoAlvo,
                'load_atrib'
            );
            this.armazenarEmVariavel(alvoResolvido, valorLlvm, expressao.alvo.tipo, tipoValor);
            return Promise.resolve(valorResolvido);
        }

        // Alvo é acesso a propriedade (isto.campo = valor): resolve GEP e armazena.
        const infoPropriedade = await this.resolverGepPropriedadeAlvo(expressao.alvo as ConstrutoInterface);
        if (infoPropriedade) {
            const valorResolvido = await expressao.valor.aceitar(this);
            const { gepPtr, tipoProp } = infoPropriedade;
            if (this.tipoEhVetor(tipoProp)) {
                // Copia o struct %Vetor inteiro do alloca de origem para o campo.
                const vetorPtr = valorResolvido instanceof VariavelEscopo
                    ? valorResolvido.variavelLlvm
                    : (valorResolvido as llvm.Value);
                const vetorValue = this.montador.CreateLoad(this.tipoEstruturaVetor, vetorPtr, 'vetor_copia');
                this.montador.CreateStore(vetorValue, gepPtr);
            } else {
                const valorCarregado = this.carregarValorSeNecessario(valorResolvido, tipoProp, 'load_prop_atrib');
                this.montador.CreateStore(valorCarregado, gepPtr);
            }
            return Promise.resolve(valorResolvido);
        }

        const valorResolvido = await expressao.valor.aceitar(this);
        return Promise.resolve(valorResolvido);
    }

    protected async resolverGepPropriedadeAlvo(
        expressao: ConstrutoInterface
    ): Promise<{ gepPtr: llvm.Value; tipoProp: string } | null> {
        const nomeCtorExp = expressao.constructor?.name;
        if (nomeCtorExp !== 'AcessoPropriedade' && nomeCtorExp !== 'AcessoMetodoOuPropriedade') {
            return null;
        }
        const acesso = expressao as any;
        const nomePropriedade: string = acesso.nomePropriedade ?? acesso.simbolo?.lexema;
        if (!nomePropriedade) return null;

        const objetoResolvido = await acesso.objeto.aceitar(this);
        let objetoPtr: llvm.Value;
        let nomeClasse: string;

        if (objetoResolvido instanceof VariavelEscopo) {
            objetoPtr = this.carregarPtrClasseSePreciso(objetoResolvido);
            nomeClasse = objetoResolvido.tipo;
        } else {
            objetoPtr = objetoResolvido as llvm.Value;
            if (acesso.objeto.constructor?.name === 'Variavel') {
                nomeClasse = this.pilhaVariaveisEscopo.obterValor(acesso.objeto.simbolo?.lexema)?.tipo;
            }
        }
        if (!nomeClasse) {
            const tipoInferido = this.resolverTipoConstruto(acesso.objeto as ConstrutoInterface);
            if (tipoInferido) nomeClasse = tipoInferido;
        }

        const mapaIndices = this.indicesPropriedades.get(nomeClasse);
        const mapaTipos = this.tiposPropriedades.get(nomeClasse);
        const indice = mapaIndices?.get(nomePropriedade);
        const tipoProp = mapaTipos?.get(nomePropriedade);
        if (indice === undefined || !tipoProp) return null;

        const tipoStruct = this.registroClasses.get(nomeClasse);
        const gepPtr = this.montador.CreateInBoundsGEP(
            tipoStruct,
            objetoPtr,
            [ConstantInt.get(this.contexto, new APInt(32, 0)), ConstantInt.get(this.contexto, new APInt(32, indice))],
            `${nomePropriedade}_alvo`
        );
        return { gepPtr, tipoProp };
    }

    async visitarExpressaoAcessoIndiceVariavel(expressao: AcessoIndiceVariavel): Promise<any> {
        const expressaoTipada = expressao as unknown as AcessoIndiceOuMatrizDialeto;
        const alvoBruto =
            expressaoTipada.entidadeChamada ??
            expressaoTipada.entidade ??
            expressaoTipada.variavel ??
            expressaoTipada.objeto;
        const indiceBruto = expressaoTipada.indice ?? expressaoTipada.índice;

        const alvoResolvido = alvoBruto?.aceitar ? await alvoBruto.aceitar(this) : alvoBruto;
        const indiceResolvido = indiceBruto?.aceitar ? await indiceBruto.aceitar(this) : indiceBruto;

        // Quando alvoResolvido é llvm.Value bruto (ex.: acesso encadeado isto.simbolos[i]),
        // infere o tipo via AST e encapsula diretamente em VariavelEscopo sem alloca temporária.
        // O valor bruto já é %Vetor* — não deve ser armazenado em alloca antes de passar para GEP.
        let alvoParaIndice: any = alvoResolvido;
        if (!(alvoResolvido instanceof VariavelEscopo) && this.ehValorLlvm(alvoResolvido)) {
            const tipoInferido = alvoBruto ? this.resolverTipoConstruto(alvoBruto as ConstrutoInterface) : null;
            if (tipoInferido && (tipoInferido === 'texto' || this.tipoEhDicionario(tipoInferido) || this.tipoEhVetor(tipoInferido))) {
                alvoParaIndice = new VariavelEscopo(alvoResolvido as llvm.Value, undefined, tipoInferido);
            }
        }

        // Caminho LLVM IR: texto[inteiro] → char exposto como ptr para buffer [2 x i8].
        if (alvoParaIndice instanceof VariavelEscopo && alvoParaIndice.tipo === 'texto') {
            const varLlvmTexto = alvoParaIndice.variavelLlvm as llvm.Value;
            const nomeInstTexto = varLlvmTexto.constructor.name;
            // AllocaInst/GEPInst/Argument são ptr* → precisa de load (parâmetros texto usam a
            // mesma convenção de dupla indireção). LoadInst/CallInst já são o ptr direto.
            const ehPtrDiretoTexto =
                nomeInstTexto !== 'GetElementPtrInst' && nomeInstTexto !== 'AllocaInst' && nomeInstTexto !== 'Argument';
            const textoPtr = ehPtrDiretoTexto
                ? varLlvmTexto
                : this.montador.CreateLoad(this.montador.getPtrTy(), varLlvmTexto, 'txt_ptr');

            let indiceValor: llvm.Value;
            if (indiceBruto instanceof Literal && typeof indiceBruto.valor === 'number') {
                indiceValor = ConstantInt.get(this.contexto, new APInt(32, Math.trunc(indiceBruto.valor)));
            } else if (indiceResolvido instanceof VariavelEscopo) {
                const tipoIdx = indiceResolvido.tipo ?? 'inteiro';
                const tipoIdxLlvm = this.obterTipoLlvm(tipoIdx);
                const idxCarregado = this.montador.CreateLoad(tipoIdxLlvm, indiceResolvido.variavelLlvm, 'txt_idx');
                indiceValor =
                    tipoIdx === 'número'
                        ? this.montador.CreateFPToSI(idxCarregado, this.montador.getInt32Ty(), 'txt_idx_i')
                        : idxCarregado;
            } else {
                indiceValor = indiceResolvido as llvm.Value;
            }

            const gepChar = this.montador.CreateInBoundsGEP(
                this.montador.getInt8Ty(),
                textoPtr,
                [indiceValor],
                'txt_char_ptr'
            );
            const charVal = this.montador.CreateLoad(this.montador.getInt8Ty(), gepChar, 'txt_char');

            // Usa malloc para que o ponteiro ao buffer de 2 bytes sobreviva ao retorno da função.
            // Stack alloca seria dangling pointer se o resultado fosse retornado pela função.
            const tamanho2 = ConstantInt.get(this.contexto, new APInt(64, 2));
            const heapBuf = this.montador.CreateCall(this.funcaoMalloc, [tamanho2], 'txt_char_buf');
            const idx1 = ConstantInt.get(this.contexto, new APInt(32, 1));
            const gepBuf1 = this.montador.CreateInBoundsGEP(
                this.montador.getInt8Ty(),
                heapBuf,
                [idx1],
                'txt_buf1'
            );
            this.montador.CreateStore(charVal, heapBuf);
            this.montador.CreateStore(ConstantInt.get(this.contexto, new APInt(8, 0)), gepBuf1);

            const alocPtr = this.criarAllocaNoBlocoEntrada(this.montador.getPtrTy(), 'txt_char_ptr_alloca');
            this.montador.CreateStore(heapBuf, alocPtr);
            return Promise.resolve(new VariavelEscopo(alocPtr, undefined, 'texto'));
        }

        // Caminho LLVM IR: dicionário (literal {} ou campo `qualquer` populado com {})
        // acessado por chave texto — delega para o runtime de hash.
        if (alvoParaIndice instanceof VariavelEscopo && this.tipoEhDicionario(alvoParaIndice.tipo)) {
            const dictPtr = this.resolverPonteiroDireto(alvoParaIndice);
            const chavePtr = this.resolverPonteiroDireto(indiceResolvido);
            const valorObtido = this.montador.CreateCall(
                this.funcaoDicionarioObter,
                [dictPtr, chavePtr],
                'dict_obtido'
            );
            return Promise.resolve(valorObtido);
        }

        // Caminho LLVM IR: vetor com struct %Vetor na memória.
        if (alvoParaIndice instanceof VariavelEscopo && this.tipoEhVetor(alvoParaIndice.tipo)) {
            const alvoResolvido = alvoParaIndice;
            const tipoElementoStr = this.tipoElementoVetor(alvoResolvido.tipo);
            const tipoElemento = this.obterTipoLlvm(tipoElementoStr);

            // Verifica se o índice é um contador não-negativo (habilita flag nuw).
            const nomeIndice = indiceBruto instanceof Variavel ? indiceBruto.simbolo?.lexema : undefined;
            const indiceNaoNegativo = nomeIndice ? this.contadoresNaoNegativos.has(nomeIndice) : false;

            // Resolve o índice como valor LLVM i32 (GEP exige índice inteiro).
            let indiceValor: llvm.Value;
            if (indiceBruto instanceof Literal && typeof indiceBruto.valor === 'number') {
                // Índice constante literal: usa diretamente como i32.
                indiceValor = ConstantInt.get(this.contexto, new APInt(32, Math.trunc(indiceBruto.valor)));
            } else if (indiceResolvido instanceof VariavelEscopo) {
                const tipoIdx = indiceResolvido.tipo ?? 'número';
                const tipoIdxLlvm = this.obterTipoLlvm(tipoIdx);
                const idxCarregado = this.montador.CreateLoad(tipoIdxLlvm, indiceResolvido.variavelLlvm, 'idx_f');
                if (tipoIdx === 'número') {
                    indiceValor = this.montador.CreateFPToSI(idxCarregado, this.montador.getInt32Ty(), 'idx');
                } else {
                    indiceValor = idxCarregado;
                }
            } else if (typeof indiceResolvido === 'number') {
                indiceValor = ConstantInt.get(this.contexto, new APInt(32, Math.trunc(indiceResolvido)));
            } else {
                indiceValor = indiceResolvido as llvm.Value;
            }

            // Carrega o ponteiro de elementos (com cache para evitar loads redundantes).
            const nomeVetorBase = alvoBruto instanceof Variavel ? alvoBruto.simbolo?.lexema : undefined;
            const nomeVetor =
                nomeVetorBase && nomeVetorBase.length > 0
                    ? nomeVetorBase
                    : this.extrairNomeValorLlvm(alvoResolvido.variavelLlvm);
            const ptrElementos = this.carregarPonteiroElementosVetor(nomeVetor, alvoResolvido.variavelLlvm);

            // GEP para o elemento, com flag nuw quando o índice é garantidamente não-negativo.
            const gepElemento = this.montador.CreateInBoundsGEP(
                tipoElemento,
                ptrElementos,
                [indiceValor],
                'ptr_elemento',
                indiceNaoNegativo
            );

            const elementoCarregado = this.montador.CreateLoad(tipoElemento, gepElemento, 'elemento');
            return Promise.resolve(elementoCarregado);
        }

        // Caminho JS (interpretador): alvo já é array ou string.
        const alvoFinal = alvoResolvido instanceof VariavelEscopo ? alvoResolvido.variavelLlvm : alvoResolvido;

        if (Array.isArray(alvoFinal) || typeof alvoFinal === 'string') {
            return Promise.resolve(alvoFinal[indiceResolvido]);
        }

        const erroIndice = new ErroCompilador(`visitarExpressaoAcessoIndiceVariavel: tipo de alvo não suportado (${typeof alvoFinal}).`);
        erroIndice.linha = expressao.linha;
        erroIndice.arquivo = this.arquivoDeSimbolo((alvoBruto as any)?.simbolo);
        throw erroIndice;
    }

    async visitarExpressaoAcessoElementoMatriz(expressao: AcessoElementoMatriz): Promise<any> {
        const expressaoTipada = expressao as unknown as AcessoIndiceOuMatrizDialeto;
        const matrizBruta =
            expressaoTipada.entidadeChamada ??
            expressaoTipada.entidade ??
            expressaoTipada.variavel ??
            expressaoTipada.objeto;
        const indiceLinhaBruto = expressaoTipada.indicePrimario ?? expressaoTipada.indiceLinha ?? expressaoTipada.linha;
        const indiceColunaBruto =
            expressaoTipada.indiceSecundario ?? expressaoTipada.indiceColuna ?? expressaoTipada.coluna;

        const matrizResolvida = matrizBruta?.aceitar ? await matrizBruta.aceitar(this) : matrizBruta;
        const linhaResolvida = indiceLinhaBruto?.aceitar ? await indiceLinhaBruto.aceitar(this) : indiceLinhaBruto;
        const colunaResolvida = indiceColunaBruto?.aceitar ? await indiceColunaBruto.aceitar(this) : indiceColunaBruto;

        const matrizFinal = matrizResolvida instanceof VariavelEscopo ? matrizResolvida.variavelLlvm : matrizResolvida;

        if (Array.isArray(matrizFinal) && Array.isArray(matrizFinal[linhaResolvida])) {
            return Promise.resolve(matrizFinal[linhaResolvida][colunaResolvida]);
        }

        return Promise.resolve(undefined);
    }

    async visitarExpressaoAcessoMetodo(expressao: AcessoMetodo): Promise<any> {
        return Promise.resolve({
            objeto: expressao.objeto,
            nomeMetodo: expressao.nomeMetodo,
        });
    }

    async visitarExpressaoAcessoMetodoOuPropriedade(expressao: AcessoMetodoOuPropriedade): Promise<any> {
        const objetoResolvido = await expressao.objeto.aceitar(this);
        let objetoPtr: llvm.Value;
        let nomeClasse: string;

        if (objetoResolvido instanceof VariavelEscopo) {
            objetoPtr = this.carregarPtrClasseSePreciso(objetoResolvido);
            nomeClasse = objetoResolvido.tipo;
        } else {
            objetoPtr = objetoResolvido as llvm.Value;
        }

        if (!nomeClasse && expressao.objeto.constructor === Variavel) {
            nomeClasse = this.pilhaVariaveisEscopo.obterValor((expressao.objeto as Variavel).simbolo.lexema)?.tipo;
        }

        // Acesso encadeado (ex.: isto.tipos.E): o sub-objeto resolveu para llvm.Value sem tipo.
        // Infere nomeClasse a partir do AST do sub-objeto.
        if (!nomeClasse) {
            const tipoInferido = this.resolverTipoConstruto(expressao.objeto as ConstrutoInterface);
            if (tipoInferido) nomeClasse = tipoInferido;
        }

        // Açúcar sintático: `obj.propriedade` em um dicionário (literal {} ou campo
        // `qualquer` populado com {}) equivale a `obj["propriedade"]`.
        if (this.tipoEhDicionario(nomeClasse)) {
            const dictPtr = this.resolverPonteiroDireto(objetoResolvido);
            const chavePtr = this.montador.CreateGlobalStringPtr(expressao.simbolo.lexema, 'dict_chave', 0, this.modulo);
            return this.montador.CreateCall(this.funcaoDicionarioObter, [dictPtr, chavePtr], 'dict_obtido');
        }

        const nomeMembro = expressao.simbolo.lexema;
        const mapaIndices = this.indicesPropriedades.get(nomeClasse);
        const mapaTipos = this.tiposPropriedades.get(nomeClasse);
        const indice = mapaIndices?.get(nomeMembro);
        const tipoProp = mapaTipos?.get(nomeMembro);

        if (indice === undefined || !tipoProp) {
            const mensagem = nomeClasse === 'qualquer'
                ? `Propriedade '${nomeMembro}' não pode ser acessada em valor de tipo 'qualquer': o compilador não conhece a estrutura em tempo de compilação.`
                : `Propriedade '${nomeMembro}' não encontrada na classe '${nomeClasse ?? 'desconhecida'}'.`;
            const erroMembro = new ErroCompilador(mensagem);
            erroMembro.linha = expressao.linha;
            erroMembro.tamanhoToken = nomeMembro.length;
            erroMembro.arquivo = this.arquivoDeSimbolo(expressao.simbolo);
            throw erroMembro;
        }

        const tipoStruct = this.registroClasses.get(nomeClasse);
        const tipoLlvm = this.obterTipoLlvm(tipoProp);
        const gepPtr = this.montador.CreateInBoundsGEP(
            tipoStruct,
            objetoPtr,
            [ConstantInt.get(this.contexto, new APInt(32, 0)), ConstantInt.get(this.contexto, new APInt(32, indice))],
            `${nomeMembro}_ptr`
        );

        // Campos do tipo vetor: gepPtr já é o %Vetor* esperado pelas funções de vetor.
        // Carregar produziria %Vetor by-value, incompatível com a assinatura (ptr).
        if (this.tipoEhVetor(tipoProp)) {
            return gepPtr;
        }
        return this.montador.CreateLoad(tipoLlvm, gepPtr, nomeMembro);
    }

    async visitarExpressaoAcessoPropriedade(expressao: AcessoPropriedade): Promise<any> {
        const objetoResolvido = await expressao.objeto.aceitar(this);
        let objetoPtr: llvm.Value;
        let nomeClasse: string;

        if (objetoResolvido instanceof VariavelEscopo) {
            objetoPtr = this.carregarPtrClasseSePreciso(objetoResolvido);
            nomeClasse = objetoResolvido.tipo;
        } else {
            objetoPtr = objetoResolvido as llvm.Value;
        }

        if (!nomeClasse && expressao.objeto.constructor === Variavel) {
            nomeClasse = this.pilhaVariaveisEscopo.obterValor((expressao.objeto as Variavel).simbolo.lexema)?.tipo;
        }

        // Acesso encadeado: infere nomeClasse a partir do AST quando não resolvida pelo escopo.
        if (!nomeClasse) {
            const tipoInferido = this.resolverTipoConstruto(expressao.objeto as ConstrutoInterface);
            if (tipoInferido) nomeClasse = tipoInferido;
        }

        const mapaIndices = this.indicesPropriedades.get(nomeClasse);
        const mapaTipos = this.tiposPropriedades.get(nomeClasse);
        const indice = mapaIndices?.get(expressao.nomePropriedade);
        const tipoProp = mapaTipos?.get(expressao.nomePropriedade);

        if (indice === undefined || !tipoProp) {
            const mensagem = nomeClasse === 'qualquer'
                ? `Propriedade '${expressao.nomePropriedade}' não pode ser acessada em valor de tipo 'qualquer': o compilador não conhece a estrutura em tempo de compilação.`
                : `Propriedade '${expressao.nomePropriedade}' não encontrada na classe '${nomeClasse ?? 'desconhecida'}'.`;
            const erroPropriedade = new ErroCompilador(mensagem);
            erroPropriedade.linha = expressao.linha;
            erroPropriedade.tamanhoToken = expressao.nomePropriedade.length;
            throw erroPropriedade;
        }

        const tipoStruct = this.registroClasses.get(nomeClasse);
        const tipoLlvm = this.obterTipoLlvm(tipoProp);
        const gepPtr = this.montador.CreateInBoundsGEP(
            tipoStruct,
            objetoPtr,
            [ConstantInt.get(this.contexto, new APInt(32, 0)), ConstantInt.get(this.contexto, new APInt(32, indice))],
            `${expressao.nomePropriedade}_ptr`
        );

        if (this.tipoEhVetor(tipoProp)) {
            return gepPtr;
        }
        return this.montador.CreateLoad(tipoLlvm, gepPtr, expressao.nomePropriedade);
    }

    async visitarExpressaoArgumentoReferenciaFuncao(expressao: ArgumentoReferenciaFuncao): Promise<any> {
        const alvo = (expressao as unknown as { valor?: ConstrutoInterface; argumento?: ConstrutoInterface; referencia?: ConstrutoInterface })
            .valor ??
            (expressao as unknown as { valor?: ConstrutoInterface; argumento?: ConstrutoInterface; referencia?: ConstrutoInterface }).argumento ??
            (expressao as unknown as { valor?: ConstrutoInterface; argumento?: ConstrutoInterface; referencia?: ConstrutoInterface }).referencia;
        if (alvo?.aceitar) {
            return await alvo.aceitar(this);
        }

        return Promise.resolve(alvo);
    }

    async visitarExpressaoAtribuicaoPorIndice(expressao: AtribuicaoPorIndice): Promise<any> {
        const expressaoTipada = expressao as unknown as AcessoIndiceOuMatrizDialeto;
        const alvoBruto =
            expressaoTipada.entidadeChamada ??
            expressaoTipada.entidade ??
            expressaoTipada.variavel ??
            expressaoTipada.objeto;
        const indiceBruto = expressaoTipada.indice ?? expressaoTipada.índice;
        const valorBruto = expressaoTipada.valor;

        const alvoResolvido = alvoBruto?.aceitar ? await alvoBruto.aceitar(this) : alvoBruto;
        const indiceResolvido = indiceBruto?.aceitar ? await indiceBruto.aceitar(this) : indiceBruto;
        const valorResolvido = valorBruto?.aceitar ? await valorBruto.aceitar(this) : valorBruto;

        // Mesma inferência de tipo usada na leitura (visitarExpressaoAcessoIndiceVariavel):
        // um alvo bruto (ex.: campo de struct `qualquer` já carregado) não vem com tipo
        // anexado, então precisa ser encapsulado em VariavelEscopo para cair nos caminhos
        // de vetor/dicionário abaixo.
        let alvoParaIndiceEscrita: any = alvoResolvido;
        if (!(alvoResolvido instanceof VariavelEscopo) && this.ehValorLlvm(alvoResolvido)) {
            const tipoInferido = alvoBruto ? this.resolverTipoConstruto(alvoBruto as ConstrutoInterface) : null;
            if (tipoInferido && (this.tipoEhDicionario(tipoInferido) || this.tipoEhVetor(tipoInferido))) {
                alvoParaIndiceEscrita = new VariavelEscopo(alvoResolvido as llvm.Value, undefined, tipoInferido);
            }
        }

        // Caminho LLVM IR: escrita por chave texto em dicionário (literal {} ou campo `qualquer`).
        if (alvoParaIndiceEscrita instanceof VariavelEscopo && this.tipoEhDicionario(alvoParaIndiceEscrita.tipo)) {
            const dictPtr = this.resolverPonteiroDireto(alvoParaIndiceEscrita);
            const chavePtr = this.resolverPonteiroDireto(indiceResolvido);
            const valorPtr = this.embalarValorParaDicionario(valorResolvido);
            this.montador.CreateCall(this.funcaoDicionarioDefinir, [dictPtr, chavePtr, valorPtr]);
            return Promise.resolve(valorPtr);
        }

        // Caminho LLVM IR: escrita por índice em vetor com struct %Vetor.
        if (alvoParaIndiceEscrita instanceof VariavelEscopo && this.tipoEhVetor(alvoParaIndiceEscrita.tipo)) {
            const alvoResolvidoVetor = alvoParaIndiceEscrita;
            const tipoElementoStr = this.tipoElementoVetor(alvoResolvidoVetor.tipo);
            const tipoElemento = this.obterTipoLlvm(tipoElementoStr);

            // Resolve o índice como valor LLVM i32.
            let indiceValor: llvm.Value;
            if (indiceBruto instanceof Literal && typeof indiceBruto.valor === 'number') {
                indiceValor = ConstantInt.get(this.contexto, new APInt(32, Math.trunc(indiceBruto.valor)));
            } else if (indiceResolvido instanceof VariavelEscopo) {
                const tipoIdx = indiceResolvido.tipo ?? 'número';
                const tipoIdxLlvm = this.obterTipoLlvm(tipoIdx);
                const idxCarregado = this.montador.CreateLoad(tipoIdxLlvm, indiceResolvido.variavelLlvm, 'idx_store');
                if (tipoIdx === 'número') {
                    indiceValor = this.montador.CreateFPToSI(idxCarregado, this.montador.getInt32Ty(), 'idx_store_i');
                } else {
                    indiceValor = idxCarregado;
                }
            } else if (typeof indiceResolvido === 'number') {
                indiceValor = ConstantInt.get(this.contexto, new APInt(32, Math.trunc(indiceResolvido)));
            } else {
                indiceValor = indiceResolvido as llvm.Value;
            }

            // Carrega o ponteiro de elementos (com cache para evitar loads redundantes).
            const nomeVetorBase = alvoBruto instanceof Variavel ? alvoBruto.simbolo?.lexema : undefined;
            const nomeVetor =
                nomeVetorBase && nomeVetorBase.length > 0
                    ? nomeVetorBase
                    : this.extrairNomeValorLlvm(alvoResolvidoVetor.variavelLlvm);
            const ptrElementos = this.carregarPonteiroElementosVetor(nomeVetor, alvoResolvidoVetor.variavelLlvm);

            // GEP para o elemento específico.
            const gepElemento = this.montador.CreateInBoundsGEP(
                tipoElemento,
                ptrElementos,
                [indiceValor],
                'ptr_elem_store'
            );

            // Resolve o valor a armazenar. Para elementos de instância de classe, só carrega
            // se a origem for AllocaInst/GEP (ptr* que aponta PARA o valor); Argument/CallInst/
            // LoadInst já SÃO o ponteiro do objeto direto (mesma convenção de
            // carregarPtrClasseSePreciso). Já texto/qualquer/dicionário seguem a convenção
            // oposta de dupla indireção: Argument também precisa de load (mesma convenção de
            // resolverPonteiroDireto). Elementos escalares (inteiro/número/lógico) sempre vêm
            // de uma alloca local e continuam exigindo o load incondicional.
            let valorFinal: llvm.Value;
            if (valorResolvido instanceof VariavelEscopo) {
                const nomeInstValor = valorResolvido.variavelLlvm?.constructor?.name;
                const ehInstanciaClasse = this.registroClasses.has(valorResolvido.tipo);
                const origemPrecisaCarregar = ehInstanciaClasse
                    ? nomeInstValor === 'AllocaInst' || nomeInstValor === 'GetElementPtrInst'
                    : nomeInstValor === 'AllocaInst' || nomeInstValor === 'GetElementPtrInst' || nomeInstValor === 'Argument';
                valorFinal =
                    !this.tipoEhPonteiro(tipoElemento) || origemPrecisaCarregar
                        ? this.montador.CreateLoad(tipoElemento, valorResolvido.variavelLlvm, 'val_store')
                        : valorResolvido.variavelLlvm;
            } else {
                valorFinal = valorResolvido as llvm.Value;
            }

            // Converte o tipo do valor para o tipo do elemento do vetor, se necessário.
            const nomeTipoValor = valorFinal.getType()?.constructor?.name;
            const nomeTipoElemento = tipoElemento?.constructor?.name;
            if (nomeTipoValor !== nomeTipoElemento) {
                if (nomeTipoValor === 'Type' && nomeTipoElemento === 'IntegerType') {
                    // double → inteiro (ex.: literal numérico em vetor de inteiros).
                    valorFinal = this.montador.CreateFPToSI(valorFinal, tipoElemento, 'val_fptosi');
                } else if (nomeTipoValor === 'IntegerType' && nomeTipoElemento === 'Type') {
                    // inteiro → double (ex.: literal inteiro em vetor de números).
                    valorFinal = this.montador.CreateSIToFP(valorFinal, tipoElemento, 'val_sitofp');
                }
            }

            this.montador.CreateStore(valorFinal, gepElemento);
            return Promise.resolve(valorFinal);
        }

        // Caminho JS (interpretador).
        const alvoFinal = alvoResolvido instanceof VariavelEscopo ? alvoResolvido.variavelLlvm : alvoResolvido;

        if (Array.isArray(alvoFinal)) {
            alvoFinal[indiceResolvido] = valorResolvido;
        }

        return Promise.resolve(valorResolvido);
    }

    async visitarExpressaoAtribuicaoPorIndicesMatriz(expressao: AtribuicaoPorIndicesMatriz): Promise<any> {
        const expressaoTipada = expressao as unknown as AcessoIndiceOuMatrizDialeto;
        const matrizBruta =
            expressaoTipada.entidadeChamada ??
            expressaoTipada.entidade ??
            expressaoTipada.variavel ??
            expressaoTipada.objeto;
        const indiceLinhaBruto = expressaoTipada.indicePrimario ?? expressaoTipada.indiceLinha ?? expressaoTipada.linha;
        const indiceColunaBruto =
            expressaoTipada.indiceSecundario ?? expressaoTipada.indiceColuna ?? expressaoTipada.coluna;
        const valorBruto = expressaoTipada.valor;

        const matrizResolvida = matrizBruta?.aceitar ? await matrizBruta.aceitar(this) : matrizBruta;
        const linhaResolvida = indiceLinhaBruto?.aceitar ? await indiceLinhaBruto.aceitar(this) : indiceLinhaBruto;
        const colunaResolvida = indiceColunaBruto?.aceitar ? await indiceColunaBruto.aceitar(this) : indiceColunaBruto;
        const valorResolvido = valorBruto?.aceitar ? await valorBruto.aceitar(this) : valorBruto;

        const matrizFinal = matrizResolvida instanceof VariavelEscopo ? matrizResolvida.variavelLlvm : matrizResolvida;

        if (Array.isArray(matrizFinal) && Array.isArray(matrizFinal[linhaResolvida])) {
            matrizFinal[linhaResolvida][colunaResolvida] = valorResolvido;
        }

        return Promise.resolve(valorResolvido);
    }

    async visitarExpressaoDefinirValor(expressao: DefinirValor): Promise<any> {
        const objetoResolvido = await expressao.objeto.aceitar(this);
        let objetoPtr: llvm.Value;
        let nomeClasse: string;

        if (objetoResolvido instanceof VariavelEscopo) {
            objetoPtr = this.carregarPtrClasseSePreciso(objetoResolvido);
            nomeClasse = objetoResolvido.tipo;
        } else {
            objetoPtr = objetoResolvido as llvm.Value;
        }

        if (!nomeClasse) {
            if (expressao.objeto.constructor === Variavel) {
                nomeClasse = this.pilhaVariaveisEscopo.obterValor((expressao.objeto as Variavel).simbolo.lexema)?.tipo;
            } else if (expressao.objeto.constructor === Isto) {
                nomeClasse = this.pilhaVariaveisEscopo.obterValor('isto')?.tipo;
            }
        }

        // Açúcar sintático: `obj.propriedade = valor` em um dicionário equivale a
        // `obj["propriedade"] = valor`.
        if (this.tipoEhDicionario(nomeClasse)) {
            const dictPtr = this.resolverPonteiroDireto(objetoResolvido);
            const chavePtr = this.montador.CreateGlobalStringPtr(expressao.nome.lexema, 'dict_chave', 0, this.modulo);
            const valorResolvido = await expressao.valor.aceitar(this);
            const valorPtr = this.embalarValorParaDicionario(valorResolvido);
            this.montador.CreateCall(this.funcaoDicionarioDefinir, [dictPtr, chavePtr, valorPtr]);
            return Promise.resolve();
        }

        const nomePropriedade = expressao.nome.lexema;
        const mapaIndices = this.indicesPropriedades.get(nomeClasse);
        const mapaTipos = this.tiposPropriedades.get(nomeClasse);
        const indice = mapaIndices?.get(nomePropriedade);
        const tipoProp = mapaTipos?.get(nomePropriedade);

        if (indice === undefined || !tipoProp) {
            const erroDefinirValor = new ErroCompilador(`Propriedade '${nomePropriedade}' não encontrada na classe '${nomeClasse}'.`);
            erroDefinirValor.linha = expressao.linha;
            erroDefinirValor.tamanhoToken = nomePropriedade.length;
            erroDefinirValor.arquivo = this.arquivoDeSimbolo(expressao.nome);
            throw erroDefinirValor;
        }

        const tipoStruct = this.registroClasses.get(nomeClasse);
        const gepPtr = this.montador.CreateInBoundsGEP(
            tipoStruct,
            objetoPtr,
            [ConstantInt.get(this.contexto, new APInt(32, 0)), ConstantInt.get(this.contexto, new APInt(32, indice))],
            `${nomePropriedade}_ptr`
        );

        const novoValor = await expressao.valor.aceitar(this);
        let novoValorLlvm: llvm.Value;
        if (novoValor instanceof VariavelEscopo) {
            novoValorLlvm = this.carregarValorSeNecessario(novoValor, tipoProp, 'load_val');
        } else if (!this.ehValorLlvm(novoValor)) {
            // Dicionários, objetos JS e outros não-LLVM: ponteiro nulo como sentinela.
            novoValorLlvm = llvm.Constant.getNullValue(this.montador.getPtrTy()) as unknown as llvm.Value;
        } else {
            const brutoLlvm = novoValor as llvm.Value;
            if (this.tipoEhVetor(tipoProp) && this.tipoEhPonteiro(brutoLlvm.getType())) {
                // Para vetores: brutoLlvm é ptr para %Vetor (ex.: resultado de []); carrega o struct.
                novoValorLlvm = this.montador.CreateLoad(this.tipoEstruturaVetor, brutoLlvm, 'load_vetor_val');
            } else {
                novoValorLlvm = brutoLlvm;
            }
        }

        // Coerce o valor ao tipo do campo para evitar stores de tamanho errado
        // (ex.: double 0.0 num campo inteiro escreve 8 bytes em vez de 4).
        if (novoValorLlvm) {
            const nomeTipoValor = novoValorLlvm.getType()?.constructor?.name;
            if ((tipoProp === 'inteiro' || tipoProp === 'inteiro') && nomeTipoValor === 'Type') {
                novoValorLlvm = this.montador.CreateFPToSI(novoValorLlvm, this.montador.getInt32Ty(), 'coerce_int');
            } else if ((tipoProp === 'número' || tipoProp === 'numero') && nomeTipoValor === 'IntegerType') {
                novoValorLlvm = this.montador.CreateSIToFP(novoValorLlvm, this.montador.getDoubleTy(), 'coerce_double');
            }
        }

        this.montador.CreateStore(novoValorLlvm, gepPtr);
        return Promise.resolve();
    }

    async visitarExpressaoDeleguaFuncao(expressao: FuncaoConstruto): Promise<any> {
        // Retorna o próprio construto de função (será tratado em visita de declaração).
        return Promise.resolve(expressao);
    }

    async visitarExpressaoDicionario(expressao: Dicionario): Promise<any> {
        const expressaoTipada = expressao as unknown as DicionarioDialeto;

        // Normaliza os dois formatos possíveis do AST em pares (chave, valor).
        const pares: Array<{ chaveBruta: ConstrutoInterface; valorBruto: ConstrutoInterface }> = [];
        if (Array.isArray(expressaoTipada.entradas)) {
            for (const entrada of expressaoTipada.entradas) {
                pares.push({ chaveBruta: entrada?.chave, valorBruto: entrada?.valor });
            }
        } else {
            const chaves = expressaoTipada.chaves || [];
            const valores = expressaoTipada.valores || [];
            const total = Math.min(chaves.length, valores.length);
            for (let indice = 0; indice < total; indice++) {
                pares.push({ chaveBruta: chaves[indice], valorBruto: valores[indice] });
            }
        }

        const dictPtr = this.montador.CreateCall(this.funcaoDicionarioCriar, [], 'dict_novo');

        for (const { chaveBruta, valorBruto } of pares) {
            const chaveResolvida = chaveBruta?.aceitar ? await chaveBruta.aceitar(this) : chaveBruta;
            const valorResolvido = valorBruto?.aceitar ? await valorBruto.aceitar(this) : valorBruto;

            const chavePtr = this.resolverPonteiroDireto(chaveResolvida);
            const valorPtr = this.embalarValorParaDicionario(valorResolvido);

            this.montador.CreateCall(this.funcaoDicionarioDefinir, [dictPtr, chavePtr, valorPtr]);
        }

        return Promise.resolve(dictPtr);
    }

    async visitarExpressaoAcessoIntervaloVariavel(_: AcessoIntervaloVariavel): Promise<any> {
        // Fatiamento (slicing) não tem geração de IR neste compilador.
        return Promise.resolve();
    }

    async visitarExpressaoAjuda(_: AjudaComoConstruto): Promise<any> {
        // Sistema de ajuda em tempo de execução não tem mapeamento em IR.
        return Promise.resolve();
    }

    async visitarExpressaoElvis(expressao: Elvis): Promise<any> {
        // Quando o montador não está em contexto de IR (testes isolados), fallback JS.
        if (!this.montador?.GetInsertBlock?.()) {
            const esq = await expressao.esquerda.aceitar(this);
            if (esq) return Promise.resolve(esq);
            return await expressao.direita.aceitar(this);
        }

        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        // Avalia o lado esquerdo.
        const esquerdaResolvido = await expressao.esquerda.aceitar(this);
        const tipoEsq = this.resolverTipoConstruto(expressao.esquerda);
        const tipoLlvmEsq = this.obterTipoLlvm(tipoEsq);
        let valorEsquerdo: llvm.Value;
        if (esquerdaResolvido instanceof VariavelEscopo) {
            valorEsquerdo = this.montador.CreateLoad(tipoLlvmEsq, esquerdaResolvido.variavelLlvm, 'elvis_esq');
        } else {
            valorEsquerdo = esquerdaResolvido as llvm.Value;
        }

        const condicao = this.garantirCondicaoI1(valorEsquerdo);

        const blocoEsqVerdadeiro = llvm.BasicBlock.Create(this.contexto, 'elvis_esq_true', funcaoAtual);
        const blocoEsqNulo = llvm.BasicBlock.Create(this.contexto, 'elvis_esq_null', funcaoAtual);
        const blocoJuncao = llvm.BasicBlock.Create(this.contexto, 'elvis_juncao', funcaoAtual);

        this.montador.CreateCondBr(condicao, blocoEsqVerdadeiro, blocoEsqNulo);

        // Bloco esquerda verdadeira: usa valorEsquerdo diretamente.
        this.montador.SetInsertPoint(blocoEsqVerdadeiro);
        const bbEsqTrue = this.montador.GetInsertBlock();
        this.montador.CreateBr(blocoJuncao);

        // Bloco esquerda nula: avalia direita.
        this.montador.SetInsertPoint(blocoEsqNulo);
        const direitaRaw = await expressao.direita.aceitar(this);
        const tipoDir = this.resolverTipoConstruto(expressao.direita);
        const tipoLlvmDir = this.obterTipoLlvm(tipoDir);
        let valorDireito: llvm.Value;
        if (direitaRaw instanceof VariavelEscopo) {
            valorDireito = this.montador.CreateLoad(tipoLlvmDir, direitaRaw.variavelLlvm, 'elvis_dir');
        } else {
            valorDireito = direitaRaw as llvm.Value;
        }
        const bbEsqNull = this.montador.GetInsertBlock();
        this.montador.CreateBr(blocoJuncao);

        // Bloco de convergência: PHI entre os dois caminhos.
        this.montador.SetInsertPoint(blocoJuncao);
        const phi = this.montador.CreatePHI(tipoLlvmEsq, 2, 'elvis_res');
        phi.addIncoming(valorEsquerdo, bbEsqTrue);
        phi.addIncoming(valorDireito, bbEsqNull);

        return Promise.resolve(phi);
    }

    async visitarExpressaoEnquanto(expressao: EnquantoComoConstruto): Promise<any> {
        // Trivial: delega ao corpo e condição.
        await expressao.condicao.aceitar(this);
        await this.aceitarListaDeclaracoes(expressao.corpo?.declaracoes);
        return Promise.resolve();
    }

    async visitarExpressaoExpressaoRegular(expressao: ExpressaoRegular): Promise<RegExp> {
        // Retorna RegExp nativo (não integrado ao IR).
        return Promise.resolve(new RegExp(expressao.valor));
    }

    async visitarExpressaoFalhar(expressao: Falhar): Promise<any> {
        const mensagemExpr = expressao.explicacao;
        if (!mensagemExpr) {
            const erroFalhar = new ErroCompilador('Falhar precisa de uma mensagem');
            erroFalhar.linha = expressao.linha;
            throw erroFalhar;
        }
        const mensagemResolvida = await mensagemExpr.aceitar(this);
        let mensagem: llvm.Value;

        if (mensagemResolvida instanceof VariavelEscopo) {
            const tipoMensagem = this.obterTipoLlvm('texto');
            mensagem = this.montador.CreateLoad(tipoMensagem, mensagemResolvida.variavelLlvm, 'load_falhar_msg');
        } else {
            mensagem = mensagemResolvida as llvm.Value;
        }

        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        if (this.pontoPousoAtual) {
            const blocoSucesso = llvm.BasicBlock.Create(this.contexto, 'falhar_normal', funcaoAtual);
            this.montador.CreateInvoke(this.funcaoFalhar, blocoSucesso, this.pontoPousoAtual, [mensagem]);
            this.montador.SetInsertPoint(blocoSucesso);
            return Promise.resolve();
        } else {
            this.montador.CreateCall(this.funcaoFalhar, [mensagem]);
            return Promise.resolve();
        }
    }

    async visitarExpressaoFazer(expressao: FazerComoConstruto): Promise<any> {
        await this.aceitarListaDeclaracoes(expressao.caminhoFazer?.declaracoes);
        await expressao.condicaoEnquanto.aceitar(this);
        return Promise.resolve();
    }

    async visitarExpressaoFimPara(_: FimPara): Promise<any> {
        // Marca fim de for; sem geração direta de IR.
        return Promise.resolve();
    }

    async visitarExpressaoFormatacaoEscrita(declaracao: FormatacaoEscrita): Promise<any> {
        const declaracaoTipada = declaracao as unknown as { expressao?: ConstrutoInterface; valor?: ConstrutoInterface; casasDecimais?: number };
        const expressaoBase = declaracaoTipada.expressao ?? declaracaoTipada.valor;
        const valorResolvido = expressaoBase?.aceitar ? await expressaoBase.aceitar(this) : expressaoBase;

        // Semântica conservadora: em caminhos sem IR, aplica formatação textual simples.
        const casasDecimais = declaracaoTipada.casasDecimais;
        if (typeof valorResolvido === 'number' && Number.isInteger(casasDecimais) && casasDecimais >= 0) {
            return Promise.resolve(valorResolvido.toFixed(casasDecimais));
        }

        return Promise.resolve(valorResolvido);
    }

    async visitarExpressaoFuncaoConstruto(expressao: FuncaoConstruto): Promise<any> {
        // Para aceitação de função anônima, cria o objeto de função (tratado mais adiante).
        return Promise.resolve(expressao);
    }

    async visitarExpressaoImportar(expressao: ImportarComoConstruto): Promise<any> {
        // Importação dinâmica: var mod = importar('nomeModulo')
        // Retorna um VariavelEscopo sentinela com tipo 'modulo:<nome>' quando o módulo
        // é uma biblioteca embutida reconhecida.
        const nomeModulo = (expressao.caminho?.valor ?? '') as string;
        if (nomeModulo && this.mapaModulos.has(nomeModulo)) {
            return Promise.resolve(new VariavelEscopo(null, undefined, `modulo:${nomeModulo}`));
        }
        // Módulo não reconhecido — pode ser um caminho de arquivo; ignorado nesta fase.
        return Promise.resolve();
    }

    async visitarExpressaoIsto(_: Isto): Promise<any> {
        const istoEscopo = this.pilhaVariaveisEscopo.obterValor('isto');
        return Promise.resolve(istoEscopo ?? null);
    }

    async visitarExpressaoLeia(expressao: Leia): Promise<llvm.Value> {
        const mensagemPrompt = expressao.argumentos[0];
        const mensagemResolvida = await mensagemPrompt.aceitar(this);

        const tipoLeitura = expressao.tipo || 'texto';
        const formatoLeia = this.buscarFormatoLeia(tipoLeitura);
        const result = this.montador.CreateCall(this.funcaoLeia, [mensagemResolvida, formatoLeia]);

        return result;
    }

    async visitarExpressaoListaCompreensao(listaCompreensao: ListaCompreensao): Promise<any> {
        const listaDialeto = listaCompreensao as unknown as ListaCompreensaoDialeto;
        const origem: ConstrutoInterface | unknown[] =
            listaCompreensao.paraCada?.vetorOuDicionario ??
            listaDialeto.lista ??
            listaDialeto.iteravel ??
            [];
        const origemResolvida = 'aceitar' in origem && typeof origem.aceitar === 'function' ? await origem.aceitar(this) : origem;

        const resultado: any[] = [];
        if (Array.isArray(origemResolvida)) {
            for (const item of origemResolvida) {
                const expressaoRetorno = listaCompreensao.expressaoRetorno ?? listaDialeto.expressao;
                if (expressaoRetorno?.aceitar) {
                    resultado.push(await expressaoRetorno.aceitar(this));
                } else {
                    resultado.push(item);
                }
            }
        }

        return Promise.resolve(resultado);
    }

    async visitarExpressaoLogica(expressao: Logico): Promise<any> {
        this.definirLocalizacaoDebug(expressao.linha ?? 0, 0);
        const esquerda = await expressao.esquerda.aceitar(this);
        const tipoEsquerda = this.resolverTipoConstruto(expressao.esquerda);
        const esquerdaRes = this.resolverOperando(esquerda, tipoEsquerda);
        const esquerdaI1 = this.garantirCondicaoI1(esquerdaRes.valor);

        if (expressao.operador.tipo !== 'OU' && expressao.operador.tipo !== 'E') {
            return Promise.resolve(esquerda);
        }

        // Curto-circuito real via branch: o operando direito só é avaliado quando
        // necessário. Essencial para padrões como `indice < tamanho e vetor[indice] == x`,
        // onde avaliar o lado direito incondicionalmente causaria acesso fora dos limites.
        const funcaoAtual = this.montador.GetInsertBlock().getParent();
        const blocoAvaliaDireita = llvm.BasicBlock.Create(this.contexto, 'logico_avalia_direita', funcaoAtual);
        const blocoApos = llvm.BasicBlock.Create(this.contexto, 'logico_apos', funcaoAtual);
        const resultadoAlloca = this.criarAllocaNoBlocoEntrada(llvm.Type.getInt1Ty(this.contexto), 'logico_resultado');

        this.montador.CreateStore(esquerdaI1, resultadoAlloca);
        if (expressao.operador.tipo === 'OU') {
            this.montador.CreateCondBr(esquerdaI1, blocoApos, blocoAvaliaDireita);
        } else {
            this.montador.CreateCondBr(esquerdaI1, blocoAvaliaDireita, blocoApos);
        }

        this.montador.SetInsertPoint(blocoAvaliaDireita);
        const direita = await expressao.direita.aceitar(this);
        const tipoDireita = this.resolverTipoConstruto(expressao.direita);
        const direitaRes = this.resolverOperando(direita, tipoDireita);
        const direitaI1 = this.garantirCondicaoI1(direitaRes.valor);
        this.montador.CreateStore(direitaI1, resultadoAlloca);
        if (!this.montador.GetInsertBlock().getTerminator()) {
            this.montador.CreateBr(blocoApos);
        }

        this.montador.SetInsertPoint(blocoApos);
        return Promise.resolve(this.montador.CreateLoad(llvm.Type.getInt1Ty(this.contexto), resultadoAlloca, 'logico_tmp'));
    }

    async visitarExpressaoPara(expressao: ParaComoConstruto): Promise<any> {
        // Fallback: processa inicializadores, condição e corpo.
        for (const init of [].concat(expressao.inicializador || [])) {
            await init.aceitar(this);
        }
        await expressao.condicao?.aceitar(this);
        await this.aceitarListaDeclaracoes(expressao.corpo?.declaracoes);
        return Promise.resolve();
    }

    async visitarExpressaoParaCada(expressao: ParaCadaComoConstruto): Promise<any> {
        const iteravel = (expressao as any).vetorOuDicionario ?? (expressao as any).iteravel;

        await this.executarCorpoParaCada(
            expressao.variavelIteracao,
            iteravel,
            expressao.corpo?.declaracoes || []
        );
        return Promise.resolve();
    }

    async visitarExpressaoReferenciaFuncao(expressao: ReferenciaFuncao): Promise<any> {
        // Retorna a VariavelEscopo correspondente à referência (se existir).
        const topo = this.pilhaVariaveisEscopo.topoDaPilha();
        const v = topo.get(expressao.simboloFuncao.lexema);
        return Promise.resolve(v);
    }

    async visitarExpressaoRetornar(declaracao: Retorna): Promise<any> {
        const linhaRetorna = declaracao.linha ?? 0;
        this.definirLocalizacaoDebug(linhaRetorna, 0);
        if (!declaracao.valor) {
            // Métodos 'nulo' são compilados com retorno ptr — emite ret null, não ret void.
            if (this.tipoRetornoFuncaoAtual === 'nulo' || this.tipoRetornoFuncaoAtual === 'qualquer') {
                this.montador.CreateRet(llvm.Constant.getNullValue(this.montador.getPtrTy()) as unknown as llvm.Value);
            } else {
                this.montador.CreateRetVoid();
            }
            return Promise.resolve();
        }

        const valorResolvido = await declaracao.valor.aceitar(this);

        if (valorResolvido instanceof VariavelEscopo) {
            const tipoRetorno = declaracao.valor.tipo || valorResolvido.tipo || 'número';
            // Instâncias de classe: o ptr já é o valor final (malloc result ou argumento).
            // Não deve ser carregado — carregarPtrClasseSePreciso resolve alloca(ptr) se necessário.
            if (this.registroClasses.has(valorResolvido.tipo)) {
                this.montador.CreateRet(this.carregarPtrClasseSePreciso(valorResolvido));
                return Promise.resolve();
            }
            if (this.tipoEhPonteiro(valorResolvido.variavelLlvm.getType())) {
                const tipoLlvmRetorno = this.obterTipoLlvm(tipoRetorno);
                const valorCarregado = this.montador.CreateLoad(
                    tipoLlvmRetorno,
                    valorResolvido.variavelLlvm,
                    'load_retorno'
                );
                this.montador.CreateRet(valorCarregado);
            } else {
                this.montador.CreateRet(valorResolvido.variavelLlvm);
            }
            return Promise.resolve();
        }

        let valorFinal = valorResolvido as llvm.Value;

        // Conversões de tipo quando a função foi compilada via compilarLambda e tem tipo de retorno esperado.
        if (this.tipoRetornoFuncaoAtual === 'inteiro') {
            const operadorLexema = declaracao.valor instanceof Binario ? declaracao.valor.operador?.lexema : undefined;
            const opComparacao = ['==', '!=', '<', '<=', '>', '>='].includes(operadorLexema ?? '');

            if (opComparacao) {
                // Comparação produz i1 → ZExt para i32
                valorFinal = this.montador.CreateZExt(valorFinal, this.montador.getInt32Ty(), 'bool_para_int_ret');
            } else if ((declaracao.valor?.tipo ?? '') === 'número') {
                // Literal/expressão número (double) → FPToSI para i32
                valorFinal = this.montador.CreateFPToSI(valorFinal, this.montador.getInt32Ty(), 'double_para_int_ret');
            }
        }

        this.montador.CreateRet(valorFinal);
        return Promise.resolve();
    }

    async visitarExpressaoSeparador(_: Separador): Promise<any> {
        return Promise.resolve();
    }

    async visitarExpressaoSeTernario(expressao: SeTernario): Promise<any> {
        // Avalia condição e retorna um dos ramos.
        const condicaoResolvida = await expressao.condicao.aceitar(this);
        const condicao = this.carregarValorSeNecessario(condicaoResolvida, expressao.condicao.tipo, 'ternary_cond');
        // Simplificação: não cria blocos, escolhe por valor conhecido em tempo de compilação; caso contrário, avalia ambos e retorna cond ? then : else as expressão.
        // Aqui apenas avalia both and creates a select instruction if cond is an llvm.Value boolean.
        const expressaoSeResolvida = await expressao.expressaoSe.aceitar(this);
        const expressaoSenaoResolvida = await expressao.expressaoSenao.aceitar(this);
        try {
            return this.montador.CreateSelect(
                condicao as llvm.Value,
                expressaoSeResolvida as llvm.Value,
                expressaoSenaoResolvida as llvm.Value,
                'ternary_sel'
            );
        } catch {
            return Promise.resolve(expressaoSeResolvida);
        }
    }

    async visitarExpressaoSuper(expressao: Super): Promise<any> {
        // `super` retorna o ponteiro `isto` atual, mas tipado como a superclasse.
        // Isso permite que `super.metodo()` despache para `SuperClasse_metodo`.
        let istoEscopo: VariavelEscopo;
        try {
            istoEscopo = this.pilhaVariaveisEscopo.obterValor('isto');
        } catch {
            return Promise.resolve(null);
        }
        if (!istoEscopo) return Promise.resolve(null);

        // O nome da superclasse pode vir do nó AST (superclasse) ou do mapa de herança.
        const nomeSuperClasse: string = expressao.superclasse ?? this.superClasses.get(istoEscopo.tipo) ?? null;

        if (!nomeSuperClasse) return Promise.resolve(istoEscopo);

        return Promise.resolve(new VariavelEscopo(istoEscopo.variavelLlvm, undefined, nomeSuperClasse));
    }

    visitarExpressaoSustar(declaracao?: Sustar): SustarQuebra | void {
        if (this.montador && this.pilhaBlocosLoop.length > 0) {
            const { blocoSaida } = this.pilhaBlocosLoop[this.pilhaBlocosLoop.length - 1];
            this.montador.CreateBr(blocoSaida);
            // Cria bloco morto para absorver instruções subsequentes no mesmo bloco (nunca alcançado).
            const funcaoAtual = this.montador.GetInsertBlock().getParent();
            const blocoMorto = llvm.BasicBlock.Create(this.contexto, 'sustar_morto', funcaoAtual);
            this.montador.SetInsertPoint(blocoMorto);
        }
    }

    async visitarExpressaoTupla(expressao: Tupla): Promise<any> {
        const expressaoTipada = expressao as unknown as TuplaDialeto;
        const itens = expressaoTipada.valores || expressaoTipada.elementos || [];
        const tuplaResolvida: any[] = [];

        for (const item of itens) {
            if (item?.aceitar) {
                tuplaResolvida.push(await item.aceitar(this));
            } else {
                tuplaResolvida.push(item);
            }
        }

        return Promise.resolve(tuplaResolvida);
    }

    async visitarExpressaoTuplaN(_: TuplaN): Promise<any> {
        // Tuplas sem limite de tamanho não têm geração de IR neste compilador.
        return Promise.resolve();
    }

    async visitarExpressaoTipoDe(expressao: TipoDe): Promise<any> {
        const expressaoTipada = expressao as unknown as TipoDeDialeto;
        const alvo = expressaoTipada.valor ?? expressaoTipada.expressao ?? expressaoTipada.argumento;

        let tipoInferido = 'desconhecido';
        if (alvo) {
            tipoInferido = this.resolverTipoConstruto(alvo) || tipoInferido;
        }

        // Durante testes unitários sem inicialização de LLVM, retorna string simples.
        if (!this.montador || !this.modulo) {
            return Promise.resolve(tipoInferido);
        }

        return Promise.resolve(
            this.montador.CreateGlobalStringPtr(tipoInferido, `tipo_de_${tipoInferido}`, 0, this.modulo)
        );
    }

    async visitarExpressaoUnaria(expressao: Unario): Promise<llvm.Value> {
        this.definirLocalizacaoDebug(expressao.linha ?? 0, 0);
        const operandoResolvido = await expressao.operando.aceitar(this);

        let valor: llvm.Value;
        if (operandoResolvido instanceof VariavelEscopo) {
            if (this.tipoEhPonteiro(operandoResolvido.variavelLlvm.getType())) {
                const tipoOperando = this.obterTipoLlvm(expressao.operando.tipo);
                valor = this.montador.CreateLoad(tipoOperando, operandoResolvido.variavelLlvm, 'load_unary');
            } else {
                valor = operandoResolvido.variavelLlvm;
            }
        } else {
            valor = operandoResolvido;
        }

        switch (expressao.operador.tipo) {
            case 'SUBTRACAO':
                if (expressao.operando.tipo === 'inteiro') {
                    return Promise.resolve(this.montador.CreateNeg(valor));
                } else {
                    return Promise.resolve(this.montador.CreateFNeg(valor));
                }

            case 'INCREMENTAR':
                let novoValor: llvm.Value;
                if (expressao.operando.tipo === 'inteiro') {
                    const um = ConstantInt.get(this.contexto, new APInt(32, 1));
                    novoValor = this.montador.CreateNSWAdd(valor, um, 'inc');
                } else {
                    const um = ConstantFP.get(this.montador.getDoubleTy(), new APFloat(1.0));
                    novoValor = this.montador.CreateFAdd(valor, um, 'inc');
                }

                if (operandoResolvido instanceof VariavelEscopo) {
                    this.montador.CreateStore(novoValor, operandoResolvido.variavelLlvm);
                }

                return Promise.resolve(novoValor);

            case 'DECREMENTAR':
                let valorDecrementado: llvm.Value;
                if (expressao.operando.tipo === 'inteiro') {
                    const um = ConstantInt.get(this.contexto, new APInt(32, 1));
                    valorDecrementado = this.montador.CreateNSWSub(valor, um, 'dec');
                } else {
                    const um = ConstantFP.get(this.montador.getDoubleTy(), new APFloat(1.0));
                    valorDecrementado = this.montador.CreateFSub(valor, um, 'dec');
                }

                if (operandoResolvido instanceof VariavelEscopo) {
                    this.montador.CreateStore(valorDecrementado, operandoResolvido.variavelLlvm);
                }

                return Promise.resolve(valorDecrementado);

            case 'BIT_NOT':
                return Promise.resolve(this.montador.CreateNot(valor));

            case 'NAO':
            case 'NEGACAO':
                return Promise.resolve(this.montador.CreateNot(this.garantirCondicaoI1(valor), 'nao_tmp'));

            default: {
                const erroUnario = new ErroCompilador(`Operador unário ${expressao.operador.tipo} não implementado.`);
                erroUnario.linha = expressao.linha;
                throw erroUnario;
            }
        }
    }

    async visitarExpressaoVetor(expressao: Vetor): Promise<any> {
        // Filtra Separadores (vírgulas) que o parser inclui entre os elementos.
        const valores = (expressao.valores || []).filter((v) => v.constructor !== Separador);

        // Sem contexto LLVM: retorna array JS (caminho do interpretador).
        if (!this.tipoEstruturaVetor) {
            const valoresResolvidos: any[] = [];
            for (const valor of valores) {
                valoresResolvidos.push(valor?.aceitar ? await valor.aceitar(this) : valor);
            }
            return Promise.resolve(valoresResolvidos);
        }

        const tamanho = valores.length;

        // Pré-resolve o primeiro elemento para detectar o tipo real dos elementos.
        // O parser usa 'inteiro[]' como padrão para vetores sem tipo explícito, mas os
        // valores reais podem ser ptrs (texto, objetos), exigindo stride de 8 bytes.
        let primeiroPreResolvido: any = tamanho > 0 ? await valores[0].aceitar(this) : null;
        let tipoElementoStr = this.tipoElementoVetor(
            expressao.tipo ?? (tamanho > 0 ? this.resolverTipoConstruto(valores[0]) : 'inteiro')
        );
        if (tipoElementoStr === 'inteiro' && primeiroPreResolvido !== null) {
            if (primeiroPreResolvido instanceof VariavelEscopo) {
                const tp = primeiroPreResolvido.tipo;
                if (tp && tp !== 'inteiro' && tp !== 'qualquer' && !this.tipoEhVetor(tp)) {
                    tipoElementoStr = tp;
                }
            } else if (this.ehValorLlvm(primeiroPreResolvido) &&
                       this.tipoEhPonteiro((primeiroPreResolvido as llvm.Value).getType())) {
                tipoElementoStr = 'texto';
            }
        }
        const tipoElemento = this.obterTipoLlvm(tipoElementoStr);

        // Aloca array de elementos no heap via malloc para que realloc (em adicionar) funcione.
        const tamBytes = this.tamElementoEmBytes(tipoElementoStr);
        const totalBytes = ConstantInt.get(this.contexto, new APInt(64, tamanho * tamBytes));
        const ptrHeap = this.montador.CreateCall(this.funcaoMalloc, [totalBytes], 'arr_heap');

        // Inicializa cada posição com seu valor.
        const idx0 = ConstantInt.get(this.contexto, new APInt(32, 0));
        for (let i = 0; i < tamanho; i++) {
            const bruto: any = i === 0 ? primeiroPreResolvido : await valores[i].aceitar(this);
            let valorElem: llvm.Value;

            if (bruto instanceof VariavelEscopo) {
                valorElem = this.montador.CreateLoad(tipoElemento, bruto.variavelLlvm, 'load_elem');
            } else if (this.ehValorLlvm(bruto)) {
                valorElem = bruto as llvm.Value;
                // Converte double → i32 quando o tipo do vetor é inteiro.
                const nomeTipoBruto = valorElem.getType()?.constructor?.name;
                if (this.tipoEhInteiroDelegua(tipoElementoStr) && nomeTipoBruto === 'Type') {
                    valorElem = this.montador.CreateFPToSI(valorElem, tipoElemento, 'elem_to_int');
                } else if (tipoElementoStr === 'número' && nomeTipoBruto === 'IntegerType') {
                    valorElem = this.montador.CreateSIToFP(valorElem, tipoElemento, 'elem_to_double');
                }
            } else {
                // Primitivo JS (número sem tipo): cria constante LLVM diretamente.
                const n = Number(bruto) || 0;
                if (tipoElementoStr === 'inteiro') {
                    valorElem = ConstantInt.get(this.contexto, new APInt(32, n));
                } else if (tipoElementoStr === 'longo') {
                    valorElem = ConstantInt.get(this.contexto, new APInt(64, n));
                } else {
                    valorElem = ConstantFP.get(tipoElemento, new APFloat(n));
                }
            }

            const gepElem = this.montador.CreateInBoundsGEP(
                tipoElemento,
                ptrHeap,
                [ConstantInt.get(this.contexto, new APInt(32, i))],
                `ptr_arr_${i}`
            );
            this.montador.CreateStore(valorElem, gepElem);
        }

        // Aloca struct %Vetor e preenche seus dois campos.
        const alocVetor = this.montador.CreateAlloca(this.tipoEstruturaVetor, null, 'vetor');

        // Campo 0: ponteiro para o array de elementos (heap).
        const gepCampoPtr = this.montador.CreateInBoundsGEP(
            this.tipoEstruturaVetor,
            alocVetor,
            [idx0, ConstantInt.get(this.contexto, new APInt(32, 0))],
            'ptr_campo_ptr'
        );
        this.montador.CreateStore(ptrHeap, gepCampoPtr);

        // Campo 1: tamanho do vetor.
        const gepCampoTam = this.montador.CreateInBoundsGEP(
            this.tipoEstruturaVetor,
            alocVetor,
            [idx0, ConstantInt.get(this.contexto, new APInt(32, 1))],
            'ptr_campo_tam'
        );
        this.montador.CreateStore(ConstantInt.get(this.contexto, new APInt(32, tamanho)), gepCampoTam);

        return Promise.resolve(alocVetor);
    }

    protected async visitarCorpoFuncao(
        funcaoConstruto: FuncaoConstruto,
        objetoLlvmFuncao: llvm.Function,
        parametrosDebug?: Array<{ arg: llvm.Value; nome: string; tipo: string; argNo: number; linha: number }>
    ) {
        const blocoEscopo = llvm.BasicBlock.Create(this.contexto, 'entry', objetoLlvmFuncao);
        this.montador.SetInsertPoint(blocoEscopo);
        // Emite alloca + store + llvm.dbg.declare para cada parâmetro formal.
        // A alloca substitui a referência direta ao argumento LLVM no escopo de variáveis,
        // permitindo ao LLDB/CodeLLDB inspecionar parâmetros nas janelas de variáveis e watch.
        if (parametrosDebug && this.construtorDebug) {
            const escopo = this.pilhaVariaveisEscopo.topoDaPilha();
            for (const param of parametrosDebug) {
                // Tipos ptr (texto, vetor, classe, qualquer) usam a convenção "caller passa
                // a própria alloca como ptr*". O parâmetro já RECEBE essa alloca (um ptr).
                // Criar outra alloca e armazenar o ptr nela introduziria dupla indireção:
                //   alloca_param → alloca_caller → char* (ou struct)
                // mas carregarValorSeNecessario / carregarArgumentoTexto só fazem UM load,
                // retornando alloca_caller como se fosse o valor final → lixo ou segfault.
                // Para escalares (i32, i64, double, i1) o arg já é o valor direto; a alloca
                // é correta pois adiciona exatamente um nível de indireção.
                if (this.tipoEhPonteiro(param.arg.getType())) continue;
                const tipoLlvm = this.obterTipoLlvm(param.tipo);
                const aloc = this.montador.CreateAlloca(tipoLlvm, null, `${param.nome}_param`);
                this.montador.CreateStore(param.arg, aloc);
                this.emitirDeclaracaoParametroDebug(aloc, param.nome, param.tipo, param.linha, param.argNo);
                const varEscopo = escopo.get(param.nome);
                if (varEscopo) {
                    varEscopo.variavelLlvm = aloc;
                }
            }
        }
        for (const construtoInstrucao of funcaoConstruto.corpo) {
            await construtoInstrucao.aceitar(this);
        }
    }

    protected obterTipoLlvm(tipoDelegua: string): llvm.Type {
        switch (tipoDelegua) {
            case 'inteiro':
            case 'função<inteiro>':
                return this.montador.getInt32Ty();
            case 'longo':
            case 'função<longo>':
                return llvm.Type.getInt64Ty(this.contexto);
            case 'numero':
            case 'número':
            case 'função<numero>':
            case 'função<número>':
                return this.montador.getDoubleTy();
            case 'texto':
                return this.montador.getPtrTy();
            case 'lógico':
            case 'logico':
                return llvm.Type.getInt1Ty(this.contexto);
            default:
                if (this.tipoEhVetor(tipoDelegua)) {
                    return this.tipoEstruturaVetor ?? llvm.PointerType.get(this.contexto, 0);
                }
                // Tipos de classe conhecidos ou desconhecidos: ponteiro opaco.
                return llvm.PointerType.get(this.contexto, 0);
        }
    }

    /**
     * Carrega um valor se ele for uma variável de escopo do tipo ponteiro.
     * Se o valor já for um llvm.Value direto, retorna ele mesmo.
     */
    protected carregarValorSeNecessario(
        valor: llvm.Value | VariavelEscopo,
        tipoDelegua: string,
        nomeLoad: string
    ): llvm.Value {
        if (valor instanceof VariavelEscopo) {
            const tipoVariavel = valor.variavelLlvm.getType();
            // Instâncias de classe são sempre ponteiro direto (single indirection) — mesma
            // convenção de carregarPtrClasseSePreciso/resolverOperando: só AllocaInst/GEP
            // apontam PARA o ponteiro do objeto (precisam de load); Argument/CallInst/
            // LoadInst já SÃO o ponteiro. texto/lógico/qualquer/dicionário seguem a
            // convenção oposta (sempre ptr* de dupla indireção, sempre precisam de um load),
            // por isso usam apenas o tipo LLVM (`tipoEhPonteiro`) para decidir.
            if (this.registroClasses.has(tipoDelegua)) {
                const nomeInst = valor.variavelLlvm?.constructor?.name;
                const precisaCarregar = nomeInst === 'AllocaInst' || nomeInst === 'GetElementPtrInst';
                return precisaCarregar
                    ? this.montador.CreateLoad(this.montador.getPtrTy(), valor.variavelLlvm, nomeLoad)
                    : valor.variavelLlvm;
            }
            if (this.tipoEhPonteiro(tipoVariavel)) {
                const tipoLlvm = this.obterTipoLlvm(tipoDelegua);
                return this.montador.CreateLoad(tipoLlvm, valor.variavelLlvm, nomeLoad);
            }
            return valor.variavelLlvm;
        }
        return valor as llvm.Value;
    }

    /**
     * Processa uma lista de declarações sequencialmente.
     */
    protected async processarDeclaracoesBloco(declaracoes: Declaracao[]): Promise<void> {
        for (const declaracao of declaracoes) {
            await declaracao.aceitar(this);
        }
    }

    /**
     * Determina o próximo bloco na estrutura de escolha.
     */
    protected obterProximoBloco(
        indiceCasoAtual: number,
        blocosCasos: llvm.BasicBlock[],
        blocoPadrao: llvm.BasicBlock | null,
        blocoApos: llvm.BasicBlock
    ): llvm.BasicBlock {
        const proximoIndiceCaso = indiceCasoAtual + 1;
        if (proximoIndiceCaso < blocosCasos.length) {
            return blocosCasos[proximoIndiceCaso];
        }
        return blocoPadrao || blocoApos;
    }

    /**
     * Constrói a comparação OR de todas as condições de um caso.
     * Retorna um llvm.Value booleano que é true se qualquer condição for satisfeita.
     */
    protected async construirComparacaoCaso(
        valorEscolha: llvm.Value,
        tipoEscolha: string,
        condicoes: ConstrutoInterface[]
    ): Promise<llvm.Value> {
        let comparacaoFinal: llvm.Value = null;

        for (const condicao of condicoes) {
            const valorCaso: llvm.Value = await condicao.aceitar(this);
            const tipoCaso = this.resolverTipoConstruto(condicao);

            const operandoEscolhaResolvido: OperandoInterface = this.resolverOperando(valorEscolha, tipoEscolha);
            const operandoCasoResolvido: OperandoInterface = this.resolverOperando(valorCaso, tipoCaso);

            const comparacao = await this.resolverIgualdade(operandoEscolhaResolvido, operandoCasoResolvido);

            if (comparacaoFinal === null) {
                comparacaoFinal = comparacao;
            } else {
                comparacaoFinal = this.montador.CreateOr(comparacaoFinal, comparacao, this.NOMES_BLOCOS.CASO_OU);
            }
        }

        return comparacaoFinal;
    }

    /**
     * Cria todos os blocos básicos necessários para a estrutura de escolha.
     */
    protected criarBlocosCasosEscolha(
        declaracao: Escolha,
        funcaoAtual: llvm.Function
    ): {
        blocosCasos: llvm.BasicBlock[];
        blocoPadrao: llvm.BasicBlock | null;
        blocoApos: llvm.BasicBlock;
    } {
        const blocoApos = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.ESCOLHA_APOS, funcaoAtual);

        const blocosCasos: llvm.BasicBlock[] = [];
        for (let indiceCaso = 0; indiceCaso < declaracao.caminhos.length; indiceCaso++) {
            const blocoCaso = llvm.BasicBlock.Create(
                this.contexto,
                `${this.NOMES_BLOCOS.ESCOLHA_CASO}_${indiceCaso}`,
                funcaoAtual
            );
            blocosCasos.push(blocoCaso);
        }

        let blocoPadrao: llvm.BasicBlock | null = null;
        if (declaracao.caminhoPadrao) {
            blocoPadrao = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.ESCOLHA_PADRAO, funcaoAtual);
        }

        return { blocosCasos, blocoPadrao, blocoApos };
    }

    async visitarDeclaracaoDefinicaoFuncao(declaracao: FuncaoDeclaracao): Promise<void> {
        const tipoRetorno = this.obterTipoLlvm(declaracao.funcao.tipo);
        const tiposParametros: llvm.Type[] = [];

        for (const parametro of declaracao.funcao.parametros) {
            const tipoParametroLlvm = this.obterTipoLlvm(parametro.tipoDado);
            tiposParametros.push(tipoParametroLlvm);
        }

        const tipoFuncao = llvm.FunctionType.get(tipoRetorno, tiposParametros, false);

        const objetoLlvmFuncao = llvm.Function.Create(
            tipoFuncao,
            llvm.Function.LinkageTypes.ExternalLinkage,
            declaracao.simbolo.lexema,
            this.modulo
        );

        // Atributos de otimização para funções do usuário.
        objetoLlvmFuncao.addFnAttr(llvm.Attribute.get(this.contexto, llvm.Attribute.AttrKind.NoUnwind));
        objetoLlvmFuncao.addFnAttr(llvm.Attribute.get(this.contexto, llvm.Attribute.AttrKind.WillReturn));

        // Metadados de depuração: cria DISubprogram para esta função.
        const linhaFuncao = (declaracao.simbolo as any).linha ?? 0;
        const hashFuncao = (declaracao.simbolo as any).hashArquivo as number | undefined;
        this.criarSubprogramaDebug(objetoLlvmFuncao, declaracao.simbolo.lexema, linhaFuncao, this.obterArquivoDebugParaHash(hashFuncao));

        const mapaVariaveis: Map<string, VariavelEscopo> = new Map<string, VariavelEscopo>();
        // Aqui temos que iterar de novo os parâmetros da função, dado que a
        // referência aos argumentos da função só estão disponíveis depois que o
        // objeto LLVM da função é criado.
        for (const [indice, parametro] of declaracao.funcao.parametros.entries()) {
            const variavelEscopo = new VariavelEscopo(objetoLlvmFuncao.getArg(indice), undefined, parametro.tipoDado);
            mapaVariaveis.set(parametro.nome.lexema, variavelEscopo);
        }

        // Registra a função no escopo antes de visitar o corpo para permitir recursão.
        const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
        const variavelEscopoObjetoLlvmFuncao = new VariavelEscopo(objetoLlvmFuncao, declaracao);
        topoDaPilha.set(declaracao.simbolo.lexema, variavelEscopoObjetoLlvmFuncao);

        const tipoRetornoAnterior = this.tipoRetornoFuncaoAtual;
        this.tipoRetornoFuncaoAtual = declaracao.funcao.tipo ?? null;

        // Prepara parâmetros para emissão de debug info dentro do corpo da função.
        const parametrosDebugFuncao = this.construtorDebug
            ? declaracao.funcao.parametros.map((parametro, indice) => ({
                  arg: objetoLlvmFuncao.getArg(indice),
                  nome: parametro.nome.lexema,
                  tipo: parametro.tipoDado ?? 'qualquer',
                  argNo: indice + 1,
                  linha: linhaFuncao,
              }))
            : undefined;
        this.pilhaVariaveisEscopo.empilhar(mapaVariaveis);
        await this.visitarCorpoFuncao(declaracao.funcao, objetoLlvmFuncao, parametrosDebugFuncao);
        this.pilhaVariaveisEscopo.removerUltimo();

        this.finalizarSubprogramaDebug();
        this.tipoRetornoFuncaoAtual = tipoRetornoAnterior;
    }

    /**
     * Retorna verdadeiro quando todos os casos de uma escolha contêm exatamente uma
     * condição que é um literal inteiro sem casas decimais. Nesse caso é possível
     * emitir a instrução nativa `switch` do LLVM em vez de uma cadeia de `icmp`.
     */
    protected escolhaPodeUsarSwitchNativo(declaracao: Escolha): boolean {
        const tipoEscolha = this.resolverTipoConstruto(declaracao.identificadorOuLiteral);
        if (!this.tipoEhInteiroDelegua(tipoEscolha)) {
            return false;
        }

        return declaracao.caminhos.every(
            (caso) =>
                caso.condicoes.length === 1 &&
                caso.condicoes[0] instanceof Literal &&
                typeof (caso.condicoes[0] as Literal).valor === 'number' &&
                Number.isInteger((caso.condicoes[0] as Literal).valor)
        );
    }

    /**
     * Processa uma declaração de escolha (switch).
     *
     * Quando o valor discriminado é inteiro e todos os casos são literais inteiros
     * emite a instrução `switch` nativa do LLVM, que o backend transforma em tabela
     * de salto ou árvore de decisão binária — ambas mais eficientes que uma cadeia
     * linear de `icmp` + `cond_br`.
     *
     * Nos demais casos (tipo texto, condições compostas com OR, etc.) mantém a
     * implementação original por cadeia de comparações.
     */
    async visitarDeclaracaoEscolha(declaracao: Escolha): Promise<any> {
        this.definirLocalizacaoDebug(declaracao.linha ?? 0, 0);
        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        const valorEscolhaRaw = await declaracao.identificadorOuLiteral.aceitar(this);
        const valorEscolha = this.carregarValorSeNecessario(
            valorEscolhaRaw,
            declaracao.identificadorOuLiteral.tipo,
            this.NOMES_BLOCOS.LOAD_ESCOLHA
        );

        if (this.escolhaPodeUsarSwitchNativo(declaracao)) {
            // Caminho otimizado: instrução switch nativa do LLVM.
            // O backend a transforma em tabela de salto ou árvore de decisão binária,
            // ambas mais eficientes que a cadeia linear de icmp + cond_br.
            const blocoPadrao = declaracao.caminhoPadrao
                ? llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.ESCOLHA_PADRAO, funcaoAtual)
                : null;
            const blocoApos = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.ESCOLHA_APOS, funcaoAtual);

            const instrucaoSwitch = this.montador.CreateSwitch(
                valorEscolha,
                blocoPadrao ?? blocoApos,
                declaracao.caminhos.length
            );

            for (let i = 0; i < declaracao.caminhos.length; i++) {
                const caso = declaracao.caminhos[i];
                const blocoCorpo = llvm.BasicBlock.Create(
                    this.contexto,
                    `${this.NOMES_BLOCOS.ESCOLHA_CORPO}_${i}`,
                    funcaoAtual
                );
                const valorCaso = ConstantInt.get(
                    this.contexto,
                    new APInt(32, Math.trunc((caso.condicoes[0] as Literal).valor as number))
                );
                instrucaoSwitch.addCase(valorCaso, blocoCorpo);

                this.montador.SetInsertPoint(blocoCorpo);
                await this.processarDeclaracoesBloco(caso.declaracoes);
                if (!this.montador.GetInsertBlock().getTerminator()) {
                    this.montador.CreateBr(blocoApos);
                }
            }

            if (blocoPadrao) {
                this.montador.SetInsertPoint(blocoPadrao);
                await this.processarDeclaracoesBloco(declaracao.caminhoPadrao.declaracoes);
                if (!this.montador.GetInsertBlock().getTerminator()) {
                    this.montador.CreateBr(blocoApos);
                }
            }

            this.montador.SetInsertPoint(blocoApos);
        } else {
            // Caminho geral: cadeia linear de icmp + cond_br.
            // Usado quando o tipo não é inteiro ou há condições compostas (OR).
            const { blocosCasos, blocoPadrao, blocoApos } = this.criarBlocosCasosEscolha(declaracao, funcaoAtual);
            const tipoEscolha = this.resolverTipoConstruto(declaracao.identificadorOuLiteral);

            const blocoInicial = blocosCasos.length > 0 ? blocosCasos[0] : blocoPadrao || blocoApos;
            this.montador.CreateBr(blocoInicial);

            for (let indiceCaso = 0; indiceCaso < declaracao.caminhos.length; indiceCaso++) {
                this.montador.SetInsertPoint(blocosCasos[indiceCaso]);

                const caso = declaracao.caminhos[indiceCaso];
                const comparacaoFinal = await this.construirComparacaoCaso(valorEscolha, tipoEscolha, caso.condicoes);

                const blocoCorpo = llvm.BasicBlock.Create(
                    this.contexto,
                    `${this.NOMES_BLOCOS.ESCOLHA_CORPO}_${indiceCaso}`,
                    funcaoAtual
                );

                const proximoBloco = this.obterProximoBloco(indiceCaso, blocosCasos, blocoPadrao, blocoApos);

                this.montador.CreateCondBr(comparacaoFinal, blocoCorpo, proximoBloco);

                this.montador.SetInsertPoint(blocoCorpo);
                await this.processarDeclaracoesBloco(caso.declaracoes);
                if (!this.montador.GetInsertBlock().getTerminator()) {
                    this.montador.CreateBr(blocoApos);
                }
            }

            if (blocoPadrao) {
                this.montador.SetInsertPoint(blocoPadrao);
                await this.processarDeclaracoesBloco(declaracao.caminhoPadrao.declaracoes);
                if (!this.montador.GetInsertBlock().getTerminator()) {
                    this.montador.CreateBr(blocoApos);
                }
            }

            this.montador.SetInsertPoint(blocoApos);
        }

        return Promise.resolve();
    }

    async visitarDeclaracaoEscreva(declaracao: Escreva): Promise<any> {
        this.definirLocalizacaoDebug(declaracao.simboloEscreva?.linha ?? 0, 0);
        const argumentosResolvidos: llvm.Value[] = [];

        const formatosTexto: string[] = [];

        for (const argumento of declaracao.argumentos) {
            const argumentoResolvido = await argumento.aceitar(this);

            if (argumentoResolvido instanceof VariavelEscopo) {
                const tipoArgumento = argumentoResolvido.tipo || argumento.tipo;
                formatosTexto.push(this.printfFormatos.get(tipoArgumento));
                const tipoLlvm = this.obterTipoLlvm(tipoArgumento);
                let valorCarregado: llvm.Value = this.montador.CreateLoad(
                    tipoLlvm,
                    argumentoResolvido.variavelLlvm,
                    'load_var'
                );
                const formatoArgumento = this.printfFormatos.get(tipoArgumento) || '';
                if (formatoArgumento.includes('%s')) {
                    valorCarregado = this.normalizarOperandoParaTextoSeguro(
                        { valor: valorCarregado, tipo: tipoArgumento || 'texto' },
                        'escreva_var'
                    );
                }
                argumentosResolvidos.push(valorCarregado);
            } else {
                const tipoArgumento = this.resolverTipoConstruto(argumento) || argumento.tipo;
                const formatoArgumento = this.printfFormatos.get(tipoArgumento);
                formatosTexto.push(formatoArgumento);
                if ((formatoArgumento || '').includes('%s')) {
                    argumentosResolvidos.push(
                        this.normalizarOperandoParaTextoSeguro(
                            { valor: argumentoResolvido as llvm.Value, tipo: tipoArgumento || 'texto' },
                            'escreva_val'
                        )
                    );
                } else {
                    argumentosResolvidos.push(argumentoResolvido);
                }
            }
        }

        const formatoResolvido = this.montador.CreateGlobalStringPtr(
            formatosTexto.concat('\n').join(' '), // String formatada ex: "%s %i"
            'fmt',
            0,
            this.modulo
        );

        argumentosResolvidos.unshift(formatoResolvido);

        this.montador.CreateCall(this.funcaoEscreva, argumentosResolvidos);
        return Promise.resolve();
    }

    async visitarDeclaracaoPara(declaracao: Para): Promise<Promise<any> | void> {
        this.definirLocalizacaoDebug(declaracao.condicao.linha ?? 0, 0);
        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        // Detecta contadores garantidamente não-negativos para habilitar flags GEP nuw/nusw.
        const nomesContadoresAdicionados: string[] = [];
        for (const init of [].concat(declaracao.inicializador ?? [])) {
            if (init instanceof Var && init.inicializador instanceof Literal) {
                const valor = (init.inicializador as Literal).valor;
                if (
                    typeof valor === 'number' &&
                    valor >= 0 &&
                    this.incrementoEhPositivo(declaracao.incrementar, init.simbolo.lexema)
                ) {
                    this.contadoresNaoNegativos.add(init.simbolo.lexema);
                    nomesContadoresAdicionados.push(init.simbolo.lexema);
                }
            }
        }

        for (const inicializador of [].concat(declaracao.inicializador)) {
            await inicializador.aceitar(this);
        }

        const blocoCabecaLoop = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.PARA_CABECA, funcaoAtual);
        const blocoCorpoLoop = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.PARA_CORPO, funcaoAtual);
        const blocoIncremento = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.PARA_INCREMENTO, funcaoAtual);
        const blocoAposLoop = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.PARA_APOS, funcaoAtual);

        this.montador.CreateBr(blocoCabecaLoop);
        this.montador.SetInsertPoint(blocoCabecaLoop);

        const condicaoRaw = await declaracao.condicao.aceitar(this);
        const condicao = this.carregarValorSeNecessario(
            condicaoRaw,
            declaracao.condicao.tipo,
            this.NOMES_BLOCOS.LOAD_CONDICAO_PARA
        );

        this.montador.CreateCondBr(condicao, blocoCorpoLoop, blocoAposLoop);

        this.montador.SetInsertPoint(blocoCorpoLoop);
        this.pilhaBlocosLoop.push({ blocoSaida: blocoAposLoop, blocoRetorno: blocoIncremento });
        await this.processarDeclaracoesBloco(declaracao.corpo.declaracoes);
        this.pilhaBlocosLoop.pop();

        this.montador.CreateBr(blocoIncremento);
        this.montador.SetInsertPoint(blocoIncremento);

        if (declaracao.incrementar) {
            await declaracao.incrementar.aceitar(this);
        }

        this.montador.CreateBr(blocoCabecaLoop);
        this.montador.SetInsertPoint(blocoAposLoop);

        // Remove contadores do conjunto ao sair do laço.
        for (const nome of nomesContadoresAdicionados) {
            this.contadoresNaoNegativos.delete(nome);
        }

        return Promise.resolve();
    }

    async visitarDeclaracaoSe(declaracao: Se): Promise<any> {
        this.definirLocalizacaoDebug(declaracao.condicao.linha ?? 0, 0);
        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        const condicaoRaw = await declaracao.condicao.aceitar(this);
        const condicaoCarregada = this.carregarValorSeNecessario(
            condicaoRaw,
            declaracao.condicao.tipo,
            this.NOMES_BLOCOS.LOAD_CONDICAO_SE
        );
        const condicao = this.garantirCondicaoI1(condicaoCarregada);

        const blocoEntao = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.SE_ENTAO, funcaoAtual);
        const blocoApos = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.SE_APOS, funcaoAtual);

        // Cria bloco senão apenas quando há caminho alternativo, evitando blocos vazios.
        const blocoSenao = declaracao.caminhoSenao
            ? llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.SE_SENAO, funcaoAtual, blocoApos)
            : blocoApos;

        this.montador.CreateCondBr(condicao, blocoEntao, blocoSenao);

        this.montador.SetInsertPoint(blocoEntao);
        if (declaracao.caminhoEntao) {
            await declaracao.caminhoEntao.aceitar(this);
        }
        if (!this.montador.GetInsertBlock().getTerminator()) {
            this.montador.CreateBr(blocoApos);
        }

        if (declaracao.caminhoSenao) {
            this.montador.SetInsertPoint(blocoSenao);
            await declaracao.caminhoSenao.aceitar(this);
            if (!this.montador.GetInsertBlock().getTerminator()) {
                this.montador.CreateBr(blocoApos);
            }
        }

        this.montador.SetInsertPoint(blocoApos);
        return Promise.resolve();
    }

    async visitarDeclaracaoVar(declaracao: Var): Promise<any> {
        // Se a variável não tem tipo, o tipo do inicializador deve ser verificado.
        let tipoVariavel = declaracao.tipo;
        if (tipoVariavel === 'qualquer') {
            // 'nulo' não é um tipo útil para travar a variável: uma var `qualquer`
            // inicializada com nulo quase sempre é reatribuída depois a um valor real.
            const tipoInferidoInicializador = this.resolverTipoConstruto(declaracao.inicializador);
            if (tipoInferidoInicializador && tipoInferidoInicializador !== 'nulo') {
                tipoVariavel = tipoInferidoInicializador;
            }
        }
        this.definirLocalizacaoDebug(declaracao.simbolo.linha ?? 0, 0);

        // Importação de módulo: var mod = importar('nome') → armazena sentinela sem alloca.
        if (declaracao.inicializador?.constructor === ImportarComoConstruto) {
            const inicializadorResolvido = declaracao.inicializador as ImportarComoConstruto;
            const sentinela = await inicializadorResolvido.aceitar(this);
            const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
            topoDaPilha.set(
                declaracao.simbolo.lexema,
                sentinela instanceof VariavelEscopo ? sentinela : new VariavelEscopo(null, undefined, 'qualquer')
            );
            return Promise.resolve();
        }

        // Instanciação de classe: var p = Ponto(...)
        if (this.registroClasses.has(tipoVariavel)) {
            const inicializadorResolvido = await declaracao.inicializador.aceitar(this);
            // O inicializador pode ser um CallInst cru (construtor/método) ou um
            // VariavelEscopo (ex.: cópia de outra variável) — em ambos os casos, resolve
            // para o ponteiro direto do objeto (mesma convenção usada em toda leitura de
            // instância de classe: só AllocaInst/GEP precisam de load).
            const objetoPtr =
                inicializadorResolvido instanceof VariavelEscopo
                    ? this.carregarPtrClasseSePreciso(inicializadorResolvido)
                    : (inicializadorResolvido as llvm.Value);
            // Sempre aloca um slot real (em vez de vincular o CallInst diretamente): isso é
            // o que permite reatribuição (`x = outraInstancia`) funcionar depois — sem
            // alloca não há memória para um `store` de reatribuição escrever. Usa o bloco de
            // entrada (não o ponto de inserção atual) para evitar crescimento de pilha sem
            // limite quando a declaração está dentro de um laço.
            const allocaVariavel = this.montador.CreateAlloca(this.montador.getPtrTy(), null, declaracao.simbolo.lexema);
            this.montador.CreateStore(objetoPtr, allocaVariavel);
            const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
            topoDaPilha.set(declaracao.simbolo.lexema, new VariavelEscopo(allocaVariavel, undefined, tipoVariavel));
            return Promise.resolve();
        }

        // Declaração de vetor: var numeros = [1, 2, 3]  ou  var numeros: inteiro[] = [...]
        if (this.tipoEhVetor(tipoVariavel)) {
            // Propaga o tipo declarado para o inicializador, pois o parser pode inferir
            // tipo diferente (ex.: inteiro[] declarado mas inicializador com tipo número[]).
            if (declaracao.inicializador instanceof Vetor) {
                const tipoElementoDeclarado = this.tipoElementoVetor(tipoVariavel);
                (declaracao.inicializador as Vetor).tipo = `${tipoElementoDeclarado}[]`;
            }
            const estruturaVetor = (await declaracao.inicializador.aceitar(this)) as llvm.Value;
            const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
            topoDaPilha.set(declaracao.simbolo.lexema, new VariavelEscopo(estruturaVetor, undefined, tipoVariavel));
            return Promise.resolve();
        }

        const tipoLlvm = this.obterTipoLlvm(tipoVariavel);
        const inicializacaoVariavel = this.montador.CreateAlloca(tipoLlvm, null, declaracao.simbolo.lexema);
        let valorOuReferenciaVariavel = await declaracao.inicializador.aceitar(this);

        if (valorOuReferenciaVariavel instanceof VariavelEscopo) {
            const tipoOrigem =
                valorOuReferenciaVariavel.tipo || this.resolverTipoConstruto(declaracao.inicializador) || tipoVariavel;
            if (this.tipoEhPonteiro(valorOuReferenciaVariavel.variavelLlvm.getType())) {
                const tipoLlvmOrigem = this.obterTipoLlvm(tipoOrigem);
                valorOuReferenciaVariavel = this.montador.CreateLoad(
                    tipoLlvmOrigem,
                    valorOuReferenciaVariavel.variavelLlvm,
                    'load_inicializador_var'
                );
            } else {
                valorOuReferenciaVariavel = valorOuReferenciaVariavel.variavelLlvm;
            }
        } else if (!this.ehValorLlvm(valorOuReferenciaVariavel)) {
            // Dicionários, objetos JS e outros não-LLVM: ponteiro nulo como sentinela.
            valorOuReferenciaVariavel = llvm.Constant.getNullValue(this.montador.getPtrTy()) as unknown as llvm.Value;
        } else if (
            this.tipoEhPonteiro((valorOuReferenciaVariavel as llvm.Value).getType()) &&
            (this.tipoEhInteiroDelegua(tipoVariavel) || tipoVariavel === 'número' || tipoVariavel === 'lógico')
        ) {
            // Valor bruto ptr (ex.: leitura de dicionário via `d["chave"]`) atribuído a uma
            // variável de tipo escalar concreto: desembala com um load do tipo esperado, em
            // vez de armazenar o ponteiro cru num slot de tamanho incompatível.
            valorOuReferenciaVariavel = this.montador.CreateLoad(
                tipoLlvm,
                valorOuReferenciaVariavel as llvm.Value,
                'desembalar_inicializador'
            );
        }

        // Isso aqui é necessario pois delegua entende numero literal sem . como numero
        // Ex: var idade: inteiro = 18
        // O Literal 18 deveria ter tipo inteiro
        // Então precisamos converter para que a verificação de modulo do llvm
        // não reclame.
        const tipoInicializador = this.resolverTipoConstruto(declaracao.inicializador);
        if (tipoVariavel === 'inteiro' && tipoInicializador === 'número') {
            valorOuReferenciaVariavel = this.montador.CreateFPToSI(
                valorOuReferenciaVariavel,
                this.montador.getInt32Ty(),
                'double_para_int'
            );
        } else if (tipoVariavel === 'inteiro' && tipoInicializador === 'longo') {
            valorOuReferenciaVariavel = this.montador.CreateTrunc(
                valorOuReferenciaVariavel,
                this.montador.getInt32Ty(),
                'longo_para_int'
            );
        } else if (tipoVariavel === 'número' && tipoInicializador === 'inteiro') {
            valorOuReferenciaVariavel = this.montador.CreateSIToFP(
                valorOuReferenciaVariavel,
                this.montador.getDoubleTy(),
                'int_para_double'
            );
        } else if (tipoVariavel === 'número' && tipoInicializador === 'longo') {
            valorOuReferenciaVariavel = this.montador.CreateSIToFP(
                valorOuReferenciaVariavel,
                this.montador.getDoubleTy(),
                'longo_para_double'
            );
        } else if (tipoVariavel === 'longo' && tipoInicializador === 'inteiro') {
            valorOuReferenciaVariavel = this.montador.CreateSExt(
                valorOuReferenciaVariavel,
                llvm.Type.getInt64Ty(this.contexto),
                'int_para_longo'
            );
        } else if (tipoVariavel === 'longo' && tipoInicializador === 'número') {
            valorOuReferenciaVariavel = this.montador.CreateFPToSI(
                valorOuReferenciaVariavel,
                llvm.Type.getInt64Ty(this.contexto),
                'double_para_longo'
            );
        }

        this.montador.CreateStore(valorOuReferenciaVariavel, inicializacaoVariavel);
        this.emitirDeclaracaoVariavelDebug(
            inicializacaoVariavel,
            declaracao.simbolo.lexema,
            tipoVariavel,
            (declaracao.simbolo as any).linha ?? 0
        );

        const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
        const variavelEscopo = new VariavelEscopo(inicializacaoVariavel, declaracao, tipoVariavel);
        topoDaPilha.set(declaracao.simbolo.lexema, variavelEscopo);

        return Promise.resolve();
    }

    async visitarExpressaoAgrupamento(expressao: Agrupamento): Promise<any> {
        return await expressao.expressao.aceitar(this);
    }

    resolverTipoConstruto(construto: ConstrutoInterface): string {
        switch (construto.constructor) {
            case Leia:
                return 'texto';
            case Isto:
                try {
                    return this.pilhaVariaveisEscopo.obterValor('isto')?.tipo ?? 'qualquer';
                } catch {
                    return 'qualquer';
                }
            case Chamada: {
                const chamada = construto as Chamada;
                if (chamada.entidadeChamada.constructor === Variavel) {
                    const nomeCallee = (chamada.entidadeChamada as Variavel).simbolo.lexema;
                    if (this.registroClasses.has(nomeCallee)) {
                        return nomeCallee;
                    }
                    // Resolve o tipo de retorno a partir da declaração da função no escopo.
                    try {
                        const varEscopo = this.pilhaVariaveisEscopo.obterValor(nomeCallee);
                        if (varEscopo?.construtoVariavel) {
                            const funcDecl = varEscopo.construtoVariavel as unknown as FuncaoDeclaracao;
                            if (funcDecl.funcao?.tipo) {
                                return funcDecl.funcao.tipo;
                            }
                        }
                    } catch {
                        /* variável não encontrada — segue com tipo do AST */
                    }
                }
                // Chamada de método em instância de classe: objeto.metodo()
                if (
                    chamada.entidadeChamada.constructor === AcessoMetodoOuPropriedade ||
                    chamada.entidadeChamada.constructor === AcessoMetodo
                ) {
                    const acesso = chamada.entidadeChamada as AcessoMetodoOuPropriedade;
                    const acessoNomeavel = acesso as unknown as AcessoNomeavel;
                    const nomeMetodo = acessoNomeavel.simbolo?.lexema ?? acessoNomeavel.nomeMetodo;
                    const tipoObjeto = this.resolverTipoConstruto(acesso.objeto as ConstrutoInterface);
                    if (tipoObjeto && tipoObjeto !== 'qualquer') {
                        const tipoRetorno = this.metodosClasse.get(tipoObjeto)?.get(nomeMetodo);
                        if (tipoRetorno && tipoRetorno !== 'vazio') return tipoRetorno;
                    }
                }
                return chamada.entidadeChamada.tipo;
            }
            case Vetor: {
                const vetor = construto as Vetor;
                let tipoElemento =
                    vetor.tipo ??
                    (vetor.valores?.length > 0 ? this.resolverTipoConstruto(vetor.valores[0]) : 'inteiro');
                // Normaliza 'inteiro[]' → 'inteiro' para produzir 'vetor<inteiro>'.
                if (tipoElemento?.endsWith('[]')) {
                    tipoElemento = tipoElemento.slice(0, -2);
                }
                return `vetor<${tipoElemento}>`;
            }
            case AcessoIndiceVariavel: {
                const acesso = construto as AcessoIndiceVariavel;
                const acessoNomeavel = acesso as unknown as AcessoNomeavel;
                const alvo =
                    acessoNomeavel.entidadeChamada ??
                    acessoNomeavel.entidade ??
                    acessoNomeavel.variavel ??
                    acessoNomeavel.objeto;
                if (alvo?.constructor === Variavel) {
                    try {
                        const varEscopo = this.pilhaVariaveisEscopo.obterValor((alvo as Variavel).simbolo.lexema);
                        if (varEscopo && this.tipoEhVetor(varEscopo.tipo)) {
                            return this.tipoElementoVetor(varEscopo.tipo);
                        }
                    } catch {
                        /* variável não encontrada */
                    }
                } else if (alvo) {
                    // alvo é uma expressão (ex.: isto.simbolos) — infere via AST
                    const tipoAlvo = this.resolverTipoConstruto(alvo as ConstrutoInterface);
                    if (tipoAlvo && this.tipoEhVetor(tipoAlvo)) {
                        return this.tipoElementoVetor(tipoAlvo);
                    }
                }
                return construto.tipo;
            }
            case AcessoPropriedade: {
                const acesso = construto as AcessoPropriedade;
                let tipoObjetoAP: string | null = null;
                if (acesso.objeto?.constructor === Variavel) {
                    const nomeVar = (acesso.objeto as Variavel).simbolo.lexema;
                    try {
                        tipoObjetoAP = this.pilhaVariaveisEscopo.obterValor(nomeVar)?.tipo ?? null;
                    } catch {}
                } else if (acesso.objeto?.constructor?.name === 'Isto') {
                    try {
                        tipoObjetoAP = this.pilhaVariaveisEscopo.obterValor('isto')?.tipo ?? null;
                    } catch {}
                } else if (acesso.objeto) {
                    const t = this.resolverTipoConstruto(acesso.objeto as ConstrutoInterface);
                    if (t && t !== 'qualquer') tipoObjetoAP = t;
                }
                if (tipoObjetoAP) {
                    const tipoProp = this.tiposPropriedades.get(tipoObjetoAP)?.get(acesso.nomePropriedade);
                    if (tipoProp) return tipoProp;
                }
                return construto.tipo ?? 'qualquer';
            }
            case AcessoMetodoOuPropriedade: {
                const acesso = construto as AcessoMetodoOuPropriedade;
                const acessoNomeavel = acesso as unknown as AcessoNomeavel;
                const nomeProp = acessoNomeavel.simbolo?.lexema ?? acessoNomeavel.nomePropriedade;
                let tipoObjetoAMOP: string | null = null;
                if (acesso.objeto?.constructor === Variavel) {
                    const nomeVar = (acesso.objeto as Variavel).simbolo.lexema;
                    try {
                        tipoObjetoAMOP = this.pilhaVariaveisEscopo.obterValor(nomeVar)?.tipo ?? null;
                    } catch {}
                } else if (acesso.objeto?.constructor?.name === 'Isto') {
                    try {
                        tipoObjetoAMOP = this.pilhaVariaveisEscopo.obterValor('isto')?.tipo ?? null;
                    } catch {}
                } else if (acesso.objeto) {
                    const t = this.resolverTipoConstruto(acesso.objeto as ConstrutoInterface);
                    if (t && t !== 'qualquer') tipoObjetoAMOP = t;
                }
                if (tipoObjetoAMOP && nomeProp) {
                    const tipoProp = this.tiposPropriedades.get(tipoObjetoAMOP)?.get(nomeProp);
                    if (tipoProp) return tipoProp;
                }
                return construto.tipo ?? 'qualquer';
            }
            default:
                return construto.tipo;
        }
    }

    protected resolverOperando(operando: llvm.Value | VariavelEscopo, tipo: string): OperandoInterface {
        // VariavelEscopo: carrega o valor da memória se necessário.
        if (operando instanceof VariavelEscopo) {
            const variavelEscopo = operando as VariavelEscopo;
            const tipoVariavel = variavelEscopo.variavelLlvm.getType();

            if (this.tipoEhVetor(tipo)) {
                // Vetores são sempre mantidos/passados por ponteiro — nunca carrega o
                // struct %Vetor por valor. Usado aqui só para comparações de identidade
                // (ex.: `declaracoes == nulo`), não para aritmética.
                return { valor: variavelEscopo.variavelLlvm, tipo };
            }

            if (this.registroClasses.has(tipo)) {
                // Instâncias de classe: o ptr já é o valor final quando vem de uma chamada
                // de construtor/método (CallInst) — só uma variável alocada (AllocaInst)
                // aponta PARA o ponteiro e precisa de load. Mesmo critério de
                // carregarPtrClasseSePreciso, usado aqui para operandos (ex.: `== nulo`).
                const nomeInstClasse = variavelEscopo.variavelLlvm?.constructor?.name;
                if (nomeInstClasse === 'AllocaInst') {
                    const valorCarregado = this.montador.CreateLoad(
                        this.montador.getPtrTy(),
                        variavelEscopo.variavelLlvm,
                        this.NOMES_BLOCOS.LOAD_OPERANDO
                    );
                    return { valor: valorCarregado, tipo };
                }
                return { valor: variavelEscopo.variavelLlvm, tipo };
            }

            if (this.tipoEhPonteiro(tipoVariavel)) {
                const tipoLlvm = this.obterTipoLlvm(tipo);
                const valorCarregado = this.montador.CreateLoad(
                    tipoLlvm,
                    variavelEscopo.variavelLlvm,
                    this.NOMES_BLOCOS.LOAD_OPERANDO
                );
                return {
                    valor: valorCarregado,
                    tipo: tipo,
                };
            }

            return {
                valor: variavelEscopo.variavelLlvm,
                tipo: tipo,
            };
        }

        // Valor LLVM: discrimina pelo tipo via constructor.name pelo mesmo motivo que
        // tipoEhPonteiro — os métodos isXxx() do binding falham com "Illegal invocation"
        // quando chamados em instâncias de subclasses via herança de protótipo Napi.
        //
        // Mapeamento de Type::New() no binding:
        //   isIntegerTy()  → 'IntegerType'
        //   isFunctionTy() → 'FunctionType'
        //   isStructTy()   → 'StructType'
        //   isArrayTy()    → 'ArrayType'
        //   isVectorTy()   → 'VectorType'
        //   isPointerTy()  → 'PointerType'
        //   caso contrário → 'Type'  (double, float, void, …)
        const valorLlvm = operando as llvm.Value;
        const nomeTipoLlvm = valorLlvm.getType()?.constructor?.name;

        if (nomeTipoLlvm === 'IntegerType') {
            // Infere o tipo Delégua a partir da largura do inteiro LLVM.
            const tipoInferido = this.tipoEhInteiroDelegua(tipo) ? tipo : 'inteiro';
            return { valor: valorLlvm, tipo: tipoInferido };
        }

        if (nomeTipoLlvm === 'Type') {
            return { valor: valorLlvm, tipo: 'número' };
        }

        return { valor: valorLlvm, tipo: tipo };
    }

    protected resolverMultiplicacao(
        operandoEsquerdo: OperandoInterface,
        operandoDireito: OperandoInterface
    ): Promise<llvm.Value> {
        if (this.tipoEhInteiroDelegua(operandoEsquerdo.tipo) && this.tipoEhInteiroDelegua(operandoDireito.tipo)) {
            // NSW (No Signed Wrap): overflow é comportamento indefinido em Delégua,
            // o que permite ao SCEV do LLVM 21 analisar e otimizar laços com esses operandos.
            return Promise.resolve(this.montador.CreateNSWMul(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFMul(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverAdicao(
        operandoEsquerdo: OperandoInterface,
        operandoDireito: OperandoInterface
    ): Promise<llvm.Value> {
        if (this.operandoEhPonteiroOuTexto(operandoEsquerdo) || this.operandoEhPonteiroOuTexto(operandoDireito)) {
            const fmtConcatenar = this.montador.CreateGlobalStringPtr('%s%s', 'fmt_concat', 0, this.modulo);
            const esquerdaTextoSeguro = this.normalizarOperandoParaTextoSeguro(operandoEsquerdo, 'concat_esq');
            const direitaTextoSeguro = this.normalizarOperandoParaTextoSeguro(operandoDireito, 'concat_dir');
            return Promise.resolve(
                this.montador.CreateCall(this.funcaoFormatar, [
                    fmtConcatenar,
                    esquerdaTextoSeguro,
                    direitaTextoSeguro,
                ])
            );
        }

        if (this.tipoEhInteiroDelegua(operandoEsquerdo.tipo) && this.tipoEhInteiroDelegua(operandoDireito.tipo)) {
            return Promise.resolve(this.montador.CreateNSWAdd(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFAdd(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverSubtracao(
        operandoEsquerdo: OperandoInterface,
        operandoDireito: OperandoInterface
    ): Promise<llvm.Value> {
        if (this.tipoEhInteiroDelegua(operandoEsquerdo.tipo) && this.tipoEhInteiroDelegua(operandoDireito.tipo)) {
            return Promise.resolve(this.montador.CreateNSWSub(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFSub(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverDivisao(
        operandoEsquerdo: OperandoInterface,
        operandoDireito: OperandoInterface
    ): Promise<llvm.Value> {
        if (this.tipoEhInteiroDelegua(operandoEsquerdo.tipo) && this.tipoEhInteiroDelegua(operandoDireito.tipo)) {
            return Promise.resolve(this.montador.CreateSDiv(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFDiv(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverModulo(
        operandoEsquerdo: OperandoInterface,
        operandoDireito: OperandoInterface
    ): Promise<llvm.Value> {
        if (this.tipoEhInteiroDelegua(operandoEsquerdo.tipo) && this.tipoEhInteiroDelegua(operandoDireito.tipo)) {
            return Promise.resolve(this.montador.CreateSRem(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFRem(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverExponenciacao(
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

        const tipoResultado = this.definirTipoPrevalente(operandoEsquerdo.tipo, operandoDireito.tipo);
        if (this.tipoEhInteiroDelegua(tipoResultado)) {
            return Promise.resolve(
                this.montador.CreateFPToSI(resultado, this.obterTipoLlvm(tipoResultado), 'pot_int')
            );
        }
        return Promise.resolve(resultado);
    }

    protected operandoEhPonteiroOuTexto(operando: OperandoInterface): boolean {
        return operando.tipo === 'texto' || this.tipoEhPonteiro(operando.valor?.getType?.());
    }

    protected obterLiteralTextoSeguro(valor: string, sufixoNome: string): llvm.Value {
        return this.montador.CreateGlobalStringPtr(
            valor,
            `${sufixoNome}_${++this._contadorNomesAnonimos}`,
            0,
            this.modulo
        );
    }

    protected garantirPonteiroTextoNaoNulo(textoPtr: llvm.Value, sufixoNome: string): llvm.Value {
        const nuloPtr = llvm.Constant.getNullValue(this.montador.getPtrTy()) as unknown as llvm.Value;
        const vazio = this.obterLiteralTextoSeguro('', `texto_vazio_${sufixoNome}`);
        const ehNulo = this.montador.CreateICmpEQ(textoPtr, nuloPtr, `texto_nulo_${sufixoNome}`);
        return this.montador.CreateSelect(ehNulo, vazio, textoPtr, `texto_seguro_${sufixoNome}`);
    }

    protected normalizarOperandoParaTextoSeguro(operando: OperandoInterface, sufixoNome: string): llvm.Value {
        if (operando.tipo === 'nulo') {
            return this.obterLiteralTextoSeguro('', `texto_nulo_${sufixoNome}`);
        }

        if (!this.tipoEhPonteiro(operando.valor?.getType?.())) {
            return this.obterLiteralTextoSeguro('<nao-texto>', `texto_nao_texto_${sufixoNome}`);
        }

        if (operando.tipo === 'texto' || operando.tipo === 'qualquer') {
            return this.garantirPonteiroTextoNaoNulo(operando.valor, sufixoNome);
        }

        // Ponteiro não textual (objeto, vetor etc.): evita uso como C-string e crash de %s/strcmp.
        return this.obterLiteralTextoSeguro(`<${operando.tipo || 'ponteiro'}>`, `texto_tipo_${sufixoNome}`);
    }

    protected compararTextos(a: llvm.Value, b: llvm.Value, tipoA: string = 'texto', tipoB: string = 'texto'): llvm.Value {
        const aSeguro = this.normalizarOperandoParaTextoSeguro({ valor: a, tipo: tipoA }, 'cmp_a');
        const bSeguro = this.normalizarOperandoParaTextoSeguro({ valor: b, tipo: tipoB }, 'cmp_b');
        return this.montador.CreateCall(this.funcaoStrcmp, [aSeguro, bSeguro]);
    }

    protected resolverIgualdade(
        operandoEsquerdo: OperandoInterface,
        operandoDireito: OperandoInterface
    ): Promise<llvm.Value> {
        if (this.tipoEhInteiroDelegua(operandoEsquerdo.tipo) && this.tipoEhInteiroDelegua(operandoDireito.tipo)) {
            return Promise.resolve(this.montador.CreateICmpEQ(operandoEsquerdo.valor, operandoDireito.valor));
        }
        // Comparação com nulo: ICmpEQ(ptr, null) em vez de strcmp(ptr, null) que crasharia.
        if (operandoEsquerdo.tipo === 'nulo' || operandoDireito.tipo === 'nulo') {
            return Promise.resolve(this.montador.CreateICmpEQ(operandoEsquerdo.valor, operandoDireito.valor));
        }
        if (this.operandoEhPonteiroOuTexto(operandoEsquerdo) || this.operandoEhPonteiroOuTexto(operandoDireito)) {
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

    protected tipoEhInteiroDelegua(tipo: string): boolean {
        return tipo === 'inteiro' || tipo === 'longo';
    }

    protected definirTipoPrevalente(tipo1: string, tipo2: string) {
        if (tipo1 === 'texto' || tipo2 === 'texto') {
            return 'texto';
        }

        if (tipo1 === 'número' || tipo2 === 'número') {
            return 'número';
        }

        if (tipo1 === 'longo' || tipo2 === 'longo') {
            return 'longo';
        }

        return 'inteiro';
    }

    async visitarExpressaoBinaria(expressao: Binario): Promise<any> {
        this.definirLocalizacaoDebug(expressao.linha ?? 0, 0);
        const promises = await Promise.all([expressao.esquerda.aceitar(this), expressao.direita.aceitar(this)]);

        let operandoEsquerdo: llvm.Value | VariavelEscopo | ConstantFP = promises[0],
            operandoDireito: llvm.Value | VariavelEscopo | ConstantFP = promises[1];

        let tipoEsquerdo = this.resolverTipoConstruto(expressao.esquerda);
        let tipoDireito = this.resolverTipoConstruto(expressao.direita);

        // Quando um operando é inteiro (por tipo AST ou por tipo LLVM real) e o outro
        // é um literal numérico inteiro, trata o literal como inteiro para evitar
        // promoção indevida a double.
        const esquerdoEhInteiro =
            this.tipoEhInteiroDelegua(tipoEsquerdo) ||
            (operandoEsquerdo instanceof VariavelEscopo && this.tipoEhInteiroDelegua(operandoEsquerdo.tipo)) ||
            (!(operandoEsquerdo instanceof VariavelEscopo) &&
                (operandoEsquerdo as llvm.Value).getType?.()?.constructor?.name === 'IntegerType');
        const direitoEhInteiro =
            this.tipoEhInteiroDelegua(tipoDireito) ||
            (operandoDireito instanceof VariavelEscopo && this.tipoEhInteiroDelegua(operandoDireito.tipo)) ||
            (!(operandoDireito instanceof VariavelEscopo) &&
                (operandoDireito as llvm.Value).getType?.()?.constructor?.name === 'IntegerType');

        const direitaEhLiteralInteiro =
            expressao.direita.constructor === Literal &&
            typeof (expressao.direita as Literal).valor === 'number' &&
            Number.isInteger((expressao.direita as Literal).valor);
        const esquerdaEhLiteralInteiro =
            expressao.esquerda.constructor === Literal &&
            typeof (expressao.esquerda as Literal).valor === 'number' &&
            Number.isInteger((expressao.esquerda as Literal).valor);

        if (esquerdoEhInteiro && tipoDireito === 'número' && direitaEhLiteralInteiro) {
            if (!this.tipoEhInteiroDelegua(tipoEsquerdo)) {
                tipoEsquerdo = 'inteiro';
            }
            const bits = tipoEsquerdo === 'longo' ? 64 : 32;
            tipoDireito = tipoEsquerdo === 'longo' ? 'longo' : 'inteiro';
            operandoDireito = ConstantInt.get(
                this.contexto,
                new APInt(bits, (expressao.direita as Literal).valor as number)
            );
        } else if (direitoEhInteiro && tipoEsquerdo === 'número' && esquerdaEhLiteralInteiro) {
            if (!this.tipoEhInteiroDelegua(tipoDireito)) {
                tipoDireito = 'inteiro';
            }
            const bits = tipoDireito === 'longo' ? 64 : 32;
            tipoEsquerdo = tipoDireito === 'longo' ? 'longo' : 'inteiro';
            operandoEsquerdo = ConstantInt.get(
                this.contexto,
                new APInt(bits, (expressao.esquerda as Literal).valor as number)
            );
        }

        const operandoEsquerdoResolvido: OperandoInterface = this.resolverOperando(operandoEsquerdo, tipoEsquerdo);
        const operandoDireitoResolvido: OperandoInterface = this.resolverOperando(operandoDireito, tipoDireito);

        const tipoPrevalente = this.definirTipoPrevalente(
            operandoEsquerdoResolvido.tipo,
            operandoDireitoResolvido.tipo
        );

        if (tipoPrevalente === 'número' && operandoEsquerdoResolvido.tipo !== tipoPrevalente) {
            operandoEsquerdoResolvido.valor = this.montador.CreateSIToFP(
                operandoEsquerdoResolvido.valor,
                llvm.Type.getDoubleTy(this.contexto)
            );
            operandoEsquerdoResolvido.tipo = 'número';
        }

        if (tipoPrevalente === 'número' && operandoDireitoResolvido.tipo !== tipoPrevalente) {
            operandoDireitoResolvido.valor = this.montador.CreateSIToFP(
                operandoDireitoResolvido.valor,
                llvm.Type.getDoubleTy(this.contexto)
            );
            operandoDireitoResolvido.tipo = 'número';
        }

        switch (expressao.operador.tipo) {
            case 'MULTIPLICACAO':
                return this.resolverMultiplicacao(operandoEsquerdoResolvido, operandoDireitoResolvido);
            case 'ADICAO':
                return this.resolverAdicao(operandoEsquerdoResolvido, operandoDireitoResolvido);
            case 'SUBTRACAO':
                return this.resolverSubtracao(operandoEsquerdoResolvido, operandoDireitoResolvido);
            case 'DIVISAO':
                return this.resolverDivisao(operandoEsquerdoResolvido, operandoDireitoResolvido);
            case 'DIVISAO_INTEIRA':
                return Promise.resolve(
                    this.montador.CreateSDiv(
                        (operandoEsquerdo as VariavelEscopo).variavelLlvm,
                        (operandoDireito as VariavelEscopo).variavelLlvm
                    )
                );
            case 'MODULO':
                return this.resolverModulo(operandoEsquerdoResolvido, operandoDireitoResolvido);
            case 'EXPONENCIACAO':
                return this.resolverExponenciacao(operandoEsquerdoResolvido, operandoDireitoResolvido);
            case 'MENOR_MENOR':
                return Promise.resolve(
                    this.montador.CreateShl(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                );
            case 'MAIOR_MAIOR':
                return Promise.resolve(
                    this.montador.CreateAShr(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                );
            case 'BIT_AND':
                return Promise.resolve(
                    this.montador.CreateAnd(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                );
            case 'BIT_OR':
                return Promise.resolve(
                    this.montador.CreateOr(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                );
            case 'BIT_XOR':
                return Promise.resolve(
                    this.montador.CreateXor(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                );
            case 'MENOR':
                if (
                    this.operandoEhPonteiroOuTexto(operandoEsquerdoResolvido) ||
                    this.operandoEhPonteiroOuTexto(operandoDireitoResolvido)
                ) {
                    return Promise.resolve(
                        this.montador.CreateICmpSLT(
                            this.compararTextos(
                                operandoEsquerdoResolvido.valor,
                                operandoDireitoResolvido.valor,
                                operandoEsquerdoResolvido.tipo,
                                operandoDireitoResolvido.tipo
                            ),
                            llvm.ConstantInt.get(this.montador.getInt32Ty(), 0)
                        )
                    );
                } else if (this.tipoEhInteiroDelegua(tipoPrevalente)) {
                    return Promise.resolve(
                        this.montador.CreateICmpSLT(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                    );
                } else {
                    return Promise.resolve(
                        this.montador.CreateFCmpOLT(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                    );
                }
            case 'MENOR_IGUAL':
                if (
                    this.operandoEhPonteiroOuTexto(operandoEsquerdoResolvido) ||
                    this.operandoEhPonteiroOuTexto(operandoDireitoResolvido)
                ) {
                    return Promise.resolve(
                        this.montador.CreateICmpSLE(
                            this.compararTextos(
                                operandoEsquerdoResolvido.valor,
                                operandoDireitoResolvido.valor,
                                operandoEsquerdoResolvido.tipo,
                                operandoDireitoResolvido.tipo
                            ),
                            llvm.ConstantInt.get(this.montador.getInt32Ty(), 0)
                        )
                    );
                } else if (this.tipoEhInteiroDelegua(tipoPrevalente)) {
                    return Promise.resolve(
                        this.montador.CreateICmpSLE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                    );
                } else {
                    return Promise.resolve(
                        this.montador.CreateFCmpOLE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                    );
                }
            case 'MAIOR':
                if (
                    this.operandoEhPonteiroOuTexto(operandoEsquerdoResolvido) ||
                    this.operandoEhPonteiroOuTexto(operandoDireitoResolvido)
                ) {
                    return Promise.resolve(
                        this.montador.CreateICmpSGT(
                            this.compararTextos(
                                operandoEsquerdoResolvido.valor,
                                operandoDireitoResolvido.valor,
                                operandoEsquerdoResolvido.tipo,
                                operandoDireitoResolvido.tipo
                            ),
                            llvm.ConstantInt.get(this.montador.getInt32Ty(), 0)
                        )
                    );
                } else if (this.tipoEhInteiroDelegua(tipoPrevalente)) {
                    return Promise.resolve(
                        this.montador.CreateICmpSGT(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                    );
                } else {
                    return Promise.resolve(
                        this.montador.CreateFCmpOGT(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                    );
                }
            case 'MAIOR_IGUAL':
                if (
                    this.operandoEhPonteiroOuTexto(operandoEsquerdoResolvido) ||
                    this.operandoEhPonteiroOuTexto(operandoDireitoResolvido)
                ) {
                    return Promise.resolve(
                        this.montador.CreateICmpSGE(
                            this.compararTextos(
                                operandoEsquerdoResolvido.valor,
                                operandoDireitoResolvido.valor,
                                operandoEsquerdoResolvido.tipo,
                                operandoDireitoResolvido.tipo
                            ),
                            llvm.ConstantInt.get(this.montador.getInt32Ty(), 0)
                        )
                    );
                } else if (this.tipoEhInteiroDelegua(tipoPrevalente)) {
                    return Promise.resolve(
                        this.montador.CreateICmpSGE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                    );
                } else {
                    return Promise.resolve(
                        this.montador.CreateFCmpOGE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                    );
                }
            case 'IGUAL_IGUAL':
                return this.resolverIgualdade(operandoEsquerdoResolvido, operandoDireitoResolvido);
            case 'DIFERENTE':
                // Comparação com nulo: ICmpNE(ptr, null) em vez de strcmp(ptr, null) que crasharia.
                if (operandoEsquerdoResolvido.tipo === 'nulo' || operandoDireitoResolvido.tipo === 'nulo') {
                    return Promise.resolve(
                        this.montador.CreateICmpNE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                    );
                }
                if (
                    this.operandoEhPonteiroOuTexto(operandoEsquerdoResolvido) ||
                    this.operandoEhPonteiroOuTexto(operandoDireitoResolvido)
                ) {
                    return Promise.resolve(
                        this.montador.CreateICmpNE(
                            this.compararTextos(
                                operandoEsquerdoResolvido.valor,
                                operandoDireitoResolvido.valor,
                                operandoEsquerdoResolvido.tipo,
                                operandoDireitoResolvido.tipo
                            ),
                            llvm.ConstantInt.get(this.montador.getInt32Ty(), 0)
                        )
                    );
                } else if (this.tipoEhInteiroDelegua(tipoPrevalente)) {
                    return Promise.resolve(
                        this.montador.CreateICmpNE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                    );
                } else {
                    return Promise.resolve(
                        this.montador.CreateFCmpONE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor)
                    );
                }
        }
    }

    async visitarExpressaoBloco(declaracao: Bloco): Promise<any> {
        for (const instrucao of declaracao.declaracoes) {
            await instrucao.aceitar(this);
        }
        return Promise.resolve();
    }

    visitarExpressaoComentario(_: ComentarioComoConstruto): Promise<any> | void {
        return Promise.resolve();
    }

    visitarExpressaoContinua(_: Continua): ContinuarQuebra {
        if (this.montador && this.pilhaBlocosLoop.length > 0) {
            const { blocoRetorno } = this.pilhaBlocosLoop[this.pilhaBlocosLoop.length - 1];
            this.montador.CreateBr(blocoRetorno);
            // Cria bloco morto para absorver instruções subsequentes no mesmo bloco (nunca alcançado).
            const funcaoAtual = this.montador.GetInsertBlock().getParent();
            const blocoMorto = llvm.BasicBlock.Create(this.contexto, 'continua_morto', funcaoAtual);
            this.montador.SetInsertPoint(blocoMorto);
        }
        return new ContinuarQuebra();
    }

    protected resolverArgumentoChamada(argumento: ConstrutoInterface, tipoParametro: string) {
        const tipoArgumento = this.resolverTipoConstruto(argumento);
        if (tipoArgumento === tipoParametro) {
            return argumento;
        }

        if (tipoParametro === 'inteiro') {
            if (tipoArgumento === 'número') {
                argumento.tipo = 'inteiro';
                argumento.valor = Math.trunc(argumento.valor);
            } else if (tipoArgumento === 'lógico') {
                argumento.tipo = 'inteiro';
                argumento.valor = argumento.valor ? 1 : 0;
            }
        } else if (tipoParametro === 'longo') {
            if (tipoArgumento === 'número') {
                argumento.tipo = 'longo';
                argumento.valor = Math.trunc(argumento.valor);
            } else if (tipoArgumento === 'inteiro') {
                argumento.tipo = 'longo';
            }
        } else if (tipoParametro === 'número') {
            if (tipoArgumento === 'inteiro' || tipoArgumento === 'longo') {
                argumento.tipo = 'número';
            }
        }

        return argumento;
    }

    protected async instanciarClasse(nomeClasse: string, argumentos: ConstrutoInterface[]): Promise<llvm.Value> {
        const tipoStruct = this.registroClasses.get(nomeClasse);
        // Alocar no montão (heap) para que o objeto sobreviva ao escopo de pilha atual.
        // alloca produzia ponteiro dangling quando armazenado em campo de outra classe.
        const tamanhoStruct = this.maquinaAlvo.createDataLayout().getTypeAllocSize(tipoStruct);
        const tamanhoConst = ConstantInt.get(this.contexto, new APInt(64, tamanhoStruct));
        const objetoAlloc = this.montador.CreateCall(this.funcaoMalloc, [tamanhoConst], `obj_${nomeClasse}`);

        // Estampa o id de identidade em tempo de execução (campo oculto __tipoId, sempre no
        // índice 0) usado por eInstanciaDe.
        const indiceTipoId = this.indicesPropriedades.get(nomeClasse)?.get('__tipoId');
        if (indiceTipoId !== undefined && this.idClasse.has(nomeClasse)) {
            const gepTipoId = this.montador.CreateInBoundsGEP(
                tipoStruct,
                objetoAlloc,
                [ConstantInt.get(this.contexto, new APInt(32, 0)), ConstantInt.get(this.contexto, new APInt(32, indiceTipoId))],
                'tipo_id_ptr'
            );
            this.montador.CreateStore(
                ConstantInt.get(this.contexto, new APInt(32, this.idClasse.get(nomeClasse))),
                gepTipoId
            );
        }

        const funcaoConstrutor = this.modulo.getFunction(`${nomeClasse}_construtor`);
        if (funcaoConstrutor) {
            const args: llvm.Value[] = [objetoAlloc];
            const paramDefsConstrutor = this.parametrosMetodosClasse.get(nomeClasse)?.get('construtor') ?? [];
            const totalParamsConstrutor = funcaoConstrutor.arg_size() - 1;
            for (let i = 0; i < totalParamsConstrutor; i++) {
                const tipoEsperado = funcaoConstrutor.getArg(i + 1).getType();
                let argResolvido: llvm.Value | VariavelEscopo;
                let noArgumento: ConstrutoInterface | undefined;
                if (i < argumentos.length) {
                    noArgumento = argumentos[i];
                    argResolvido = await noArgumento.aceitar(this);
                } else {
                    const paramDef = paramDefsConstrutor[i];
                    if (paramDef?.valorPadrao !== undefined) {
                        noArgumento = paramDef.valorPadrao;
                        argResolvido = await noArgumento.aceitar(this);
                    } else {
                        args.push(llvm.Constant.getNullValue(tipoEsperado) as unknown as llvm.Value);
                        continue;
                    }
                }
                let valor: llvm.Value;
                // Construtores Délégua fazem "load ptr, ptr %arg" para parâmetros texto/lógico/
                // qualquer/dicionário (dupla indireção — passa a alloca/box diretamente). Já
                // parâmetros de instância de classe são sempre ponteiro direto (single
                // indirection), mesma convenção usada em toda leitura de instância de classe.
                const construtorEsperaPtr = this.tipoEhPonteiro(tipoEsperado);
                if (argResolvido instanceof VariavelEscopo) {
                    const llvmValue = argResolvido.variavelLlvm;
                    if (construtorEsperaPtr && this.registroClasses.has(argResolvido.tipo)) {
                        valor = this.carregarPtrClasseSePreciso(argResolvido);
                    } else if (construtorEsperaPtr) {
                        // Parâmetro ptr: passa alloca diretamente; o construtor faz load para obter o valor.
                        valor = llvmValue;
                    } else if (this.tipoEhPonteiro(llvmValue.getType())) {
                        // Parâmetro primitivo: carrega o valor da alloca.
                        const tipoLlvm = this.obterTipoLlvm(argResolvido.tipo ?? 'número');
                        valor = this.montador.CreateLoad(tipoLlvm, llvmValue, 'load_arg_construtor');
                    } else {
                        valor = llvmValue;
                    }
                } else {
                    valor = argResolvido as llvm.Value;
                    const tipoArgBruto = noArgumento ? this.resolverTipoConstruto(noArgumento) : undefined;
                    if (construtorEsperaPtr && tipoArgBruto && this.registroClasses.has(tipoArgBruto)) {
                        // Instância de classe crua (ex.: resultado de método/índice de vetor):
                        // sempre ponteiro direto, nunca embrulhar em alloca extra.
                    } else {
                        const nomeInstanciaValor = valor?.constructor?.name;
                        // GEP e Alloca já apontam para onde o valor está (ptr indireto): passa diretamente.
                        // CallInst, ConstantPointerNull, LoadInst, etc. SÃO o valor (ptr direto):
                        // precisa embrulhar em alloca para o construtor poder fazer load.
                        const valorEhPtrDireto =
                            nomeInstanciaValor !== 'GetElementPtrInst' && nomeInstanciaValor !== 'AllocaInst';
                        if (construtorEsperaPtr && valor && this.tipoEhPonteiro(valor.getType()) && valorEhPtrDireto) {
                            const tmpAlloca = this.criarAllocaNoBlocoEntrada(this.montador.getPtrTy(), 'box_arg_ptr');
                            this.montador.CreateStore(valor, tmpAlloca);
                            valor = tmpAlloca;
                        } else if (valor && this.tipoEhPonteiro(valor.getType()) && !construtorEsperaPtr) {
                            valor = this.montador.CreateLoad(tipoEsperado, valor, 'load_arg_construtor_bruto');
                        }
                    }
                }
                // Conversão de tipos: i32 ↔ double ↔ ptr conforme assinatura do construtor.
                // Usa constructor.name em vez de identidade de objeto (===) porque os
                // wrappers de Type no binding Napi não são singletons garantidos.
                if (!valor) {
                    valor = llvm.Constant.getNullValue(this.montador.getPtrTy()) as unknown as llvm.Value;
                }
                const nomeValor = valor.getType()?.constructor?.name;
                const nomeTipoEsperado = tipoEsperado?.constructor?.name;
                const tipoEsperadoEhDouble = nomeTipoEsperado === 'Type';
                const tipoEsperadoEhInt = nomeTipoEsperado === 'IntegerType';
                const tipoEsperadoEhPtr = nomeTipoEsperado === 'PointerType';
                const tipoValorEhInt = nomeValor === 'IntegerType';
                const tipoValorEhDouble = nomeValor === 'Type';
                if (tipoEsperadoEhInt && tipoValorEhInt) {
                    // i32/i64 têm mesmo constructor.name: usa isIntegerTy(N) para largura.
                    const valorEh64 = valor.getType().isIntegerTy(64);
                    const esperadoEh64 = tipoEsperado.isIntegerTy(64);
                    if (!valorEh64 && esperadoEh64) {
                        valor = this.montador.CreateSExt(valor, tipoEsperado, 'sext_int');
                    } else if (valorEh64 && !esperadoEh64) {
                        valor = this.montador.CreateTrunc(valor, tipoEsperado, 'trunc_int');
                    }
                } else if (nomeValor !== nomeTipoEsperado) {
                    if (tipoEsperadoEhDouble && tipoValorEhInt) {
                        valor = this.montador.CreateSIToFP(valor, this.montador.getDoubleTy(), 'int_para_double');
                    } else if (tipoEsperadoEhInt && tipoValorEhDouble) {
                        valor = this.montador.CreateFPToSI(valor, tipoEsperado, 'double_para_int');
                    } else if (tipoEsperadoEhPtr && (tipoValorEhInt || tipoValorEhDouble)) {
                        // Valor primitivo passado para parâmetro 'qualquer' (ptr): embala em alloca.
                        const tmpAlloca = this.criarAllocaNoBlocoEntrada(valor.getType(), 'box_prim');
                        this.montador.CreateStore(valor, tmpAlloca);
                        valor = tmpAlloca;
                    }
                }
                args.push(valor);
            }
            this.montador.CreateCall(funcaoConstrutor, args);
        }

        return objetoAlloc;
    }

    protected async chamarMetodoInstancia(
        acesso: AcessoMetodo | AcessoMetodoOuPropriedade,
        argumentos: ConstrutoInterface[]
    ): Promise<llvm.Value> {
        const objetoResolvido = await acesso.objeto.aceitar(this);
        let objetoPtr: llvm.Value;
        let nomeClasse: string;

        if (objetoResolvido instanceof VariavelEscopo) {
            objetoPtr = this.carregarPtrClasseSePreciso(objetoResolvido);
            nomeClasse = objetoResolvido.tipo;
        } else {
            objetoPtr = objetoResolvido as llvm.Value;
            const nomeConstrutorObjeto = (acesso.objeto as any)?.constructor?.name;
            if (nomeConstrutorObjeto === 'Variavel' && (acesso.objeto as Variavel).simbolo?.lexema) {
                nomeClasse = this.pilhaVariaveisEscopo.obterValor((acesso.objeto as Variavel).simbolo.lexema)?.tipo;
            }
        }

        // Acesso encadeado (ex.: isto.simbolos.tamanho()): infere tipo a partir do AST.
        if (!nomeClasse) {
            const tipoInferido = this.resolverTipoConstruto(acesso.objeto as ConstrutoInterface);
            if (tipoInferido) nomeClasse = tipoInferido;
        }

        // AcessoMetodo usa .nomeMetodo; AcessoMetodoOuPropriedade usa .simbolo.lexema
        const nomeMetodo = (acesso as AcessoMetodo).nomeMetodo ?? (acesso as AcessoMetodoOuPropriedade).simbolo.lexema;

        // eInstanciaDe(Classe) / éInstânciaDe(Classe): identidade em tempo de execução.
        // O argumento deve ser o nome literal de uma classe conhecida — classes não são
        // valores de primeira classe neste compilador, então resolvemos direto do AST em
        // vez de avaliar como expressão comum.
        if ((nomeMetodo === 'eInstanciaDe' || nomeMetodo === 'éInstânciaDe') && this.registroClasses.has(nomeClasse)) {
            const argAlvo = argumentos[0];
            const nomeClasseAlvo =
                argAlvo?.constructor === Variavel ? (argAlvo as Variavel).simbolo?.lexema : undefined;
            if (!nomeClasseAlvo || !this.registroClasses.has(nomeClasseAlvo)) {
                const erroAlvo = new ErroCompilador(
                    `eInstanciaDe espera o nome de uma classe conhecida como argumento.`
                );
                erroAlvo.linha = acesso.linha;
                throw erroAlvo;
            }

            // Conjunto de ids: a classe-alvo e todas as suas subclasses já declaradas
            // (segue a mesma limitação de ordem de declaração da herança de campos).
            const idsDescendentes: number[] = [];
            for (const [nomeCandidata, idCandidata] of this.idClasse) {
                let atual: string | undefined = nomeCandidata;
                while (atual) {
                    if (atual === nomeClasseAlvo) {
                        idsDescendentes.push(idCandidata);
                        break;
                    }
                    atual = this.superClasses.get(atual);
                }
            }

            const indiceTipoIdReceptor = this.indicesPropriedades.get(nomeClasse)?.get('__tipoId');
            if (indiceTipoIdReceptor === undefined || idsDescendentes.length === 0) {
                return Promise.resolve(ConstantInt.get(this.contexto, new APInt(1, 0)));
            }

            const tipoStructReceptor = this.registroClasses.get(nomeClasse);
            const gepTipoIdReceptor = this.montador.CreateInBoundsGEP(
                tipoStructReceptor,
                objetoPtr,
                [
                    ConstantInt.get(this.contexto, new APInt(32, 0)),
                    ConstantInt.get(this.contexto, new APInt(32, indiceTipoIdReceptor)),
                ],
                'tipo_id_receptor_ptr'
            );
            const idReal = this.montador.CreateLoad(this.montador.getInt32Ty(), gepTipoIdReceptor, 'tipo_id_receptor');

            let resultado: llvm.Value = this.montador.CreateICmpEQ(
                idReal,
                ConstantInt.get(this.contexto, new APInt(32, idsDescendentes[0])),
                'eh_instancia_de'
            );
            for (let i = 1; i < idsDescendentes.length; i++) {
                const cmp = this.montador.CreateICmpEQ(
                    idReal,
                    ConstantInt.get(this.contexto, new APInt(32, idsDescendentes[i])),
                    'eh_instancia_de_or'
                );
                resultado = this.montador.CreateOr(resultado, cmp, 'eh_instancia_de_acc');
            }
            return Promise.resolve(resultado);
        }

        // Métodos embutidos de texto
        if (nomeClasse === 'texto') {
            // chamarMetodoTexto espera ptr* (char**): alloca ou gepPtr.
            // Se objetoPtr for LoadInst/CallInst, já é char* — embrulha em alloca temporária.
            let textoSlot = objetoPtr;
            const nomeTipoObj = objetoPtr?.constructor?.name;
            if (nomeTipoObj === 'LoadInst' || nomeTipoObj === 'CallInst') {
                textoSlot = this.criarAllocaNoBlocoEntrada(this.montador.getPtrTy(), 'texto_slot');
                this.montador.CreateStore(objetoPtr, textoSlot);
            }
            return await this.chamarMetodoTexto(nomeMetodo, textoSlot, argumentos, acesso.linha);
        }

        // Métodos embutidos de vetor
        if (this.tipoEhVetor(nomeClasse)) {
            const tipoElem = this.tipoElementoVetor(nomeClasse);
            return await this.chamarMetodoVetor(nomeMetodo, objetoPtr, tipoElem, argumentos, acesso.linha);
        }

        // Fallback: parâmetro tipado como qualquer, mas o método é de vetor (ex.: qualquer.tamanho())
        if ((!nomeClasse || nomeClasse === 'qualquer') &&
            CompiladorLLVM.METODOS_VETOR_BUILTIN.has(nomeMetodo)) {
            return await this.chamarMetodoVetor(nomeMetodo, objetoPtr, 'qualquer', argumentos, acesso.linha);
        }

        // Despacho de módulo importado:
        //   var mod = importar('nome')         → tipo 'modulo:nome'
        //   importar tudo como mod de 'nome'   → tipo 'modulo:nome'
        if (nomeClasse?.startsWith('modulo:')) {            const nomeModulo = nomeClasse.slice(7);
            const funcoes = this.mapaModulos.get(nomeModulo);
            const entrada = funcoes?.get(nomeMetodo);
            if (!entrada) {
                const erroModulo = new ErroCompilador(`Função '${nomeMetodo}' não encontrada no módulo '${nomeModulo}'.`);
                erroModulo.linha = acesso.linha;
                erroModulo.tamanhoToken = nomeMetodo.length;
                throw erroModulo;
            }
            const args: llvm.Value[] = [];
            for (let i = 0; i < argumentos.length; i++) {
                const tipoPar = entrada.tiposParametros[i] ?? 'qualquer';
                if (tipoPar === 'inteiro') {
                    args.push(await this.carregarArgumentoInteiro(argumentos[i]));
                } else if (tipoPar === 'numero' || tipoPar === 'número') {
                    args.push(await this.carregarArgumentoNumero(argumentos[i]));
                } else if (tipoPar === 'texto') {
                    args.push(await this.carregarArgumentoTexto(argumentos[i]));
                } else {
                    const argResolvido = await argumentos[i].aceitar(this);
                    args.push(
                        argResolvido instanceof VariavelEscopo
                            ? this.registroClasses.has(tipoPar)
                                ? this.carregarPtrClasseSePreciso(argResolvido)
                                : argResolvido.variavelLlvm
                            : (argResolvido as llvm.Value)
                    );
                }
            }
            return this.montador.CreateCall(entrada.callee, args);
        }

        // Despacho de classe estrangeira (@definicao):
        //   LibM.cosseno(x) → tipo 'classeEstrangeira:LibM'
        if (nomeClasse?.startsWith('classeEstrangeira:')) {
            const nomeClasseReal = nomeClasse.slice('classeEstrangeira:'.length);
            const funcoes = this.mapaModulos.get(nomeClasseReal);
            const entrada = funcoes?.get(nomeMetodo);
            if (!entrada) {
                const erroMetodo = new ErroCompilador(`Método '${nomeMetodo}' não encontrado na classe estrangeira '${nomeClasseReal}'.`);
                erroMetodo.linha = acesso.linha;
                erroMetodo.tamanhoToken = nomeMetodo.length;
                throw erroMetodo;
            }
            const argsEstrangeira: llvm.Value[] = [];
            for (let i = 0; i < argumentos.length; i++) {
                const tipoPar = entrada.tiposParametros[i] ?? 'qualquer';
                if (tipoPar === 'inteiro') {
                    argsEstrangeira.push(await this.carregarArgumentoInteiro(argumentos[i]));
                } else if (tipoPar === 'numero' || tipoPar === 'número') {
                    argsEstrangeira.push(await this.carregarArgumentoNumero(argumentos[i]));
                } else if (tipoPar === 'texto') {
                    argsEstrangeira.push(await this.carregarArgumentoTexto(argumentos[i]));
                } else {
                    const argResolvido = await argumentos[i].aceitar(this);
                    argsEstrangeira.push(
                        argResolvido instanceof VariavelEscopo
                            ? this.registroClasses.has(tipoPar)
                                ? this.carregarPtrClasseSePreciso(argResolvido)
                                : argResolvido.variavelLlvm
                            : (argResolvido as llvm.Value)
                    );
                }
            }
            return this.montador.CreateCall(entrada.callee, argsEstrangeira);
        }

        // Procura o método na classe e, se não encontrado, sobe a cadeia de herança.
        let funcaoLlvm = this.modulo.getFunction(`${nomeClasse}_${nomeMetodo}`);
        if (!funcaoLlvm) {
            let nomeSuperAtual = this.superClasses.get(nomeClasse);
            while (nomeSuperAtual && !funcaoLlvm) {
                funcaoLlvm = this.modulo.getFunction(`${nomeSuperAtual}_${nomeMetodo}`);
                nomeSuperAtual = this.superClasses.get(nomeSuperAtual);
            }
        }
        if (!funcaoLlvm && (!nomeClasse || nomeClasse === 'qualquer')) {
            // Fallback para objetos tipados como 'qualquer': busca o método em classes registradas.
            for (const [nomeClasseRegistrada] of this.metodosClasse) {
                const candidata = this.modulo.getFunction(`${nomeClasseRegistrada}_${nomeMetodo}`);
                if (candidata) {
                    funcaoLlvm = candidata;
                    break;
                }
            }
            if (funcaoLlvm) {
                // Para variáveis 'qualquer', variavelLlvm é alloca (ptr-to-ptr): carrega o ptr real.
                const objPtr = this.tipoEhPonteiro(objetoPtr?.getType?.())
                    ? this.montador.CreateLoad(this.montador.getPtrTy(), objetoPtr, 'qualquer_obj')
                    : objetoPtr;
                const argsQualquer: llvm.Value[] = [objPtr];
                for (const argumento of argumentos) {
                    const argResolvido = await argumento.aceitar(this);
                    argsQualquer.push(
                        argResolvido instanceof VariavelEscopo
                            ? argResolvido.variavelLlvm
                            : (argResolvido as llvm.Value)
                    );
                }
                return this.montador.CreateCall(funcaoLlvm, argsQualquer);
            }
        }

        if (!funcaoLlvm) {
            const erroMetodo = new ErroCompilador(`Método '${nomeMetodo}' não encontrado na classe '${nomeClasse}'.`);
            erroMetodo.linha = acesso.linha;
            erroMetodo.tamanhoToken = nomeMetodo.length;
            throw erroMetodo;
        }

        const args: llvm.Value[] = [objetoPtr];
        for (const argumento of argumentos) {
            const argResolvido = await argumento.aceitar(this);
            if (argResolvido instanceof VariavelEscopo) {
                const valVE = argResolvido.variavelLlvm;
                const nomeInstVE = valVE?.constructor?.name;
                if (this.registroClasses.has(argResolvido.tipo)) {
                    // Instâncias de classe são sempre ponteiro direto (single indirection) —
                    // mesma convenção de carregarPtrClasseSePreciso/resolverOperando: só
                    // AllocaInst aponta PARA o ponteiro do objeto (precisa de load antes de
                    // passar); Argument/CallInst/LoadInst/GEP já SÃO o ponteiro do objeto e
                    // nunca devem ser reembrulhados numa alloca extra (isso criaria um
                    // ponteiro-para-ponteiro que o corpo do método, ao fazer acesso a campo,
                    // interpretaria incorretamente como o próprio objeto).
                    const precisaCarregar = nomeInstVE === 'AllocaInst';
                    args.push(
                        precisaCarregar
                            ? this.montador.CreateLoad(this.montador.getPtrTy(), valVE, 'load_obj_arg')
                            : valVE
                    );
                } else {
                    const indiceArgAtual = args.length;
                    const tipoParamEsperado =
                        typeof (funcaoLlvm as any).arg_size === 'function' && indiceArgAtual < funcaoLlvm.arg_size()
                            ? funcaoLlvm.getArg(indiceArgAtual).getType()
                            : undefined;
                    const tipoArgEhEscalarConcreto =
                        this.tipoEhInteiroDelegua(argResolvido.tipo) ||
                        argResolvido.tipo === 'número' ||
                        argResolvido.tipo === 'lógico';
                    if (tipoParamEsperado && this.tipoEhPonteiro(tipoParamEsperado) && tipoArgEhEscalarConcreto) {
                        // Parâmetro do callee espera qualquer/dicionário, mas o argumento é uma
                        // variável escalar concreta local (ex.: `número`): a alloca dela NÃO é
                        // um ponteiro qualquer já boxado — precisa carregar o valor real e
                        // embalar em heap. Parâmetros qualquer seguem a mesma convenção ptr* de
                        // dupla indireção que texto/dicionário (ver embalarValorParaDicionario,
                        // que faz um load antes de reembalar) — por isso a caixa do heap ainda
                        // precisa ser colocada numa alloca temporária antes de passar.
                        const tipoLlvmArg = this.obterTipoLlvm(argResolvido.tipo);
                        const valorCarregado = this.montador.CreateLoad(tipoLlvmArg, valVE, 'load_arg_escalar_ve');
                        const caixaArg = this.embalarValorEmHeap(valorCarregado, tipoLlvmArg);
                        const tmpAllocaCaixa = this.criarAllocaNoBlocoEntrada(this.montador.getPtrTy(), 'arg_ptr_box_qualquer');
                        this.montador.CreateStore(caixaArg, tmpAllocaCaixa);
                        args.push(tmpAllocaCaixa);
                        continue;
                    }

                    // texto/lógico/qualquer/dicionário: convenção ptr* — AllocaInst/GEP/Argument
                    // já são ptr* (apontam PARA o valor) e passam direto; um valor já
                    // materializado (CallInst/LoadInst) precisa ser embrulhado numa alloca
                    // temporária para o callee poder fazer o load.
                    const valVEEhPtrDireto =
                        nomeInstVE !== 'GetElementPtrInst' && nomeInstVE !== 'AllocaInst' && nomeInstVE !== 'Argument';
                    if (valVE && this.tipoEhPonteiro(valVE?.getType?.()) && valVEEhPtrDireto) {
                        const tmpAllocaVE = this.criarAllocaNoBlocoEntrada(this.montador.getPtrTy(), 'arg_ptr_box_ve');
                        this.montador.CreateStore(valVE, tmpAllocaVE);
                        args.push(tmpAllocaVE);
                    } else {
                        args.push(valVE);
                    }
                }
            } else {
                const val = argResolvido as llvm.Value;

                // Parâmetro do callee espera ponteiro (qualquer/dicionário/texto/...) mas o
                // valor bruto é um escalar (ex.: resultado de `a + b`): embala em heap em vez
                // de deixar o CreateCall com tipo de argumento incompatível.
                const indiceArgAtual = args.length;
                const tipoParamEsperado =
                    typeof (funcaoLlvm as any).arg_size === 'function' && indiceArgAtual < funcaoLlvm.arg_size()
                        ? funcaoLlvm.getArg(indiceArgAtual).getType()
                        : undefined;
                if (tipoParamEsperado && this.tipoEhPonteiro(tipoParamEsperado) && val && !this.tipoEhPonteiro(val.getType())) {
                    // Mesma convenção ptr* de dupla indireção do ramo VariavelEscopo acima:
                    // a caixa do heap precisa ir numa alloca temporária antes de passar.
                    const caixaArg = this.embalarValorEmHeap(val, val.getType());
                    const tmpAllocaCaixa = this.criarAllocaNoBlocoEntrada(this.montador.getPtrTy(), 'arg_ptr_box_qualquer');
                    this.montador.CreateStore(caixaArg, tmpAllocaCaixa);
                    args.push(tmpAllocaCaixa);
                    continue;
                }

                // Instância de classe crua (ex.: leitura de vetor de classes via `itens[i]`):
                // sempre ponteiro direto, nunca reembrulhar (mesma convenção do ramo
                // VariavelEscopo acima — ver comentário lá para detalhes).
                const tipoArgBruto = this.resolverTipoConstruto(argumento as ConstrutoInterface);
                if (tipoArgBruto && this.registroClasses.has(tipoArgBruto)) {
                    args.push(val);
                    continue;
                }

                // Délégua usa convenção ptr*: LoadInst/CallInst etc. são ptrs diretos que precisam
                // de alloca para que o callee possa fazer "load ptr, ptr %arg".
                // AllocaInst e GetElementPtrInst já são ptr* — passam direto.
                const nomeInstVal = val?.constructor?.name;
                const valEhPtrDireto = nomeInstVal !== 'GetElementPtrInst' && nomeInstVal !== 'AllocaInst';
                if (val && this.tipoEhPonteiro(val.getType()) && valEhPtrDireto) {
                    const tmpAlloca = this.criarAllocaNoBlocoEntrada(this.montador.getPtrTy(), 'arg_ptr_box');
                    this.montador.CreateStore(val, tmpAlloca);
                    args.push(tmpAlloca);
                } else {
                    args.push(val);
                }
            }
        }

        // Preenche argumentos faltantes com zero/null (ex.: chamada com menos args que a assinatura).
        if (typeof (funcaoLlvm as any).arg_size === 'function') {
            while (args.length < funcaoLlvm.arg_size()) {
                const tipoParam = funcaoLlvm.getArg(args.length).getType();
                args.push(llvm.Constant.getNullValue(tipoParam) as unknown as llvm.Value);
            }
        }

        return this.montador.CreateCall(funcaoLlvm, args);
    }

    protected async chamarMetodoTexto(
        nomeMetodo: string,
        objetoPtr: llvm.Value,
        argumentos: ConstrutoInterface[],
        linha?: number
    ): Promise<llvm.Value> {
        // Carrega o char* real a partir do ponteiro da variável
        const strPtr = this.montador.CreateLoad(this.montador.getPtrTy(), objetoPtr, 'load_texto');

        switch (nomeMetodo) {
            case 'maiusculo':
                return this.montador.CreateCall(this.funcaoTextoMaiusculo, [strPtr]);

            case 'minusculo':
                return this.montador.CreateCall(this.funcaoTextoMinusculo, [strPtr]);

            case 'inclui': {
                const sub = await this.carregarArgumentoTexto(argumentos[0]);
                return this.montador.CreateCall(this.funcaoTextoInclui, [strPtr, sub]);
            }

            case 'subtexto': {
                const inicio = await this.carregarArgumentoInteiro(argumentos[0]);
                const fim = await this.carregarArgumentoInteiro(argumentos[1]);
                return this.montador.CreateCall(this.funcaoTextoSubtexto, [strPtr, inicio, fim]);
            }

            case 'substituir': {
                const de = await this.carregarArgumentoTexto(argumentos[0]);
                const para = await this.carregarArgumentoTexto(argumentos[1]);
                return this.montador.CreateCall(this.funcaoTextoSubstituir, [strPtr, de, para]);
            }

            case 'tamanho': {
                const len64 = this.montador.CreateCall(this.funcaoStrlen, [strPtr], 'strlen_res');
                return this.montador.CreateTrunc(len64, this.montador.getInt32Ty(), 'strlen_i32');
            }

            default: {
                const erroTexto = new ErroCompilador(`Método de texto '${nomeMetodo}' não implementado.`);
                erroTexto.linha = linha;
                erroTexto.tamanhoToken = nomeMetodo.length;
                throw erroTexto;
            }
        }
    }

    // Insere um alloca no bloco de entrada da função corrente, evitando
    // que allocas emitidos dentro de loops consumam stack a cada iteração.
    private criarAllocaNoBlocoEntrada(tipo: llvm.Type, nome: string): llvm.AllocaInst {
        const funcaoAtual = this.montador.GetInsertBlock().getParent();
        const blocoEntrada = funcaoAtual.getEntryBlock();

        // Usa um IRBuilder temporário para não alterar o ponto de inserção de
        // this.montador. SetInsertPoint(BasicBlock) só restauraria o bloco, não
        // o ponto exato dentro dele, o que pode reordenar instruções ou gerar
        // IR inválido quando há terminadores.
        const montadorEntrada = new llvm.IRBuilder(this.contexto);
        const primeiraInstrucao = blocoEntrada.getFirstNonPHI();
        if (primeiraInstrucao) {
            montadorEntrada.SetInsertPoint(primeiraInstrucao);
        } else {
            montadorEntrada.SetInsertPoint(blocoEntrada);
        }

        return montadorEntrada.CreateAlloca(tipo, null, nome);
    }

    // Variáveis locais de classe: alloca(ptr) contendo o ptr real do objeto malloc'd.
    // self dentro de métodos chega como Argument (ptr direto) — não precisa de load.
    protected carregarPtrClasseSePreciso(objVar: VariavelEscopo): llvm.Value {
        const llvmVal = objVar.variavelLlvm;
        if (llvmVal && llvmVal.constructor.name === 'AllocaInst' && this.registroClasses.has(objVar.tipo)) {
            return this.montador.CreateLoad(this.montador.getPtrTy(), llvmVal, 'load_obj_ptr');
        }
        return llvmVal;
    }

    // Carrega o ponteiro de elementos de um vetor, usando cache para evitar loads redundantes.
    protected carregarPonteiroElementosVetor(nomeVetor: string, vetorPtr: llvm.Value): llvm.Value {
        const blocoAtual = this.montador.GetInsertBlock();
        if (this.cacheBlocoAtual !== blocoAtual) {
            this.cachePointerVetor.clear();
            this.cacheBlocoAtual = blocoAtual;
        }
        const cached = this.cachePointerVetor.get(nomeVetor);
        if (cached) return cached;

        const idx0 = ConstantInt.get(this.contexto, new APInt(32, 0));
        const tipoPonteiro = llvm.PointerType.get(this.contexto, 0);
        const gepCampoPtr = this.montador.CreateInBoundsGEP(
            this.tipoEstruturaVetor,
            vetorPtr,
            [idx0, ConstantInt.get(this.contexto, new APInt(32, 0))],
            'ptr_campo_elementos'
        );
        const ptrElementos = this.montador.CreateLoad(tipoPonteiro, gepCampoPtr, 'ptr_elementos');
        this.cachePointerVetor.set(nomeVetor, ptrElementos);
        return ptrElementos;
    }

    // Resolve um valor já sabidamente "em forma de ponteiro" (dicionário, chave texto)
    // para o llvm.Value de ponteiro utilizável diretamente. Um VariavelEscopo cujo
    // variavelLlvm veio de GEP/alloca ainda precisa de um load; um que já veio de um
    // load/chamada (ex.: campo de struct já carregado) é usado como está — mesmo
    // critério usado no caminho de leitura de texto por índice (ehPtrDiretoTexto).
    // Parâmetros (Argument) de dicionário/texto seguem a convenção ptr* de dupla
    // indireção (sempre precisam de um load) — diferente da convenção de instância de
    // classe, que nunca é usada aqui (só dicionário/texto passam por esta função).
    protected resolverPonteiroDireto(resolvido: any): llvm.Value {
        if (resolvido instanceof VariavelEscopo) {
            const valorLlvm = resolvido.variavelLlvm as llvm.Value;
            const nomeInst = valorLlvm?.constructor?.name;
            const ehPtrDireto = nomeInst !== 'GetElementPtrInst' && nomeInst !== 'AllocaInst' && nomeInst !== 'Argument';
            return ehPtrDireto ? valorLlvm : this.montador.CreateLoad(this.montador.getPtrTy(), valorLlvm, 'ptr_direto');
        }
        return resolvido as llvm.Value;
    }

    // Resolve um valor a ser armazenado como valor de dicionário (sempre void*).
    // Ponteiros (qualquer/texto/vetor/instâncias) são usados diretamente; escalares
    // (inteiro/número/lógico/longo) são embalados em uma célula no heap, já que um
    // dicionário sobrevive ao escopo/pilha de onde o valor foi lido.
    protected embalarValorParaDicionario(resolvido: any): llvm.Value {
        if (resolvido instanceof VariavelEscopo) {
            const tipo = resolvido.tipo;
            const ehPonteiro =
                this.tipoEhDicionario(tipo) ||
                tipo === 'texto' ||
                tipo === 'qualquer' ||
                this.tipoEhVetor(tipo) ||
                this.registroClasses.has(tipo);
            if (ehPonteiro) {
                return this.resolverPonteiroDireto(resolvido);
            }
            const tipoLlvmEscalar = this.obterTipoLlvm(tipo);
            const valorCarregado = this.montador.CreateLoad(tipoLlvmEscalar, resolvido.variavelLlvm, 'dict_valor_escalar');
            return this.embalarValorEmHeap(valorCarregado, tipoLlvmEscalar);
        }

        const valorLlvm = resolvido as llvm.Value;
        const nomeTipo = valorLlvm?.getType()?.constructor?.name;
        if (nomeTipo === 'PointerType') {
            return valorLlvm;
        }
        return this.embalarValorEmHeap(valorLlvm, valorLlvm.getType());
    }

    // Aloca uma célula no heap (malloc) do tamanho do tipo dado e armazena o valor nela.
    protected embalarValorEmHeap(valor: llvm.Value, tipo: llvm.Type): llvm.Value {
        const nomeTipo = tipo?.constructor?.name;
        const tamanhoBytes = nomeTipo === 'IntegerType' && tipo.isIntegerTy(32) ? 4 : nomeTipo === 'IntegerType' && tipo.isIntegerTy(1) ? 1 : 8;
        const tamanho = ConstantInt.get(this.contexto, new APInt(64, tamanhoBytes));
        const caixa = this.montador.CreateCall(this.funcaoMalloc, [tamanho], 'dict_caixa');
        this.montador.CreateStore(valor, caixa);
        return caixa;
    }

    protected tamElementoEmBytes(tipoElem: string): number {
        if (tipoElem === 'inteiro') return 4;
        // número, longo, texto (ponteiro 64-bit) → 8 bytes
        return 8;
    }

    // Constante i32 para tamanho de elemento.
    protected constTamElem(tipoElem: string): llvm.Value {
        return ConstantInt.get(this.contexto, new APInt(32, this.tamElementoEmBytes(tipoElem)));
    }

    protected async chamarMetodoVetor(
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
                } else if (this.registroClasses.has(tipoElem)) {
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

            case 'ordenar':
                return this.montador.CreateCall(this.funcaoVetorOrdenar, [vetorPtr, tamElem, ehNumero]);

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
                    return this.montador.CreateCall(this.funcaoVetorIncluiTexto, [vetorPtr, valorBusca]);
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

    // Resolve o ponteiro LLVM de uma função passada como argumento.
    // Se for FuncaoConstruto (lambda), compila-a primeiro.
    // Se for referência a função nomeada, carrega da pilha de escopo.
    protected async resolverPonteiroDeFuncao(
        argumento: ConstrutoInterface,
        tiposParametrosEsperados: string[],
        tipoRetornoEsperado: string
    ): Promise<llvm.Value> {
        const nomeConstruct = argumento.constructor;
        if (nomeConstruct === FuncaoConstruto) {
            return await this.compilarLambda(
                argumento as FuncaoConstruto,
                tiposParametrosEsperados,
                tipoRetornoEsperado
            );
        }
        // Referência a função nomeada ou variável
        const resolvido = await argumento.aceitar(this);
        if (resolvido instanceof VariavelEscopo) {
            return resolvido.variavelLlvm;
        }
        return resolvido as llvm.Value;
    }

    // Compila uma função anônima (FuncaoConstruto) como função LLVM com nome único.
    // Parâmetros sem tipo recebem o tipo esperado de tiposParametrosEsperados.
    // O tipo de retorno esperado é usado para selecionar o tipo LLVM correto.
    protected async compilarLambda(
        construto: FuncaoConstruto,
        tiposParametrosEsperados: string[],
        tipoRetornoEsperado: string
    ): Promise<llvm.Function> {
        const nomeLambda = `__lambda_${this.contadorLambda++}`;

        // Monta tipos dos parâmetros: usa a anotação do parâmetro ou o tipo esperado.
        const tiposParamStr: string[] = construto.parametros.map((p, i) => {
            const tipo =
                p.tipoDado && p.tipoDado !== 'qualquer' ? p.tipoDado : (tiposParametrosEsperados[i] ?? 'número');
            return tipo;
        });
        const tiposParamLlvm = tiposParamStr.map((t) => this.obterTipoLlvm(t));

        // Tipo de retorno: usa o declarado ou o esperado.
        const tipoRetornoStr = construto.tipo && construto.tipo !== 'qualquer' ? construto.tipo : tipoRetornoEsperado;
        const tipoRetornoLlvm = this.obterTipoLlvm(tipoRetornoStr);

        const tipoFuncao = llvm.FunctionType.get(tipoRetornoLlvm, tiposParamLlvm, false);
        const funcaoLlvm = llvm.Function.Create(
            tipoFuncao,
            llvm.Function.LinkageTypes.ExternalLinkage,
            nomeLambda,
            this.modulo
        );

        // Metadados de depuração: cria DISubprogram para este lambda.
        const linhaLambda = construto.linha ?? 0;
        this.criarSubprogramaDebug(funcaoLlvm, nomeLambda, linhaLambda);

        // Escopo: mapeia parâmetros para os argumentos LLVM da função.
        const mapaVariaveis: Map<string, VariavelEscopo> = new Map();
        for (const [i, param] of construto.parametros.entries()) {
            const argLlvm = funcaoLlvm.getArg(i);
            mapaVariaveis.set(param.nome.lexema, new VariavelEscopo(argLlvm, undefined, tiposParamStr[i]));
        }

        // Salva e restaura ponto de inserção e tipo de retorno corrente.
        const blocoAnterior = this.montador.GetInsertBlock();
        const tipoRetornoAnterior = this.tipoRetornoFuncaoAtual;
        this.tipoRetornoFuncaoAtual = tipoRetornoStr;

        this.pilhaVariaveisEscopo.empilhar(mapaVariaveis);
        await this.visitarCorpoFuncao(construto, funcaoLlvm);
        this.pilhaVariaveisEscopo.removerUltimo();

        this.finalizarSubprogramaDebug();
        this.tipoRetornoFuncaoAtual = tipoRetornoAnterior;
        this.montador.SetInsertPoint(blocoAnterior);

        return funcaoLlvm;
    }

    protected async carregarArgumentoTexto(argumento: ConstrutoInterface): Promise<llvm.Value> {
        const resolvido = await argumento.aceitar(this);
        if (resolvido instanceof VariavelEscopo) {
            return this.montador.CreateLoad(this.montador.getPtrTy(), resolvido.variavelLlvm, 'load_arg_texto');
        }
        return resolvido as llvm.Value;
    }

    protected async carregarArgumentoInteiro(argumento: ConstrutoInterface): Promise<llvm.Value> {
        const resolvido = await argumento.aceitar(this);
        let valor: llvm.Value;
        if (resolvido instanceof VariavelEscopo) {
            const tipoLlvm = this.obterTipoLlvm(resolvido.tipo ?? argumento.tipo ?? 'inteiro');
            // Parâmetros escalares chegam por valor (Argument não é ponteiro) — só carrega se
            // variavelLlvm realmente for ponteiro (alloca local).
            valor = this.tipoEhPonteiro(resolvido.variavelLlvm.getType())
                ? this.montador.CreateLoad(tipoLlvm, resolvido.variavelLlvm, 'load_arg_int')
                : resolvido.variavelLlvm;
        } else {
            valor = resolvido as llvm.Value;
        }
        // Converte double → i32 se necessário (literais inteiros chegam como double no Delégua).
        // Usa constructor.name em vez de isDoubleTy() para evitar "Illegal invocation"
        // em subclasses Napi.
        if (valor.getType()?.constructor?.name === 'Type') {
            return this.montador.CreateFPToSI(valor, this.montador.getInt32Ty(), 'double_para_int');
        }
        return valor;
    }

    protected async chamarFuncaoTexto(argumentos: ConstrutoInterface[]): Promise<llvm.Value> {
        const argumento = argumentos[0];
        const resolvido = await argumento.aceitar(this);

        let valor: llvm.Value;
        let tipo: string;

        if (resolvido instanceof VariavelEscopo) {
            tipo = resolvido.tipo ?? argumento.tipo ?? 'número';
            // Parâmetros escalares (inteiro/número/lógico) chegam por valor (Argument não é
            // ponteiro) — só carrega se variavelLlvm realmente for um ponteiro (alloca local
            // ou parâmetro texto/qualquer/dicionário de dupla indireção).
            valor = this.tipoEhPonteiro(resolvido.variavelLlvm.getType())
                ? this.montador.CreateLoad(this.obterTipoLlvm(tipo), resolvido.variavelLlvm, 'load_texto_arg')
                : resolvido.variavelLlvm;
        } else {
            valor = resolvido as llvm.Value;
            tipo = argumento.tipo ?? 'número';
        }

        // Se já é texto, retorna o ponteiro diretamente
        if (tipo === 'texto') {
            return valor;
        }

        // inteiro → texto (usa %d para evitar notação científica)
        if (tipo === 'inteiro') {
            // Literal inteiro sem tipo explícito chega como double do parser do Delégua
            if (tipo !== 'inteiro' || argumento.tipo === 'número') {
                valor = this.montador.CreateFPToSI(valor, this.montador.getInt32Ty(), 'double_para_int_texto');
            }
            return this.montador.CreateCall(this.funcaoTextoDeInteiro, [valor]);
        }

        // número (double) → texto
        // Se a variável era inteiro mas não temos conversão ainda, eleva para double
        if (tipo === 'inteiro') {
            valor = this.montador.CreateSIToFP(valor, this.montador.getDoubleTy(), 'int_para_double_texto');
        }
        return this.montador.CreateCall(this.funcaoTextoDeNumero, [valor]);
    }

    protected async chamarAleatorioEntre(argumentos: ConstrutoInterface[]): Promise<llvm.Value> {
        const a = await this.carregarArgumentoNumero(argumentos[0]);
        const b = await this.carregarArgumentoNumero(argumentos[1]);
        return this.montador.CreateCall(this.funcaoAleatorioEntre, [a, b]);
    }

    protected async chamarMapear(argumentos: ConstrutoInterface[]): Promise<llvm.Value> {
        // mapear(lista, fn)  →  novo vetor com fn aplicada a cada elemento
        const vetorArg = argumentos[0];
        const fnArg = argumentos[1];

        // Resolve o vetor de entrada
        const vetorResolvido = await vetorArg.aceitar(this);
        const vetorPtr: llvm.Value =
            vetorResolvido instanceof VariavelEscopo ? vetorResolvido.variavelLlvm : (vetorResolvido as llvm.Value);

        // Determina o tipo do elemento
        const tipoVetor = vetorArg.tipo ?? this.resolverTipoConstruto(vetorArg);
        const tipoElem = this.tipoElementoVetor(tipoVetor);
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

    protected async chamarEncontrar(argumentos: ConstrutoInterface[]): Promise<llvm.Value> {
        // encontrar(lista, fn) → novo vetor com todos os elementos que satisfazem fn
        const vetorArg = argumentos[0];
        const fnArg = argumentos[1];

        const vetorResolvido = await vetorArg.aceitar(this);
        const vetorPtr: llvm.Value =
            vetorResolvido instanceof VariavelEscopo ? vetorResolvido.variavelLlvm : (vetorResolvido as llvm.Value);

        const tipoVetor = vetorArg.tipo ?? this.resolverTipoConstruto(vetorArg);
        const tipoElem = this.tipoElementoVetor(tipoVetor);

        const fnPtr = await this.resolverPonteiroDeFuncao(fnArg, [tipoElem], 'inteiro');

        const alocSaida = this.criarAllocaNoBlocoEntrada(this.tipoEstruturaVetor, 'encontrado');
        if (tipoElem === 'inteiro') {
            this.montador.CreateCall(this.funcaoVetorFiltrarInteiro, [vetorPtr, fnPtr, alocSaida]);
        } else {
            this.montador.CreateCall(this.funcaoVetorFiltrarNumero, [vetorPtr, fnPtr, alocSaida]);
        }
        return alocSaida;
    }

    protected async carregarArgumentoNumero(argumento: ConstrutoInterface): Promise<llvm.Value> {
        const resolvido = await argumento.aceitar(this);
        let valor: llvm.Value;
        if (resolvido instanceof VariavelEscopo) {
            const tipoLlvm = this.obterTipoLlvm(resolvido.tipo ?? argumento.tipo ?? 'número');
            // Parâmetros escalares chegam por valor (Argument não é ponteiro) — só carrega se
            // variavelLlvm realmente for ponteiro (alloca local).
            valor = this.tipoEhPonteiro(resolvido.variavelLlvm.getType())
                ? this.montador.CreateLoad(tipoLlvm, resolvido.variavelLlvm, 'load_arg_num')
                : resolvido.variavelLlvm;
        } else {
            valor = resolvido as llvm.Value;
        }
        // Converte i32 → double se necessário
        if ((resolvido instanceof VariavelEscopo ? resolvido.tipo : argumento.tipo) === 'inteiro') {
            return this.montador.CreateSIToFP(valor, this.montador.getDoubleTy(), 'int_para_double');
        }
        return valor;
    }

    async visitarExpressaoDeChamada(expressao: Chamada): Promise<any> {
        this.definirLocalizacaoDebug(expressao.linha ?? 0, 0);
        // Instanciação de classe: Ponto(...)
        if (expressao.entidadeChamada.constructor === Variavel) {
            const nomeEntidadeChamada = (expressao.entidadeChamada as Variavel).simbolo.lexema;
            if (this.registroClasses.has(nomeEntidadeChamada)) {
                return await this.instanciarClasse(nomeEntidadeChamada, expressao.argumentos);
            }
            // texto() escolhe a função C com base no tipo do argumento
            if (nomeEntidadeChamada === 'texto') {
                return await this.chamarFuncaoTexto(expressao.argumentos);
            }
            // aleatorioEntre precisa de despacho próprio para carregar variáveis como double
            if (nomeEntidadeChamada === 'aleatorioEntre') {
                return await this.chamarAleatorioEntre(expressao.argumentos);
            }
            // mapear(lista, fn) — função global que mapeia elementos de um vetor
            if (nomeEntidadeChamada === 'mapear') {
                return await this.chamarMapear(expressao.argumentos);
            }
            // encontrar(lista, fn) — retorna todos os elementos que satisfazem o predicado
            if (nomeEntidadeChamada === 'encontrar') {
                return await this.chamarEncontrar(expressao.argumentos);
            }
            if (nomeEntidadeChamada === 'maximo' || nomeEntidadeChamada === 'minimo') {
                const a = await this.carregarArgumentoInteiro(expressao.argumentos[0]);
                const b = await this.carregarArgumentoInteiro(expressao.argumentos[1]);
                const cond =
                    nomeEntidadeChamada === 'maximo'
                        ? this.montador.CreateICmpSGT(a, b, 'cmp_max')
                        : this.montador.CreateICmpSLT(a, b, 'cmp_min');
                return this.montador.CreateSelect(cond, a, b, nomeEntidadeChamada + '_res');
            }
        }

        // Chamada de método: p.distancia() — Delégua usa AcessoMetodoOuPropriedade na maioria dos casos
        if (
            expressao.entidadeChamada.constructor === AcessoMetodo ||
            expressao.entidadeChamada.constructor === AcessoMetodoOuPropriedade
        ) {
            return await this.chamarMetodoInstancia(expressao.entidadeChamada as AcessoMetodo, expressao.argumentos);
        }

        const entidadeChamadaResolvida = await expressao.entidadeChamada.aceitar(this);
        const variavelEscopoCorrespondente = this.pilhaVariaveisEscopo.obterValor(
            (expressao.entidadeChamada as Variavel).simbolo.lexema
        );
        const argumentos: llvm.Value[] = [];

        if (variavelEscopoCorrespondente.construtoVariavel) {
            const construtoCorrespondente = (
                variavelEscopoCorrespondente.construtoVariavel as unknown as FuncaoDeclaracao
            ).funcao;

            const tiposParametros = [];
            for (const parametro of construtoCorrespondente.parametros) {
                tiposParametros.push(parametro.tipoDado);
            }

            for (const [indice, argumento] of expressao.argumentos.entries()) {
                const argumentoAjustado = this.resolverArgumentoChamada(argumento, tiposParametros[indice]);
                let argumentoResolvido = await argumentoAjustado.aceitar(this);
                if (argumentoResolvido instanceof VariavelEscopo) {
                    const tipoParam = tiposParametros[indice] || argumentoResolvido.tipo || 'número';
                    const tipoLlvm = this.obterTipoLlvm(tipoParam);
                    if (this.tipoEhPonteiro(argumentoResolvido.variavelLlvm.getType())) {
                        argumentoResolvido = this.montador.CreateLoad(
                            tipoLlvm,
                            argumentoResolvido.variavelLlvm,
                            'load_arg'
                        );
                    } else {
                        argumentoResolvido = argumentoResolvido.variavelLlvm;
                    }
                }
                argumentos.push(argumentoResolvido);
            }
        } else {
            for (const argumento of expressao.argumentos) {
                const argumentoAjustado = this.resolverArgumentoChamada(argumento, argumento.tipo || 'texto');
                let argumentoResolvido = await argumentoAjustado.aceitar(this);
                if (argumentoResolvido instanceof VariavelEscopo) {
                    const tipoParam = argumentoResolvido.tipo || argumento.tipo || 'número';
                    const tipoLlvm = this.obterTipoLlvm(tipoParam);
                    if (this.tipoEhPonteiro(argumentoResolvido.variavelLlvm.getType())) {
                        argumentoResolvido = this.montador.CreateLoad(
                            tipoLlvm,
                            argumentoResolvido.variavelLlvm,
                            'load_arg'
                        );
                    } else {
                        argumentoResolvido = argumentoResolvido.variavelLlvm;
                    }
                }
                argumentos.push(argumentoResolvido);
            }
        }

        return this.montador.CreateCall(entidadeChamadaResolvida.variavelLlvm, argumentos);
    }

    async visitarExpressaoDeVariavel(expressao: Variavel | Constante): Promise<VariavelEscopo> {
        try {
            return Promise.resolve(this.pilhaVariaveisEscopo.obterValor(expressao.simbolo.lexema));
        } catch {
            // Classes estrangeiras são espaços de nome, não variáveis: retorna sentinela.
            if (this.classesEstrangeiras.has(expressao.simbolo.lexema)) {
                const nulo = llvm.Constant.getNullValue(this.montador.getPtrTy()) as unknown as llvm.Value;
                return Promise.resolve(
                    new VariavelEscopo(nulo, undefined, `classeEstrangeira:${expressao.simbolo.lexema}`)
                );
            }
            const erroVariavel = new ErroCompilador(`Variável '${expressao.simbolo.lexema}' não existe neste escopo.`);
            erroVariavel.linha = expressao.linha;
            erroVariavel.tamanhoToken = expressao.simbolo.lexema.length;
            throw erroVariavel;
        }
    }

    visitarExpressaoLiteral(expressao: Literal): Promise<llvm.Value> {
        switch (expressao.tipo) {
            case 'inteiro':
                return Promise.resolve(ConstantInt.get(this.contexto, new APInt(32, expressao.valor as number)));
            case 'longo':
                return Promise.resolve(ConstantInt.get(this.contexto, new APInt(64, expressao.valor as number)));
            case 'número':
                return Promise.resolve(
                    ConstantFP.get(this.montador.getDoubleTy(), new APFloat(expressao.valor as number))
                );
            case 'lógico':
                return Promise.resolve(ConstantInt.get(this.contexto, new APInt(1, expressao.valor ? 1 : 0)));
            case 'texto': {
                const valor = expressao.valor as string;
                if (valor.includes('${')) {
                    return this.resolverTextoInterpolado(valor);
                }
                return Promise.resolve(this.montador.CreateGlobalStringPtr(valor, 'str', 0, this.modulo));
            }
            case 'nulo':
            case null:
            case undefined:
                return Promise.resolve(
                    llvm.Constant.getNullValue(this.montador.getPtrTy()) as unknown as llvm.Value
                );
            default:
                return Promise.resolve(
                    llvm.Constant.getNullValue(this.montador.getPtrTy()) as unknown as llvm.Value
                );
        }
    }

    protected parsearTemplateString(modelo: string): Array<string | { nomeVar: string }> {
        const partes: Array<string | { nomeVar: string }> = [];
        const regex = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
        let ultimaPos = 0;
        let correspondencia: RegExpExecArray;

        while ((correspondencia = regex.exec(modelo)) !== null) {
            if (correspondencia.index > ultimaPos) {
                partes.push(modelo.slice(ultimaPos, correspondencia.index));
            }
            partes.push({ nomeVar: correspondencia[1] });
            ultimaPos = correspondencia.index + correspondencia[0].length;
        }

        if (ultimaPos < modelo.length) {
            partes.push(modelo.slice(ultimaPos));
        }

        return partes;
    }

    protected async resolverTextoInterpolado(modelo: string): Promise<llvm.Value> {
        const partes = this.parsearTemplateString(modelo);
        const segmentosFormato: string[] = [];
        const argumentos: llvm.Value[] = [];

        for (const parte of partes) {
            if (typeof parte === 'string') {
                // Escapa '%' em trechos estáticos para que não seja interpretado pelo printf
                segmentosFormato.push(parte.replace(/%/g, '%%'));
            } else {
                const varEscopo = this.pilhaVariaveisEscopo.obterValor(parte.nomeVar);
                const tipo = varEscopo.tipo ?? 'número';
                const formato = this.printfFormatos.get(tipo) ?? '%s';
                segmentosFormato.push(formato);

                const tipoLlvm = this.obterTipoLlvm(tipo);
                let valor: llvm.Value = this.montador.CreateLoad(
                    tipoLlvm,
                    varEscopo.variavelLlvm,
                    `load_interp_${parte.nomeVar}`
                );
                if (formato.includes('%s')) {
                    valor = this.normalizarOperandoParaTextoSeguro(
                        { valor, tipo: tipo || 'texto' },
                        `interp_${parte.nomeVar}`
                    );
                }
                argumentos.push(valor);
            }
        }

        const formatoFinal = segmentosFormato.join('');
        const formatoPtr = this.montador.CreateGlobalStringPtr(formatoFinal, 'fmt_interp', 0, this.modulo);

        return this.montador.CreateCall(this.funcaoFormatar, [formatoPtr, ...argumentos]);
    }

    protected buscarFormatoLeia(tipoDelegua: string): llvm.Constant {
        let formatoScanf = this.scanfFormatosCarregados.get(tipoDelegua);

        if (!formatoScanf) {
            const formatoString = this.scanfFormatos.get(tipoDelegua);
            formatoScanf = this.montador.CreateGlobalStringPtr(
                formatoString,
                `formato_leia_${tipoDelegua}`,
                0,
                this.modulo
            );
            this.scanfFormatosCarregados.set(tipoDelegua, formatoScanf);
        }

        return formatoScanf;
    }

    /**
     * Aqui ficam as ideias de implementação encontradas em
     * https://gist.github.com/seven1m/2ca74265cca9ef6f493ef1de87e9252d.
     *
     * Outras ideias que foram testadas, mas não funcionaram muito bem,
     * estão em:
     *
     * - https://gist.github.com/alendit/defe3d518cd8f3f3e28cb46708d4c9d6
     * - https://github.com/numba/numba/blob/c699ef8679316f40af8d0678219fa197522a741f/numba/cgutils.py#L975
     *
     * No entanto, elas podem servir de inspiração para funções futuras.
     */
    protected criarFuncaoNativa(modulosImportados?: Set<string>): void {
        // %Vetor = type { ptr, i32 }  (ponteiro para elementos + tamanho)
        this.tipoEstruturaVetor = llvm.StructType.create(this.contexto, 'Vetor');
        this.tipoEstruturaVetor.setBody([llvm.PointerType.get(this.contexto, 0), this.montador.getInt32Ty()]);

        // int escreva(const char *fmt, ...)
        const tipoRetornoPrinter = this.montador.getInt32Ty();
        const tipoFuncaoPrinter = llvm.FunctionType.get(tipoRetornoPrinter, [this.montador.getPtrTy()], true);

        this.funcaoEscreva = this.modulo.getOrInsertFunction('escreva', tipoFuncaoPrinter);

        // void* leia(const char* texto, const char *fmt)
        const tipoFuncaoLeia = llvm.FunctionType.get(
            this.montador.getPtrTy(),
            [this.montador.getPtrTy(), this.montador.getPtrTy()],
            false
        );

        this.funcaoLeia = this.modulo.getOrInsertFunction('leia', tipoFuncaoLeia);

        // int inteiro(void *valor)
        const tipoFuncaoInteiro = llvm.FunctionType.get(this.montador.getInt32Ty(), [this.montador.getPtrTy()], false);

        this.funcaoInteiro = this.modulo.getOrInsertFunction('inteiro', tipoFuncaoInteiro);

        // double numero(void *valor)
        const tipoFuncaoNumero = llvm.FunctionType.get(this.montador.getDoubleTy(), [this.montador.getPtrTy()], false);

        this.funcaoNumero = this.modulo.getOrInsertFunction('numero', tipoFuncaoNumero);

        // void falhar(const char *msg)
        const tipoFuncaoFalhar = llvm.FunctionType.get(
            llvm.Type.getVoidTy(this.contexto),
            [this.montador.getPtrTy()],
            false
        );

        this.funcaoFalhar = this.modulo.getOrInsertFunction('falhar', tipoFuncaoFalhar);

        // Personality function para suporte a exceções C++ (tente/pegue).
        // Deve ser obtida como llvm.Function pois setPersonalityFn exige esse tipo.
        const tipoPersonalidade = llvm.FunctionType.get(
            this.montador.getInt32Ty(),
            [
                this.montador.getInt32Ty(),
                this.montador.getInt32Ty(),
                llvm.Type.getInt64Ty(this.contexto),
                this.montador.getPtrTy(),
                this.montador.getPtrTy(),
            ],
            false
        );

        this.funcaoPersonalidade = llvm.Function.Create(
            tipoPersonalidade,
            llvm.Function.LinkageTypes.ExternalLinkage,
            '__gxx_personality_v0',
            this.modulo
        );

        const tipoBeginCatch = llvm.FunctionType.get(this.montador.getPtrTy(), [this.montador.getPtrTy()], false);

        this.funcaoBeginCatch = this.modulo.getOrInsertFunction('__cxa_begin_catch', tipoBeginCatch);

        const tipoEndCatch = llvm.FunctionType.get(llvm.Type.getVoidTy(this.contexto), [], false);

        this.funcaoEndCatch = this.modulo.getOrInsertFunction('__cxa_end_catch', tipoEndCatch);

        // char* delegua_texto_maiusculo(const char* s)
        // char* delegua_texto_minusculo(const char* s)
        const tipoFuncaoTextoPtr1 = llvm.FunctionType.get(this.montador.getPtrTy(), [this.montador.getPtrTy()], false);
        this.funcaoTextoMaiusculo = this.modulo.getOrInsertFunction('delegua_texto_maiusculo', tipoFuncaoTextoPtr1);
        this.funcaoTextoMinusculo = this.modulo.getOrInsertFunction('delegua_texto_minusculo', tipoFuncaoTextoPtr1);

        // int delegua_texto_inclui(const char* s, const char* sub)
        const tipoFuncaoTextoInclui = llvm.FunctionType.get(
            this.montador.getInt32Ty(),
            [this.montador.getPtrTy(), this.montador.getPtrTy()],
            false
        );
        this.funcaoTextoInclui = this.modulo.getOrInsertFunction('delegua_texto_inclui', tipoFuncaoTextoInclui);

        // char* delegua_texto_subtexto(const char* s, int inicio, int fim)
        const tipoFuncaoTextoSubtexto = llvm.FunctionType.get(
            this.montador.getPtrTy(),
            [this.montador.getPtrTy(), this.montador.getInt32Ty(), this.montador.getInt32Ty()],
            false
        );
        this.funcaoTextoSubtexto = this.modulo.getOrInsertFunction('delegua_texto_subtexto', tipoFuncaoTextoSubtexto);

        // char* delegua_texto_substituir(const char* s, const char* de, const char* para)
        const tipoFuncaoTextoSubstituir = llvm.FunctionType.get(
            this.montador.getPtrTy(),
            [this.montador.getPtrTy(), this.montador.getPtrTy(), this.montador.getPtrTy()],
            false
        );
        this.funcaoTextoSubstituir = this.modulo.getOrInsertFunction(
            'delegua_texto_substituir',
            tipoFuncaoTextoSubstituir
        );

        // double aleatorio(void)
        const tipoFuncaoAleatorio = llvm.FunctionType.get(this.montador.getDoubleTy(), [], false);
        this.funcaoAleatorio = this.modulo.getOrInsertFunction('aleatorio', tipoFuncaoAleatorio);

        // int aleatorioEntre(double a, double b)
        const tipoFuncaoAleatorioEntre = llvm.FunctionType.get(
            this.montador.getInt32Ty(),
            [this.montador.getDoubleTy(), this.montador.getDoubleTy()],
            false
        );
        this.funcaoAleatorioEntre = this.modulo.getOrInsertFunction('aleatorioEntre', tipoFuncaoAleatorioEntre);

        // char* texto_de_inteiro(int val)
        const tipoFuncaoTextoDeInteiro = llvm.FunctionType.get(
            this.montador.getPtrTy(),
            [this.montador.getInt32Ty()],
            false
        );
        this.funcaoTextoDeInteiro = this.modulo.getOrInsertFunction('texto_de_inteiro', tipoFuncaoTextoDeInteiro);

        // char* texto_de_numero(double val)
        const tipoFuncaoTextoDeNumero = llvm.FunctionType.get(
            this.montador.getPtrTy(),
            [this.montador.getDoubleTy()],
            false
        );
        this.funcaoTextoDeNumero = this.modulo.getOrInsertFunction('texto_de_numero', tipoFuncaoTextoDeNumero);

        // char* delegua_formatar(const char* fmt, ...)  — sprintf alocador para interpolação de texto
        const tipoFuncaoFormatar = llvm.FunctionType.get(
            this.montador.getPtrTy(),
            [this.montador.getPtrTy()],
            true // variadic
        );
        this.funcaoFormatar = this.modulo.getOrInsertFunction('delegua_formatar', tipoFuncaoFormatar);

        // size_t strlen(const char*)
        const tipoFuncaoStrlen = llvm.FunctionType.get(
            llvm.Type.getInt64Ty(this.contexto),
            [this.montador.getPtrTy()],
            false
        );
        this.funcaoStrlen = this.modulo.getOrInsertFunction('strlen', tipoFuncaoStrlen);

        // int strcmp(const char*, const char*)
        const tipoFuncaoStrcmp = llvm.FunctionType.get(
            this.montador.getInt32Ty(),
            [this.montador.getPtrTy(), this.montador.getPtrTy()],
            false
        );
        this.funcaoStrcmp = this.modulo.getOrInsertFunction('strcmp', tipoFuncaoStrcmp);

        // void* malloc(size_t)
        const tipoFuncaoMalloc = llvm.FunctionType.get(
            this.montador.getPtrTy(),
            [llvm.Type.getInt64Ty(this.contexto)],
            false
        );
        this.funcaoMalloc = this.modulo.getOrInsertFunction('malloc', tipoFuncaoMalloc);

        // int delegua_vetor_adicionar(Vetor* v, void* elem, int tam_elem)
        const tipoFuncaoVetorAdicionar = llvm.FunctionType.get(
            this.montador.getInt32Ty(),
            [this.montador.getPtrTy(), this.montador.getPtrTy(), this.montador.getInt32Ty()],
            false
        );
        this.funcaoVetorAdicionar = this.modulo.getOrInsertFunction(
            'delegua_vetor_adicionar',
            tipoFuncaoVetorAdicionar
        );

        // int delegua_vetor_remover_ultimo(Vetor* v)
        const tipoFuncaoVetorRemoverUltimo = llvm.FunctionType.get(
            this.montador.getInt32Ty(),
            [this.montador.getPtrTy()],
            false
        );
        this.funcaoVetorRemoverUltimo = this.modulo.getOrInsertFunction(
            'delegua_vetor_remover_ultimo',
            tipoFuncaoVetorRemoverUltimo
        );

        // int delegua_vetor_tamanho(Vetor* v)
        const tipoFuncaoVetorTamanho = llvm.FunctionType.get(
            this.montador.getInt32Ty(),
            [this.montador.getPtrTy()],
            false
        );
        this.funcaoVetorTamanho = this.modulo.getOrInsertFunction('delegua_vetor_tamanho', tipoFuncaoVetorTamanho);

        // int delegua_vetor_inclui_texto(Vetor* v, const char* s)
        const tipoFuncaoVetorIncluiTexto = llvm.FunctionType.get(
            this.montador.getInt32Ty(),
            [this.montador.getPtrTy(), this.montador.getPtrTy()],
            false
        );
        this.funcaoVetorIncluiTexto = this.modulo.getOrInsertFunction(
            'delegua_vetor_inclui_texto',
            tipoFuncaoVetorIncluiTexto
        );

        // Dicionario* delegua_dicionario_criar(void)
        const tipoFuncaoDicionarioCriar = llvm.FunctionType.get(this.montador.getPtrTy(), [], false);
        this.funcaoDicionarioCriar = this.modulo.getOrInsertFunction(
            'delegua_dicionario_criar',
            tipoFuncaoDicionarioCriar
        );

        // void delegua_dicionario_definir(Dicionario* d, const char* chave, void* valor)
        const tipoFuncaoDicionarioDefinir = llvm.FunctionType.get(
            llvm.Type.getVoidTy(this.contexto),
            [this.montador.getPtrTy(), this.montador.getPtrTy(), this.montador.getPtrTy()],
            false
        );
        this.funcaoDicionarioDefinir = this.modulo.getOrInsertFunction(
            'delegua_dicionario_definir',
            tipoFuncaoDicionarioDefinir
        );

        // void* delegua_dicionario_obter(Dicionario* d, const char* chave)
        const tipoFuncaoDicionarioObter = llvm.FunctionType.get(
            this.montador.getPtrTy(),
            [this.montador.getPtrTy(), this.montador.getPtrTy()],
            false
        );
        this.funcaoDicionarioObter = this.modulo.getOrInsertFunction(
            'delegua_dicionario_obter',
            tipoFuncaoDicionarioObter
        );

        // int delegua_dicionario_contem(Dicionario* d, const char* chave)
        const tipoFuncaoDicionarioContem = llvm.FunctionType.get(
            this.montador.getInt32Ty(),
            [this.montador.getPtrTy(), this.montador.getPtrTy()],
            false
        );
        this.funcaoDicionarioContem = this.modulo.getOrInsertFunction(
            'delegua_dicionario_contem',
            tipoFuncaoDicionarioContem
        );

        // int delegua_dicionario_tamanho(Dicionario* d)
        const tipoFuncaoDicionarioTamanho = llvm.FunctionType.get(
            this.montador.getInt32Ty(),
            [this.montador.getPtrTy()],
            false
        );
        this.funcaoDicionarioTamanho = this.modulo.getOrInsertFunction(
            'delegua_dicionario_tamanho',
            tipoFuncaoDicionarioTamanho
        );

        // double pow(double base, double expoente) — libm/ucrt, usado pelo operador **.
        const tipoFuncaoPotencia = llvm.FunctionType.get(
            this.montador.getDoubleTy(),
            [this.montador.getDoubleTy(), this.montador.getDoubleTy()],
            false
        );
        this.funcaoPotencia = this.modulo.getOrInsertFunction('pow', tipoFuncaoPotencia);

        // int delegua_vetor_remover_primeiro(Vetor* v, int tam_elem)
        const tipoFuncaoVetorRemoverPrimeiro = llvm.FunctionType.get(
            this.montador.getInt32Ty(),
            [this.montador.getPtrTy(), this.montador.getInt32Ty()],
            false
        );
        this.funcaoVetorRemoverPrimeiro = this.modulo.getOrInsertFunction(
            'delegua_vetor_remover_primeiro',
            tipoFuncaoVetorRemoverPrimeiro
        );

        // void delegua_vetor_inverter(Vetor* v, int tam_elem)
        const tipoFuncaoVetorInverter = llvm.FunctionType.get(
            llvm.Type.getVoidTy(this.contexto),
            [this.montador.getPtrTy(), this.montador.getInt32Ty()],
            false
        );
        this.funcaoVetorInverter = this.modulo.getOrInsertFunction('delegua_vetor_inverter', tipoFuncaoVetorInverter);

        // void delegua_vetor_ordenar(Vetor* v, int tam_elem, int eh_numero)
        const tipoFuncaoVetorOrdenar = llvm.FunctionType.get(
            llvm.Type.getVoidTy(this.contexto),
            [this.montador.getPtrTy(), this.montador.getInt32Ty(), this.montador.getInt32Ty()],
            false
        );
        this.funcaoVetorOrdenar = this.modulo.getOrInsertFunction('delegua_vetor_ordenar', tipoFuncaoVetorOrdenar);

        // void delegua_vetor_fatiar(Vetor* v, int inicio, int fim, int tam_elem, Vetor* saida)
        const tipoFuncaoVetorFatiar = llvm.FunctionType.get(
            llvm.Type.getVoidTy(this.contexto),
            [
                this.montador.getPtrTy(),
                this.montador.getInt32Ty(),
                this.montador.getInt32Ty(),
                this.montador.getInt32Ty(),
                this.montador.getPtrTy(),
            ],
            false
        );
        this.funcaoVetorFatiar = this.modulo.getOrInsertFunction('delegua_vetor_fatiar', tipoFuncaoVetorFatiar);

        // char* delegua_vetor_juntar_inteiro(Vetor* v, const char* sep)
        // char* delegua_vetor_juntar_numero(Vetor* v, const char* sep)
        // char* delegua_vetor_juntar_texto(Vetor* v, const char* sep)
        const tipoFuncaoVetorJuntar = llvm.FunctionType.get(
            this.montador.getPtrTy(),
            [this.montador.getPtrTy(), this.montador.getPtrTy()],
            false
        );
        this.funcaoVetorJuntarInteiro = this.modulo.getOrInsertFunction(
            'delegua_vetor_juntar_inteiro',
            tipoFuncaoVetorJuntar
        );
        this.funcaoVetorJuntarNumero = this.modulo.getOrInsertFunction(
            'delegua_vetor_juntar_numero',
            tipoFuncaoVetorJuntar
        );
        this.funcaoVetorJuntarTexto = this.modulo.getOrInsertFunction(
            'delegua_vetor_juntar_texto',
            tipoFuncaoVetorJuntar
        );

        // void delegua_vetor_filtrar_inteiro(Vetor* v, ptr fn, Vetor* saida)
        // void delegua_vetor_filtrar_numero (Vetor* v, ptr fn, Vetor* saida)
        // void delegua_vetor_mapear_inteiro (Vetor* v, ptr fn, Vetor* saida)
        // void delegua_vetor_mapear_numero  (Vetor* v, ptr fn, Vetor* saida)
        // Todos recebem (ptr, ptr, ptr) → void  — o ponteiro de função é opaco no IR.
        const tipoFuncaoVetorCallback = llvm.FunctionType.get(
            llvm.Type.getVoidTy(this.contexto),
            [this.montador.getPtrTy(), this.montador.getPtrTy(), this.montador.getPtrTy()],
            false
        );
        this.funcaoVetorFiltrarInteiro = this.modulo.getOrInsertFunction(
            'delegua_vetor_filtrar_inteiro',
            tipoFuncaoVetorCallback
        );
        this.funcaoVetorFiltrarNumero = this.modulo.getOrInsertFunction(
            'delegua_vetor_filtrar_numero',
            tipoFuncaoVetorCallback
        );
        this.funcaoVetorMapearInteiro = this.modulo.getOrInsertFunction(
            'delegua_vetor_mapear_inteiro',
            tipoFuncaoVetorCallback
        );
        this.funcaoVetorMapearNumero = this.modulo.getOrInsertFunction(
            'delegua_vetor_mapear_numero',
            tipoFuncaoVetorCallback
        );
        this.funcaoVetorMapearTexto = this.modulo.getOrInsertFunction(
            'delegua_vetor_mapear_texto',
            tipoFuncaoVetorCallback
        );

        // Registra apenas os módulos efetivamente importados no código.
        const registros: Map<string, () => void> = new Map([
            ['matematica', () => this.registrarModuloMatematica()],
            ['fisica', () => this.registrarModuloFisica()],
            ['estatistica', () => this.registrarModuloEstatistica()],
            ['arquivos', () => this.registrarModuloArquivos()],
            ['csv', () => this.registrarModuloCsv()],
            ['json', () => this.registrarModuloJson()],
            ['http', () => this.registrarModuloHttp()],
            ['criptografia', () => this.registrarModuloCriptografia()],
            ['dados', () => this.registrarModuloDados()],
        ]);

        if (modulosImportados) {
            for (const modulo of modulosImportados) {
                registros.get(modulo)?.();
            }
        } else {
            // Fallback: registra todos (comportamento anterior).
            for (const registrar of registros.values()) {
                registrar();
            }
        }
    }

    /**
     * Delégua por definição não possui um ponto de entrada, ou seja, uma função `main()`, mas
     * LLVM, ao passar pelo CMake, requer este ponto de entrada, que é criado automaticamente.
     * @returns Sempre retorna `void`.
     */
    protected async criarPontoEntrada(declaracoes: Declaracao[]): Promise<void> {
        const tipoRetorno = this.montador.getInt32Ty();
        const tipoFuncao = llvm.FunctionType.get(tipoRetorno, [], false);
        const funcaoInicio = llvm.Function.Create(
            tipoFuncao,
            llvm.Function.LinkageTypes.ExternalLinkage,
            'main',
            this.modulo
        );

        const blocoEscopo = llvm.BasicBlock.Create(this.contexto, 'entry', funcaoInicio);
        this.montador.SetInsertPoint(blocoEscopo);

        this.criarSubprogramaDebug(funcaoInicio, 'main', 1);

        for (const declaracao of declaracoes) {
            await declaracao.aceitar(this);
        }

        this.finalizarSubprogramaDebug();

        // Define a personality function apenas se o código contém blocos tente/pegue,
        // pois sua presença incondicional inibe inlining e otimizações de tail-call.
        if (this.contemExcecoes) {
            funcaoInicio.setPersonalityFn(this.funcaoPersonalidade);
        }

        this.montador.CreateRet(ConstantInt.get(this.contexto, new APInt(32, 0)));

        if (llvm.verifyFunction(funcaoInicio)) {
            console.error('Falha ao verificar função de início.');
            return;
        }
    }

    /**
     * O ponto de entrada deste compilador.
     * @param codigo O código em Delégua.
     * @param otimizar Quando verdadeiro, roda passes de otimização LLVM no IR (SROA, CSE, instcombine).
     * @returns A representação intermediária do código em LLVM.
     */
    async compilar(
        codigo: string[],
        otimizar: boolean = false,
        diretorioBase?: string,
        nomeArquivoFonte?: string,
        diretorioArquivoFonte?: string,
        emitirDebug: boolean = false
    ): Promise<string> {
        this.pilhaVariaveisEscopo = new PilhaVariaveisEscopo();
        this.registroClasses = new Map();
        this.indicesPropriedades = new Map();
        this.tiposPropriedades = new Map();
        this.metodosClasse = new Map();
        this.parametrosMetodosClasse = new Map();
        this.superClasses = new Map();
        this.idClasse = new Map();
        this.proximoIdClasse = 0;
        this.mapaModulos = new Map();
        this.bibliotecasEstrangeiras = new Set();
        this.classesEstrangeiras = new Set();
        this.pilhaIsto = [];
        this.classesComMarcadorTipo = new Set();
        const mapaVariaveis: Map<string, VariavelEscopo> = new Map<string, VariavelEscopo>();
        this.pilhaVariaveisEscopo.empilhar(mapaVariaveis);

        this.contexto = new llvm.LLVMContext();
        this.modulo = new llvm.Module('demo', this.contexto);
        this.montador = new llvm.IRBuilder(this.contexto);

        // Define target triple e data layout para a plataforma nativa.
        llvm.InitializeNativeTarget();
        llvm.InitializeNativeTargetAsmPrinter();
        const triploAlvo = llvm.config.LLVM_DEFAULT_TARGET_TRIPLE;
        this.modulo.setTargetTriple(triploAlvo);
        const alvo = llvm.TargetRegistry.lookupTarget(triploAlvo);
        this.maquinaAlvo = alvo.createTargetMachine(triploAlvo, 'generic', '');
        this.modulo.setDataLayout(this.maquinaAlvo.createDataLayout());

        this.tipoEstruturaVetor = null;
        this.contemExcecoes = false;
        this.contadorLambda = 0;
        this.cachePointerVetor = new Map();
        this.tipoRetornoFuncaoAtual = null;
        this.pilhaSubprogramas = [];

        // Inicializa metadados DWARF quando a emissão de debug foi solicitada.
        this.construtorDebug = null;
        this.arquivoDebug = null;
        this.unidadeCompilacaoDebug = null;
        if (emitirDebug && nomeArquivoFonte) {
            this.construtorDebug = new llvm.DIBuilder(this.modulo);
            const dirEntradaNorm = (diretorioArquivoFonte ?? '.').replace(/\\/g, '/');
            this.arquivoDebug = this.construtorDebug.createFile(
                nomeArquivoFonte,
                dirEntradaNorm
            );
            // Hash -1 é usado pelo lexador para o arquivo de entrada principal.
            const caminhoEntrada = diretorioArquivoFonte
                ? `${dirEntradaNorm}/${nomeArquivoFonte}`
                : nomeArquivoFonte;
            this.mapaHashParaCaminho.set(-1, caminhoEntrada);
            this.cacheArquivosDebug.set(-1, this.arquivoDebug);
            this.unidadeCompilacaoDebug = this.construtorDebug.createCompileUnit(
                llvm.dwarf.SourceLanguage.DW_LANG_C,
                this.arquivoDebug,
                'delegua-llvm',
                otimizar,
                '',
                0
            );
            this.modulo.addModuleFlag(
                llvm.Module.ModFlagBehavior.Warning,
                'Debug Info Version',
                llvm.LLVMConstants.DEBUG_METADATA_VERSION
            );
        }

        const avaliadorSintaticoComTipagem = this.avaliadorSintatico as unknown as AvaliadorSintaticoComTipagem;
        if (!avaliadorSintaticoComTipagem.tiposDefinidosPorBibliotecas) {
            avaliadorSintaticoComTipagem.tiposDefinidosPorBibliotecas = {};
        }

        if (!avaliadorSintaticoComTipagem.__ajusteInferenciaMembroAplicado) {
            const inferenciaOriginal =
                avaliadorSintaticoComTipagem.logicaComumInferenciaTiposAcessoMetodoOuPropriedade?.bind(
                    avaliadorSintaticoComTipagem
                );
            if (inferenciaOriginal) {
                avaliadorSintaticoComTipagem.logicaComumInferenciaTiposAcessoMetodoOuPropriedade = (
                    entidadeChamada: any
                ) => {
                    try {
                        return inferenciaOriginal(entidadeChamada);
                    } catch (erro) {
                        const nomeTipoObjeto = entidadeChamada?.objeto?.tipo;
                        if (typeof nomeTipoObjeto === 'string' && nomeTipoObjeto.match(/^[A-Z]/)) {
                            return 'qualquer';
                        }

                        throw erro;
                    }
                };
            }

            avaliadorSintaticoComTipagem.__ajusteInferenciaMembroAplicado = true;
        }

        // Resolve importações de arquivo (.delegua) parseando cada arquivo independentemente
        // com um AvaliadorSintatico próprio (sem inferência de tipos cruzada entre arquivos).
        let declaracoesImportadas: Declaracao[] = [];
        let codigoPrincipal = codigo;
        const avaliadorComTipagem = this.avaliadorSintatico as unknown as AvaliadorSintaticoComTipagem;

        this.mapaHashParaCaminho = new Map();
        this.cacheArquivosDebug = new Map();

        if (diretorioBase) {
            const registroClasses: { [nome: string]: Declaracao } = {};
            const resultadoImportacoes = await resolverEMesclarDeclaracoes(
                codigo,
                diretorioBase,
                new Set(),
                registroClasses
            );
            declaracoesImportadas = resultadoImportacoes.declaracoes;
            this.mapaHashParaCaminho = resultadoImportacoes.mapaHash;

            // analisar() reseta tiposDefinidosEmCodigo logo de início; envolve
            // inicializarPilhaEscopos (chamada depois do reset, antes do loop de parse)
            // para injetar as classes importadas no momento certo.
            const inicializarOriginal = avaliadorComTipagem.inicializarPilhaEscopos?.bind(avaliadorComTipagem);
            if (inicializarOriginal) {
                avaliadorComTipagem.inicializarPilhaEscopos = () => {
                    inicializarOriginal();
                    Object.assign(avaliadorComTipagem.tiposDefinidosEmCodigo, registroClasses);
                };
            }

            // Remove linhas de importação de arquivo do código principal — já foram resolvidas.
            codigoPrincipal = codigo.map((l) => (ehImportacaoArquivo(l) ? '' : l));
        }

        const resultadoLexador = this.lexador.mapear(codigoPrincipal, -1);
        const resultadoAvaliadorSintatico = await this.avaliadorSintatico.analisar(resultadoLexador, -1);

        // Restaura inicializarPilhaEscopos para não afetar chamadas subsequentes.
        if (diretorioBase) {
            delete avaliadorComTipagem.inicializarPilhaEscopos;
        }

        if (resultadoAvaliadorSintatico.erros.length > 0) {
            const primeiroErro = resultadoAvaliadorSintatico.erros[0];
            const erroSintatico = new ErroCompilador(
                `Erro sintático: ${primeiroErro.message ?? JSON.stringify(resultadoAvaliadorSintatico.erros)}`
            );
            erroSintatico.linha = primeiroErro.simbolo?.linha ?? primeiroErro.linha;
            erroSintatico.coluna = primeiroErro.simbolo?.colunaInicio;
            throw erroSintatico;
        }

        const todasDeclaracoes: Declaracao[] = [...declaracoesImportadas, ...resultadoAvaliadorSintatico.declaracoes];

        // Detecta módulos importados para registrar apenas as funções necessárias.
        const modulosImportados = new Set<string>();
        const regexImportar = /importar\s*\(\s*['"](\w+)['"]\s*\)/;
        const regexDe = /importar\s+.*\s+de\s+['"](\w+)['"]/;
        for (const linha of codigo) {
            const match = regexImportar.exec(linha) || regexDe.exec(linha);
            if (match) modulosImportados.add(match[1]);
        }

        this.criarFuncaoNativa(modulosImportados);

        const topoDaPilhaDeVariaveis = this.pilhaVariaveisEscopo.topoDaPilha();
        topoDaPilhaDeVariaveis.set('numero', new VariavelEscopo(this.funcaoNumero?.getCallee() as llvm.Value));
        topoDaPilhaDeVariaveis.set('inteiro', new VariavelEscopo(this.funcaoInteiro?.getCallee() as llvm.Value));
        topoDaPilhaDeVariaveis.set('aleatorio', new VariavelEscopo(this.funcaoAleatorio?.getCallee() as llvm.Value));
        topoDaPilhaDeVariaveis.set(
            'aleatorioEntre',
            new VariavelEscopo(this.funcaoAleatorioEntre?.getCallee() as llvm.Value)
        );

        // Classes primeiro: os structs e métodos devem existir antes de qualquer uso.
        const declaracoesClasses = todasDeclaracoes.filter((d) => d instanceof Classe);
        for (const declaracao of declaracoesClasses) {
            await declaracao.aceitar(this);
        }

        // Declarações de funções durante o código.
        // Delégua permite declarar funções a qualquer momento do código, mas o montador LLVM
        // reclama se fizermos isso no ponto de entrada.
        const declaracoesFuncoes = todasDeclaracoes.filter((d) => d instanceof FuncaoDeclaracao);
        for (const declaracao of declaracoesFuncoes) {
            await declaracao.aceitar(this);
        }

        const outrasDeclaracoes = todasDeclaracoes.filter(
            (d) => !(d instanceof FuncaoDeclaracao) && !(d instanceof Classe)
        );
        await this.criarPontoEntrada(outrasDeclaracoes);

        if (llvm.verifyModule(this.modulo)) {
            throw new Error('Falha ao verificar módulo LLVM.');
        }

        if (otimizar) {
            const passesModulo = new llvm.ModulePassManager();
            const passesFuncao = passesModulo.createFunctionPassManager();
            passesFuncao.addSROAPass();
            passesFuncao.addEarlyCSEPass();
            passesFuncao.addInstCombinePass();
            passesModulo.addFunctionPasses(passesFuncao);
            (passesModulo as unknown as PassesModuloComRun).run(this.modulo, this.maquinaAlvo);
        }

        // Finaliza os metadados DWARF antes de imprimir o IR.
        if (this.construtorDebug) {
            this.construtorDebug.finalize();
        }

        let irFinal = this.modulo.print();

        // Injeta metadados !llvm.linker.options e comentários de link para bibliotecas FFI.
        if (this.bibliotecasEstrangeiras.size > 0) {
            const bibliotecas = [...this.bibliotecasEstrangeiras];
            const metaIdMax = [...irFinal.matchAll(/^!(\d+)\s*=/gm)].reduce(
                (max, m) => Math.max(max, parseInt(m[1], 10)),
                -1
            );
            let nextId = metaIdMax + 1;
            const linhasNovas: string[] = [''];
            const idsLinker: string[] = [];
            for (const biblioteca of bibliotecas) {
                linhasNovas.push(`; ffi-link: -l${biblioteca}`);
            }
            for (const biblioteca of bibliotecas) {
                linhasNovas.push(`!${nextId} = !{!"-l${biblioteca}"}`);
                idsLinker.push(`!${nextId}`);
                nextId++;
            }
            linhasNovas.push(`!llvm.linker.options = !{ ${idsLinker.join(', ')} }`);
            irFinal += linhasNovas.join('\n');
        }

        return irFinal;
    }
}

// Mixins: métodos de registro de módulos extraídos para arquivos separados.
CompiladorLLVM.prototype.registrarModuloMatematica = registrarModuloMatematica;
CompiladorLLVM.prototype.registrarModuloFisica = registrarModuloFisica;
CompiladorLLVM.prototype.registrarModuloEstatistica = registrarModuloEstatistica;
CompiladorLLVM.prototype.registrarModuloArquivos = registrarModuloArquivos;
CompiladorLLVM.prototype.registrarModuloCsv = registrarModuloCsv;
CompiladorLLVM.prototype.registrarModuloJson = registrarModuloJson;
CompiladorLLVM.prototype.registrarModuloHttp = registrarModuloHttp;
CompiladorLLVM.prototype.registrarModuloCriptografia = registrarModuloCriptografia;
CompiladorLLVM.prototype.registrarModuloDados = registrarModuloDados;
