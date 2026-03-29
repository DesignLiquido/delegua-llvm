import {
    Lexador, AvaliadorSintatico, AcessoElementoMatriz, AcessoIndiceVariavel, AcessoMetodoOuPropriedade, Agrupamento,
    AtribuicaoPorIndice, AtribuicaoPorIndicesMatriz, Atribuir, Binario, Bloco, CabecalhoPrograma, Chamada, Classe, Comentario, Const,
    Constante, ConstMultiplo, Continua, DefinirValor, Dicionario, Enquanto, Escolha, Escreva, EscrevaMesmaLinha, Expressao, ExpressaoRegular,
    Falhar, Fazer, FimPara, FormatacaoEscrita, FuncaoConstruto, FuncaoDeclaracao, Importar, InicioAlgoritmo, Isto, Leia,
    Literal, Logico, Para, ParaCada, Retorna, Se, Super, Sustar, TendoComo, Tente, TipoDe, Tupla, Unario, Var, Variavel, VarMultiplo, Vetor, Declaracao, Construto,
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
    InterfaceDeclaracao
} from '@designliquido/delegua';
import { VisitanteDeleguaInterface } from '@designliquido/delegua/interfaces';
import { ContinuarQuebra, SustarQuebra } from '@designliquido/delegua/quebras';
import llvm, { APFloat, APInt, ConstantFP, ConstantInt } from '@designliquido/llvm-bindings';

import { PilhaVariaveisEscopo } from './pilha-variaveis-escopo';
import { VariavelEscopo } from './variavel-escopo';
import { OperandoInterface } from './interfaces';

// Entrada no mapaModulos: associa um FunctionCallee LLVM à assinatura da função.
interface EntradaFuncaoModulo {
    callee: llvm.FunctionCallee;
    tiposParametros: string[];
    tipoRetorno: string;
}

export class CompiladorLLVM implements VisitanteDeleguaInterface {
    lexador: Lexador;
    avaliadorSintatico: AvaliadorSintatico;

    contexto: llvm.LLVMContext;
    modulo: llvm.Module;
    montador: llvm.IRBuilder;

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
    pontoPousoAtual: llvm.BasicBlock | null = null;

    private registroClasses: Map<string, llvm.StructType> = new Map();
    private indicesPropriedades: Map<string, Map<string, number>> = new Map();
    private tiposPropriedades: Map<string, Map<string, string>> = new Map();
    private metodosClasse: Map<string, Map<string, string>> = new Map();
    // Mapa de herança: nomeFIlho → nomePai (single inheritance).
    private superClasses: Map<string, string> = new Map();
    // Mapa de módulos importados: nomeModulo → (nomeFuncaoDelégua → FunctionCallee).
    // Populado em criarFuncoesNativas() à medida que as bibliotecas são implementadas.
    private mapaModulos: Map<string, Map<string, EntradaFuncaoModulo>> = new Map();
    private pilhaIsto: llvm.Value[] = [];
    private classesComMarcadorTipo: Set<string> = new Set();
    private contadoresNaoNegativos: Set<string> = new Set();
    private tipoEstruturaVetor: llvm.StructType = null;
    private pilhaBlocosLoop: Array<{ blocoSaida: llvm.BasicBlock; blocoRetorno: llvm.BasicBlock }> = [];
    private contemExcecoes: boolean = false;
    // Tipo de retorno esperado da função sendo compilada no momento (null = main / desconhecido).
    // Usado para converter i1 → i32 quando a função declara retorno 'inteiro'/'lógico'.
    private tipoRetornoFuncaoAtual: string | null = null;
    // Contador para gerar nomes únicos de lambdas.
    private contadorLambda: number = 0;

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

    private readonly NOMES_BLOCOS = {
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
        TENTE_APOS: 'tente_apos',
        PEGUE_LANDING: 'pegue_landing',
        PEGUE_CORPO: 'pegue_corpo',
        FINALMENTE_CORPO: 'finalmente_corpo',
        TENTE_APOS_FINAL: 'tente_apos_final'
    };

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
    private incrementoEhPositivo(incrementar: any, nomeVariavel: string): boolean {
        if (!incrementar) return false;
        // Unário pós/pré-incremento: i++  ou  ++i
        if (incrementar instanceof Unario) {
            const operando = (incrementar as any).operando;
            const lexemaOperador = (incrementar as any).operador?.lexema;
            const lexemaOperando = operando?.simbolo?.lexema ?? operando?.lexema;
            return lexemaOperador === '++' && lexemaOperando === nomeVariavel;
        }
        return false;
    }

    // Extrai o tipo do elemento de uma string de tipo vetor.
    // Aceita tanto 'vetor<inteiro>' como 'inteiro[]'.
    private tipoElementoVetor(tipoVetor: string): string {
        if (tipoVetor?.endsWith('[]')) {
            return tipoVetor.slice(0, -2);
        }
        const correspondencia = tipoVetor?.match(/^vetor<(.+)>$/);
        return correspondencia ? correspondencia[1] : 'inteiro';
    }

    // Retorna verdadeiro se o tipo representa um vetor (qualquer notação).
    private tipoEhVetor(tipo: string): boolean {
        return tipo?.startsWith('vetor<') || tipo === 'vetor' || tipo?.endsWith('[]');
    }

    // Verifica se um llvm.Type é um ponteiro (PointerType).
    // Usa constructor.name em vez de isPointerTy() porque o binding LLVM só registra
    // isPointerTy() na classe Type base; chamá-la em subclasses como IntegerType via
    // herança de protótipo falha com "Illegal invocation" no runtime do Node.js.
    protected tipoEhPonteiro(tipo: llvm.Type): boolean {
        return tipo?.constructor?.name === 'PointerType';
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
    protected async aceitarListaDeclaracoes(decls: Declaracao[] | undefined): Promise<void> {
        if (!decls) return;
        for (const d of decls) {
            await d.aceitar(this);
        }
    }

    // Conveniência para aceitar (resolver) um construto e carregar seu valor se for VariavelEscopo.
    protected async aceitarECarregar(possivelVariavel: Construto | VariavelEscopo | llvm.Value, tipo?: string, nomeLoad?: string): Promise<llvm.Value | VariavelEscopo> {
        let resolvido: any;
        if (possivelVariavel && typeof (possivelVariavel as any).aceitar === 'function') {
            resolvido = await (possivelVariavel as Construto).aceitar(this);
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
        return resolvido;
    }

    /**
     * Implementações úteis padrão para visitantes que eram stubs.
     *
     * Observação: as implementações aqui buscam oferecer comportamento útil
     * e conservador (traversal/armazenamento/carregamento), não suporte completo
     * a todas as construções complexas (ex.: métodos, indexações complexas, classes).
     */

    async visitarDeclaracaoCabecalhoPrograma(declaracao: CabecalhoPrograma): Promise<any> {
        // Normalmente só marca metadados; não produz IR.
        return Promise.resolve();
    }

    async visitarDeclaracaoClasse(declaracao: Classe): Promise<any> {
        const nomeClasse = declaracao.simbolo.lexema;

        // Detecta superclasse (primeira entrada em superClasses, se existir).
        const superClasseRef = (declaracao.superClasses as any[])?.[0];
        const nomeSuperClasse: string | null =
            superClasseRef?.simbolo?.lexema ?? superClasseRef?.tipo ?? null;

        // 1. Coletar tipos LLVM das propriedades e construir o struct.
        //    Com herança plana: campos do pai vêm primeiro, depois os próprios.
        const tiposPropsLlvm: llvm.Type[] = [];
        const mapaIndices: Map<string, number> = new Map();
        const mapaTipos: Map<string, string> = new Map();

        if (nomeSuperClasse && this.indicesPropriedades.has(nomeSuperClasse)) {
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

        for (const metodo of declaracao.metodos) {
            const ehConstrutor = metodo.simbolo.lexema === 'construtor';
            const nomeFuncaoLlvm = `${nomeClasse}_${metodo.simbolo.lexema}`;

            const tiposParametros: llvm.Type[] = [tipoSelf];
            for (const parametro of metodo.funcao.parametros) {
                tiposParametros.push(this.obterTipoLlvm(parametro.tipoDado));
            }

            const tipoRetornoStr: string = ehConstrutor ? 'vazio' : (metodo.funcao.tipo ?? 'vazio');
            const tipoRetorno = (tipoRetornoStr === 'vazio')
                ? llvm.Type.getVoidTy(this.contexto)
                : this.obterTipoLlvm(tipoRetornoStr);

            const tipoFuncao = llvm.FunctionType.get(tipoRetorno, tiposParametros, false);
            const objetoLlvmFuncao = llvm.Function.Create(
                tipoFuncao,
                llvm.Function.LinkageTypes.ExternalLinkage,
                nomeFuncaoLlvm,
                this.modulo
            );

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
            await this.visitarCorpoFuncao(metodo.funcao, objetoLlvmFuncao);
            if (tipoRetornoStr === 'vazio') {
                this.montador.CreateRetVoid();
            }
            this.tipoRetornoFuncaoAtual = tipoRetornoAnteriorMetodo;
            this.pilhaIsto.pop();
            this.pilhaVariaveisEscopo.removerUltimo();

            this.metodosClasse.get(nomeClasse).set(
                metodo.simbolo.lexema,
                ehConstrutor ? 'vazio' : metodo.funcao.tipo
            );
        }

        // Registra relação de herança e copia métodos herdados não sobrescritos.
        if (nomeSuperClasse) {
            this.superClasses.set(nomeClasse, nomeSuperClasse);

            const metodosPai = this.metodosClasse.get(nomeSuperClasse);
            if (metodosPai) {
                const nomesPropriosFilho = new Set(declaracao.metodos.map(m => m.simbolo.lexema));
                for (const [nomeMetodo, tipoRetorno] of metodosPai.entries()) {
                    if (!nomesPropriosFilho.has(nomeMetodo) && nomeMetodo !== 'construtor') {
                        this.metodosClasse.get(nomeClasse).set(nomeMetodo, tipoRetorno);
                    }
                }
            }
        }

        return Promise.resolve();
    }

    async visitarDeclaracaoComentario(declaracao: Comentario): Promise<any> {
        // Comentários não são tratados no LLVM.
        return Promise.resolve();
    }

    async visitarDeclaracaoConst(declaracao: Const): Promise<any> {
        // Tratar similar a var mas imutável. Aloca e armazena o inicializador.
        const tipoVariavel = declaracao.tipo === 'qualquer' ? this.resolverTipoConstruto(declaracao.inicializador) : declaracao.tipo;
        const tipoLlvm = this.obterTipoLlvm(tipoVariavel);
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

        const topo = this.pilhaVariaveisEscopo.topoDaPilha();
        const variavelEscopo = new VariavelEscopo(aloc, declaracao as any, tipoVariavel, true);
        topo.set(declaracao.simbolo.lexema, variavelEscopo);
        return Promise.resolve();
    }

    async visitarDeclaracaoConstMultiplo(declaracao: ConstMultiplo): Promise<any> {
        const declaracaoTipada = declaracao as any;
        const simbolos = declaracaoTipada.simbolos || declaracaoTipada.constantes || [];
        const inicializadores = declaracaoTipada.inicializadores || declaracaoTipada.valores || [];
        const tipoDeclarado = declaracaoTipada.tipo;

        const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
        for (const [indice, simbolo] of simbolos.entries()) {
            const nomeSimbolo = simbolo?.lexema || simbolo?.nome || `const_${indice}`;
            const inicializador = inicializadores[indice] ?? inicializadores[0];

            if (!this.montador || !inicializador?.aceitar) {
                topoDaPilha.set(nomeSimbolo, new VariavelEscopo(inicializador as any, declaracao as any, tipoDeclarado || 'qualquer', true));
                continue;
            }

            const tipoVariavel = tipoDeclarado === 'qualquer' || !tipoDeclarado
                ? this.resolverTipoConstruto(inicializador)
                : tipoDeclarado;

            const tipoLlvm = this.obterTipoLlvm(tipoVariavel);
            const alocacao = this.montador.CreateAlloca(tipoLlvm, null, nomeSimbolo);
            const valorResolvido = await inicializador.aceitar(this);
            this.montador.CreateStore(valorResolvido, alocacao);

            topoDaPilha.set(nomeSimbolo, new VariavelEscopo(alocacao, declaracao as any, tipoVariavel, true));
        }

        return Promise.resolve();
    }

    async visitarDeclaracaoDeExpressao(declaracao: Expressao): Promise<any> {
        // Uma declaração que é apenas uma expressão: resolve expressão.
        await (declaracao as any).expressao.aceitar(this);
        return Promise.resolve();
    }

    async visitarDeclaracaoEnquanto(declaracao: Enquanto): Promise<any> {
        // Estrutura de loop while:
        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        const blocoCond = llvm.BasicBlock.Create(this.contexto, 'while_cond', funcaoAtual);
        const blocoCorpo = llvm.BasicBlock.Create(this.contexto, 'while_body', funcaoAtual);
        const blocoApos = llvm.BasicBlock.Create(this.contexto, 'while_after', funcaoAtual);

        this.montador.CreateBr(blocoCond);
        this.montador.SetInsertPoint(blocoCond);

        const condRaw = await declaracao.condicao.aceitar(this);
        const cond = this.carregarValorSeNecessario(condRaw, declaracao.condicao.tipo, 'while_load_cond');

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
        // Semelhante ao escrever com quebra, mas sem newline: ajusta formato para não usar \n.
        const argumentosResolvidos: llvm.Value[] = [];
        for (const argumento of declaracao.argumentos) {
            const arg = await argumento.aceitar(this);
            if (arg instanceof VariavelEscopo) {
                const tipoArg = this.obterTipoLlvm(argumento.tipo);
                const carregado = this.montador.CreateLoad(tipoArg, arg.variavelLlvm, "load_var");
                argumentosResolvidos.push(carregado);
            } else {
                argumentosResolvidos.push(arg);
            }
        }

        const tipoPrimeiroArgumento = declaracao.argumentos[0].tipo;
        // Reutiliza o formato do printf, removendo o newline final.
        let formato = this.printfFormatos.get(tipoPrimeiroArgumento) || '%s\n';
        formato = formato.replace(/\n$/, '');
        const formatoPtr = this.montador.CreateGlobalStringPtr(formato, `formato_printf_${tipoPrimeiroArgumento}_sem_nl`, 0, this.modulo);

        argumentosResolvidos.unshift(formatoPtr);
        this.montador.CreateCall(this.funcaoEscreva, argumentosResolvidos);
        return Promise.resolve();
    }

    async visitarDeclaracaoFazer(declaracao: Fazer): Promise<any> {
        const declaracaoTipada = declaracao as any;

        // Guard: se o compilador não estiver inicializado (sem montador ativo),
        // percorre corpo e condição sem emitir CFG — compatível com testes de visitantes isolados.
        if (!this.montador) {
            await this.aceitarListaDeclaracoes(
                declaracaoTipada.caminhoFazer?.declaracoes ??
                declaracaoTipada.corpo?.declaracoes ??
                declaracaoTipada.caminho?.declaracoes
            );
            if (declaracaoTipada.condicaoEnquanto?.aceitar) {
                await declaracaoTipada.condicaoEnquanto.aceitar(this);
            } else if (declaracaoTipada.condicao?.aceitar) {
                await declaracaoTipada.condicao.aceitar(this);
            }
            return Promise.resolve();
        }

        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        const blocoCorpo = llvm.BasicBlock.Create(this.contexto, 'fazer_corpo', funcaoAtual);
        const blocoCondicao = llvm.BasicBlock.Create(this.contexto, 'fazer_cond', funcaoAtual);
        const blocoApos = llvm.BasicBlock.Create(this.contexto, 'fazer_apos', funcaoAtual);

        // Salta incondicionalmente para o corpo (executa pelo menos uma vez).
        this.montador.CreateBr(blocoCorpo);

        // Corpo do laço.
        this.montador.SetInsertPoint(blocoCorpo);
        this.pilhaBlocosLoop.push({ blocoSaida: blocoApos, blocoRetorno: blocoCondicao });
        await this.aceitarListaDeclaracoes(
            declaracaoTipada.caminhoFazer?.declaracoes ??
            declaracaoTipada.corpo?.declaracoes ??
            declaracaoTipada.caminho?.declaracoes
        );
        this.pilhaBlocosLoop.pop();
        this.montador.CreateBr(blocoCondicao);

        // Avaliação da condição de continuação.
        this.montador.SetInsertPoint(blocoCondicao);
        const condicaoBruta =
            declaracaoTipada.condicaoEnquanto?.aceitar
                ? await declaracaoTipada.condicaoEnquanto.aceitar(this)
                : declaracaoTipada.condicao?.aceitar
                    ? await declaracaoTipada.condicao.aceitar(this)
                    : null;

        if (condicaoBruta !== null) {
            const tipoCond =
                declaracaoTipada.condicaoEnquanto?.tipo ??
                declaracaoTipada.condicao?.tipo ??
                'lógico';
            const condicao = this.carregarValorSeNecessario(condicaoBruta, tipoCond, 'fazer_load_cond');
            this.montador.CreateCondBr(condicao, blocoCorpo, blocoApos);
        } else {
            // Condição ausente: laço infinito (improvável em Delégua, mas seguro).
            this.montador.CreateBr(blocoCorpo);
        }

        this.montador.SetInsertPoint(blocoApos);
        return Promise.resolve();
    }

    async visitarDeclaracaoAjuda(declaracao: Ajuda): Promise<any> {
        // Sistema de ajuda em tempo de execução não tem mapeamento em IR.
        return Promise.resolve();
    }

    async visitarDeclaracaoExtensao(declaracao: Extensao): Promise<any> {
        // Extensões de classe são metadados de tipo; sem geração de IR neste compilador.
        if ((declaracao as any).membros) {
            await this.aceitarListaDeclaracoes((declaracao as any).membros);
        }
        return Promise.resolve();
    }

    async visitarDeclaracaoImportar(declaracao: Importar): Promise<any> {
        // Resolve o nome do módulo a partir do caminho (normalmente um Literal com valor string).
        const nomeModulo: string = (declaracao.caminho as any)?.valor ?? '';

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
                    this.pilhaVariaveisEscopo.topoDaPilha().set(
                        nomeFuncao,
                        new VariavelEscopo(llvmFuncao, undefined, 'função')
                    );
                }
            }
        }

        return Promise.resolve();
    }

