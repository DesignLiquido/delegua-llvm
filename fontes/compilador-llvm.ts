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

export class CompiladorLLVM implements VisitanteDeleguaInterface {
    lexador: Lexador;
    avaliadorSintatico: AvaliadorSintatico;

    contexto: llvm.LLVMContext;
    modulo: llvm.Module;
    montador: llvm.IRBuilder;

    pilhaVariaveisEscopo: PilhaVariaveisEscopo;
    funcaoEscreva: llvm.Function;
    funcaoLeia: llvm.Function;
    funcaoInteiro: llvm.Function;
    funcaoNumero: llvm.Function;
    funcaoFalhar: llvm.Function;
    funcaoPersonalidade: llvm.Function;
    funcaoBeginCatch: llvm.Function;
    funcaoEndCatch: llvm.Function;
    pontoPousoAtual: llvm.BasicBlock | null = null;

    private registroClasses: Map<string, llvm.StructType> = new Map();
    private indicesPropriedades: Map<string, Map<string, number>> = new Map();
    private tiposPropriedades: Map<string, Map<string, string>> = new Map();
    private metodosClasse: Map<string, Map<string, string>> = new Map();
    private pilhaIsto: llvm.Value[] = [];
    private classesComMarcadorTipo: Set<string> = new Set();
    private contadoresNaoNegativos: Set<string> = new Set();
    private tipoEstruturaVetor: llvm.StructType = null;

