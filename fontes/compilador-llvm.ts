import { Lexador, AvaliadorSintatico, AcessoElementoMatriz, AcessoIndiceVariavel, AcessoMetodoOuPropriedade, Agrupamento, Aleatorio, AtribuicaoPorIndice, AtribuicaoPorIndicesMatriz, Atribuir, Binario, Bloco, CabecalhoPrograma, Chamada, Classe, Comentario, Const, Constante, ConstMultiplo, Continua, DefinirValor, Dicionario, Enquanto, Escolha, Escreva, EscrevaMesmaLinha, Expressao, ExpressaoRegular, Falhar, Fazer, FimPara, FormatacaoEscrita, FuncaoConstruto, FuncaoDeclaracao, Importar, InicioAlgoritmo, Isto, Leia, LeiaMultiplo, Literal, Logico, Para, ParaCada, Retorna, Se, Super, Sustar, TendoComo, Tente, TipoDe, Tupla, Unario, Var, Variavel, VarMultiplo, Vetor } from '@designliquido/delegua';
import { VisitanteComumInterface } from '@designliquido/delegua/interfaces';
import { ContinuarQuebra, RetornoQuebra, SustarQuebra } from '@designliquido/delegua/quebras';
import llvm, { APInt, ConstantInt } from 'llvm-bindings';

export class CompiladorLLVM implements VisitanteComumInterface {
    lexador: Lexador;
    avaliadorSintatico: AvaliadorSintatico;

    contexto: llvm.LLVMContext;
    modulo: llvm.Module;
    montador: llvm.IRBuilder;

    constructor() {
        this.lexador = new Lexador();
        this.avaliadorSintatico = new AvaliadorSintatico();
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

    visitarDeclaracaoDefinicaoFuncao(declaracao: FuncaoDeclaracao): void {
        const tipoRetorno = this.montador.getInt32Ty();
        const tipoFuncao = llvm.FunctionType.get(
            tipoRetorno, 
            [this.montador.getInt32Ty()], 
            false
        );

        const funcaoFoo = llvm.Function.Create(
            tipoFuncao, 
            llvm.Function.LinkageTypes.ExternalLinkage, 
            declaracao.simbolo.lexema, 
            this.modulo
        );
    
        const blocoEscopo = llvm.BasicBlock.Create(this.contexto, 'entry', funcaoFoo);
        this.montador.SetInsertPoint(blocoEscopo);
        this.montador.CreateRet(ConstantInt.get(this.contexto, new APInt(32, 0)));

    }

    visitarDeclaracaoEnquanto(declaracao: Enquanto): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoEscolha(declaracao: Escolha): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoEscreva(declaracao: Escreva): Promise<any> | void {
        throw new Error('Método não implementado.');
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

    visitarDeclaracaoPara(declaracao: Para): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoParaCada(declaracao: ParaCada): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoSe(declaracao: Se): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoTendoComo(declaracao: TendoComo): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoTente(declaracao: Tente): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarDeclaracaoVar(declaracao: Var): Promise<any> | void {
        throw new Error('Método não implementado.');
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

    visitarExpressaoAgrupamento(expressao: Agrupamento): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoAtribuicaoPorIndice(expressao: AtribuicaoPorIndice): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoAtribuicaoPorIndicesMatriz(expressao: AtribuicaoPorIndicesMatriz): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoBinaria(expressao: Binario): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoBloco(declaracao: Bloco): Promise<any> {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoContinua(declaracao?: Continua): ContinuarQuebra {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoDeChamada(expressao: Chamada): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoDefinirValor(expressao: DefinirValor): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoDeleguaFuncao(expressao: FuncaoConstruto): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoDeVariavel(expressao: Variavel | Constante): Promise<any> | void {
        throw new Error('Método não implementado.');
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

    visitarExpressaoLeia(expressao: Leia): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoLeiaMultiplo(expressao: LeiaMultiplo): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoLiteral(expressao: Literal): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoLogica(expressao: Logico): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoRetornar(declaracao: Retorna): Promise<RetornoQuebra> | void {
        throw new Error('Método não implementado.');
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

    visitarExpressaoUnaria(expressao: Unario): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    visitarExpressaoVetor(expressao: Vetor): Promise<any> | void {
        throw new Error('Método não implementado.');
    }

    protected criarPontoEntrada() {
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
        this.montador.CreateRet(ConstantInt.get(this.contexto, new APInt(32, 0)));

        if (llvm.verifyFunction(funcaoInicio)) {
            console.error('Falha ao verificar função de início.');
            return;
        }
    }

    async compilar(codigo: string[]): Promise<string> {
        this.contexto = new llvm.LLVMContext();
        this.modulo = new llvm.Module('demo', this.contexto);
        this.montador = new llvm.IRBuilder(this.contexto);

        const resultadoLexador = this.lexador.mapear(codigo, -1);
        const resultadoAvaliadorSintatico = this.avaliadorSintatico.analisar(resultadoLexador, -1);

        if (resultadoAvaliadorSintatico.erros.length > 0) {
            throw new Error(`Erros ao executar código: ${JSON.stringify(resultadoAvaliadorSintatico.erros)}`);
        }

        for (const declaracao of resultadoAvaliadorSintatico.declaracoes) {
            declaracao.aceitar(this);
        }
    
        const tipoRetorno = this.montador.getInt32Ty();
        const tipoFuncao = llvm.FunctionType.get(
            tipoRetorno, 
            [this.montador.getInt32Ty()], 
            false
        );

        const funcaoFoo = llvm.Function.Create(
            tipoFuncao, 
            llvm.Function.LinkageTypes.ExternalLinkage, 
            'foo', 
            this.modulo
        );
    
        const blocoEscopo = llvm.BasicBlock.Create(this.contexto, 'entry', funcaoFoo);
        this.montador.SetInsertPoint(blocoEscopo);
        this.montador.CreateRet(ConstantInt.get(this.contexto, new APInt(32, 0)));

        this.criarPontoEntrada();

        if (llvm.verifyModule(this.modulo)) {
            console.error('Falha ao verificar módulo.');
            return;
        }
    
        return this.modulo.print();
    }
}
