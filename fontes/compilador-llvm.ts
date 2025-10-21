import { Lexador, AvaliadorSintatico, AcessoElementoMatriz, AcessoIndiceVariavel, AcessoMetodoOuPropriedade, Agrupamento, Aleatorio, AtribuicaoPorIndice, AtribuicaoPorIndicesMatriz, Atribuir, Binario, Bloco, CabecalhoPrograma, Chamada, Classe, Comentario, Const, Constante, ConstMultiplo, Continua, DefinirValor, Dicionario, Enquanto, Escolha, Escreva, EscrevaMesmaLinha, Expressao, ExpressaoRegular, Falhar, Fazer, FimPara, FormatacaoEscrita, FuncaoConstruto, FuncaoDeclaracao, Importar, InicioAlgoritmo, Isto, Leia, LeiaMultiplo, Literal, Logico, Para, ParaCada, Retorna, Se, Super, Sustar, TendoComo, Tente, TipoDe, Tupla, Unario, Var, Variavel, VarMultiplo, Vetor, Declaracao, Construto } from '@designliquido/delegua';
import { ParametroInterface, VisitanteComumInterface } from '@designliquido/delegua/interfaces';
import { ContinuarQuebra, SustarQuebra } from '@designliquido/delegua/quebras';
import llvm, { APFloat, APInt, ConstantFP, ConstantInt } from 'llvm-bindings';

import { PilhaVariaveisEscopo } from './pilha-variaveis-escopo';
import { VariavelEscopo } from './variavel-escopo';
import { OperandoInterface } from './interfaces';

export class CompiladorLLVM implements VisitanteComumInterface {
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

    constructor() {
        this.lexador = new Lexador();
        this.avaliadorSintatico = new AvaliadorSintatico();
        this.pilhaVariaveisEscopo = new PilhaVariaveisEscopo();
    }