    printfFormatos: Map<string, string> = new Map<string, string>([
        ['inteiro', '%d'],
        ['longo', '%ld'],
        ['número', '%g'],
        ['texto', '%s'],
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
    protected tipoEhPonteiro(tipo: llvm.Type): boolean {
        return tipo && tipo.constructor && tipo.constructor.name === 'PointerType';
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

        // 1. Coletar tipos LLVM das propriedades e construir o struct
        const tiposPropsLlvm: llvm.Type[] = [];
        const mapaIndices: Map<string, number> = new Map();
        const mapaTipos: Map<string, string> = new Map();

        for (const [indice, propriedade] of declaracao.propriedades.entries()) {
            const tipoProp = propriedade.tipo || 'número';
            tiposPropsLlvm.push(this.obterTipoLlvm(tipoProp));
            mapaIndices.set(propriedade.nome.lexema, indice);
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

            const tipoRetorno = ehConstrutor
                ? llvm.Type.getVoidTy(this.contexto)
                : this.obterTipoLlvm(metodo.funcao.tipo);

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
            await this.visitarCorpoFuncao(metodo.funcao, objetoLlvmFuncao);
            if (ehConstrutor) {
                this.montador.CreateRetVoid();
            }
            this.pilhaIsto.pop();
            this.pilhaVariaveisEscopo.removerUltimo();

            this.metodosClasse.get(nomeClasse).set(
                metodo.simbolo.lexema,
                ehConstrutor ? 'vazio' : metodo.funcao.tipo
            );
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
        await this.aceitarListaDeclaracoes(declaracao.corpo.declaracoes);
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

        // Implementação conservadora: processa corpo e condição sem emitir CFG dedicado.
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
        // Import não tem efeito direto no IR neste contexto minimal.
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

        this.montador.CreateRet(valorResolvido as llvm.Value);
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
        return Promise.resolve(null);
    }

    // TODO: Verificar se está correto.
    visitarExpressaoSustar(declaracao?: Sustar): SustarQuebra | void {
        // Controle de fluxo (suspender) não mapeado aqui.
        return;
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
                    novoValor = this.montador.CreateAdd(valor, um, "inc");
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
                    valorDecrementado = this.montador.CreateSub(valor, um, "dec");
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
            if (tipoVariavel.constructor.name === 'PointerType') {
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
     * Processa uma declaração de escolha (switch).
     *
     * Estrutura gerada:
     * - Carrega o valor da escolha
     * - Cria blocos para cada caso, corpo e caminho padrão
     * - Para cada caso: compara valor com condições (OR)
     * - Salta para corpo se verdadeiro, próximo caso caso contrário
     * - Executa corpo e salta para bloco após
     * - Se nenhum caso satisfeito, executa caminho padrão (se existir)
     */
    async visitarDeclaracaoEscolha(declaracao: Escolha): Promise<any> {
        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        const valorEscolhaRaw = await declaracao.identificadorOuLiteral.aceitar(this);
        const valorEscolha = this.carregarValorSeNecessario(
            valorEscolhaRaw,
            declaracao.identificadorOuLiteral.tipo,
            this.NOMES_BLOCOS.LOAD_ESCOLHA
        );

        const { blocosCasos, blocoPadrao, blocoApos } =
            this.criarBlocosCasosEscolha(declaracao, funcaoAtual);

        const blocoInicial = blocosCasos.length > 0
            ? blocosCasos[0]
            : (blocoPadrao || blocoApos);
        this.montador.CreateBr(blocoInicial);

        const tipoEscolha = this.resolverTipoConstruto(declaracao.identificadorOuLiteral);

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
        await this.processarDeclaracoesBloco(declaracao.corpo.declaracoes);

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
        switch (operando.constructor.name) {
            case 'ConstantFP':
            case 'SIToFPInst':
                return {
                    valor: operando as llvm.Value,
                    tipo: 'número'
                };
            case 'VariavelEscopo':
                const variavelEscopo = operando as VariavelEscopo;
                const tipoVariavel = variavelEscopo.variavelLlvm.getType();

                if (tipoVariavel.constructor.name === 'PointerType') {
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
                } else {
                    return {
                        valor: variavelEscopo.variavelLlvm,
                        tipo: tipo
                    };
                }
            case 'Instruction':
                const operandoEsquerdoTipado = operando as llvm.Instruction;
                const tipoOperandoEsquerdo = operandoEsquerdoTipado.getType();
                switch (tipoOperandoEsquerdo.constructor.name) {
                    case 'IntegerType':
                        return {
                            valor: operando as llvm.Value,
                            tipo: 'inteiro'
                        };
                    default:
                        return {
                            valor: this.montador.CreateSIToFP(
                                operando as llvm.Value,
                                llvm.Type.getDoubleTy(this.contexto)),
                            tipo: 'número'
                        }
                }
            default:
                return {
                    valor: operando as llvm.Value,
                    tipo: tipo
                };
        }
    }

    protected resolverMultiplicacao(operandoEsquerdo: OperandoInterface, operandoDireito: OperandoInterface): Promise<llvm.Value> {
        if (this.tipoEhInteiroDelegua(operandoEsquerdo.tipo) && this.tipoEhInteiroDelegua(operandoDireito.tipo)) {
            return Promise.resolve(this.montador.CreateMul(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFMul(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverAdicao(operandoEsquerdo: OperandoInterface, operandoDireito: OperandoInterface): Promise<llvm.Value> {
        if (this.tipoEhInteiroDelegua(operandoEsquerdo.tipo) && this.tipoEhInteiroDelegua(operandoDireito.tipo)) {
            return Promise.resolve(this.montador.CreateAdd(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFAdd(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverSubtracao(operandoEsquerdo: OperandoInterface, operandoDireito: OperandoInterface): Promise<llvm.Value> {
        if (this.tipoEhInteiroDelegua(operandoEsquerdo.tipo) && this.tipoEhInteiroDelegua(operandoDireito.tipo)) {
            return Promise.resolve(this.montador.CreateSub(operandoEsquerdo.valor, operandoDireito.valor));
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
        return new ContinuarQuebra();
    }

    private resolverArgumentoChamada(argumento: Construto, tipoParametro: string) {
        const tipoArgumento = this.resolverTipoConstruto(argumento);
        if (tipoArgumento === tipoParametro) {
            return argumento;
        }

        // TODO: Terminar.
        if (tipoParametro === 'inteiro') {
            if (tipoArgumento === 'número') {
                argumento.tipo = 'inteiro';
                argumento.valor = Math.trunc(argumento.valor);
            }
        } else if (tipoParametro === 'longo') {
            if (tipoArgumento === 'número') {
                argumento.tipo = 'longo';
                argumento.valor = Math.trunc(argumento.valor);
            } else if (tipoArgumento === 'inteiro') {
                argumento.tipo = 'longo';
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
        const nomeFuncao = `${nomeClasse}_${nomeMetodo}`;
        const funcaoLlvm = this.modulo.getFunction(nomeFuncao);
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

    async visitarExpressaoDeChamada(expressao: Chamada): Promise<any> {
        // Instanciação de classe: Ponto(...)
        if (expressao.entidadeChamada.constructor.name === 'Variavel') {
            const nomeCallee = (expressao.entidadeChamada as Variavel).simbolo.lexema;
            if (this.registroClasses.has(nomeCallee)) {
                return await this.instanciarClasse(nomeCallee, expressao.argumentos);
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
            case 'texto':
                return Promise.resolve(
                    this.montador.CreateGlobalStringPtr(
                        expressao.valor as string,
                        "str",
                        0,
                        this.modulo
                    )
                );
            /* case 'inteiro':
                return Promise.resolve(
                    this.montador.CreateRet(
                        ConstantInt.get(
                            this.contexto,
                            new APInt(32, expressao.valor)
                        )
                    )
                );
            case 'número':
                return Promise.resolve(
                    this.montador.CreateRet(
                        ConstantFP.get(
                            this.montador.getFloatTy(),
                            new APFloat(expressao.valor)
                        )
                    )
                ); */
        }
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

        this.funcaoEscreva = llvm.Function.Create(
            tipoFuncaoPrinter,
            llvm.Function.LinkageTypes.ExternalLinkage,
            'escreva',
            this.modulo
        );

        // void* leia(const char* texto, const char *fmt)
        const tipoRetornoLeia = this.montador.getPtrTy();
        const tipoFuncaoLeia = llvm.FunctionType.get(
            tipoRetornoLeia,
            [
                this.montador.getPtrTy(),
                this.montador.getPtrTy()
            ],
            false
        );

        this.funcaoLeia = llvm.Function.Create(
            tipoFuncaoLeia,
            llvm.Function.LinkageTypes.ExternalLinkage,
            'leia',
            this.modulo
        );

        // int *inteiro(void *valor)

        const tipoRetornoInteiro = this.montador.getInt32Ty();
        const tipoFuncaoInteiro = llvm.FunctionType.get(
            tipoRetornoInteiro,
            [
                this.montador.getPtrTy()
            ],
            false
        )

        this.funcaoInteiro = llvm.Function.Create(
            tipoFuncaoInteiro,
            llvm.Function.LinkageTypes.ExternalLinkage,
            'inteiro',
            this.modulo
        )

        // double *numero(void *valor)
        const tipoRetornoNumero = this.montador.getDoubleTy();
        const tipoFuncaoNumero = llvm.FunctionType.get(
            tipoRetornoNumero,
            [
                this.montador.getPtrTy()
            ],
            false
        )

        this.funcaoNumero = llvm.Function.Create(
            tipoFuncaoNumero,
            llvm.Function.LinkageTypes.ExternalLinkage,
            'numero',
            this.modulo
        )

        // void falhar(const char *msg)
        const tipoRetornoFalhar = llvm.Type.getVoidTy(this.contexto);
        const tipoFuncaoFalhar = llvm.FunctionType.get(
            tipoRetornoFalhar,
            [
                this.montador.getPtrTy()
            ],
            false
        );

        this.funcaoFalhar = llvm.Function.Create(
            tipoFuncaoFalhar,
            llvm.Function.LinkageTypes.ExternalLinkage,
            'falhar',
            this.modulo
        );

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
            [
                this.montador.getPtrTy()
            ],
            false
        );

        this.funcaoBeginCatch = llvm.Function.Create(
            tipoBeginCatch,
            llvm.Function.LinkageTypes.ExternalLinkage,
            '__cxa_begin_catch',
            this.modulo
        );

        const tipoEndCatch = llvm.FunctionType.get(
            llvm.Type.getVoidTy(this.contexto),
            [],
            false
        );

        this.funcaoEndCatch = llvm.Function.Create(
            tipoEndCatch,
            llvm.Function.LinkageTypes.ExternalLinkage,
            '__cxa_end_catch',
            this.modulo
        );
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

        funcaoInicio.setPersonalityFn(this.funcaoPersonalidade);

        const blocoEscopo = llvm.BasicBlock.Create(this.contexto, 'entry', funcaoInicio);
        this.montador.SetInsertPoint(blocoEscopo);

        for (const declaracao of declaracoes) {
            await declaracao.aceitar(this);
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
        this.pilhaIsto = [];
        this.classesComMarcadorTipo = new Set();
        const mapaVariaveis: Map<string, VariavelEscopo> = new Map<string, VariavelEscopo>()
        this.pilhaVariaveisEscopo.empilhar(mapaVariaveis);

        this.contexto = new llvm.LLVMContext();
        this.modulo = new llvm.Module('demo', this.contexto);
        this.montador = new llvm.IRBuilder(this.contexto);
        this.tipoEstruturaVetor = null;

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
        topoDaPilhaDeVariaveis.set("numero", new VariavelEscopo(this.funcaoNumero))
        topoDaPilhaDeVariaveis.set("inteiro", new VariavelEscopo(this.funcaoInteiro))

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
