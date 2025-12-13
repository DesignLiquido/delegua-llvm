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
    SeTernario
} from '@designliquido/delegua';
import { VisitanteDeleguaInterface } from '@designliquido/delegua/interfaces';
import { ContinuarQuebra, SustarQuebra } from '@designliquido/delegua/quebras';
import llvm, { APFloat, APInt, ConstantFP, ConstantInt } from 'llvm-bindings';

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
    funcaoPrintf: llvm.Function;
    funcaoScanf: llvm.Function;
    funcaoPuts: llvm.Function;

    printfFormatos: Map<string, string> = new Map<string, string>([
        ['inteiro', '%d\n'],
        ['número', '%g\n'],
        ['texto', '%s\n'],
    ]);

    scanfFormatos: Map<string, string> = new Map<string, string>([
        ['inteiro', '%d'],
        ['número', '%lf'],
        ['texto', '%s'],
    ]);

    printFormatosCarregados: Map<string, llvm.Constant> = new Map<string, llvm.Constant>();
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
        CASO_OU: 'caso_ou'
    };

    constructor() {
        this.lexador = new Lexador();
        this.avaliadorSintatico = new AvaliadorSintatico();
        this.pilhaVariaveisEscopo = new PilhaVariaveisEscopo();
    }

    /**
     * Pequenos utilitários usados em várias visitas.
     */

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
        // Suporte a classes não implementado neste compilador minimal.
        // Apenas percorre possíveis membros (se existirem) para que erros sejam detectados.
        if ((declaracao as any).membros) {
            await this.aceitarListaDeclaracoes((declaracao as any).membros);
        }
        return Promise.resolve();
    }

    async visitarDeclaracaoComentario(declaracao: Comentario): Promise<any> {
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
        }

        this.montador.CreateStore(valor, aloc);

        const topo = this.pilhaVariaveisEscopo.topoDaPilha();
        const variavelEscopo = new VariavelEscopo(aloc, declaracao);
        topo.set(declaracao.simbolo.lexema, variavelEscopo);
        return Promise.resolve();
    }

    visitarDeclaracaoConstMultiplo(declaracao: ConstMultiplo): Promise<any> | void {
        throw new Error('Método não implementado.');
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
        this.montador.CreateCall(this.funcaoPrintf, argumentosResolvidos, "escreva");
        return Promise.resolve();
    }

    visitarDeclaracaoFazer(declaracao: Fazer): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    async visitarDeclaracaoImportar(declaracao: Importar): Promise<any> {
        // Import não tem efeito direto no IR neste contexto minimal.
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

    async visitarDeclaracaoTendoComo(declaracao: TendoComo): Promise<any> {
        // Semântica de "tendo como" (ex.: try-with-resources) não implementada; percorre corpo.
        await this.aceitarListaDeclaracoes((declaracao as any).corpo?.declaracoes);
        return Promise.resolve();
    }

    visitarDeclaracaoTente(declaracao: Tente): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoVarMultiplo(declaracao: VarMultiplo): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    async visitarExpressaoDeAtribuicao(expressao: Atribuir): Promise<any> {
        // suporte para atribuição simples a variável: resolve lado esquerdo (deve ser Variavel) e armazena o valor.
        const valorResolvido = await expressao.valor.aceitar(this);
        const tipoValor = this.resolverTipoConstruto(expressao.valor);

        const alvoResolvido = await expressao.alvo.aceitar(this);
        if (alvoResolvido instanceof VariavelEscopo) {
            this.armazenarEmVariavel(alvoResolvido, valorResolvido as llvm.Value, expressao.alvo.tipo, tipoValor);
            return Promise.resolve(valorResolvido);
        }

        // Se o alvo não for VariavelEscopo, apenas retorna o valor (fallback).
        return Promise.resolve(valorResolvido);
    }

    visitarExpressaoAcessoIndiceVariavel(expressao: AcessoIndiceVariavel): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoAcessoElementoMatriz(expressao: AcessoElementoMatriz): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoAcessoMetodo(expressao: AcessoMetodo): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoAcessoMetodoOuPropriedade(expressao: AcessoMetodoOuPropriedade): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoAcessoPropriedade(expressao: AcessoPropriedade): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoArgumentoReferenciaFuncao(expressao: ArgumentoReferenciaFuncao): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoAtribuicaoPorIndice(expressao: AtribuicaoPorIndice): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoAtribuicaoPorIndicesMatriz(expressao: AtribuicaoPorIndicesMatriz): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoDefinirValor(expressao: DefinirValor): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    // TODO: Verificar se está correto.
    async visitarExpressaoDeleguaFuncao(expressao: FuncaoConstruto): Promise<any> {
        // Retorna o próprio construto de função (será tratado em visita de declaração).
        return Promise.resolve(expressao);
    }

    visitarExpressaoDicionario(expressao: Dicionario): Promise<any> | void {
        throw new Error('Método não implementado.');
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

    visitarExpressaoFalhar(expressao: Falhar): Promise<any> | void {
        throw new Error('Método não implementado.');
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

    visitarExpressaoFormatacaoEscrita(declaracao: FormatacaoEscrita): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    // TODO: Verificar se está correto.
    async visitarExpressaoFuncaoConstruto(expressao: FuncaoConstruto): Promise<any> {
        // Para aceitação de função anônima, cria o objeto de função (tratado mais adiante).
        return Promise.resolve(expressao);
    }

    async visitarExpressaoImportar(expressao: ImportarComoConstruto): Promise<any> {
        return Promise.resolve();
    }

    // TODO: Verificar se está correto.
    async visitarExpressaoIsto(expressao: Isto): Promise<any> {
        // 'isto' refere-se ao contexto da classe/objeto; não suportado aqui.
        return Promise.resolve(null);
    }

    async visitarExpressaoLeia(expressao: Leia): Promise<llvm.Value> {
        if (expressao.argumentos && expressao.argumentos.length > 0) {
            const mensagemPrompt = expressao.argumentos[0];
            const mensagemResolvida = await mensagemPrompt.aceitar(this);
            this.montador.CreateCall(this.funcaoPuts, [mensagemResolvida], "puts");
        }

        const tipoLeitura = "texto";

        const tipoLlvm = this.obterTipoLlvm(tipoLeitura);

        const variavelTemporaria = this.montador.CreateAlloca(tipoLlvm, null, "temp_leia");

        const formatoScanf = this.buscarFormatoScanf(tipoLeitura);

        this.montador.CreateCall(this.funcaoScanf, [formatoScanf, variavelTemporaria], "scanf");

        return this.montador.CreateLoad(tipoLlvm, variavelTemporaria, "valor_lido");
    }

    async visitarExpressaoListaCompreensao(listaCompreensao: ListaCompreensao): Promise<any> {
        throw new Error('Método não implementado.');
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
        throw new Error('Método não implementado.');
    }

    async visitarExpressaoReferenciaFuncao(expressao: ReferenciaFuncao): Promise<any> {
        // Retorna a VariavelEscopo correspondente à referência (se existir).
        const topo = this.pilhaVariaveisEscopo.topoDaPilha();
        const v = topo.get(expressao.simboloFuncao.lexema);
        return Promise.resolve(v);
    }

    async visitarExpressaoRetornar(declaracao: Retorna): Promise<any> {
        // Já implementado mais abaixo; deixar aqui para coerência: resolve valor e retorna instrução de retorno.
        const valorResolvido: llvm.Instruction = await declaracao.valor.aceitar(this);
        this.montador.CreateRet(valorResolvido);
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

    visitarExpressaoTupla(expressao: Tupla): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoTipoDe(expressao: TipoDe): Promise<any> | void {
        throw new Error('Método não implementado.');
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

    visitarExpressaoVetor(expressao: Vetor): Promise<any> | void {
        throw new Error('Método não implementado.');
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
                return this.montador.getInt32Ty();
            case 'numero':
            case 'número':
                return this.montador.getDoubleTy();
            case 'texto':
                return llvm.Type.getInt8PtrTy(this.contexto);
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
        const variavelEscopoObjetoLlvmFuncao = new VariavelEscopo(objetoLlvmFuncao, declaracao);
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
        for (const argumento of declaracao.argumentos) {
            const argumentoResolvido = await argumento.aceitar(this);

            // Se for VariavelEscopo, precisa carregar o valor
            if (argumentoResolvido instanceof VariavelEscopo) {
                const tipoArgumento = this.obterTipoLlvm(argumento.tipo);
                const valorCarregado = this.montador.CreateLoad(
                    tipoArgumento,
                    argumentoResolvido.variavelLlvm,
                    "load_var"
                );
                argumentosResolvidos.push(valorCarregado);
            } else {
                argumentosResolvidos.push(argumentoResolvido);
            }
        }

        const tipoPrimeiroArgumento = declaracao.argumentos[0].tipo;

        const formatoPrintf = this.buscarFormatoPrintf(tipoPrimeiroArgumento);
        argumentosResolvidos.unshift(formatoPrintf);

        this.montador.CreateCall(this.funcaoPrintf, argumentosResolvidos, "escreva");
        return Promise.resolve();
    }

    async visitarDeclaracaoPara(declaracao: Para): Promise<Promise<any> | void> {
        const funcaoAtual = this.montador.GetInsertBlock().getParent();

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

        const tipoLlvm = this.obterTipoLlvm(tipoVariavel);
        const inicializacaoVariavel = this.montador.CreateAlloca(tipoLlvm, null, declaracao.simbolo.lexema);
        let valorOuReferenciaVariavel = await declaracao.inicializador.aceitar(this);

        const tipoInicializador = this.resolverTipoConstruto(declaracao.inicializador);
        if (tipoVariavel === 'inteiro' && tipoInicializador === 'número') {
            valorOuReferenciaVariavel = this.montador.CreateFPToSI(
                valorOuReferenciaVariavel,
                this.montador.getInt32Ty(),
                'double_para_int'
            );
        } else if (tipoVariavel === 'número' && tipoInicializador === 'inteiro') {
            valorOuReferenciaVariavel = this.montador.CreateSIToFP(
                valorOuReferenciaVariavel,
                this.montador.getDoubleTy(),
                'int_para_double'
            );
        }

        this.montador.CreateStore(valorOuReferenciaVariavel, inicializacaoVariavel);

        const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
        const variavelEscopo = new VariavelEscopo(inicializacaoVariavel, declaracao);
        topoDaPilha.set(declaracao.simbolo.lexema, variavelEscopo);

        return Promise.resolve();
    }

    async visitarExpressaoAgrupamento(expressao: Agrupamento): Promise<any> {
        return await expressao.expressao.aceitar(this);
    }

    resolverTipoConstruto(construto: Construto): string {
        switch (construto.constructor.name) {
            case 'Binario':
            case 'Constante':
            case 'Literal':
            case 'Variavel':
                return construto.tipo;
            case 'Chamada':
                return (construto as Chamada).entidadeChamada.tipo;
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
        if (operandoEsquerdo.tipo === 'inteiro' && operandoDireito.tipo === 'inteiro') {
            return Promise.resolve(this.montador.CreateMul(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFMul(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverAdicao(operandoEsquerdo: OperandoInterface, operandoDireito: OperandoInterface): Promise<llvm.Value> {
        if (operandoEsquerdo.tipo === 'inteiro' && operandoDireito.tipo === 'inteiro') {
            return Promise.resolve(this.montador.CreateAdd(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFAdd(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverSubtracao(operandoEsquerdo: OperandoInterface, operandoDireito: OperandoInterface): Promise<llvm.Value> {
        if (operandoEsquerdo.tipo === 'inteiro' && operandoDireito.tipo === 'inteiro') {
            return Promise.resolve(this.montador.CreateSub(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFSub(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverDivisao(operandoEsquerdo: OperandoInterface, operandoDireito: OperandoInterface): Promise<llvm.Value> {
        if (operandoEsquerdo.tipo === 'inteiro' && operandoDireito.tipo === 'inteiro') {
            return Promise.resolve(this.montador.CreateSDiv(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFDiv(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverModulo(operandoEsquerdo: OperandoInterface, operandoDireito: OperandoInterface): Promise<llvm.Value> {
        if (operandoEsquerdo.tipo === 'inteiro' && operandoDireito.tipo === 'inteiro') {
            return Promise.resolve(this.montador.CreateSRem(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFRem(operandoEsquerdo.valor, operandoDireito.valor));
    }

    protected resolverIgualdade(operandoEsquerdo: OperandoInterface, operandoDireito: OperandoInterface): Promise<llvm.Value> {
        if (operandoEsquerdo.tipo === 'inteiro' && operandoDireito.tipo === 'inteiro') {
            return Promise.resolve(this.montador.CreateICmpEQ(operandoEsquerdo.valor, operandoDireito.valor));
        }

        return Promise.resolve(this.montador.CreateFCmpOEQ(operandoEsquerdo.valor, operandoDireito.valor));
    }

    // TODO: Não sei se vai mais precisar.
    protected definirTipoPrevalente(tipo1: string, tipo2: string) {
        if (tipo1 === 'número' || tipo2 === 'número') {
            return 'número';
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

        if (operandoEsquerdoResolvido.tipo !== tipoPrevalente) {
            operandoEsquerdoResolvido.valor = this.montador.CreateSIToFP(operandoEsquerdoResolvido.valor, llvm.Type.getDoubleTy(this.contexto));
            operandoEsquerdoResolvido.tipo = 'número';
        }

        if (operandoDireitoResolvido.tipo !== tipoPrevalente) {
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
                if (tipoPrevalente === 'inteiro') {
                    return Promise.resolve(this.montador.CreateICmpSLT(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                } else {
                    return Promise.resolve(this.montador.CreateFCmpOLT(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                }
            case 'MENOR_IGUAL':
                if (tipoPrevalente === 'inteiro') {
                    return Promise.resolve(this.montador.CreateICmpSLE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                } else {
                    return Promise.resolve(this.montador.CreateFCmpOLE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                }
            case 'MAIOR':
                if (tipoPrevalente === 'inteiro') {
                    return Promise.resolve(this.montador.CreateICmpSGT(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                } else {
                    return Promise.resolve(this.montador.CreateFCmpOGT(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                }
            case 'MAIOR_IGUAL':
                if (tipoPrevalente === 'inteiro') {
                    return Promise.resolve(this.montador.CreateICmpSGE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                } else {
                    return Promise.resolve(this.montador.CreateFCmpOGE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                }
            case 'MENOR':
                if (tipoPrevalente === 'inteiro') {
                    return Promise.resolve(this.montador.CreateICmpSLT(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                } else {
                    return Promise.resolve(this.montador.CreateFCmpOLT(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                }
            case 'IGUAL_IGUAL':
                return this.resolverIgualdade(operandoEsquerdoResolvido, operandoDireitoResolvido);
            case 'DIFERENTE':
                if (tipoPrevalente === 'inteiro') {
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

    visitarExpressaoComentario(declaracao: Comentario): Promise<any> | void {
        return Promise.resolve();
    }

    visitarExpressaoContinua(declaracao?: Continua): ContinuarQuebra {
        throw new Error('Método não implementado.');
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
        }

        return argumento;
    }

    async visitarExpressaoDeChamada(expressao: Chamada): Promise<any> {
        const entidadeChamadaResolvida = await expressao.entidadeChamada.aceitar(this);
        const variavelEscopoCorrespondente = this.pilhaVariaveisEscopo.obterValor((expressao.entidadeChamada as Variavel).simbolo.lexema);
        const construtoCorrespondente = (variavelEscopoCorrespondente.construtoVariavel as FuncaoDeclaracao).funcao;

        const tiposParametros = [];
        for (const parametro of construtoCorrespondente.parametros) {
            tiposParametros.push(parametro.tipoDado);
        }

        const argumentos: llvm.Value[] = [];
        for (const [indice, argumento] of expressao.argumentos.entries()) {
            const argumentoAjustado = this.resolverArgumentoChamada(argumento, tiposParametros[indice]);
            const argumentoResolvido = await argumentoAjustado.aceitar(this);
            argumentos.push(argumentoResolvido);
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
                        new APInt(32, expressao.valor)
                    )
                );
            case 'número':
                return Promise.resolve(
                    ConstantFP.get(
                        this.montador.getDoubleTy(),
                        new APFloat(expressao.valor)
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





    protected buscarFormatoPrintf(tipoDelegua: string): llvm.Constant {
        let formatoPrintf = this.printFormatosCarregados.get(tipoDelegua);

        if (!formatoPrintf) {
            const formatoString = this.printfFormatos.get(tipoDelegua);
            formatoPrintf = this.montador.CreateGlobalStringPtr(
                formatoString,
                `formato_printf_${tipoDelegua}`,
                0,
                this.modulo
            );
            this.printFormatosCarregados.set(tipoDelegua, formatoPrintf);
        }

        return formatoPrintf;
    }

    protected buscarFormatoScanf(tipoDelegua: string): llvm.Constant {
        let formatoScanf = this.scanfFormatosCarregados.get(tipoDelegua);

        if (!formatoScanf) {
            const formatoString = this.scanfFormatos.get(tipoDelegua);
            formatoScanf = this.montador.CreateGlobalStringPtr(
                formatoString,
                `formato_scanf_${tipoDelegua}`,
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
    protected criarFuncaoNativaEscreva(): void {
        const tipoRetornoPrinter = this.montador.getInt32Ty();
        const tipoFuncaoPrinter = llvm.FunctionType.get(
            tipoRetornoPrinter,
            [
                this.montador.getInt8PtrTy(0)
            ],
            true
        );

        // Declara a função como módulo externo.
        this.funcaoPrintf = llvm.Function.Create(
            tipoFuncaoPrinter,
            llvm.Function.LinkageTypes.ExternalLinkage,
            'escreva',
            this.modulo
        );
    }

    protected criarFuncaoNativaLeia(): void {
        const tipoRetornoScanf = this.montador.getInt32Ty();
        const tipoFuncaoScanf = llvm.FunctionType.get(
            tipoRetornoScanf,
            [
                this.montador.getInt8PtrTy(0)
            ],
            true
        );

        // Declara a função scanf como módulo externo.
        this.funcaoScanf = llvm.Function.Create(
            tipoFuncaoScanf,
            llvm.Function.LinkageTypes.ExternalLinkage,
            'scanf',
            this.modulo
        );
    }

    protected criarFuncaoNativaPuts(): void {
        const tipoRetornoPuts = this.montador.getInt32Ty();
        const tipoFuncaoPuts = llvm.FunctionType.get(
            tipoRetornoPuts,
            [
                this.montador.getInt8PtrTy(0)
            ],
            false
        );

        // Declara a função puts como módulo externo.
        this.funcaoPuts = llvm.Function.Create(
            tipoFuncaoPuts,
            llvm.Function.LinkageTypes.ExternalLinkage,
            'puts',
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
        const mapaVariaveis: Map<string, VariavelEscopo> = new Map<string, VariavelEscopo>();
        this.pilhaVariaveisEscopo.empilhar(mapaVariaveis);

        this.contexto = new llvm.LLVMContext();
        this.modulo = new llvm.Module('demo', this.contexto);
        this.montador = new llvm.IRBuilder(this.contexto);

        const resultadoLexador = this.lexador.mapear(codigo, -1);
        const resultadoAvaliadorSintatico = this.avaliadorSintatico.analisar(resultadoLexador, -1);

        if (resultadoAvaliadorSintatico.erros.length > 0) {
            throw new Error(`Erros ao executar código: ${JSON.stringify(resultadoAvaliadorSintatico.erros)}`);
        }

        // Deve ser chamado de forma dinâmica assim que é usado algo que dependa dele.
        // Criação das funções nativas aqui.
        this.criarFuncaoNativaEscreva();
        this.criarFuncaoNativaLeia();
        this.criarFuncaoNativaPuts();

        // Declarações de funções durante o código.
        // Delégua permite declarar funções a qualquer momento do código, mas o montador LLVM
        // reclama se fizermos isso no ponto de entrada.
        const declaracoesFuncoes = resultadoAvaliadorSintatico.declaracoes.filter(d => d instanceof FuncaoDeclaracao);
        for (const declaracao of declaracoesFuncoes) {
            await declaracao.aceitar(this);
        }

        const outrasDeclaracoes = resultadoAvaliadorSintatico.declaracoes.filter(d => !(d instanceof FuncaoDeclaracao));
        await this.criarPontoEntrada(outrasDeclaracoes);

        if (llvm.verifyModule(this.modulo)) {
            console.error('Falha ao verificar módulo.');
            return;
        }
        console.log(this.modulo.print());
        return this.modulo.print();
    }
}