    visitarDeclaracaoAleatorio(declaracao: Aleatorio): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoCabecalhoPrograma(declaracao: CabecalhoPrograma): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoClasse(declaracao: Classe): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoComentario(declaracao: Comentario): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoConst(declaracao: Const): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoConstMultiplo(declaracao: ConstMultiplo): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoDeExpressao(declaracao: Expressao): Promise<any> | void {
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

    async visitarDeclaracaoDefinicaoFuncao(declaracao: FuncaoDeclaracao): Promise<void> {
        const tipoRetorno = this.obterTipoLlvm(declaracao.funcao.tipoRetorno);
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

    visitarDeclaracaoEnquanto(declaracao: Enquanto): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoEscolha(declaracao: Escolha): Promise<any> | void {
        throw new Error('Método não implementado.');
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

        this.montador.CreateCall(this.funcaoPrintf, argumentosResolvidos, "printf");
        return Promise.resolve();
    }

    visitarDeclaracaoEscrevaMesmaLinha(declaracao: EscrevaMesmaLinha): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoFazer(declaracao: Fazer): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoImportar(declaracao: Importar): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoInicioAlgoritmo(declaracao: InicioAlgoritmo): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    async visitarDeclaracaoPara(declaracao: Para): Promise<Promise<any> | void> {
        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        for (const inicializador of [].concat(declaracao.inicializador)) {
            await inicializador.aceitar(this);
        }

        const blocoCabecaLoop = llvm.BasicBlock.Create(this.contexto, 'para_cabeca', funcaoAtual);
        const blocoCorpoLoop = llvm.BasicBlock.Create(this.contexto, 'para_corpo', funcaoAtual);
        const blocoIncremento = llvm.BasicBlock.Create(this.contexto, 'para_incremento', funcaoAtual);
        const blocoAposLoop = llvm.BasicBlock.Create(this.contexto, 'para_apos', funcaoAtual);

        this.montador.CreateBr(blocoCabecaLoop);
        this.montador.SetInsertPoint(blocoCabecaLoop);

        let condicao: llvm.Value = await declaracao.condicao.aceitar(this);

        if (condicao instanceof VariavelEscopo) {
            const tipoCondicao = this.obterTipoLlvm(declaracao.condicao.tipo);
            condicao = this.montador.CreateLoad(
                tipoCondicao,
                condicao.variavelLlvm,
                "load_condicao_para"
            )
        }

        this.montador.CreateCondBr(
            condicao,
            blocoCorpoLoop,
            blocoAposLoop
        )

        this.montador.SetInsertPoint(blocoCorpoLoop);

        for (const instrucao of declaracao.corpo.declaracoes) {
            await instrucao.aceitar(this);
        }

        this.montador.CreateBr(blocoIncremento);
        this.montador.SetInsertPoint(blocoIncremento);

        if (declaracao.incrementar) {
            await declaracao.incrementar.aceitar(this);
        }

        this.montador.CreateBr(blocoCabecaLoop);

        this.montador.SetInsertPoint(blocoAposLoop);

        return Promise.resolve();
    }

    visitarDeclaracaoParaCada(declaracao: ParaCada): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    async visitarDeclaracaoSe(declaracao: Se): Promise<any> {
        const funcaoAtual = this.montador.GetInsertBlock().getParent();

        let condicao: llvm.Value | VariavelEscopo = await declaracao.condicao.aceitar(this);

        if (condicao instanceof VariavelEscopo) {
            const tipoVariavel = condicao.variavelLlvm.getType();
            if (tipoVariavel.constructor.name === 'PointerType') {
                const tipoCondicao = this.obterTipoLlvm(declaracao.condicao.tipo);
                condicao = this.montador.CreateLoad(
                    tipoCondicao,
                    condicao.variavelLlvm,
                    "load_condicao_se"
                );
            } else {
                condicao = condicao.variavelLlvm;
            }
        }

        const blocoEntao = llvm.BasicBlock.Create(this.contexto, 'se_entao', funcaoAtual);
        const blocoSenao = llvm.BasicBlock.Create(this.contexto, 'se_senao', funcaoAtual);
        const blocoApos = llvm.BasicBlock.Create(this.contexto, 'se_apos', funcaoAtual);

        this.montador.CreateCondBr(condicao as llvm.Value, blocoEntao, blocoSenao);

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

    visitarDeclaracaoTendoComo(declaracao: TendoComo): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoTente(declaracao: Tente): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    async visitarDeclaracaoVar(declaracao: Var): Promise<any> {
        // Se a variável não tem tipo, o tipo do inicializador deve ser verificado.
        let tipoVariavel = declaracao.tipo;
        if (tipoVariavel === 'qualquer') {
            tipoVariavel = this.resolverTipoConstruto(declaracao.inicializador);
        }

        const tipoLlvm = this.obterTipoLlvm(tipoVariavel);
        const inicializacaoVariavel = this.montador.CreateAlloca(tipoLlvm, null, declaracao.simbolo.lexema);
        const valorOuReferenciaVariavel = await declaracao.inicializador.aceitar(this);
        this.montador.CreateStore(valorOuReferenciaVariavel, inicializacaoVariavel);

        const topoDaPilha = this.pilhaVariaveisEscopo.topoDaPilha();
        const variavelEscopo = new VariavelEscopo(inicializacaoVariavel, declaracao);
        topoDaPilha.set(declaracao.simbolo.lexema, variavelEscopo);

        return Promise.resolve();
    }

    visitarDeclaracaoVarMultiplo(declaracao: VarMultiplo): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoDeAtribuicao(expressao: Atribuir): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoAcessoIndiceVariavel(expressao: AcessoIndiceVariavel): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoAcessoElementoMatriz(expressao: AcessoElementoMatriz): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoAcessoMetodo(expressao: AcessoMetodoOuPropriedade): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    async visitarExpressaoAgrupamento(expressao: Agrupamento): Promise<any> {
        return await expressao.expressao.aceitar(this);
    }

    visitarExpressaoAtribuicaoPorIndice(expressao: AtribuicaoPorIndice): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoAtribuicaoPorIndicesMatriz(expressao: AtribuicaoPorIndicesMatriz): Promise<any> | void {
        throw new Error('Método não implementado.');
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
            case 'VariavelEscopo':
                const variavelEscopo = operando as VariavelEscopo;
                const tipoVariavel = variavelEscopo.variavelLlvm.getType();

                };
                if (tipoVariavel.constructor.name === 'PointerType') {
                    const tipoLlvm = this.obterTipoLlvm(tipo);
                    const valorCarregado = this.montador.CreateLoad(
                        tipoLlvm,
                        variavelEscopo.variavelLlvm,
                        "load_operando"
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

        let operandoEsquerdo: llvm.Value | VariavelEscopo = promises[0],
            operandoDireito: llvm.Value | VariavelEscopo = promises[1];

        let tipoEsquerdo = this.resolverTipoConstruto(expressao.esquerda);
        let tipoDireito = this.resolverTipoConstruto(expressao.direita);

        const tipoPrevalente = this.definirTipoPrevalente(tipoEsquerdo, tipoDireito);
        if (tipoEsquerdo != tipoPrevalente) {
            operandoEsquerdo = this.montador.CreateSIToFP((operandoEsquerdo as VariavelEscopo).variavelLlvm, llvm.Type.getDoubleTy(this.contexto));
        }

        if (tipoDireito != tipoPrevalente) {
            operandoDireito = this.montador.CreateSIToFP((operandoDireito as VariavelEscopo).variavelLlvm, llvm.Type.getDoubleTy(this.contexto));
        }

        const operandoEsquerdoResolvido: OperandoInterface = this.resolverOperando(operandoEsquerdo, tipoEsquerdo);
        const operandoDireitoResolvido: OperandoInterface = this.resolverOperando(operandoDireito, tipoDireito);

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
            case 'MENOR_IGUAL':
                if (tipoPrevalente === 'inteiro') {
                    return Promise.resolve(this.montador.CreateICmpSLE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                } else {
                    return Promise.resolve(this.montador.CreateFCmpOLE(operandoEsquerdoResolvido.valor, operandoDireitoResolvido.valor));
                }
            case 'IGUAL_IGUAL':
                return this.resolverIgualdade(operandoEsquerdoResolvido, operandoDireitoResolvido);
        }
    }

    async visitarExpressaoBloco(declaracao: Bloco): Promise<any> {
        for (const instrucao of declaracao.declaracoes) {
            await instrucao.aceitar(this);
        }
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

    visitarExpressaoDefinirValor(expressao: DefinirValor): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoDeleguaFuncao(expressao: FuncaoConstruto): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    async visitarExpressaoDeVariavel(expressao: Variavel | Constante): Promise<VariavelEscopo> {
        const topoDaPilhaDeVariaveis = this.pilhaVariaveisEscopo.topoDaPilha();
        const valorOuReferenciaVariavel = topoDaPilhaDeVariaveis.get(expressao.simbolo.lexema);
        if (!valorOuReferenciaVariavel) {
            throw new Error(`Variável ${expressao.simbolo.lexema} não existe neste escopo.`);
        }

        return Promise.resolve(valorOuReferenciaVariavel);
    }

    visitarExpressaoDicionario(expressao: Dicionario): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoExpressaoRegular(expressao: ExpressaoRegular): Promise<RegExp> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoFalhar(expressao: Falhar): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoFimPara(declaracao: FimPara): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoFormatacaoEscrita(declaracao: FormatacaoEscrita): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoIsto(expressao: Isto): Promise<any> | void {
        throw new Error('Método não implementado.');
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

    visitarExpressaoLeiaMultiplo(expressao: LeiaMultiplo): Promise<any> | void {
        throw new Error('Método não implementado.');
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

    visitarExpressaoLogica(expressao: Logico): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    async visitarExpressaoRetornar(declaracao: Retorna): Promise<any> {
        const valorResolvido: llvm.Instruction = await declaracao.valor.aceitar(this);
        this.montador.CreateRet(valorResolvido);
    }

    visitarExpressaoSuper(expressao: Super): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoSustar(declaracao?: Sustar): SustarQuebra | void {
        throw new Error('Método não implementado.');
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
            'printf',
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
        // TODO: Talvez colocar `printf` aqui.
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