    async visitarDeclaracaoInterface(declaracao: InterfaceDeclaracao): Promise<any> {
        // Declarações de interface são apenas metadados de tipo; sem geração de IR.
        return Promise.resolve();
    }

    async visitarDeclaracaoInicioAlgoritmo(declaracao: InicioAlgoritmo): Promise<any> {
        // Marca início — nada a gerar.
        return Promise.resolve();
    }

    async visitarDeclaracaoParaCada(declaracao: ParaCada): Promise<any> {
        // Implementação simples: aceita expressão iterável e corpo.
        // Implementar iteração real depende do tipo do iterável; aqui apenas percorre o corpo.
        await this.aceitarListaDeclaracoes(declaracao.corpo.declaracoes);
        return Promise.resolve();
    }

    async visitarDeclaracaoTextoDocumentacao(declaracao: TextoDocumentacao): Promise<any> {
        // Docstrings não geram IR.
        return Promise.resolve();
    }

    async visitarDeclaracaoTendoComo(declaracao: TendoComo): Promise<any> {
        // Semântica de "tendo como" (ex.: try-with-resources) não implementada; percorre corpo.
        await this.aceitarListaDeclaracoes((declaracao as any).corpo?.declaracoes);
        return Promise.resolve();
    }

    async visitarDeclaracaoTente(declaracao: Tente): Promise<any> {
        this.contemExcecoes = true;
        const funcaoAtual = this.montador.GetInsertBlock().getParent();
        
        const tipoPontoPouso = llvm.StructType.get(
            this.contexto,
            [
                this.montador.getPtrTy(),
                this.montador.getInt32Ty()
            ]
        );

        const temFinally = declaracao.caminhoFinalmente && 
            (Array.isArray(declaracao.caminhoFinalmente) ? declaracao.caminhoFinalmente.length > 0 : true);
        const temCatch = declaracao.caminhoPegue && 
            (Array.isArray(declaracao.caminhoPegue) ? declaracao.caminhoPegue.length > 0 : true);
        
        const blocoTenteCorpo = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.TENTE_CORPO, funcaoAtual);
        const blocoTenteApos = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.TENTE_APOS, funcaoAtual);
        const blocoPegueLanding = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.PEGUE_LANDING, funcaoAtual);
        const blocoTenteAposFinal = llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.TENTE_APOS_FINAL, funcaoAtual);

        const blocoPegueCorpo = temCatch 
            ? llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.PEGUE_CORPO, funcaoAtual) 
            : null;
        const blocoFinalmenteCorpo = temFinally 
            ? llvm.BasicBlock.Create(this.contexto, this.NOMES_BLOCOS.FINALMENTE_CORPO, funcaoAtual) 
            : null;
        const blocoFinalmenteSucesso = temFinally && !temCatch
            ? llvm.BasicBlock.Create(this.contexto, 'finalmente_sucesso', funcaoAtual)
            : null;
        const blocoRelancarExcecao = temFinally && !temCatch
            ? llvm.BasicBlock.Create(this.contexto, 'relancar_excecao', funcaoAtual)
            : null;

        let alocPontoPouso: llvm.AllocaInst | null = null;
        if (blocoRelancarExcecao) {
            alocPontoPouso = this.montador.CreateAlloca(tipoPontoPouso, null, 'ponto_pouso_temp');
        }

        const pontoPousoAnterior = this.pontoPousoAtual;
        this.pontoPousoAtual = blocoPegueLanding;

        this.montador.CreateBr(blocoTenteCorpo);
        this.montador.SetInsertPoint(blocoTenteCorpo);
        
        await this.processarCaminhoTente(declaracao.caminhoTente);
        this.montador.CreateBr(blocoTenteApos);

        this.montador.SetInsertPoint(blocoPegueLanding);
        funcaoAtual.setPersonalityFn(this.funcaoPersonalidade);

        const pontoPouso = this.montador.CreateLandingPad(tipoPontoPouso, 1, 'landingpad');
        const nullPtr = llvm.Constant.getNullValue(this.montador.getPtrTy());
        pontoPouso.addClause(nullPtr);

        if (blocoPegueCorpo && temCatch) {
            this.montador.CreateBr(blocoPegueCorpo);
            this.montador.SetInsertPoint(blocoPegueCorpo);

            const ponteiroCabecalho = this.montador.CreateExtractValue(pontoPouso, [0], 'exception_header');
            const ponteiroExcecao = this.montador.CreateCall(this.funcaoBeginCatch, [ponteiroCabecalho], 'exception_data');

            const parametroEncontrado = this.extrairParametroPegue(declaracao.caminhoPegue);
            if (parametroEncontrado) {
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
        } else if (blocoFinalmenteCorpo && !temCatch) {
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
            
            if (temCatch) {
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

    private extrairParametroPegue(caminhoPegue: any): any {
        if (!caminhoPegue) return null;
        
        if (caminhoPegue.parametros?.length > 0) {
            return caminhoPegue.parametros[0].nome;
        }
        
        return null;
    }

    private async processarCaminhoTente(caminhoTente: any): Promise<void> {
        if (!caminhoTente) return;
        if (caminhoTente.aceitar) {
            await caminhoTente.aceitar(this);
        } else if (caminhoTente.declaracoes) {
            await this.aceitarListaDeclaracoes(caminhoTente.declaracoes);
        } else if (Array.isArray(caminhoTente)) {
            await this.aceitarListaDeclaracoes(caminhoTente);
        }
    }

    private async processarCaminhoPegue(caminhoPegue: any): Promise<void> {
        if (!caminhoPegue) return;
        if (caminhoPegue.corpo) {
            await this.aceitarListaDeclaracoes(caminhoPegue.corpo);
        } else if (caminhoPegue.declaracoes) {
            await this.aceitarListaDeclaracoes(caminhoPegue.declaracoes);
        } else if (Array.isArray(caminhoPegue)) {
            await this.aceitarListaDeclaracoes(caminhoPegue);
        }
    }

    private async processarCaminhoFinalmente(caminhoFinalmente: any): Promise<void> {
        if (!caminhoFinalmente) return;
        if (caminhoFinalmente.aceitar) {
            await caminhoFinalmente.aceitar(this);
        } else if (caminhoFinalmente.declaracoes) {
            await this.aceitarListaDeclaracoes(caminhoFinalmente.declaracoes);
        } else if (Array.isArray(caminhoFinalmente)) {
            await this.aceitarListaDeclaracoes(caminhoFinalmente);
        }
    }

    async visitarDeclaracaoVarMultiplo(declaracao: VarMultiplo): Promise<any> {
        const declaracaoTipada = declaracao as any;
        const simbolos = declaracaoTipada.simbolos || declaracaoTipada.variaveis || [];
        const inicializadores = declaracaoTipada.inicializadores || declaracaoTipada.valores || [];
        const tipoDeclarado = declaracaoTipada.tipo;

        const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
        for (const [indice, simbolo] of simbolos.entries()) {
            const nomeSimbolo = simbolo?.lexema || simbolo?.nome || `var_${indice}`;
            const inicializador = inicializadores[indice] ?? inicializadores[0];

            if (!this.montador || !inicializador?.aceitar) {
                topoDaPilha.set(nomeSimbolo, new VariavelEscopo(inicializador as any, declaracao as any, tipoDeclarado || 'qualquer', false));
                continue;
            }

            const tipoVariavel = tipoDeclarado === 'qualquer' || !tipoDeclarado
                ? this.resolverTipoConstruto(inicializador)
                : tipoDeclarado;

            const tipoLlvm = this.obterTipoLlvm(tipoVariavel);
            const alocacao = this.montador.CreateAlloca(tipoLlvm, null, nomeSimbolo);
            const valorResolvido = await inicializador.aceitar(this);
            this.montador.CreateStore(valorResolvido, alocacao);

            topoDaPilha.set(nomeSimbolo, new VariavelEscopo(alocacao, declaracao as any, tipoVariavel, false));
        }

        return Promise.resolve();
    }

    async visitarExpressaoDeAtribuicao(expressao: Atribuir): Promise<any> {
        // suporte para atribuição simples a variável: resolve lado esquerdo (deve ser Variavel) e armazena o valor.
        const valorResolvido = await expressao.valor.aceitar(this);
        const tipoValor = this.resolverTipoConstruto(expressao.valor);

        const alvoResolvido = await expressao.alvo.aceitar(this);
        if (alvoResolvido instanceof VariavelEscopo) {
            if (alvoResolvido.ehConstante) {
                const nomeConstante = (expressao.alvo as Variavel).simbolo?.lexema || 'desconhecida';
                throw new Error(`Não é possível reatribuir a constante '${nomeConstante}'.`);
            }
            this.armazenarEmVariavel(alvoResolvido, valorResolvido as llvm.Value, expressao.alvo.tipo, tipoValor);
            return Promise.resolve(valorResolvido);
        }

        // Se o alvo não for VariavelEscopo, apenas retorna o valor (fallback).
        return Promise.resolve(valorResolvido);
    }

    async visitarExpressaoAcessoIndiceVariavel(expressao: AcessoIndiceVariavel): Promise<any> {
        const expressaoTipada = expressao as any;
        const alvoBruto = expressaoTipada.entidadeChamada ?? expressaoTipada.entidade ?? expressaoTipada.variavel ?? expressaoTipada.objeto;
        const indiceBruto = expressaoTipada.indice ?? expressaoTipada.índice;

        const alvoResolvido = alvoBruto?.aceitar ? await alvoBruto.aceitar(this) : alvoBruto;
        const indiceResolvido = indiceBruto?.aceitar ? await indiceBruto.aceitar(this) : indiceBruto;

        // Caminho LLVM IR: vetor com struct %Vetor na memória.
        if (alvoResolvido instanceof VariavelEscopo && this.tipoEhVetor(alvoResolvido.tipo)) {
            const tipoElementoStr = this.tipoElementoVetor(alvoResolvido.tipo);
            const tipoElemento = this.obterTipoLlvm(tipoElementoStr);
            const tipoPonteiro = llvm.PointerType.get(this.contexto, 0);
            const idx0 = ConstantInt.get(this.contexto, new APInt(32, 0));

            // Verifica se o índice é um contador não-negativo (habilita flag nuw).
            const nomeIndice = (indiceBruto as any)?.simbolo?.lexema;
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

            // Carrega o ponteiro de elementos do campo 0 do struct %Vetor.
            const gepCampoPtr = this.montador.CreateInBoundsGEP(
                this.tipoEstruturaVetor,
                alvoResolvido.variavelLlvm,
                [idx0, ConstantInt.get(this.contexto, new APInt(32, 0))],
                'ptr_campo_elementos'
            );
            const ptrElementos = this.montador.CreateLoad(tipoPonteiro, gepCampoPtr, 'ptr_elementos');

            // GEP para o elemento, com flag nuw quando o índice é garantidamente não-negativo.
            const gepElemento = this.montador.CreateInBoundsGEP(
                tipoElemento,
                ptrElementos,
                [indiceValor],
                'ptr_elemento',
                indiceNaoNegativo
            );

            return Promise.resolve(this.montador.CreateLoad(tipoElemento, gepElemento, 'elemento'));
        }

        // Caminho JS (interpretador): alvo já é array ou string.
        const alvoFinal = alvoResolvido instanceof VariavelEscopo
            ? (alvoResolvido.variavelLlvm as any)
            : alvoResolvido;

        if (Array.isArray(alvoFinal) || typeof alvoFinal === 'string') {
            return Promise.resolve(alvoFinal[indiceResolvido]);
        }

        return Promise.resolve(undefined);
    }

    async visitarExpressaoAcessoElementoMatriz(expressao: AcessoElementoMatriz): Promise<any> {
        const expressaoTipada = expressao as any;
        const matrizBruta = expressaoTipada.entidadeChamada ?? expressaoTipada.entidade ?? expressaoTipada.variavel ?? expressaoTipada.objeto;
        const indiceLinhaBruto = expressaoTipada.indicePrimario ?? expressaoTipada.indiceLinha ?? expressaoTipada.linha;
        const indiceColunaBruto = expressaoTipada.indiceSecundario ?? expressaoTipada.indiceColuna ?? expressaoTipada.coluna;

        const matrizResolvida = matrizBruta?.aceitar ? await matrizBruta.aceitar(this) : matrizBruta;
        const linhaResolvida = indiceLinhaBruto?.aceitar ? await indiceLinhaBruto.aceitar(this) : indiceLinhaBruto;
        const colunaResolvida = indiceColunaBruto?.aceitar ? await indiceColunaBruto.aceitar(this) : indiceColunaBruto;

        const matrizFinal = matrizResolvida instanceof VariavelEscopo
            ? (matrizResolvida.variavelLlvm as any)
            : matrizResolvida;

        if (Array.isArray(matrizFinal) && Array.isArray(matrizFinal[linhaResolvida])) {
            return Promise.resolve(matrizFinal[linhaResolvida][colunaResolvida]);
        }

        return Promise.resolve(undefined);
    }

    async visitarExpressaoAcessoMetodo(expressao: AcessoMetodo): Promise<any> {
        const expressaoTipada = expressao as any;
        return Promise.resolve({
            objeto: expressaoTipada.objeto,
            nomeMetodo: expressaoTipada.nomeMetodo ?? expressaoTipada.simbolo?.lexema
        });
    }

    async visitarExpressaoAcessoMetodoOuPropriedade(expressao: AcessoMetodoOuPropriedade): Promise<any> {
        const objetoResolvido = await expressao.objeto.aceitar(this);
        let objetoPtr: llvm.Value;
        let nomeClasse: string;

        if (objetoResolvido instanceof VariavelEscopo) {
            objetoPtr = objetoResolvido.variavelLlvm;
            nomeClasse = objetoResolvido.tipo;
        } else {
            objetoPtr = objetoResolvido as llvm.Value;
        }

        if (!nomeClasse && expressao.objeto.constructor.name === 'Variavel') {
            nomeClasse = this.pilhaVariaveisEscopo.obterValor((expressao.objeto as Variavel).simbolo.lexema)?.tipo;
        }

        const nomeMembro = expressao.simbolo.lexema;
        const mapaIndices = this.indicesPropriedades.get(nomeClasse);
        const mapaTipos = this.tiposPropriedades.get(nomeClasse);
        const indice = mapaIndices?.get(nomeMembro);
        const tipoProp = mapaTipos?.get(nomeMembro);

        if (indice === undefined || !tipoProp) {
            throw new Error(`Propriedade '${nomeMembro}' não encontrada na classe '${nomeClasse}'.`);
        }

        const tipoStruct = this.registroClasses.get(nomeClasse);
        const tipoLlvm = this.obterTipoLlvm(tipoProp);
        const gepPtr = this.montador.CreateInBoundsGEP(
            tipoStruct,
            objetoPtr,
            [
                ConstantInt.get(this.contexto, new APInt(32, 0)),
                ConstantInt.get(this.contexto, new APInt(32, indice))
            ],
            `${nomeMembro}_ptr`
        );

        return this.montador.CreateLoad(tipoLlvm, gepPtr, nomeMembro);
    }

    async visitarExpressaoAcessoPropriedade(expressao: AcessoPropriedade): Promise<any> {
        const objetoResolvido = await expressao.objeto.aceitar(this);
        let objetoPtr: llvm.Value;
        let nomeClasse: string;

        if (objetoResolvido instanceof VariavelEscopo) {
            objetoPtr = objetoResolvido.variavelLlvm;
            nomeClasse = objetoResolvido.tipo;
        } else {
            objetoPtr = objetoResolvido as llvm.Value;
        }

        if (!nomeClasse && expressao.objeto.constructor.name === 'Variavel') {
            nomeClasse = this.pilhaVariaveisEscopo.obterValor((expressao.objeto as Variavel).simbolo.lexema)?.tipo;
        }

        const mapaIndices = this.indicesPropriedades.get(nomeClasse);
        const mapaTipos = this.tiposPropriedades.get(nomeClasse);
        const indice = mapaIndices?.get(expressao.nomePropriedade);
        const tipoProp = mapaTipos?.get(expressao.nomePropriedade);

        if (indice === undefined || !tipoProp) {
            throw new Error(`Propriedade '${expressao.nomePropriedade}' não encontrada na classe '${nomeClasse}'.`);
        }

        const tipoStruct = this.registroClasses.get(nomeClasse);
        const tipoLlvm = this.obterTipoLlvm(tipoProp);
        const gepPtr = this.montador.CreateInBoundsGEP(
            tipoStruct,
            objetoPtr,
            [
                ConstantInt.get(this.contexto, new APInt(32, 0)),
                ConstantInt.get(this.contexto, new APInt(32, indice))
            ],
            `${expressao.nomePropriedade}_ptr`
        );

        return this.montador.CreateLoad(tipoLlvm, gepPtr, expressao.nomePropriedade);
    }

    async visitarExpressaoArgumentoReferenciaFuncao(expressao: ArgumentoReferenciaFuncao): Promise<any> {
        const expressaoTipada = expressao as any;
        const alvo = expressaoTipada.valor ?? expressaoTipada.argumento ?? expressaoTipada.referencia;
        if (alvo?.aceitar) {
            return await alvo.aceitar(this);
        }

        return Promise.resolve(alvo);
    }

    async visitarExpressaoAtribuicaoPorIndice(expressao: AtribuicaoPorIndice): Promise<any> {
        const expressaoTipada = expressao as any;
        const alvoBruto = expressaoTipada.entidadeChamada ?? expressaoTipada.entidade ?? expressaoTipada.variavel ?? expressaoTipada.objeto;
        const indiceBruto = expressaoTipada.indice ?? expressaoTipada.índice;
        const valorBruto = expressaoTipada.valor;

        const alvoResolvido = alvoBruto?.aceitar ? await alvoBruto.aceitar(this) : alvoBruto;
        const indiceResolvido = indiceBruto?.aceitar ? await indiceBruto.aceitar(this) : indiceBruto;
        const valorResolvido = valorBruto?.aceitar ? await valorBruto.aceitar(this) : valorBruto;

        const alvoFinal = alvoResolvido instanceof VariavelEscopo
            ? (alvoResolvido.variavelLlvm as any)
            : alvoResolvido;

        if (Array.isArray(alvoFinal)) {
            alvoFinal[indiceResolvido] = valorResolvido;
        }

        return Promise.resolve(valorResolvido);
    }

    async visitarExpressaoAtribuicaoPorIndicesMatriz(expressao: AtribuicaoPorIndicesMatriz): Promise<any> {
        const expressaoTipada = expressao as any;
        const matrizBruta = expressaoTipada.entidadeChamada ?? expressaoTipada.entidade ?? expressaoTipada.variavel ?? expressaoTipada.objeto;
        const indiceLinhaBruto = expressaoTipada.indicePrimario ?? expressaoTipada.indiceLinha ?? expressaoTipada.linha;
        const indiceColunaBruto = expressaoTipada.indiceSecundario ?? expressaoTipada.indiceColuna ?? expressaoTipada.coluna;
        const valorBruto = expressaoTipada.valor;

        const matrizResolvida = matrizBruta?.aceitar ? await matrizBruta.aceitar(this) : matrizBruta;
        const linhaResolvida = indiceLinhaBruto?.aceitar ? await indiceLinhaBruto.aceitar(this) : indiceLinhaBruto;
        const colunaResolvida = indiceColunaBruto?.aceitar ? await indiceColunaBruto.aceitar(this) : indiceColunaBruto;
        const valorResolvido = valorBruto?.aceitar ? await valorBruto.aceitar(this) : valorBruto;

        const matrizFinal = matrizResolvida instanceof VariavelEscopo
            ? (matrizResolvida.variavelLlvm as any)
            : matrizResolvida;

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
            objetoPtr = objetoResolvido.variavelLlvm;
            nomeClasse = objetoResolvido.tipo;
        } else {
            objetoPtr = objetoResolvido as llvm.Value;
        }

        if (!nomeClasse) {
            if (expressao.objeto.constructor.name === 'Variavel') {
                nomeClasse = this.pilhaVariaveisEscopo.obterValor((expressao.objeto as Variavel).simbolo.lexema)?.tipo;
            } else if (expressao.objeto.constructor.name === 'Isto') {
                nomeClasse = this.pilhaVariaveisEscopo.obterValor('isto')?.tipo;
            }
        }

        const nomePropriedade = expressao.nome.lexema;
        const mapaIndices = this.indicesPropriedades.get(nomeClasse);
        const mapaTipos = this.tiposPropriedades.get(nomeClasse);
        const indice = mapaIndices?.get(nomePropriedade);
        const tipoProp = mapaTipos?.get(nomePropriedade);

        if (indice === undefined || !tipoProp) {
            throw new Error(`Propriedade '${nomePropriedade}' não encontrada na classe '${nomeClasse}'.`);
        }

        const tipoStruct = this.registroClasses.get(nomeClasse);
        const gepPtr = this.montador.CreateInBoundsGEP(
            tipoStruct,
            objetoPtr,
            [
                ConstantInt.get(this.contexto, new APInt(32, 0)),
                ConstantInt.get(this.contexto, new APInt(32, indice))
            ],
            `${nomePropriedade}_ptr`
        );

        const novoValor = await expressao.valor.aceitar(this);
        const novoValorLlvm = novoValor instanceof VariavelEscopo
            ? this.carregarValorSeNecessario(novoValor, tipoProp, 'load_val')
            : novoValor as llvm.Value;

        this.montador.CreateStore(novoValorLlvm, gepPtr);
        return Promise.resolve();
    }

    // TODO: Verificar se está correto.
    async visitarExpressaoDeleguaFuncao(expressao: FuncaoConstruto): Promise<any> {
        // Retorna o próprio construto de função (será tratado em visita de declaração).
        return Promise.resolve(expressao);
    }

    async visitarExpressaoDicionario(expressao: Dicionario): Promise<any> {
        const expressaoTipada = expressao as any;
        const resultado: Record<string, any> = {};

        // Formato 1: entradas [{ chave, valor }]
        if (Array.isArray(expressaoTipada.entradas)) {
            for (const entrada of expressaoTipada.entradas) {
                const chaveBruta = entrada?.chave;
                const valorBruto = entrada?.valor;

                const chaveResolvida = chaveBruta?.aceitar ? await chaveBruta.aceitar(this) : chaveBruta;
                const valorResolvido = valorBruto?.aceitar ? await valorBruto.aceitar(this) : valorBruto;

                resultado[String(chaveResolvida)] = valorResolvido;
            }

            return Promise.resolve(resultado);
        }

        // Formato 2: chaves[] e valores[]
        const chaves = expressaoTipada.chaves || [];
        const valores = expressaoTipada.valores || [];
        const total = Math.min(chaves.length, valores.length);

        for (let indice = 0; indice < total; indice++) {
            const chaveBruta = chaves[indice];
            const valorBruto = valores[indice];

            const chaveResolvida = chaveBruta?.aceitar ? await chaveBruta.aceitar(this) : chaveBruta;
            const valorResolvido = valorBruto?.aceitar ? await valorBruto.aceitar(this) : valorBruto;

            resultado[String(chaveResolvida)] = valorResolvido;
        }

        return Promise.resolve(resultado);
    }

    async visitarExpressaoAcessoIntervaloVariavel(expressao: AcessoIntervaloVariavel): Promise<any> {
        // Fatiamento (slicing) não tem geração de IR neste compilador.
        return Promise.resolve();
    }

    async visitarExpressaoAjuda(expressao: AjudaComoConstruto): Promise<any> {
        // Sistema de ajuda em tempo de execução não tem mapeamento em IR.
        return Promise.resolve();
    }

    async visitarExpressaoElvis(expressao: Elvis): Promise<any> {
        // Operador Elvis (a ?: b): avalia a, se nulo/false usa b. Aqui realiza avaliação simples sem GEP.
        const left = await expressao.esquerda.aceitar(this);
        if (left) {
            return Promise.resolve(left);
        }
        return await expressao.direita.aceitar(this);
    }

    async visitarExpressaoEnquanto(expressao: EnquantoComoConstruto): Promise<any> {
        // Trivial: delega ao corpo e condição.
        await expressao.condicao.aceitar(this);
        await this.aceitarListaDeclaracoes(expressao.corpo?.declaracoes);
        return Promise.resolve();
    }

    // TODO: Verificar se está correto.
    async visitarExpressaoExpressaoRegular(expressao: ExpressaoRegular): Promise<RegExp> {
        // Retorna RegExp nativo (não integrado ao IR).
        return Promise.resolve(new RegExp(expressao.valor));
    }

    async visitarExpressaoFalhar(expressao: Falhar): Promise<any> {
        const mensagemExpr = (expressao as any).explicacao;
        if (!mensagemExpr) {
            throw new Error('Falhar precisa de uma mensagem');
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
            this.montador.CreateInvoke(
                this.funcaoFalhar,
                blocoSucesso,
                this.pontoPousoAtual,
                [mensagem]
            );
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

    async visitarExpressaoFimPara(declaracao: FimPara): Promise<any> {
        // Marca fim de for; sem geração direta de IR.
        return Promise.resolve();
    }

    async visitarExpressaoFormatacaoEscrita(declaracao: FormatacaoEscrita): Promise<any> {
        const declaracaoTipada = declaracao as any;
        const expressaoBase = declaracaoTipada.expressao ?? declaracaoTipada.valor;
        const valorResolvido = expressaoBase?.aceitar ? await expressaoBase.aceitar(this) : expressaoBase;

        // Semântica conservadora: em caminhos sem IR, aplica formatação textual simples.
        const casasDecimais = declaracaoTipada.casasDecimais;
        if (typeof valorResolvido === 'number' && Number.isInteger(casasDecimais) && casasDecimais >= 0) {
            return Promise.resolve(valorResolvido.toFixed(casasDecimais));
        }

        return Promise.resolve(valorResolvido);
    }

    // TODO: Verificar se está correto.
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

    async visitarExpressaoIsto(expressao: Isto): Promise<any> {
        const istoEscopo = this.pilhaVariaveisEscopo.obterValor('isto');
        return Promise.resolve(istoEscopo ?? null);
    }

    async visitarExpressaoLeia(expressao: Leia): Promise<llvm.Value> {
        const mensagemPrompt = expressao.argumentos[0];
        const mensagemResolvida = await mensagemPrompt.aceitar(this);

        const tipoLeitura = expressao.tipo || "texto";

        const tipoLlvm = this.obterTipoLlvm(tipoLeitura);

        const formatoLeia = this.buscarFormatoLeia(tipoLeitura);

        const result = this.montador.CreateCall(this.funcaoLeia, [mensagemResolvida, formatoLeia]);

        return result
    }

    async visitarExpressaoListaCompreensao(listaCompreensao: ListaCompreensao): Promise<any> {
        const listaTipada = listaCompreensao as any;
        const origem = listaTipada.lista ?? listaTipada.iteravel ?? [];
        const origemResolvida = origem?.aceitar ? await origem.aceitar(this) : origem;

        const resultado: any[] = [];
        if (Array.isArray(origemResolvida)) {
            for (const item of origemResolvida) {
                if (listaTipada.expressao?.aceitar) {
                    resultado.push(await listaTipada.expressao.aceitar(this));
                } else {
                    resultado.push(item);
                }
            }
        }

        return Promise.resolve(resultado);
    }

    async visitarExpressaoLogica(expressao: Logico): Promise<any> {
        // Avalia curto-circuito: resolve esquerda, decide, possivelmente resolve direita.
        const esquerda = await expressao.esquerda.aceitar(this);
        const tipoEsquerda = this.resolverTipoConstruto(expressao.esquerda);
        const esquerdaRes = this.resolverOperando(esquerda, tipoEsquerda);

        if (expressao.operador.tipo === 'OU') {
            // curto-circuito: se esquerda true -> true; simplificação: gera OR entre valores.
            const direita = await expressao.direita.aceitar(this);
            const tipoDireita = this.resolverTipoConstruto(expressao.direita);
            const direitaRes = this.resolverOperando(direita, tipoDireita);
            return Promise.resolve(this.montador.CreateOr(esquerdaRes.valor, direitaRes.valor, 'or_tmp'));
        } else if (expressao.operador.tipo === 'E') {
            const direita = await expressao.direita.aceitar(this);
            const tipoDireita = this.resolverTipoConstruto(expressao.direita);
            const direitaRes = this.resolverOperando(direita, tipoDireita);
            return Promise.resolve(this.montador.CreateAnd(esquerdaRes.valor, direitaRes.valor, 'and_tmp'));
        }
        return Promise.resolve(esquerda);
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
        const expressaoTipada = expressao as any;
        const iteravel = expressaoTipada.vetor ?? expressaoTipada.iteravel ?? [];
        const iteravelResolvido = iteravel?.aceitar ? await iteravel.aceitar(this) : iteravel;
        const corpo = expressaoTipada.corpo?.declaracoes || [];

        if (Array.isArray(iteravelResolvido) && iteravelResolvido.length > 0) {
            for (const _ of iteravelResolvido) {
                await this.aceitarListaDeclaracoes(corpo);
            }
        } else {
            await this.aceitarListaDeclaracoes(corpo);
        }

        return Promise.resolve();
    }

    async visitarExpressaoReferenciaFuncao(expressao: ReferenciaFuncao): Promise<any> {
        // Retorna a VariavelEscopo correspondente à referência (se existir).
        const topo = this.pilhaVariaveisEscopo.topoDaPilha();
        const v = topo.get(expressao.simboloFuncao.lexema);
        return Promise.resolve(v);
    }

    async visitarExpressaoRetornar(declaracao: Retorna): Promise<any> {
        if (!declaracao.valor) {
            this.montador.CreateRetVoid();
            return Promise.resolve();
        }

        const valorResolvido = await declaracao.valor.aceitar(this);

        if (valorResolvido instanceof VariavelEscopo) {
            const tipoRetorno = declaracao.valor.tipo || valorResolvido.tipo || 'número';
            if (this.tipoEhPonteiro(valorResolvido.variavelLlvm.getType())) {
                const tipoLlvmRetorno = this.obterTipoLlvm(tipoRetorno);
                const valorCarregado = this.montador.CreateLoad(tipoLlvmRetorno, valorResolvido.variavelLlvm, 'load_retorno');
                this.montador.CreateRet(valorCarregado);
            } else {
                this.montador.CreateRet(valorResolvido.variavelLlvm);
            }
            return Promise.resolve();
        }

        let valorFinal = valorResolvido as llvm.Value;

        // Conversões de tipo quando a função foi compilada via compilarLambda e tem tipo de retorno esperado.
        if (this.tipoRetornoFuncaoAtual === 'inteiro') {
            const operadorLexema = (declaracao.valor as any)?.operador?.lexema;
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

    async visitarExpressaoSeparador(expressao: Separador): Promise<any> {
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
            return this.montador.CreateSelect(condicao as llvm.Value, expressaoSeResolvida as llvm.Value, expressaoSenaoResolvida as llvm.Value, 'ternary_sel');
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
        const nomeSuperClasse: string =
            (expressao as any).superclasse ??
            this.superClasses.get(istoEscopo.tipo) ??
            null;

        if (!nomeSuperClasse) return Promise.resolve(istoEscopo);

        return Promise.resolve(
            new VariavelEscopo(istoEscopo.variavelLlvm, undefined, nomeSuperClasse)
        );
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
        const expressaoTipada = expressao as any;
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

    async visitarExpressaoTuplaN(expressao: TuplaN): Promise<any> {
        // Tuplas sem limite de tamanho não têm geração de IR neste compilador.
        return Promise.resolve();
    }

    async visitarExpressaoTipoDe(expressao: TipoDe): Promise<any> {
        const expressaoTipada = expressao as any;
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
            this.montador.CreateGlobalStringPtr(
                tipoInferido,
                `tipo_de_${tipoInferido}`,
                0,
                this.modulo
            )
        );
    }

    async visitarExpressaoUnaria(expressao: Unario): Promise<llvm.Value> {
        const operandoResolvido = await expressao.operando.aceitar(this);

        let valor: llvm.Value;
        if (operandoResolvido instanceof VariavelEscopo) {
            const tipoOperando = this.obterTipoLlvm(expressao.operando.tipo);
            valor = this.montador.CreateLoad(tipoOperando, operandoResolvido.variavelLlvm, "load_unary");
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
                    novoValor = this.montador.CreateNSWAdd(valor, um, "inc");
                } else {
                    const um = ConstantFP.get(this.montador.getDoubleTy(), new APFloat(1.0));
                    novoValor = this.montador.CreateFAdd(valor, um, "inc");
                }

                if (operandoResolvido instanceof VariavelEscopo) {
                    this.montador.CreateStore(novoValor, operandoResolvido.variavelLlvm);
                }

                return Promise.resolve(novoValor);

            case 'DECREMENTAR':
                let valorDecrementado: llvm.Value;
                if (expressao.operando.tipo === 'inteiro') {
                    const um = ConstantInt.get(this.contexto, new APInt(32, 1));
                    valorDecrementado = this.montador.CreateNSWSub(valor, um, "dec");
                } else {
                    const um = ConstantFP.get(this.montador.getDoubleTy(), new APFloat(1.0));
                    valorDecrementado = this.montador.CreateFSub(valor, um, "dec");
                }

                if (operandoResolvido instanceof VariavelEscopo) {
                    this.montador.CreateStore(valorDecrementado, operandoResolvido.variavelLlvm);
                }

                return Promise.resolve(valorDecrementado);

            default:
                throw new Error(`Operador unário ${expressao.operador.tipo} não implementado.`);
        }
    }

    async visitarExpressaoVetor(expressao: Vetor): Promise<any> {
        // Filtra Separadores (vírgulas) que o parser inclui entre os elementos.
        const valores = (expressao.valores || []).filter((v) => v.constructor.name !== 'Separador');

        // Sem contexto LLVM: retorna array JS (caminho do interpretador).
        if (!this.tipoEstruturaVetor) {
            const valoresResolvidos: any[] = [];
            for (const valor of valores) {
                valoresResolvidos.push(valor?.aceitar ? await valor.aceitar(this) : valor);
            }
            return Promise.resolve(valoresResolvidos);
        }

        const tamanho = valores.length;
        const tipoElementoStr = this.tipoElementoVetor(
            expressao.tipo ?? (tamanho > 0 ? this.resolverTipoConstruto(valores[0]) : 'inteiro')
        );
        const tipoElemento = this.obterTipoLlvm(tipoElementoStr);

        // Aloca array de elementos na pilha: [N x T]
        const tipoArrayFixo = llvm.ArrayType.get(tipoElemento, tamanho);
        const alocArray = this.montador.CreateAlloca(tipoArrayFixo, null, 'arr_elem');

        // Inicializa cada posição com seu valor.
        const idx0 = ConstantInt.get(this.contexto, new APInt(32, 0));
        for (let i = 0; i < tamanho; i++) {
            const bruto: any = await valores[i].aceitar(this);
            let valorElem: llvm.Value;

            if (bruto instanceof VariavelEscopo) {
                valorElem = this.montador.CreateLoad(tipoElemento, bruto.variavelLlvm, 'load_elem');
            } else if (bruto && typeof (bruto as any).getType === 'function') {
                // Já é um llvm.Value (ex.: ConstantFP, ConstantInt)
                valorElem = bruto as llvm.Value;
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
                tipoArrayFixo,
                alocArray,
                [idx0, ConstantInt.get(this.contexto, new APInt(32, i))],
                `ptr_arr_${i}`
            );
            this.montador.CreateStore(valorElem, gepElem);
        }

        // Aloca struct %Vetor e preenche seus dois campos.
        const alocVetor = this.montador.CreateAlloca(this.tipoEstruturaVetor, null, 'vetor');

        // Campo 0: ponteiro para o array de elementos.
        const gepCampoPtr = this.montador.CreateInBoundsGEP(
            this.tipoEstruturaVetor,
            alocVetor,
            [idx0, ConstantInt.get(this.contexto, new APInt(32, 0))],
            'ptr_campo_ptr'
        );
        this.montador.CreateStore(alocArray, gepCampoPtr);

        // Campo 1: tamanho do vetor.
        const gepCampoTam = this.montador.CreateInBoundsGEP(
            this.tipoEstruturaVetor,
            alocVetor,
            [idx0, ConstantInt.get(this.contexto, new APInt(32, 1))],
            'ptr_campo_tam'
        );
        this.montador.CreateStore(
            ConstantInt.get(this.contexto, new APInt(32, tamanho)),
            gepCampoTam
        );

        return Promise.resolve(alocVetor);
    }

    protected async visitarCorpoFuncao(funcaoConstruto: FuncaoConstruto, objetoLlvmFuncao: llvm.Function) {
        const blocoEscopo = llvm.BasicBlock.Create(this.contexto, 'entry', objetoLlvmFuncao);
        this.montador.SetInsertPoint(blocoEscopo);
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
                return this.montador.getInt32Ty();
            default:
                if (this.tipoEhVetor(tipoDelegua)) {
                    return this.tipoEstruturaVetor ?? llvm.PointerType.get(this.contexto, 0);
                }
                if (this.registroClasses.has(tipoDelegua)) {
                    return llvm.PointerType.get(this.contexto, 0);
                }
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
            if (this.tipoEhPonteiro(tipoVariavel)) {
                const tipoLlvm = this.obterTipoLlvm(tipoDelegua);
                return this.montador.CreateLoad(tipoLlvm, valor.variavelLlvm, nomeLoad);
            } else {
                return valor.variavelLlvm;
            }
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
        condicoes: Construto[]
    ): Promise<llvm.Value> {
        let comparacaoFinal: llvm.Value = null;

        for (const condicao of condicoes) {
            const valorCaso: llvm.Value = await condicao.aceitar(this);
            const tipoCaso = this.resolverTipoConstruto(condicao);

            const operandoEscolhaResolvido: OperandoInterface =
                this.resolverOperando(valorEscolha, tipoEscolha);
            const operandoCasoResolvido: OperandoInterface =
                this.resolverOperando(valorCaso, tipoCaso);

            const comparacao = await this.resolverIgualdade(
                operandoEscolhaResolvido,
                operandoCasoResolvido
            );

            if (comparacaoFinal === null) {
                comparacaoFinal = comparacao;
            } else {
                comparacaoFinal = this.montador.CreateOr(
                    comparacaoFinal,
                    comparacao,
                    this.NOMES_BLOCOS.CASO_OU
                );
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
        const blocoApos = llvm.BasicBlock.Create(
            this.contexto,
            this.NOMES_BLOCOS.ESCOLHA_APOS,
            funcaoAtual
        );

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
            blocoPadrao = llvm.BasicBlock.Create(
                this.contexto,
                this.NOMES_BLOCOS.ESCOLHA_PADRAO,
                funcaoAtual
            );
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

        const tipoFuncao = llvm.FunctionType.get(
            tipoRetorno,
            tiposParametros,
            false
        );

        const objetoLlvmFuncao = llvm.Function.Create(
            tipoFuncao,
            llvm.Function.LinkageTypes.ExternalLinkage,
            declaracao.simbolo.lexema,
            this.modulo
        );

        const mapaVariaveis: Map<string, VariavelEscopo> = new Map<string, VariavelEscopo>();
        // Aqui temos que iterar de novo os parâmetros da função, dado que a
        // referência aos argumentos da função só estão disponíveis depois que o 
        // objeto LLVM da função é criado.
        for (const [indice, parametro] of declaracao.funcao.parametros.entries()) {
            const variavelEscopo = new VariavelEscopo(objetoLlvmFuncao.getArg(indice));
            mapaVariaveis.set(parametro.nome.lexema, variavelEscopo);
        }

        this.pilhaVariaveisEscopo.empilhar(mapaVariaveis);
        await this.visitarCorpoFuncao(declaracao.funcao, objetoLlvmFuncao);
        this.pilhaVariaveisEscopo.removerUltimo();

        const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
        const variavelEscopoObjetoLlvmFuncao = new VariavelEscopo(objetoLlvmFuncao, declaracao as any);
        topoDaPilha.set(declaracao.simbolo.lexema, variavelEscopoObjetoLlvmFuncao);
    }

    /**
     * Retorna verdadeiro quando todos os casos de uma escolha contêm exatamente uma
     * condição que é um literal inteiro sem casas decimais. Nesse caso é possível
     * emitir a instrução nativa `switch` do LLVM em vez de uma cadeia de `icmp`.
     */
    private escolhaPodeUsarSwitchNativo(declaracao: Escolha): boolean {
        const tipoEscolha = this.resolverTipoConstruto(declaracao.identificadorOuLiteral);
        if (!this.tipoEhInteiroDelegua(tipoEscolha)) {
            return false;
        }

        return declaracao.caminhos.every(caso =>
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
                this.montador.CreateBr(blocoApos);
            }

            if (blocoPadrao) {
                this.montador.SetInsertPoint(blocoPadrao);
                await this.processarDeclaracoesBloco(declaracao.caminhoPadrao.declaracoes);
                this.montador.CreateBr(blocoApos);
            }

            this.montador.SetInsertPoint(blocoApos);
        } else {
            // Caminho geral: cadeia linear de icmp + cond_br.
            // Usado quando o tipo não é inteiro ou há condições compostas (OR).
            const { blocosCasos, blocoPadrao, blocoApos } =
                this.criarBlocosCasosEscolha(declaracao, funcaoAtual);
            const tipoEscolha = this.resolverTipoConstruto(declaracao.identificadorOuLiteral);

            const blocoInicial = blocosCasos.length > 0 ? blocosCasos[0] : (blocoPadrao || blocoApos);
            this.montador.CreateBr(blocoInicial);

            for (let indiceCaso = 0; indiceCaso < declaracao.caminhos.length; indiceCaso++) {
                this.montador.SetInsertPoint(blocosCasos[indiceCaso]);

                const caso = declaracao.caminhos[indiceCaso];
                const comparacaoFinal = await this.construirComparacaoCaso(
                    valorEscolha,
                    tipoEscolha,
                    caso.condicoes
                );

                const blocoCorpo = llvm.BasicBlock.Create(
                    this.contexto,
                    `${this.NOMES_BLOCOS.ESCOLHA_CORPO}_${indiceCaso}`,
                    funcaoAtual
                );

                const proximoBloco = this.obterProximoBloco(
                    indiceCaso,
                    blocosCasos,
                    blocoPadrao,
                    blocoApos
                );

                this.montador.CreateCondBr(comparacaoFinal, blocoCorpo, proximoBloco);

                this.montador.SetInsertPoint(blocoCorpo);
                await this.processarDeclaracoesBloco(caso.declaracoes);
                this.montador.CreateBr(blocoApos);
            }

            if (blocoPadrao) {
                this.montador.SetInsertPoint(blocoPadrao);
                await this.processarDeclaracoesBloco(declaracao.caminhoPadrao.declaracoes);
                this.montador.CreateBr(blocoApos);
            }

            this.montador.SetInsertPoint(blocoApos);
        }

        return Promise.resolve();
    }

    async visitarDeclaracaoEscreva(declaracao: Escreva): Promise<any> {
        const argumentosResolvidos: llvm.Value[] = [];

        const formatosTexto: string[] = []

        for (const argumento of declaracao.argumentos) {
            const argumentoResolvido = await argumento.aceitar(this);

            if (argumentoResolvido instanceof VariavelEscopo) {
                const tipoArgumento = argumentoResolvido.tipo || argumento.tipo;
                formatosTexto.push(this.printfFormatos.get(tipoArgumento));
                const tipoLlvm = this.obterTipoLlvm(tipoArgumento);
                const valorCarregado = this.montador.CreateLoad(
                    tipoLlvm,
                    argumentoResolvido.variavelLlvm,
                    "load_var"
                );
                argumentosResolvidos.push(valorCarregado);
            } else {
                formatosTexto.push(this.printfFormatos.get(argumento.tipo));
                argumentosResolvidos.push(argumentoResolvido);
            }
        }

        const fmt = this.montador.CreateGlobalStringPtr(
            formatosTexto.concat("\n").join(" "), // String formatada ex: "%s %i"
            "fmt",
            0,
            this.modulo
        )

        argumentosResolvidos.unshift(fmt)

        this.montador.CreateCall(this.funcaoEscreva, argumentosResolvidos);
        return Promise.resolve();
    }

    async visitarDeclaracaoPara(declaracao: Para): Promise<Promise<any> | void> {
        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        // Detecta contadores garantidamente não-negativos para habilitar flags GEP nuw/nusw.
        const nomesContadoresAdicionados: string[] = [];
        for (const init of [].concat(declaracao.inicializador ?? [])) {
            if (init instanceof Var && init.inicializador instanceof Literal) {
                const valor = (init.inicializador as Literal).valor;
                if (typeof valor === 'number' && valor >= 0 &&
                    this.incrementoEhPositivo(declaracao.incrementar, init.simbolo.lexema)) {
                    this.contadoresNaoNegativos.add(init.simbolo.lexema);
                    nomesContadoresAdicionados.push(init.simbolo.lexema);
                }
            }
        }

        for (const inicializador of [].concat(declaracao.inicializador)) {
            await inicializador.aceitar(this);
        }

        const blocoCabecaLoop = llvm.BasicBlock.Create(
            this.contexto,
            this.NOMES_BLOCOS.PARA_CABECA,
            funcaoAtual
        );
        const blocoCorpoLoop = llvm.BasicBlock.Create(
            this.contexto,
            this.NOMES_BLOCOS.PARA_CORPO,
            funcaoAtual
        );
        const blocoIncremento = llvm.BasicBlock.Create(
            this.contexto,
            this.NOMES_BLOCOS.PARA_INCREMENTO,
            funcaoAtual
        );
        const blocoAposLoop = llvm.BasicBlock.Create(
            this.contexto,
            this.NOMES_BLOCOS.PARA_APOS,
            funcaoAtual
        );

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
        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        const condicaoRaw = await declaracao.condicao.aceitar(this);
        const condicao = this.carregarValorSeNecessario(
            condicaoRaw,
            declaracao.condicao.tipo,
            this.NOMES_BLOCOS.LOAD_CONDICAO_SE
        );

        const blocoEntao = llvm.BasicBlock.Create(
            this.contexto,
            this.NOMES_BLOCOS.SE_ENTAO,
            funcaoAtual
        );
        const blocoSenao = llvm.BasicBlock.Create(
            this.contexto,
            this.NOMES_BLOCOS.SE_SENAO,
            funcaoAtual
        );
        const blocoApos = llvm.BasicBlock.Create(
            this.contexto,
            this.NOMES_BLOCOS.SE_APOS,
            funcaoAtual
        );

        this.montador.CreateCondBr(condicao, blocoEntao, blocoSenao);

        this.montador.SetInsertPoint(blocoEntao);
        if (declaracao.caminhoEntao) {
            await declaracao.caminhoEntao.aceitar(this);
        }
        this.montador.CreateBr(blocoApos);

        this.montador.SetInsertPoint(blocoSenao);
        if (declaracao.caminhoSenao) {
            await declaracao.caminhoSenao.aceitar(this);
        }
        this.montador.CreateBr(blocoApos);

        this.montador.SetInsertPoint(blocoApos);
        return Promise.resolve();
    }

    async visitarDeclaracaoVar(declaracao: Var): Promise<any> {
        // Se a variável não tem tipo, o tipo do inicializador deve ser verificado.
        let tipoVariavel = declaracao.tipo;
        if (tipoVariavel === 'qualquer') {
            tipoVariavel = this.resolverTipoConstruto(declaracao.inicializador);
        }

        // Importação de módulo: var mod = importar('nome') → armazena sentinela sem alloca.
        if (declaracao.inicializador?.constructor?.name === 'ImportarComoConstruto') {
            const sentinela = await declaracao.inicializador.aceitar(this);
            const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
            topoDaPilha.set(
                declaracao.simbolo.lexema,
                sentinela instanceof VariavelEscopo ? sentinela : new VariavelEscopo(null, undefined, 'qualquer')
            );
            return Promise.resolve();
        }

        // Instanciação de classe: var p = Ponto(...)
        if (this.registroClasses.has(tipoVariavel)) {
            const objetoPtr = await declaracao.inicializador.aceitar(this) as llvm.Value;
            const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
            topoDaPilha.set(declaracao.simbolo.lexema, new VariavelEscopo(objetoPtr, undefined, tipoVariavel));
            return Promise.resolve();
        }

        // Declaração de vetor: var numeros = [1, 2, 3]  ou  var numeros: inteiro[] = [...]
        if (this.tipoEhVetor(tipoVariavel)) {
            const estruturaVetor = await declaracao.inicializador.aceitar(this) as llvm.Value;
            const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
            topoDaPilha.set(declaracao.simbolo.lexema, new VariavelEscopo(estruturaVetor, undefined, tipoVariavel));
            return Promise.resolve();
        }

        const tipoLlvm = this.obterTipoLlvm(tipoVariavel);
        const inicializacaoVariavel = this.montador.CreateAlloca(tipoLlvm, null, declaracao.simbolo.lexema);
        let valorOuReferenciaVariavel = await declaracao.inicializador.aceitar(this);

        if (valorOuReferenciaVariavel instanceof VariavelEscopo) {
            const tipoOrigem = valorOuReferenciaVariavel.tipo || this.resolverTipoConstruto(declaracao.inicializador) || tipoVariavel;
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

        const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
        const variavelEscopo = new VariavelEscopo(inicializacaoVariavel, declaracao as any, tipoVariavel);
        topoDaPilha.set(declaracao.simbolo.lexema, variavelEscopo);

        return Promise.resolve();
    }

    async visitarExpressaoAgrupamento(expressao: Agrupamento): Promise<any> {
        return await expressao.expressao.aceitar(this);
    }

    resolverTipoConstruto(construto: Construto): string {
        switch (construto.constructor.name) {
            case 'Leia':
                return 'texto';
            case 'Chamada': {
                const chamada = construto as Chamada;
                if (chamada.entidadeChamada.constructor.name === 'Variavel') {
                    const nomeCallee = (chamada.entidadeChamada as Variavel).simbolo.lexema;
                    if (this.registroClasses.has(nomeCallee)) {
                        return nomeCallee;
                    }
                }
                return chamada.entidadeChamada.tipo;
            }
            case 'Vetor': {
                const vetor = construto as Vetor;
                let tipoElemento = vetor.tipo ??
                    (vetor.valores?.length > 0 ? this.resolverTipoConstruto(vetor.valores[0]) : 'inteiro');
                // Normaliza 'inteiro[]' → 'inteiro' para produzir 'vetor<inteiro>'.
                if (tipoElemento?.endsWith('[]')) {
                    tipoElemento = tipoElemento.slice(0, -2);
                }
                return `vetor<${tipoElemento}>`;
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

            if (this.tipoEhPonteiro(tipoVariavel)) {
                const tipoLlvm = this.obterTipoLlvm(tipo);
                const valorCarregado = this.montador.CreateLoad(
                    tipoLlvm,
                    variavelEscopo.variavelLlvm,
                    this.NOMES_BLOCOS.LOAD_OPERANDO
                );
                return {
                    valor: valorCarregado,
                    tipo: tipo
                };
            }

            return {
                valor: variavelEscopo.variavelLlvm,
                tipo: tipo
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

        if (nomeTipoLlvm === 'Type') {
            // Tipo genérico: em Delégua corresponde a 'número' (double/float).
            return { valor: valorLlvm, tipo: 'número' };
        }

        return { valor: valorLlvm, tipo: tipo };
    }

    protected resolverMultiplicacao(operandoEsquerdo: OperandoInterface, operandoDireito: OperandoInterface): Promise<llvm.Value> {
        if (this.tipoEhInteiroDelegua(operandoEsquerdo.tipo) && this.tipoEhInteiroDelegua(operandoDireito.tipo)) {
            // NSW (No Signed Wrap): overflow é comportamento indefinido em Delégua,
            // o que permite ao SCEV do LLVM 21 analisar e otimizar laços com esses operandos.
            return Promise.resolve(this.montador.CreateNSWMul(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFMul(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverAdicao(operandoEsquerdo: OperandoInterface, operandoDireito: OperandoInterface): Promise<llvm.Value> {
        if (this.tipoEhInteiroDelegua(operandoEsquerdo.tipo) && this.tipoEhInteiroDelegua(operandoDireito.tipo)) {
            return Promise.resolve(this.montador.CreateNSWAdd(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFAdd(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverSubtracao(operandoEsquerdo: OperandoInterface, operandoDireito: OperandoInterface): Promise<llvm.Value> {
        if (this.tipoEhInteiroDelegua(operandoEsquerdo.tipo) && this.tipoEhInteiroDelegua(operandoDireito.tipo)) {
            return Promise.resolve(this.montador.CreateNSWSub(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFSub(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverDivisao(operandoEsquerdo: OperandoInterface, operandoDireito: OperandoInterface): Promise<llvm.Value> {
        if (this.tipoEhInteiroDelegua(operandoEsquerdo.tipo) && this.tipoEhInteiroDelegua(operandoDireito.tipo)) {
            return Promise.resolve(this.montador.CreateSDiv(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFDiv(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverModulo(operandoEsquerdo: OperandoInterface, operandoDireito: OperandoInterface): Promise<llvm.Value> {
        if (this.tipoEhInteiroDelegua(operandoEsquerdo.tipo) && this.tipoEhInteiroDelegua(operandoDireito.tipo)) {
            return Promise.resolve(this.montador.CreateSRem(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFRem(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverIgualdade(operandoEsquerdo: OperandoInterface, operandoDireito: OperandoInterface): Promise<llvm.Value> {
        if (this.tipoEhInteiroDelegua(operandoEsquerdo.tipo) && this.tipoEhInteiroDelegua(operandoDireito.tipo)) {
            return Promise.resolve(this.montador.CreateICmpEQ(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFCmpOEQ(operandoEsquerdo.valor, operandoDireito.valor));
    }

    // TODO: Não sei se vai mais precisar.
    protected tipoEhInteiroDelegua(tipo: string): boolean {
        return tipo === 'inteiro' || tipo === 'longo';
    }

    protected definirTipoPrevalente(tipo1: string, tipo2: string) {
        if (tipo1 === 'número' || tipo2 === 'número') {
            return 'número';
        }

        if (tipo1 === 'longo' || tipo2 === 'longo') {
            return 'longo';
        }

        return 'inteiro';
    }

    async visitarExpressaoBinaria(expressao: Binario): Promise<any> {
        const promises = await Promise.all([
            expressao.esquerda.aceitar(this),
            expressao.direita.aceitar(this)
        ]);

        let operandoEsquerdo: llvm.Value | VariavelEscopo | ConstantFP = promises[0],
            operandoDireito: llvm.Value | VariavelEscopo | ConstantFP = promises[1];

        let tipoEsquerdo = this.resolverTipoConstruto(expressao.esquerda);
        let tipoDireito = this.resolverTipoConstruto(expressao.direita);

        const operandoEsquerdoResolvido: OperandoInterface = this.resolverOperando(operandoEsquerdo, tipoEsquerdo);
        const operandoDireitoResolvido: OperandoInterface = this.resolverOperando(operandoDireito, tipoDireito);

        const tipoPrevalente = this.definirTipoPrevalente(operandoEsquerdoResolvido.tipo, operandoDireitoResolvido.tipo);

        if (tipoPrevalente === 'número' && operandoEsquerdoResolvido.tipo !== tipoPrevalente) {
            operandoEsquerdoResolvido.valor = this.montador.CreateSIToFP(operandoEsquerdoResolvido.valor, llvm.Type.getDoubleTy(this.contexto));
            operandoEsquerdoResolvido.tipo = 'número';
        }

        if (tipoPrevalente === 'número' && operandoDireitoResolvido.tipo !== tipoPrevalente) {
            operandoDireitoResolvido.valor = this.montador.CreateSIToFP(operandoDireitoResolvido.valor, llvm.Type.getDoubleTy(this.contexto));
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
                return Promise.resolve(this.montador.CreateSDiv((operandoEsquerdo as VariavelEscopo).variavelLlvm, (operandoDireito as VariavelEscopo).variavelLlvm));
            case 'MODULO':
                return this.resolverModulo(operandoEsquerdoResolvido, operandoDireitoResolvido);
            case 'MENOR':
                if (this.tipoEhInteiroDelegua(tipoPrevalente)) {
                    return Promise.resolve(this.montador.CreateICmpSLT(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                } else {
                    return Promise.resolve(this.montador.CreateFCmpOLT(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                }
            case 'MENOR_IGUAL':
                if (this.tipoEhInteiroDelegua(tipoPrevalente)) {
                    return Promise.resolve(this.montador.CreateICmpSLE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                } else {
                    return Promise.resolve(this.montador.CreateFCmpOLE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                }
            case 'MAIOR':
                if (this.tipoEhInteiroDelegua(tipoPrevalente)) {
                    return Promise.resolve(this.montador.CreateICmpSGT(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                } else {
                    return Promise.resolve(this.montador.CreateFCmpOGT(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                }
            case 'MAIOR_IGUAL':
                if (this.tipoEhInteiroDelegua(tipoPrevalente)) {
                    return Promise.resolve(this.montador.CreateICmpSGE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                } else {
                    return Promise.resolve(this.montador.CreateFCmpOGE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                }
            case 'IGUAL_IGUAL':
                return this.resolverIgualdade(operandoEsquerdoResolvido, operandoDireitoResolvido);
            case 'DIFERENTE':
                if (this.tipoEhInteiroDelegua(tipoPrevalente)) {
                    return Promise.resolve(this.montador.CreateICmpNE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                } else {
                    return Promise.resolve(this.montador.CreateFCmpONE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                }
        }
    }

    async visitarExpressaoBloco(declaracao: Bloco): Promise<any> {
        for (const instrucao of declaracao.declaracoes) {
            await instrucao.aceitar(this);
        }
        return Promise.resolve();
    }

    visitarExpressaoComentario(expressao: ComentarioComoConstruto): Promise<any> | void {
        return Promise.resolve();
    }

    visitarExpressaoContinua(declaracao?: Continua): ContinuarQuebra {
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

    private resolverArgumentoChamada(argumento: Construto, tipoParametro: string) {
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

    private async instanciarClasse(nomeClasse: string, argumentos: Construto[]): Promise<llvm.Value> {
        const tipoStruct = this.registroClasses.get(nomeClasse);
        const objetoAlloc = this.montador.CreateAlloca(tipoStruct, null, `obj_${nomeClasse}`);

        const funcaoConstrutor = this.modulo.getFunction(`${nomeClasse}_construtor`);
        if (funcaoConstrutor) {
            const args: llvm.Value[] = [objetoAlloc];
            for (const argumento of argumentos) {
                const argResolvido = await argumento.aceitar(this);
                args.push(argResolvido instanceof VariavelEscopo ? argResolvido.variavelLlvm : argResolvido as llvm.Value);
            }
            this.montador.CreateCall(funcaoConstrutor, args);
        }

        return objetoAlloc;
    }

    private async chamarMetodoInstancia(acesso: AcessoMetodo | AcessoMetodoOuPropriedade, argumentos: Construto[]): Promise<llvm.Value> {
        const objetoResolvido = await acesso.objeto.aceitar(this);
        let objetoPtr: llvm.Value;
        let nomeClasse: string;

        if (objetoResolvido instanceof VariavelEscopo) {
            objetoPtr = objetoResolvido.variavelLlvm;
            nomeClasse = objetoResolvido.tipo;
        } else {
            objetoPtr = objetoResolvido as llvm.Value;
            if (acesso.objeto.constructor.name === 'Variavel') {
                nomeClasse = this.pilhaVariaveisEscopo.obterValor((acesso.objeto as Variavel).simbolo.lexema)?.tipo;
            }
        }

        // AcessoMetodo usa .nomeMetodo; AcessoMetodoOuPropriedade usa .simbolo.lexema
        const nomeMetodo = (acesso as AcessoMetodo).nomeMetodo ?? (acesso as AcessoMetodoOuPropriedade).simbolo.lexema;

        // Métodos embutidos de texto
        if (nomeClasse === 'texto') {
            return await this.chamarMetodoTexto(nomeMetodo, objetoPtr, argumentos);
        }

        // Métodos embutidos de vetor
        if (this.tipoEhVetor(nomeClasse)) {
            const tipoElem = this.tipoElementoVetor(nomeClasse);
            return await this.chamarMetodoVetor(nomeMetodo, objetoPtr, tipoElem, argumentos);
        }

        // Despacho de módulo importado:
        //   var mod = importar('nome')         → tipo 'modulo:nome'
        //   importar tudo como mod de 'nome'   → tipo 'modulo:nome'
        if (nomeClasse?.startsWith('modulo:')) {
            const nomeModulo = nomeClasse.slice(7);
            const funcoes = this.mapaModulos.get(nomeModulo);
            const entrada = funcoes?.get(nomeMetodo);
            if (!entrada) {
                throw new Error(`Função '${nomeMetodo}' não encontrada no módulo '${nomeModulo}'.`);
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
                    args.push(argResolvido instanceof VariavelEscopo
                        ? argResolvido.variavelLlvm
                        : argResolvido as llvm.Value);
                }
            }
            return this.montador.CreateCall(entrada.callee, args);
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
        if (!funcaoLlvm) {
            throw new Error(`Método '${nomeMetodo}' não encontrado na classe '${nomeClasse}'.`);
        }

        const args: llvm.Value[] = [objetoPtr];
        for (const argumento of argumentos) {
            const argResolvido = await argumento.aceitar(this);
            args.push(argResolvido instanceof VariavelEscopo ? argResolvido.variavelLlvm : argResolvido as llvm.Value);
        }

        return this.montador.CreateCall(funcaoLlvm, args);
    }

    private async chamarMetodoTexto(nomeMetodo: string, objetoPtr: llvm.Value, argumentos: Construto[]): Promise<llvm.Value> {
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

            default:
                throw new Error(`Método de texto '${nomeMetodo}' não implementado.`);
        }
    }

    // Retorna o tamanho em bytes de um elemento de vetor segundo o tipo Delégua.
    private tamElementoEmBytes(tipoElem: string): number {
        if (tipoElem === 'inteiro') return 4;
        // número, longo, texto (ponteiro 64-bit) → 8 bytes
        return 8;
    }

    // Constante i32 para tamanho de elemento.
    private constTamElem(tipoElem: string): llvm.Value {
        return ConstantInt.get(this.contexto, new APInt(32, this.tamElementoEmBytes(tipoElem)));
    }

    private async chamarMetodoVetor(
        nomeMetodo: string,
        vetorPtr: llvm.Value,
        tipoElem: string,
        argumentos: Construto[]
    ): Promise<llvm.Value> {
        const tamElem = this.constTamElem(tipoElem);
        const ehNumero = ConstantInt.get(this.contexto, new APInt(32, tipoElem === 'número' || tipoElem === 'numero' ? 1 : 0));

        switch (nomeMetodo) {
            case 'adicionar':
            case 'empilhar': {
                // Aloca um slot temporário para o elemento e passa seu endereço
                const tipoLlvmElem = this.obterTipoLlvm(tipoElem);
                const alocElem = this.montador.CreateAlloca(tipoLlvmElem, null, 'novo_elem');
                let valorElem: llvm.Value;
                if (tipoElem === 'inteiro') {
                    valorElem = await this.carregarArgumentoInteiro(argumentos[0]);
                } else if (tipoElem === 'número' || tipoElem === 'numero') {
                    valorElem = await this.carregarArgumentoNumero(argumentos[0]);
                } else {
                    valorElem = await this.carregarArgumentoTexto(argumentos[0]);
                }
                this.montador.CreateStore(valorElem, alocElem);
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
                const alocSaida = this.montador.CreateAlloca(this.tipoEstruturaVetor, null, 'fatia');
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
                    'inteiro'   // predicado retorna inteiro (0/1)
                );
                const alocSaida = this.montador.CreateAlloca(this.tipoEstruturaVetor, null, 'filtrado');
                if (tipoElem === 'inteiro') {
                    this.montador.CreateCall(this.funcaoVetorFiltrarInteiro, [vetorPtr, fnPtr, alocSaida]);
                } else {
                    this.montador.CreateCall(this.funcaoVetorFiltrarNumero, [vetorPtr, fnPtr, alocSaida]);
                }
                return alocSaida;
            }

            case 'mapear': {
                const tipoRetorno = tipoElem;
                const fnPtr = await this.resolverPonteiroDeFuncao(
                    argumentos[0],
                    [tipoElem],
                    tipoRetorno
                );
                const alocSaida = this.montador.CreateAlloca(this.tipoEstruturaVetor, null, 'mapeado');
                if (tipoElem === 'inteiro') {
                    this.montador.CreateCall(this.funcaoVetorMapearInteiro, [vetorPtr, fnPtr, alocSaida]);
                } else if (tipoElem === 'número' || tipoElem === 'numero') {
                    this.montador.CreateCall(this.funcaoVetorMapearNumero, [vetorPtr, fnPtr, alocSaida]);
                } else {
                    this.montador.CreateCall(this.funcaoVetorMapearTexto, [vetorPtr, fnPtr, alocSaida]);
                }
                return alocSaida;
            }

            default:
                throw new Error(`Método de vetor '${nomeMetodo}' não implementado.`);
        }
    }

    // Resolve o ponteiro LLVM de uma função passada como argumento.
    // Se for FuncaoConstruto (lambda), compila-a primeiro.
    // Se for referência a função nomeada, carrega da pilha de escopo.
    private async resolverPonteiroDeFuncao(
        argumento: Construto,
        tiposParametrosEsperados: string[],
        tipoRetornoEsperado: string
    ): Promise<llvm.Value> {
        const nomeConstruct = argumento.constructor.name;
        if (nomeConstruct === 'FuncaoConstruto') {
            return await this.compilarLambda(argumento as FuncaoConstruto, tiposParametrosEsperados, tipoRetornoEsperado);
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
    private async compilarLambda(
        construto: FuncaoConstruto,
        tiposParametrosEsperados: string[],
        tipoRetornoEsperado: string
    ): Promise<llvm.Function> {
        const nomeLambda = `__lambda_${this.contadorLambda++}`;

        // Monta tipos dos parâmetros: usa a anotação do parâmetro ou o tipo esperado.
        const tiposParamStr: string[] = construto.parametros.map((p, i) => {
            const tipo = p.tipoDado && p.tipoDado !== 'qualquer' ? p.tipoDado : (tiposParametrosEsperados[i] ?? 'número');
            return tipo;
        });
        const tiposParamLlvm = tiposParamStr.map(t => this.obterTipoLlvm(t));

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

        this.tipoRetornoFuncaoAtual = tipoRetornoAnterior;
        this.montador.SetInsertPoint(blocoAnterior);

        return funcaoLlvm;
    }

    private async carregarArgumentoTexto(argumento: Construto): Promise<llvm.Value> {
        const resolvido = await argumento.aceitar(this);
        if (resolvido instanceof VariavelEscopo) {
            return this.montador.CreateLoad(this.montador.getPtrTy(), resolvido.variavelLlvm, 'load_arg_texto');
        }
        return resolvido as llvm.Value;
    }

    private async carregarArgumentoInteiro(argumento: Construto): Promise<llvm.Value> {
        const resolvido = await argumento.aceitar(this);
        let valor: llvm.Value;
        if (resolvido instanceof VariavelEscopo) {
            const tipoLlvm = this.obterTipoLlvm(resolvido.tipo ?? argumento.tipo ?? 'inteiro');
            valor = this.montador.CreateLoad(tipoLlvm, resolvido.variavelLlvm, 'load_arg_int');
        } else {
            valor = resolvido as llvm.Value;
        }
        // Converte double → i32 se necessário (literais inteiros chegam como double no Delégua)
        if (valor.getType().isDoubleTy()) {
            return this.montador.CreateFPToSI(valor, this.montador.getInt32Ty(), 'double_para_int');
        }
        return valor;
    }

    private async chamarFuncaoTexto(argumentos: Construto[]): Promise<llvm.Value> {
        const argumento = argumentos[0];
        const resolvido = await argumento.aceitar(this);

        let valor: llvm.Value;
        let tipo: string;

        if (resolvido instanceof VariavelEscopo) {
            tipo = resolvido.tipo ?? argumento.tipo ?? 'número';
            valor = this.montador.CreateLoad(this.obterTipoLlvm(tipo), resolvido.variavelLlvm, 'load_texto_arg');
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

    private async chamarAleatorioEntre(argumentos: Construto[]): Promise<llvm.Value> {
        const a = await this.carregarArgumentoNumero(argumentos[0]);
        const b = await this.carregarArgumentoNumero(argumentos[1]);
        return this.montador.CreateCall(this.funcaoAleatorioEntre, [a, b]);
    }

    private async chamarMapear(argumentos: Construto[]): Promise<llvm.Value> {
        // mapear(lista, fn)  →  novo vetor com fn aplicada a cada elemento
        const vetorArg = argumentos[0];
        const fnArg = argumentos[1];

        // Resolve o vetor de entrada
        const vetorResolvido = await vetorArg.aceitar(this);
        const vetorPtr: llvm.Value = vetorResolvido instanceof VariavelEscopo
            ? vetorResolvido.variavelLlvm
            : vetorResolvido as llvm.Value;

        // Determina o tipo do elemento
        const tipoVetor = vetorArg.tipo ?? this.resolverTipoConstruto(vetorArg);
        const tipoElem = this.tipoElementoVetor(tipoVetor);
        const ehNumero = tipoElem === 'número' || tipoElem === 'numero';

        const fnPtr = await this.resolverPonteiroDeFuncao(fnArg, [tipoElem], tipoElem);

        const alocSaida = this.montador.CreateAlloca(this.tipoEstruturaVetor, null, 'mapeado');
        if (ehNumero) {
            this.montador.CreateCall(this.funcaoVetorMapearNumero, [vetorPtr, fnPtr, alocSaida]);
        } else {
            this.montador.CreateCall(this.funcaoVetorMapearInteiro, [vetorPtr, fnPtr, alocSaida]);
        }
        return alocSaida;
    }

    private async carregarArgumentoNumero(argumento: Construto): Promise<llvm.Value> {
        const resolvido = await argumento.aceitar(this);
        let valor: llvm.Value;
        if (resolvido instanceof VariavelEscopo) {
            const tipoLlvm = this.obterTipoLlvm(resolvido.tipo ?? argumento.tipo ?? 'número');
            valor = this.montador.CreateLoad(tipoLlvm, resolvido.variavelLlvm, 'load_arg_num');
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
        // Instanciação de classe: Ponto(...)
        if (expressao.entidadeChamada.constructor.name === 'Variavel') {
            const nomeCallee = (expressao.entidadeChamada as Variavel).simbolo.lexema;
            if (this.registroClasses.has(nomeCallee)) {
                return await this.instanciarClasse(nomeCallee, expressao.argumentos);
            }
            // texto() escolhe a função C com base no tipo do argumento
            if (nomeCallee === 'texto') {
                return await this.chamarFuncaoTexto(expressao.argumentos);
            }
            // aleatorioEntre precisa de despacho próprio para carregar variáveis como double
            if (nomeCallee === 'aleatorioEntre') {
                return await this.chamarAleatorioEntre(expressao.argumentos);
            }
            // mapear(lista, fn) — função global que mapeia elementos de um vetor
            if (nomeCallee === 'mapear') {
                return await this.chamarMapear(expressao.argumentos);
            }
        }

        // Chamada de método: p.distancia() — Delégua usa AcessoMetodoOuPropriedade na maioria dos casos
        if (expressao.entidadeChamada.constructor.name === 'AcessoMetodo' ||
            expressao.entidadeChamada.constructor.name === 'AcessoMetodoOuPropriedade') {
            return await this.chamarMetodoInstancia(expressao.entidadeChamada as AcessoMetodo, expressao.argumentos);
        }

        const entidadeChamadaResolvida = await expressao.entidadeChamada.aceitar(this);
        const variavelEscopoCorrespondente = this.pilhaVariaveisEscopo.obterValor((expressao.entidadeChamada as Variavel).simbolo.lexema);
        const argumentos: llvm.Value[] = [];

        if (variavelEscopoCorrespondente.construtoVariavel) {
            const construtoCorrespondente = (variavelEscopoCorrespondente.construtoVariavel as unknown as FuncaoDeclaracao).funcao;

            const tiposParametros = [];
            for (const parametro of construtoCorrespondente.parametros) {
                tiposParametros.push(parametro.tipoDado);
            }   

            
            for (const [indice, argumento] of expressao.argumentos.entries()) {
                const argumentoAjustado = this.resolverArgumentoChamada(argumento, tiposParametros[indice]);
                const argumentoResolvido = await argumentoAjustado.aceitar(this);
                argumentos.push(argumentoResolvido);
            }
        } else {
            for (const argumento of expressao.argumentos) {
                const argumentoAjustado = this.resolverArgumentoChamada(argumento, argumento.tipo || "texto")
                const argumentoResolvido = await argumentoAjustado.aceitar(this);
                argumentos.push(argumentoResolvido)
            }
        }

        return this.montador.CreateCall(entidadeChamadaResolvida.variavelLlvm, argumentos);
    }

    async visitarExpressaoDeVariavel(expressao: Variavel | Constante): Promise<VariavelEscopo> {
        const topoDaPilhaDeVariaveis = this.pilhaVariaveisEscopo.topoDaPilha();
        const valorOuReferenciaVariavel = topoDaPilhaDeVariaveis.get(expressao.simbolo.lexema);
        if (!valorOuReferenciaVariavel) {
            throw new Error(`Variável ${expressao.simbolo.lexema} não existe neste escopo.`);
        }

        return Promise.resolve(valorOuReferenciaVariavel);
    }

    visitarExpressaoLiteral(expressao: Literal): Promise<llvm.Value> {
        // TODO: Por questões de preguiça, por enquanto vamos imaginar que aqui só
        // teremos números. Ajustar depois.
        switch (expressao.tipo) {
            case 'inteiro':
                return Promise.resolve(
                    ConstantInt.get(
                        this.contexto,
                        new APInt(32, expressao.valor as number)
                    )
                );
            case 'longo':
                return Promise.resolve(
                    ConstantInt.get(
                        this.contexto,
                        new APInt(64, expressao.valor as number)
                    )
                );
            case 'número':
                return Promise.resolve(
                    ConstantFP.get(
                        this.montador.getDoubleTy(),
                        new APFloat(expressao.valor as number)
                    )
                );
            case 'lógico':
                return Promise.resolve(
                    ConstantInt.get(
                        this.contexto,
                        new APInt(1, expressao.valor ? 1 : 0)
                    )
                );
            case 'texto': {
                const valor = expressao.valor as string;
                if (valor.includes('${')) {
                    return this.resolverTextoInterpolado(valor);
                }
                return Promise.resolve(
                    this.montador.CreateGlobalStringPtr(valor, "str", 0, this.modulo)
                );
            }
        }
    }

    private parsearTemplateString(modelo: string): Array<string | { nomeVar: string }> {
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

    private async resolverTextoInterpolado(modelo: string): Promise<llvm.Value> {
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
                const valor = this.montador.CreateLoad(tipoLlvm, varEscopo.variavelLlvm, `load_interp_${parte.nomeVar}`);
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
    protected criarFuncoesNativa(): void {
        // %Vetor = type { ptr, i32 }  (ponteiro para elementos + tamanho)
        this.tipoEstruturaVetor = llvm.StructType.create(this.contexto, 'Vetor');
        this.tipoEstruturaVetor.setBody([
            llvm.PointerType.get(this.contexto, 0),
            this.montador.getInt32Ty()
        ]);

        // int escreva(const char *fmt, ...)
        const tipoRetornoPrinter = this.montador.getInt32Ty();
        const tipoFuncaoPrinter = llvm.FunctionType.get(
            tipoRetornoPrinter,
            [
                this.montador.getPtrTy()
            ],
            true
        );

        this.funcaoEscreva = this.modulo.getOrInsertFunction('escreva', tipoFuncaoPrinter);

        // void* leia(const char* texto, const char *fmt)
        const tipoFuncaoLeia = llvm.FunctionType.get(
            this.montador.getPtrTy(),
            [
                this.montador.getPtrTy(),
                this.montador.getPtrTy()
            ],
            false
        );

        this.funcaoLeia = this.modulo.getOrInsertFunction('leia', tipoFuncaoLeia);

        // int inteiro(void *valor)
        const tipoFuncaoInteiro = llvm.FunctionType.get(
            this.montador.getInt32Ty(),
            [this.montador.getPtrTy()],
            false
        );

        this.funcaoInteiro = this.modulo.getOrInsertFunction('inteiro', tipoFuncaoInteiro);

        // double numero(void *valor)
        const tipoFuncaoNumero = llvm.FunctionType.get(
            this.montador.getDoubleTy(),
            [this.montador.getPtrTy()],
            false
        );

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
                this.montador.getPtrTy()
            ],
            false
        );

        this.funcaoPersonalidade = llvm.Function.Create(
            tipoPersonalidade,
            llvm.Function.LinkageTypes.ExternalLinkage,
            '__gxx_personality_v0',
            this.modulo
        );

        const tipoBeginCatch = llvm.FunctionType.get(
            this.montador.getPtrTy(),
            [this.montador.getPtrTy()],
            false
        );

        this.funcaoBeginCatch = this.modulo.getOrInsertFunction('__cxa_begin_catch', tipoBeginCatch);

        const tipoEndCatch = llvm.FunctionType.get(
            llvm.Type.getVoidTy(this.contexto),
            [],
            false
        );

        this.funcaoEndCatch = this.modulo.getOrInsertFunction('__cxa_end_catch', tipoEndCatch);

        // char* delegua_texto_maiusculo(const char* s)
        // char* delegua_texto_minusculo(const char* s)
        const tipoFuncaoTextoPtr1 = llvm.FunctionType.get(
            this.montador.getPtrTy(),
            [this.montador.getPtrTy()],
            false
        );
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
        this.funcaoTextoSubstituir = this.modulo.getOrInsertFunction('delegua_texto_substituir', tipoFuncaoTextoSubstituir);

        // double aleatorio(void)
        const tipoFuncaoAleatorio = llvm.FunctionType.get(
            this.montador.getDoubleTy(), [], false
        );
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
            true  // variadic
        );
        this.funcaoFormatar = this.modulo.getOrInsertFunction('delegua_formatar', tipoFuncaoFormatar);

        // int delegua_vetor_adicionar(Vetor* v, void* elem, int tam_elem)
        const tipoFuncaoVetorAdicionar = llvm.FunctionType.get(
            this.montador.getInt32Ty(),
            [this.montador.getPtrTy(), this.montador.getPtrTy(), this.montador.getInt32Ty()],
            false
        );
        this.funcaoVetorAdicionar = this.modulo.getOrInsertFunction('delegua_vetor_adicionar', tipoFuncaoVetorAdicionar);

        // int delegua_vetor_remover_ultimo(Vetor* v)
        const tipoFuncaoVetorRemoverUltimo = llvm.FunctionType.get(
            this.montador.getInt32Ty(),
            [this.montador.getPtrTy()],
            false
        );
        this.funcaoVetorRemoverUltimo = this.modulo.getOrInsertFunction('delegua_vetor_remover_ultimo', tipoFuncaoVetorRemoverUltimo);

        // int delegua_vetor_remover_primeiro(Vetor* v, int tam_elem)
        const tipoFuncaoVetorRemoverPrimeiro = llvm.FunctionType.get(
            this.montador.getInt32Ty(),
            [this.montador.getPtrTy(), this.montador.getInt32Ty()],
            false
        );
        this.funcaoVetorRemoverPrimeiro = this.modulo.getOrInsertFunction('delegua_vetor_remover_primeiro', tipoFuncaoVetorRemoverPrimeiro);

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
                this.montador.getPtrTy()
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
        this.funcaoVetorJuntarInteiro = this.modulo.getOrInsertFunction('delegua_vetor_juntar_inteiro', tipoFuncaoVetorJuntar);
        this.funcaoVetorJuntarNumero = this.modulo.getOrInsertFunction('delegua_vetor_juntar_numero', tipoFuncaoVetorJuntar);
        this.funcaoVetorJuntarTexto = this.modulo.getOrInsertFunction('delegua_vetor_juntar_texto', tipoFuncaoVetorJuntar);

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
        this.funcaoVetorFiltrarInteiro = this.modulo.getOrInsertFunction('delegua_vetor_filtrar_inteiro', tipoFuncaoVetorCallback);
        this.funcaoVetorFiltrarNumero  = this.modulo.getOrInsertFunction('delegua_vetor_filtrar_numero',  tipoFuncaoVetorCallback);
        this.funcaoVetorMapearInteiro  = this.modulo.getOrInsertFunction('delegua_vetor_mapear_inteiro',  tipoFuncaoVetorCallback);
        this.funcaoVetorMapearNumero   = this.modulo.getOrInsertFunction('delegua_vetor_mapear_numero',   tipoFuncaoVetorCallback);
        this.funcaoVetorMapearTexto    = this.modulo.getOrInsertFunction('delegua_vetor_mapear_texto',    tipoFuncaoVetorCallback);

        this.registrarModuloMatematica();
        this.registrarModuloFisica();
        this.registrarModuloEstatistica();
        this.registrarModuloArquivos();
        this.registrarModuloCsv();
        this.registrarModuloJson();
        this.registrarModuloHttp();
        this.registrarModuloCriptografia();
        this.registrarModuloDados();
    }

    private registrarModuloMatematica(): void {
        const d = this.montador.getDoubleTy();
        const i32 = this.montador.getInt32Ty();

        // Auxiliar: cria FunctionCallee para uma função C com assinatura double(double...)
        const reg = (nomeCFunc: string, tiposParametros: string[], tipoRetorno: string = 'numero'): EntradaFuncaoModulo => {
            const tiposLlvm = tiposParametros.map(t => t === 'inteiro' ? i32 : d);
            const tipo = llvm.FunctionType.get(d, tiposLlvm, false);
            const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
            return { callee, tiposParametros, tipoRetorno };
        };

        const funcoes = new Map<string, EntradaFuncaoModulo>([
            // Algébricas
            ['exp',                    reg('delegua_mat_exp',                    ['numero'])],
            ['logaritmo',              reg('delegua_mat_logaritmo',              ['numero'])],
            ['potencia',               reg('delegua_mat_potencia',               ['numero', 'numero'])],
            ['raizQuadrada',           reg('delegua_mat_raiz_quadrada',          ['numero'])],
            ['arredondarParaBaixo',    reg('delegua_mat_arredondar_para_baixo',  ['numero'])],
            ['aprox',                  reg('delegua_mat_aprox',                  ['numero', 'inteiro'])],
            // Trigonometria
            ['pi',                     reg('delegua_mat_pi',                     [])],
            ['seno',                   reg('delegua_mat_seno',                   ['numero'])],
            ['cosseno',                reg('delegua_mat_cosseno',                ['numero'])],
            ['tangente',               reg('delegua_mat_tangente',               ['numero'])],
            ['arcoSeno',               reg('delegua_mat_arco_seno',              ['numero'])],
            ['arcoCosseno',            reg('delegua_mat_arco_cosseno',           ['numero'])],
            ['arcoTangente',           reg('delegua_mat_arco_tangente',          ['numero'])],
            ['graus',                  reg('delegua_mat_graus',                  ['numero'])],
            ['radiano',                reg('delegua_mat_radiano',                ['numero'])],
            // Cálculo
            ['limite',                 reg('delegua_mat_limite',                 ['numero', 'numero', 'numero'])],
            // Financeira
            ['jurosSimples',           reg('delegua_mat_juros_simples',          ['numero', 'numero', 'numero'])],
            ['jurosCompostos',         reg('delegua_mat_juros_compostos',        ['numero', 'numero', 'numero'])],
            // Geometria plana
            ['areaCirculo',            reg('delegua_mat_area_circulo',           ['numero'])],
            ['areaQuadrado',           reg('delegua_mat_area_quadrado',          ['numero'])],
            ['areaRetangulo',          reg('delegua_mat_area_retangulo',         ['numero', 'numero'])],
            ['areaLosango',            reg('delegua_mat_area_losango',           ['numero', 'numero'])],
            ['areaTrapezio',           reg('delegua_mat_area_trapezio',          ['numero', 'numero', 'numero'])],
            ['areaTriangulo',          reg('delegua_mat_area_triangulo',         ['numero', 'numero'])],
            ['distanciaDoisPontos',    reg('delegua_mat_distancia_dois_pontos',  ['numero', 'numero', 'numero', 'numero'])],
            // Funções de grau
            ['fun1r',                  reg('delegua_mat_fun1r',                  ['numero', 'numero'])],
            ['xVertice',               reg('delegua_mat_x_vertice',              ['numero', 'numero', 'numero'])],
            ['yVertice',               reg('delegua_mat_y_vertice',              ['numero', 'numero', 'numero'])],
        ]);

        this.mapaModulos.set('matematica', funcoes);
    }

    private registrarModuloFisica(): void {
        const d = this.montador.getDoubleTy();

        const reg = (nomeCFunc: string, tiposParametros: string[]): EntradaFuncaoModulo => {
            const tiposLlvm = tiposParametros.map(() => d);
            const tipo = llvm.FunctionType.get(d, tiposLlvm, false);
            const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
            return { callee, tiposParametros, tipoRetorno: 'numero' };
        };

        const funcoes = new Map<string, EntradaFuncaoModulo>([
            ['velocidadeMedia', reg('delegua_fis_velocidade_media', ['numero', 'numero'])],
            ['deltaS',          reg('delegua_fis_delta_s',          ['numero', 'numero'])],
            ['deltaT',          reg('delegua_fis_delta_t',          ['numero', 'numero'])],
            ['aceleracao',      reg('delegua_fis_aceleracao',       ['numero', 'numero', 'numero', 'numero'])],
        ]);

        this.mapaModulos.set('fisica', funcoes);
    }

    private registrarModuloEstatistica(): void {
        const d = this.montador.getDoubleTy();
        const ptr = this.montador.getPtrTy();

        // Auxiliar: cria EntradaFuncaoModulo para função double(Vetor*...).
        // tiposParametros usa 'vetor' para parâmetros Vetor* — o despachante usa o else-branch,
        // que passa variavelLlvm (o ponteiro alloca do Vetor) diretamente.
        const reg1 = (nomeCFunc: string): EntradaFuncaoModulo => {
            const tipo = llvm.FunctionType.get(d, [ptr], false);
            const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
            return { callee, tiposParametros: ['vetor'], tipoRetorno: 'numero' };
        };
        const reg2 = (nomeCFunc: string): EntradaFuncaoModulo => {
            const tipo = llvm.FunctionType.get(d, [ptr, ptr], false);
            const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
            return { callee, tiposParametros: ['vetor', 'vetor'], tipoRetorno: 'numero' };
        };

        const funcoes = new Map<string, EntradaFuncaoModulo>([
            ['max',         reg1('delegua_est_max')],
            ['min',         reg1('delegua_est_min')],
            ['media',       reg1('delegua_est_media')],
            ['mediana',     reg1('delegua_est_mediana')],
            ['ve',          reg1('delegua_est_variancia')],
            ['covariancia', reg2('delegua_est_covariancia')],
            // moda: retorna Vetor via out-param — adiado
        ]);

        this.mapaModulos.set('estatistica', funcoes);
    }

    private registrarModuloArquivos(): void {
        const ptr  = this.montador.getPtrTy();
        const i32  = this.montador.getInt32Ty();
        const vazio = llvm.Type.getVoidTy(this.contexto);

        // Auxiliar: cria EntradaFuncaoModulo para funções do módulo arquivos.
        // tiposParametros: 'texto' → ptr (char* ou Arquivo*), 'inteiro' → i32.
        const reg = (
            nomeCFunc: string,
            tiposParametros: string[],
            tipoRetorno: string
        ): EntradaFuncaoModulo => {
            const tiposLlvm = tiposParametros.map(t =>
                t === 'inteiro' ? i32 : ptr
            );
            const tipoRetLlvm =
                tipoRetorno === 'inteiro' ? i32
                : tipoRetorno === 'vazio'  ? vazio
                : ptr;
            const tipo = llvm.FunctionType.get(tipoRetLlvm, tiposLlvm, false);
            const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
            return { callee, tiposParametros, tipoRetorno };
        };

        const funcoes = new Map<string, EntradaFuncaoModulo>([
            // Funções de módulo (livres)
            ['abrir',              reg('delegua_arq_abrir',                ['texto'],          'texto')],
            ['diretorioAtual',     reg('delegua_arq_diretorio_atual',       [],                 'texto')],
            ['diretorioExiste',    reg('delegua_arq_diretorio_existe',      ['texto'],          'inteiro')],
            ['eArquivo',           reg('delegua_arq_e_arquivo',             ['texto'],          'inteiro')],
            ['eDiretorio',         reg('delegua_arq_e_diretorio',           ['texto'],          'inteiro')],
            // Funções de instância (recebem Arquivo* = 'texto' no mapa de módulo)
            ['paraTexto',          reg('delegua_arq_para_texto',            ['texto'],          'texto')],
            ['escrever',           reg('delegua_arq_escrever',              ['texto', 'texto'], 'vazio')],
            ['sobrescrever',       reg('delegua_arq_sobrescrever',          ['texto', 'texto'], 'vazio')],
            ['recarregar',         reg('delegua_arq_recarregar',            ['texto'],          'vazio')],
            ['instanciaEArquivo',  reg('delegua_arq_instancia_e_arquivo',   ['texto'],          'inteiro')],
            ['instanciaEDiretorio',reg('delegua_arq_instancia_e_diretorio', ['texto'],          'inteiro')],
        ]);

        this.mapaModulos.set('arquivos', funcoes);
    }

    private registrarModuloCsv(): void {
        const ptr   = this.montador.getPtrTy();
        const i8    = llvm.Type.getInt8Ty(this.contexto);
        const i32   = this.montador.getInt32Ty();
        const vazio = llvm.Type.getVoidTy(this.contexto);

        // Auxiliar — tiposParametros: 'texto' → ptr, 'inteiro' → i32, 'char' → i8.
        // O separador é passado como 'char' (i8); na chamada, usa carregarArgumentoInteiro
        // que converte double→i32, mas aqui truncamos para i8 na assinatura C.
        const reg = (
            nomeCFunc: string,
            tiposParametros: string[],
            tipoRetorno: string
        ): EntradaFuncaoModulo => {
            const tiposLlvm = tiposParametros.map(t =>
                t === 'inteiro' ? i32
                : t === 'char'  ? i8
                : ptr
            );
            const tipoRetLlvm =
                tipoRetorno === 'inteiro' ? i32
                : tipoRetorno === 'vazio'  ? vazio
                : ptr;
            const tipo = llvm.FunctionType.get(tipoRetLlvm, tiposLlvm, false);
            const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
            return { callee, tiposParametros, tipoRetorno };
        };

        const funcoes = new Map<string, EntradaFuncaoModulo>([
            // Funções principais (sep = separador CSV, inteiro com valor ASCII, ex. 44 = ',')
            ['textoParaObjetoCsv', reg('delegua_csv_texto_para_tabela', ['texto', 'inteiro'], 'texto')],
            ['objetoCsvParaTexto', reg('delegua_csv_tabela_para_texto', ['texto', 'inteiro'], 'texto')],
            ['lerCsv',             reg('delegua_csv_ler',               ['texto', 'inteiro'], 'texto')],
            ['escreverCsv',        reg('delegua_csv_escrever',          ['texto', 'texto', 'inteiro'], 'vazio')],
            // Acessores de instância (recebem TabelaCsv* = 'texto')
            ['totalLinhas',        reg('delegua_csv_total_linhas',      ['texto'],                     'inteiro')],
            ['totalColunas',       reg('delegua_csv_total_colunas',     ['texto'],                     'inteiro')],
            ['obterCelula',        reg('delegua_csv_obter_celula',      ['texto', 'inteiro', 'inteiro'],'texto')],
            ['liberar',            reg('delegua_csv_liberar',           ['texto'],                     'vazio')],
        ]);

        this.mapaModulos.set('csv', funcoes);
    }

    private registrarModuloJson(): void {
        const ptr   = this.montador.getPtrTy();
        const i32   = this.montador.getInt32Ty();
        const d     = this.montador.getDoubleTy();
        const vazio = llvm.Type.getVoidTy(this.contexto);

        // Auxiliar — tiposParametros: 'texto' → ptr (cJSON* ou char*), 'inteiro' → i32.
        const reg = (
            nomeCFunc: string,
            tiposParametros: string[],
            tipoRetorno: string
        ): EntradaFuncaoModulo => {
            const tiposLlvm = tiposParametros.map(t => t === 'inteiro' ? i32 : ptr);
            const tipoRetLlvm =
                tipoRetorno === 'inteiro' ? i32
                : tipoRetorno === 'numero'  ? d
                : tipoRetorno === 'vazio'   ? vazio
                : ptr;
            const tipo = llvm.FunctionType.get(tipoRetLlvm, tiposLlvm, false);
            const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
            return { callee, tiposParametros, tipoRetorno };
        };

        const funcoes = new Map<string, EntradaFuncaoModulo>([
            // Conversão / I/O
            ['textoParaJson',                   reg('delegua_json_texto_para_objeto',  ['texto'],           'texto')],
            ['objetoParaTextoJson',              reg('delegua_json_objeto_para_texto',  ['texto'],           'texto')],
            ['importarArquivoJson',              reg('delegua_json_importar_arquivo',   ['texto'],           'texto')],
            ['exportarObjetoParaArquivoJson',    reg('delegua_json_exportar_arquivo',   ['texto', 'texto'],  'vazio')],
            // Acessores (recebem cJSON* = 'texto' no mapa)
            ['obterCampo',                       reg('delegua_json_obter_campo',        ['texto', 'texto'],  'texto')],
            ['obterItem',                        reg('delegua_json_obter_item',         ['texto', 'inteiro'],'texto')],
            ['tamanho',                          reg('delegua_json_tamanho',            ['texto'],           'inteiro')],
            ['valorTexto',                       reg('delegua_json_valor_texto',        ['texto'],           'texto')],
            ['valorNumero',                      reg('delegua_json_valor_numero',       ['texto'],           'numero')],
            ['liberar',                          reg('delegua_json_liberar',            ['texto'],           'vazio')],
        ]);

        this.mapaModulos.set('json', funcoes);
    }

    private registrarModuloHttp(): void {
        const ptr   = this.montador.getPtrTy();
        const i32   = this.montador.getInt32Ty();
        const vazio = llvm.Type.getVoidTy(this.contexto);

        // Auxiliar — tiposParametros: 'texto' → ptr (char*, ClienteHttp* ou RespostaHttp*),
        //            'inteiro' → i32.
        const reg = (
            nomeCFunc: string,
            tiposParametros: string[],
            tipoRetorno: string
        ): EntradaFuncaoModulo => {
            const tiposLlvm = tiposParametros.map(t => t === 'inteiro' ? i32 : ptr);
            const tipoRetLlvm =
                tipoRetorno === 'inteiro' ? i32
                : tipoRetorno === 'vazio'  ? vazio
                : ptr;
            const tipo = llvm.FunctionType.get(tipoRetLlvm, tiposLlvm, false);
            const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
            return { callee, tiposParametros, tipoRetorno };
        };

        const funcoes = new Map<string, EntradaFuncaoModulo>([
            // Criação de cliente
            ['novoClienteHttp',             reg('delegua_http_novo_cliente',   ['texto', 'inteiro'],          'texto')],
            ['adicionarCabecalho',          reg('delegua_http_add_cabecalho',  ['texto', 'texto'],            'vazio')],
            // Métodos HTTP (cliente = ClienteHttp*, sufixo = char*, corpo = char*)
            ['requisicaoGet',               reg('delegua_http_get',            ['texto', 'texto'],            'texto')],
            ['requisicaoPost',              reg('delegua_http_post',           ['texto', 'texto', 'texto'],   'texto')],
            ['requisicaoPut',               reg('delegua_http_put',            ['texto', 'texto', 'texto'],   'texto')],
            ['requisicaoDelete',            reg('delegua_http_delete',         ['texto', 'texto'],            'texto')],
            ['requisicaoPatch',             reg('delegua_http_patch',          ['texto', 'texto', 'texto'],   'texto')],
            // Acessores sobre RespostaHttp*
            ['codigoStatus',                reg('delegua_http_codigo_status',  ['texto'],                     'inteiro')],
            ['dados',                       reg('delegua_http_dados',          ['texto'],                     'texto')],
            ['mensagemStatus',              reg('delegua_http_mensagem',       ['texto'],                     'texto')],
            // Limpeza de memória
            ['liberarResposta',             reg('delegua_http_liberar_resp',   ['texto'],                     'vazio')],
            ['liberarCliente',              reg('delegua_http_liberar_cliente',['texto'],                     'vazio')],
        ]);

        this.mapaModulos.set('http', funcoes);
    }

    private registrarModuloCriptografia(): void {
        const ptr = this.montador.getPtrTy();
        const i32 = this.montador.getInt32Ty();

        // reg — retorna ptr (char*); regInt — retorna i32.
        const reg = (
            nomeCFunc: string,
            tiposParametros: string[]
        ): EntradaFuncaoModulo => {
            const tiposLlvm = tiposParametros.map(t => t === 'inteiro' ? i32 : ptr);
            const tipo = llvm.FunctionType.get(ptr, tiposLlvm, false);
            const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
            return { callee, tiposParametros, tipoRetorno: 'texto' };
        };
        const regInt = (
            nomeCFunc: string,
            tiposParametros: string[]
        ): EntradaFuncaoModulo => {
            const tiposLlvm = tiposParametros.map(t => t === 'inteiro' ? i32 : ptr);
            const tipo = llvm.FunctionType.get(i32, tiposLlvm, false);
            const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
            return { callee, tiposParametros, tipoRetorno: 'inteiro' };
        };

        const funcoes = new Map<string, EntradaFuncaoModulo>([
            // XOR
            ['cifrarXor',                    reg('delegua_cript_cifrar_xor',          ['texto', 'texto'])],
            ['decifrarXor',                  reg('delegua_cript_decifrar_xor',         ['texto', 'texto'])],
            // ROT
            ['rot13',                        reg('delegua_cript_rot13',                ['texto'])],
            ['rotN',                         reg('delegua_cript_rot_n',                ['texto', 'inteiro'])],
            ['decifrarRotN',                 reg('delegua_cript_decifrar_rot_n',        ['texto', 'inteiro'])],
            // Base64
            ['codificarBase64',              reg('delegua_cript_base64_codificar',     ['texto'])],
            ['decodificarBase64',            reg('delegua_cript_base64_decodificar',   ['texto'])],
            // Menino do Acre (tema runico)
            ['criptografarEmMeninoDoAcre',   reg('delegua_cript_menino_do_acre_cif',   ['texto'])],
            ['descriptografarDeMeninoDoAcre',reg('delegua_cript_menino_do_acre_dec',   ['texto'])],
            // F.1b — hashes (requer OpenSSL -lcrypto)
            ['md5',                          reg('delegua_cript_md5',                  ['texto'])],
            ['sha1',                         reg('delegua_cript_sha1',                 ['texto'])],
            ['sha256',                       reg('delegua_cript_sha256',               ['texto'])],
            ['sha512',                       reg('delegua_cript_sha512',               ['texto'])],
            ['hmacSha256',                   reg('delegua_cript_hmac_sha256',          ['texto', 'texto'])],
            ['hmacSha512',                   reg('delegua_cript_hmac_sha512',          ['texto', 'texto'])],
            // F.1b — aleatório / UUID / PBKDF2
            ['gerarBytesAleatorios',         reg('delegua_cript_bytes_aleatorios',     ['inteiro'])],
            ['gerarTextoAleatorio',          reg('delegua_cript_texto_aleatorio',      ['inteiro'])],
            ['gerarUuid',                    reg('delegua_cript_uuid',                 [])],
            ['derivarChavePbkdf2',           reg('delegua_cript_pbkdf2',              ['texto', 'texto', 'inteiro', 'inteiro'])],
            // F.1c — AES-256-GCM (requer OpenSSL -lcrypto -lssl)
            ['criptografarAes256',           reg('delegua_cript_aes256_cifrar',        ['texto', 'texto', 'texto'])],
            ['descriptografarAes256',        reg('delegua_cript_aes256_decifrar',      ['texto', 'texto', 'texto'])],
            // F.1c — RSA (requer OpenSSL -lcrypto -lssl)
            ['gerarChavePrivadaRsa',         reg('delegua_cript_rsa_gerar_privada',    ['inteiro'])],
            ['derivarChavePublicaRsa',       reg('delegua_cript_rsa_derivar_publica',  ['texto'])],
            ['criptografarRsa',              reg('delegua_cript_rsa_cifrar',           ['texto', 'texto'])],
            ['descriptografarRsa',           reg('delegua_cript_rsa_decifrar',         ['texto', 'texto'])],
            ['assinarRsa',                   reg('delegua_cript_rsa_assinar',          ['texto', 'texto'])],
            ['verificarAssinaturaRsa',       regInt('delegua_cript_rsa_verificar',     ['texto', 'texto', 'texto'])],
        ]);

        this.mapaModulos.set('criptografia', funcoes);
    }

    private registrarModuloDados(): void {
        const ptr = this.montador.getPtrTy();
        const i32 = this.montador.getInt32Ty();
        const d   = this.montador.getDoubleTy();

        // reg — retorna ptr (RecorteDados* ou Serie* ou char*).
        const reg = (nomeCFunc: string, tiposParametros: string[]): EntradaFuncaoModulo => {
            const tiposLlvm = tiposParametros.map(t => t === 'inteiro' ? i32 : ptr);
            const tipo = llvm.FunctionType.get(ptr, tiposLlvm, false);
            const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
            return { callee, tiposParametros, tipoRetorno: 'texto' };
        };

        // regInt — retorna i32.
        const regInt = (nomeCFunc: string, tiposParametros: string[]): EntradaFuncaoModulo => {
            const tiposLlvm = tiposParametros.map(t => t === 'inteiro' ? i32 : ptr);
            const tipo = llvm.FunctionType.get(i32, tiposLlvm, false);
            const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
            return { callee, tiposParametros, tipoRetorno: 'inteiro' };
        };

        // regDouble — retorna double; parâmetros 'texto' → ptr (para RecorteDados*/Serie*).
        const regDouble = (nomeCFunc: string, tiposParametros: string[]): EntradaFuncaoModulo => {
            const tiposLlvm = tiposParametros.map(t => t === 'inteiro' ? i32 : (t === 'numero' ? d : ptr));
            const tipo = llvm.FunctionType.get(d, tiposLlvm, false);
            const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
            return { callee, tiposParametros, tipoRetorno: 'numero' };
        };

        const funcoes = new Map<string, EntradaFuncaoModulo>([
            // I/O
            ['lerCSV',              reg('delegua_dados_ler_csv',              ['texto'])],
            // Operações sobre RecorteDados
            ['cabeca',              reg('delegua_dados_cabeca',               ['texto', 'inteiro'])],
            ['cauda',               reg('delegua_dados_cauda',                ['texto', 'inteiro'])],
            ['info',                reg('delegua_dados_info',                 ['texto'])],
            ['paraTexto',           reg('delegua_dados_para_texto',           ['texto'])],
            ['removerNulo',         reg('delegua_dados_remover_nulo',         ['texto'])],
            ['selecionarColuna',    reg('delegua_dados_selecionar_coluna',    ['texto', 'texto'])],
            // Operações sobre Serie
            ['serieMax',            regDouble('delegua_dados_serie_max',      ['texto'])],
            ['serieMin',            regDouble('delegua_dados_serie_min',      ['texto'])],
            ['serieMedia',          regDouble('delegua_dados_serie_media',    ['texto'])],
            ['serieTamanho',        regInt('delegua_dados_serie_tamanho',     ['texto'])],
        ]);

        this.mapaModulos.set('dados', funcoes);
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

        for (const declaracao of declaracoes) {
            await declaracao.aceitar(this);
        }

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
     * @returns A representação intermediária do código em LLVM.
     */
    async compilar(codigo: string[]): Promise<string> {
        this.pilhaVariaveisEscopo = new PilhaVariaveisEscopo();
        this.registroClasses = new Map();
        this.indicesPropriedades = new Map();
        this.tiposPropriedades = new Map();
        this.metodosClasse = new Map();
        this.superClasses = new Map();
        this.mapaModulos = new Map();
        this.pilhaIsto = [];
        this.classesComMarcadorTipo = new Set();
        const mapaVariaveis: Map<string, VariavelEscopo> = new Map<string, VariavelEscopo>()
        this.pilhaVariaveisEscopo.empilhar(mapaVariaveis);

        this.contexto = new llvm.LLVMContext();
        this.modulo = new llvm.Module('demo', this.contexto);
        this.montador = new llvm.IRBuilder(this.contexto);
        this.tipoEstruturaVetor = null;
        this.contemExcecoes = false;
        this.contadorLambda = 0;
        this.tipoRetornoFuncaoAtual = null;

        const avaliadorSintaticoComTipagem = this.avaliadorSintatico as any;
        if (!avaliadorSintaticoComTipagem.tiposDefinidosPorBibliotecas) {
            avaliadorSintaticoComTipagem.tiposDefinidosPorBibliotecas = {};
        }

        if (!avaliadorSintaticoComTipagem.__ajusteInferenciaMembroAplicado) {
            const inferenciaOriginal = avaliadorSintaticoComTipagem.logicaComumInferenciaTiposAcessoMetodoOuPropriedade?.bind(avaliadorSintaticoComTipagem);
            if (inferenciaOriginal) {
                avaliadorSintaticoComTipagem.logicaComumInferenciaTiposAcessoMetodoOuPropriedade = (entidadeChamada: any) => {
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

        const resultadoLexador = this.lexador.mapear(codigo, -1);
        const resultadoAvaliadorSintatico = await this.avaliadorSintatico.analisar(resultadoLexador, -1);

        if (resultadoAvaliadorSintatico.erros.length > 0) {
            throw new Error(`Erros ao executar código: ${JSON.stringify(resultadoAvaliadorSintatico.erros)}`);
        }

        // Deve ser chamado de forma dinâmica assim que é usado algo que dependa dele.
        // Criação das funções nativas aqui.
        this.criarFuncoesNativa();

        const topoDaPilhaDeVariaveis = this.pilhaVariaveisEscopo.topoDaPilha()
        topoDaPilhaDeVariaveis.set("numero", new VariavelEscopo(this.funcaoNumero?.getCallee() as llvm.Value))
        topoDaPilhaDeVariaveis.set("inteiro", new VariavelEscopo(this.funcaoInteiro?.getCallee() as llvm.Value))
        topoDaPilhaDeVariaveis.set("aleatorio", new VariavelEscopo(this.funcaoAleatorio?.getCallee() as llvm.Value))
        topoDaPilhaDeVariaveis.set("aleatorioEntre", new VariavelEscopo(this.funcaoAleatorioEntre?.getCallee() as llvm.Value))

        // Classes primeiro: os structs e métodos devem existir antes de qualquer uso.
        const declaracoesClasses = resultadoAvaliadorSintatico.declaracoes.filter(d => d instanceof Classe);
        for (const declaracao of declaracoesClasses) {
            await declaracao.aceitar(this);
        }

        // Declarações de funções durante o código.
        // Delégua permite declarar funções a qualquer momento do código, mas o montador LLVM
        // reclama se fizermos isso no ponto de entrada.
        const declaracoesFuncoes = resultadoAvaliadorSintatico.declaracoes.filter(d => d instanceof FuncaoDeclaracao);
        for (const declaracao of declaracoesFuncoes) {
            await declaracao.aceitar(this);
        }

        const outrasDeclaracoes = resultadoAvaliadorSintatico.declaracoes.filter(
            d => !(d instanceof FuncaoDeclaracao) && !(d instanceof Classe)
        );
        await this.criarPontoEntrada(outrasDeclaracoes);
        // console.log(this.modulo.print());
        if (llvm.verifyModule(this.modulo)) {
            console.error('Falha ao verificar módulo.');
            return;
        }
        
        return this.modulo.print();
    }
}
