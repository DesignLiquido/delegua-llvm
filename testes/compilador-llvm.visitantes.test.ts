import { CompiladorLLVM } from '../fontes/compilador-llvm';
import llvm from '@designliquido/llvm-bindings';
import { VariavelEscopo } from '../fontes/variavel-escopo';
import { PilhaVariaveisEscopo } from '../fontes/pilha-variaveis-escopo';

describe('Compilador LLVM - visitantes', () => {
    let compilador: CompiladorLLVM;

    beforeEach(() => {
        compilador = new CompiladorLLVM();
    });

    describe('Visitantes básicos sem geração de IR', () => {
        it('Cabecalho de programa retorna sem erro', async () => {
            await expect(compilador.visitarDeclaracaoCabecalhoPrograma({} as any)).resolves.toBeUndefined();
        });

        it('Comentario de declaracao retorna sem erro', async () => {
            await expect(compilador.visitarDeclaracaoComentario({} as any)).resolves.toBeUndefined();
        });

        it('Ajuda de declaracao retorna sem erro', async () => {
            await expect(compilador.visitarDeclaracaoAjuda({} as any)).resolves.toBeUndefined();
        });

        it('Importar de declaracao retorna sem erro', async () => {
            await expect(compilador.visitarDeclaracaoImportar({} as any)).resolves.toBeUndefined();
        });

        it('Interface de declaracao retorna sem erro', async () => {
            await expect(compilador.visitarDeclaracaoInterface({} as any)).resolves.toBeUndefined();
        });

        it('InicioAlgoritmo retorna sem erro', async () => {
            await expect(compilador.visitarDeclaracaoInicioAlgoritmo({} as any)).resolves.toBeUndefined();
        });

        it('TextoDocumentacao retorna sem erro', async () => {
            await expect(compilador.visitarDeclaracaoTextoDocumentacao({} as any)).resolves.toBeUndefined();
        });

        it('Extensao com membros percorre declaracoes internas', async () => {
            const aceitar = jest.fn().mockResolvedValue(undefined);

            await expect(
                compilador.visitarDeclaracaoExtensao({
                    membros: [{ aceitar }],
                } as any)
            ).resolves.toBeUndefined();

            expect(aceitar).toHaveBeenCalledTimes(1);
        });

        it('Extensao sem membros retorna sem erro', async () => {
            await expect(compilador.visitarDeclaracaoExtensao({} as any)).resolves.toBeUndefined();
        });

        it('TendoComo percorre o corpo quando presente', async () => {
            const aceitar = jest.fn().mockResolvedValue(undefined);

            await expect(
                compilador.visitarDeclaracaoTendoComo({
                    corpo: {
                        declaracoes: [{ aceitar }],
                    },
                } as any)
            ).resolves.toBeUndefined();

            expect(aceitar).toHaveBeenCalledTimes(1);
        });

        it('TendoComo sem corpo retorna sem erro', async () => {
            await expect(compilador.visitarDeclaracaoTendoComo({} as any)).resolves.toBeUndefined();
        });

        it('Comentario como construto retorna sem erro', async () => {
            await expect(compilador.visitarExpressaoComentario({} as any)).resolves.toBeUndefined();
        });

        it('Super retorna nulo', async () => {
            await expect(compilador.visitarExpressaoSuper({} as any)).resolves.toBeNull();
        });

        it('Sustar retorna sem valor', () => {
            expect(compilador.visitarExpressaoSustar({} as any)).toBeUndefined();
        });

        it('AcessoIntervaloVariavel retorna sem erro', async () => {
            await expect(compilador.visitarExpressaoAcessoIntervaloVariavel({} as any)).resolves.toBeUndefined();
        });

        it('Ajuda como construto retorna sem erro', async () => {
            await expect(compilador.visitarExpressaoAjuda({} as any)).resolves.toBeUndefined();
        });

        it('Importar como construto retorna sem erro', async () => {
            await expect(compilador.visitarExpressaoImportar({} as any)).resolves.toBeUndefined();
        });

        it('FimPara retorna sem erro', async () => {
            await expect(compilador.visitarExpressaoFimPara({} as any)).resolves.toBeUndefined();
        });

        it('TuplaN retorna sem erro', async () => {
            await expect(compilador.visitarExpressaoTuplaN({} as any)).resolves.toBeUndefined();
        });

        it('Separador retorna sem erro', async () => {
            await expect(compilador.visitarExpressaoSeparador({} as any)).resolves.toBeUndefined();
        });

        it('DeleguaFuncao retorna o proprio construto', async () => {
            const construto = { qualquer: true } as any;
            await expect(compilador.visitarExpressaoDeleguaFuncao(construto)).resolves.toBe(construto);
        });

        it('FuncaoConstruto retorna o proprio construto', async () => {
            const construto = { qualquer: true } as any;
            await expect(compilador.visitarExpressaoFuncaoConstruto(construto)).resolves.toBe(construto);
        });

        it('Isto sem contexto lanca erro', async () => {
            await expect(compilador.visitarExpressaoIsto({} as any)).rejects.toThrow("Variável não definida: 'isto'.");
        });

        it('Expressao regular cria RegExp', async () => {
            const resultado = await compilador.visitarExpressaoExpressaoRegular({ valor: 'abc' } as any);
            expect(resultado).toBeInstanceOf(RegExp);
            expect(resultado.test('abc')).toBe(true);
        });

        it('Elvis retorna esquerda quando truthy', async () => {
            const resultado = await compilador.visitarExpressaoElvis({
                esquerda: { aceitar: jest.fn().mockResolvedValue('esquerda') },
                direita: { aceitar: jest.fn().mockResolvedValue('direita') },
            } as any);

            expect(resultado).toBe('esquerda');
        });

        it('Elvis retorna direita quando esquerda e falsy', async () => {
            const direita = { aceitar: jest.fn().mockResolvedValue('direita') };
            const resultado = await compilador.visitarExpressaoElvis({
                esquerda: { aceitar: jest.fn().mockResolvedValue(null) },
                direita,
            } as any);

            expect(resultado).toBe('direita');
            expect(direita.aceitar).toHaveBeenCalledTimes(1);
        });

        it('Falhar sem mensagem lanca erro especifico', async () => {
            await expect(compilador.visitarExpressaoFalhar({} as any)).rejects.toThrow('Falhar precisa de uma mensagem');
        });

        it('Declaracao fazer percorre corpo e condicao', async () => {
            const aceitarCorpo = jest.fn().mockResolvedValue(undefined);
            const aceitarCondicao = jest.fn().mockResolvedValue(undefined);

            await expect(
                compilador.visitarDeclaracaoFazer({
                    caminhoFazer: { declaracoes: [{ aceitar: aceitarCorpo }] },
                    condicaoEnquanto: { aceitar: aceitarCondicao },
                } as any)
            ).resolves.toBeUndefined();

            expect(aceitarCorpo).toHaveBeenCalledTimes(1);
            expect(aceitarCondicao).toHaveBeenCalledTimes(1);
        });

        it('TipoDe sem montador retorna tipo inferido como texto', async () => {
            (compilador as any).resolverTipoConstruto = jest.fn().mockReturnValue('inteiro');

            await expect(
                compilador.visitarExpressaoTipoDe({
                    valor: { tipo: 'inteiro' },
                } as any)
            ).resolves.toBe('inteiro');
        });

        it('Vetor resolve os valores via aceitar()', async () => {
            const resultado = await compilador.visitarExpressaoVetor({
                valores: [
                    { aceitar: jest.fn().mockResolvedValue(1) },
                    { aceitar: jest.fn().mockResolvedValue(2) },
                ],
            } as any);

            expect(resultado).toEqual([1, 2]);
        });

        it('Tupla resolve itens via aceitar()', async () => {
            const resultado = await compilador.visitarExpressaoTupla({
                valores: [
                    { aceitar: jest.fn().mockResolvedValue('a') },
                    { aceitar: jest.fn().mockResolvedValue('b') },
                ],
            } as any);

            expect(resultado).toEqual(['a', 'b']);
        });

        it('Dicionario resolve formato por entradas', async () => {
            const resultado = await compilador.visitarExpressaoDicionario({
                entradas: [
                    {
                        chave: { aceitar: jest.fn().mockResolvedValue('nome') },
                        valor: { aceitar: jest.fn().mockResolvedValue('Delegua') },
                    },
                ],
            } as any);

            expect(resultado).toEqual({ nome: 'Delegua' });
        });

        it('Dicionario resolve formato por chaves e valores', async () => {
            const resultado = await compilador.visitarExpressaoDicionario({
                chaves: [{ aceitar: jest.fn().mockResolvedValue('x') }],
                valores: [{ aceitar: jest.fn().mockResolvedValue(10) }],
            } as any);

            expect(resultado).toEqual({ x: 10 });
        });

        it('FormatacaoEscrita aplica casas decimais em número', async () => {
            const resultado = await compilador.visitarExpressaoFormatacaoEscrita({
                valor: { aceitar: jest.fn().mockResolvedValue(3.14159) },
                casasDecimais: 2,
            } as any);

            expect(resultado).toBe('3.14');
        });

        it('FormatacaoEscrita mantém valor sem casas decimais', async () => {
            const resultado = await compilador.visitarExpressaoFormatacaoEscrita({
                valor: { aceitar: jest.fn().mockResolvedValue('texto') },
            } as any);

            expect(resultado).toBe('texto');
        });

        it('AcessoIndiceVariavel retorna item esperado', async () => {
            const resultado = await compilador.visitarExpressaoAcessoIndiceVariavel({
                entidade: { aceitar: jest.fn().mockResolvedValue([10, 20, 30]) },
                indice: { aceitar: jest.fn().mockResolvedValue(1) },
            } as any);

            expect(resultado).toBe(20);
        });

        it('AcessoElementoMatriz retorna item esperado', async () => {
            const resultado = await compilador.visitarExpressaoAcessoElementoMatriz({
                entidade: { aceitar: jest.fn().mockResolvedValue([[1, 2], [3, 4]]) },
                indiceLinha: { aceitar: jest.fn().mockResolvedValue(1) },
                indiceColuna: { aceitar: jest.fn().mockResolvedValue(0) },
            } as any);

            expect(resultado).toBe(3);
        });

        it('AtribuicaoPorIndice altera vetor em memória', async () => {
            const vetor = [1, 2, 3];

            const resultado = await compilador.visitarExpressaoAtribuicaoPorIndice({
                entidade: { aceitar: jest.fn().mockResolvedValue(vetor) },
                indice: { aceitar: jest.fn().mockResolvedValue(2) },
                valor: { aceitar: jest.fn().mockResolvedValue(99) },
            } as any);

            expect(resultado).toBe(99);
            expect(vetor).toEqual([1, 2, 99]);
        });

        it('AtribuicaoPorIndicesMatriz altera matriz em memória', async () => {
            const matriz = [[1, 2], [3, 4]];

            const resultado = await compilador.visitarExpressaoAtribuicaoPorIndicesMatriz({
                entidade: { aceitar: jest.fn().mockResolvedValue(matriz) },
                indiceLinha: { aceitar: jest.fn().mockResolvedValue(0) },
                indiceColuna: { aceitar: jest.fn().mockResolvedValue(1) },
                valor: { aceitar: jest.fn().mockResolvedValue(77) },
            } as any);

            expect(resultado).toBe(77);
            expect(matriz).toEqual([[1, 77], [3, 4]]);
        });

        it('AcessoMetodo retorna descritor com objeto e nome', async () => {
            const objeto = { qualquer: true };
            const resultado = await compilador.visitarExpressaoAcessoMetodo({
                objeto,
                nomeMetodo: 'somar',
            } as any);

            expect(resultado).toEqual({ objeto, nomeMetodo: 'somar' });
        });

        it('ArgumentoReferenciaFuncao resolve valor por aceitar', async () => {
            const resultado = await compilador.visitarExpressaoArgumentoReferenciaFuncao({
                valor: { aceitar: jest.fn().mockResolvedValue('ok') },
            } as any);

            expect(resultado).toBe('ok');
        });

        it('Continua retorna quebra de continuar', () => {
            const resultado = compilador.visitarExpressaoContinua();
            expect(resultado).toBeTruthy();
            expect(resultado.constructor.name).toBe('ContinuarQuebra');
        });

        it('ConstMultiplo registra constantes em fallback sem montador', async () => {
            compilador.pilhaVariaveisEscopo.empilhar(new Map());

            await expect(
                compilador.visitarDeclaracaoConstMultiplo({
                    simbolos: [{ lexema: 'a' }, { lexema: 'b' }],
                    valores: [1, 2],
                    tipo: 'inteiro',
                } as any)
            ).resolves.toBeUndefined();

            expect(compilador.pilhaVariaveisEscopo.obterValor('a')).toBeTruthy();
            expect(compilador.pilhaVariaveisEscopo.obterValor('b')).toBeTruthy();
        });

        it('VarMultiplo registra variáveis em fallback sem montador', async () => {
            compilador.pilhaVariaveisEscopo.empilhar(new Map());

            await expect(
                compilador.visitarDeclaracaoVarMultiplo({
                    simbolos: [{ lexema: 'x' }, { lexema: 'y' }],
                    valores: [10, 20],
                    tipo: 'inteiro',
                } as any)
            ).resolves.toBeUndefined();

            expect(compilador.pilhaVariaveisEscopo.obterValor('x')).toBeTruthy();
            expect(compilador.pilhaVariaveisEscopo.obterValor('y')).toBeTruthy();
        });

        it('ListaCompreensao retorna itens da origem quando sem expressão', async () => {
            const resultado = await compilador.visitarExpressaoListaCompreensao({
                lista: { aceitar: jest.fn().mockResolvedValue([1, 2, 3]) },
            } as any);

            expect(resultado).toEqual([1, 2, 3]);
        });

        it('ParaCada percorre corpo para cada item', async () => {
            const aceitarCorpo = jest.fn().mockResolvedValue(undefined);

            await expect(
                compilador.visitarExpressaoParaCada({
                    iteravel: { aceitar: jest.fn().mockResolvedValue([1, 2]) },
                    corpo: { declaracoes: [{ aceitar: aceitarCorpo }] },
                } as any)
            ).resolves.toBeUndefined();

            expect(aceitarCorpo).toHaveBeenCalledTimes(2);
        });

        it('Declaracao ParaCada percorre corpo uma vez', async () => {
            const aceitarCorpo = jest.fn().mockResolvedValue(undefined);

            await expect(
                compilador.visitarDeclaracaoParaCada({
                    corpo: { declaracoes: [{ aceitar: aceitarCorpo }] },
                } as any)
            ).resolves.toBeUndefined();

            expect(aceitarCorpo).toHaveBeenCalledTimes(1);
        });

        it('Expressao Para processa inicializador, condicao e corpo', async () => {
            const aceitarInit = jest.fn().mockResolvedValue(undefined);
            const aceitarCondicao = jest.fn().mockResolvedValue(undefined);
            const aceitarCorpo = jest.fn().mockResolvedValue(undefined);

            await expect(
                compilador.visitarExpressaoPara({
                    inicializador: [{ aceitar: aceitarInit }],
                    condicao: { aceitar: aceitarCondicao },
                    corpo: { declaracoes: [{ aceitar: aceitarCorpo }] },
                } as any)
            ).resolves.toBeUndefined();

            expect(aceitarInit).toHaveBeenCalledTimes(1);
            expect(aceitarCondicao).toHaveBeenCalledTimes(1);
            expect(aceitarCorpo).toHaveBeenCalledTimes(1);
        });

        it('ReferenciaFuncao retorna item do topo da pilha', async () => {
            compilador.pilhaVariaveisEscopo.empilhar(new Map());
            const referencia = { marcador: true } as any;
            compilador.pilhaVariaveisEscopo.topoDaPilha().set('minhaFuncao', referencia);

            const resultado = await compilador.visitarExpressaoReferenciaFuncao({
                simboloFuncao: { lexema: 'minhaFuncao' },
            } as any);

            expect(resultado).toBe(referencia);
        });

        it('Processadores de caminho cobrem formatos aceitos', async () => {
            const aceitar = jest.fn().mockResolvedValue(undefined);
            const aceitarListaDeclaracoes = jest.fn().mockResolvedValue(undefined);
            (compilador as any).aceitarListaDeclaracoes = aceitarListaDeclaracoes;

            await (compilador as any).processarCaminhoTente({ aceitar });
            await (compilador as any).processarCaminhoTente({ declaracoes: [{ aceitar }] });
            await (compilador as any).processarCaminhoTente([{ aceitar }]);
            await (compilador as any).processarCaminhoTente(undefined);

            await (compilador as any).processarCaminhoPegue({ corpo: [{ aceitar }] });
            await (compilador as any).processarCaminhoPegue({ declaracoes: [{ aceitar }] });
            await (compilador as any).processarCaminhoPegue([{ aceitar }]);
            await (compilador as any).processarCaminhoPegue(undefined);

            await (compilador as any).processarCaminhoFinalmente({ aceitar });
            await (compilador as any).processarCaminhoFinalmente({ declaracoes: [{ aceitar }] });
            await (compilador as any).processarCaminhoFinalmente([{ aceitar }]);
            await (compilador as any).processarCaminhoFinalmente(undefined);

            expect(aceitar).toHaveBeenCalledTimes(2);
            expect(aceitarListaDeclaracoes).toHaveBeenCalledTimes(7);
        });

        it('Extrair parametro de pegue cobre cenarios', () => {
            expect((compilador as any).extrairParametroPegue(undefined)).toBeNull();
            expect((compilador as any).extrairParametroPegue({ parametros: [] })).toBeNull();

            const parametro = { nome: { lexema: 'erro' } };
            expect((compilador as any).extrairParametroPegue({ parametros: [parametro] })).toBe(parametro.nome);
        });

        it('Resolver argumento de chamada converte para inteiro e longo', () => {
            (compilador as any).resolverTipoConstruto = jest
                .fn()
                .mockReturnValueOnce('número')
                .mockReturnValueOnce('número')
                .mockReturnValueOnce('inteiro');

            const paraInteiro = { tipo: 'número', valor: 3.9 };
            const paraLongoNumero = { tipo: 'número', valor: 9.7 };
            const paraLongoInteiro = { tipo: 'inteiro', valor: 10 };

            const r1 = (compilador as any).resolverArgumentoChamada(paraInteiro, 'inteiro');
            const r2 = (compilador as any).resolverArgumentoChamada(paraLongoNumero, 'longo');
            const r3 = (compilador as any).resolverArgumentoChamada(paraLongoInteiro, 'longo');

            expect(r1.tipo).toBe('inteiro');
            expect(r1.valor).toBe(3);
            expect(r2.tipo).toBe('longo');
            expect(r2.valor).toBe(9);
            expect(r3.tipo).toBe('longo');
            expect(r3.valor).toBe(10);
        });

        it('Resolver argumento de chamada converte lógico para inteiro', () => {
            (compilador as any).resolverTipoConstruto = jest
                .fn()
                .mockReturnValueOnce('lógico')
                .mockReturnValueOnce('lógico');

            const verdadeiro = { tipo: 'lógico', valor: true };
            const falso = { tipo: 'lógico', valor: false };

            const r1 = (compilador as any).resolverArgumentoChamada(verdadeiro, 'inteiro');
            const r2 = (compilador as any).resolverArgumentoChamada(falso, 'inteiro');

            expect(r1.tipo).toBe('inteiro');
            expect(r1.valor).toBe(1);
            expect(r2.tipo).toBe('inteiro');
            expect(r2.valor).toBe(0);
        });

        it('Resolver argumento de chamada amplia inteiro e longo para número', () => {
            (compilador as any).resolverTipoConstruto = jest
                .fn()
                .mockReturnValueOnce('inteiro')
                .mockReturnValueOnce('longo');

            const deInteiro = { tipo: 'inteiro', valor: 5 };
            const deLongo = { tipo: 'longo', valor: 10 };

            const r1 = (compilador as any).resolverArgumentoChamada(deInteiro, 'número');
            const r2 = (compilador as any).resolverArgumentoChamada(deLongo, 'número');

            expect(r1.tipo).toBe('número');
            expect(r1.valor).toBe(5);
            expect(r2.tipo).toBe('número');
            expect(r2.valor).toBe(10);
        });

        it('tipoElementoVetor extrai tipo de vetor<T> e T[]', () => {
            expect((compilador as any).tipoElementoVetor('inteiro[]')).toBe('inteiro');
            expect((compilador as any).tipoElementoVetor('vetor<número>')).toBe('número');
            expect((compilador as any).tipoElementoVetor('vetor')).toBe('inteiro');
        });

        it('incrementoEhPositivo retorna falso para incremento não-unário', () => {
            expect((compilador as any).incrementoEhPositivo(null, 'i')).toBe(false);
            expect((compilador as any).incrementoEhPositivo({ tipo: 'outro' }, 'i')).toBe(false);
        });

        it('armazenarEmVariavel converte inteiro para número e vice-versa', () => {
            const compiladorLocal = new CompiladorLLVM();
            const ponteiro = { id: 'ptr', getType: jest.fn().mockReturnValue({ constructor: { name: 'PointerType' } }) } as any;
            const destino = new VariavelEscopo(ponteiro, undefined, 'número');

            const createSIToFP = jest.fn().mockReturnValue({ id: 'converted' });
            const createFPToSI = jest.fn().mockReturnValue({ id: 'converted2' });
            const createStore = jest.fn();

            (compiladorLocal as any).montador = {
                CreateSIToFP: createSIToFP,
                CreateFPToSI: createFPToSI,
                CreateStore: createStore,
                getInt32Ty: jest.fn().mockReturnValue({}),
                getDoubleTy: jest.fn().mockReturnValue({}),
            };

            const valorInteiro = { id: 'val_int' } as any;
            const valorNumero = { id: 'val_num' } as any;

            (compiladorLocal as any).armazenarEmVariavel(destino, valorInteiro, 'número', 'inteiro');
            expect(createSIToFP).toHaveBeenCalledWith(valorInteiro, expect.anything(), 'int_para_double');

            const destinoInteiro = new VariavelEscopo(ponteiro, undefined, 'inteiro');
            (compiladorLocal as any).armazenarEmVariavel(destinoInteiro, valorNumero, 'inteiro', 'número');
            expect(createFPToSI).toHaveBeenCalledWith(valorNumero, expect.anything(), 'double_para_int');
        });

        it('Binaria DIFERENTE com tipo inteiro usa comparação inteira', async () => {
            const compiladorLocal = new CompiladorLLVM();

            (compiladorLocal as any).resolverTipoConstruto = jest.fn().mockReturnValue('inteiro');
            (compiladorLocal as any).resolverOperando = jest
                .fn()
                .mockReturnValueOnce({ valor: 'esquerdo', tipo: 'inteiro' })
                .mockReturnValueOnce({ valor: 'direito', tipo: 'inteiro' });
            (compiladorLocal as any).definirTipoPrevalente = jest.fn().mockReturnValue('inteiro');
            (compiladorLocal as any).tipoEhInteiroDelegua = jest.fn().mockReturnValue(true);
            (compiladorLocal as any).montador = {
                CreateICmpNE: jest.fn().mockReturnValue('icmp_ne'),
            };

            const resultado = await compiladorLocal.visitarExpressaoBinaria({
                esquerda: { aceitar: jest.fn().mockResolvedValue('valor_esquerdo') },
                direita: { aceitar: jest.fn().mockResolvedValue('valor_direito') },
                operador: { tipo: 'DIFERENTE' },
            } as any);

            expect((compiladorLocal as any).montador.CreateICmpNE).toHaveBeenCalledWith('esquerdo', 'direito');
            expect(resultado).toBe('icmp_ne');
        });

        it('Binaria MENOR com tipo inteiro usa comparação inteira', async () => {
            const compiladorLocal = new CompiladorLLVM();

            (compiladorLocal as any).resolverTipoConstruto = jest.fn().mockReturnValue('inteiro');
            (compiladorLocal as any).resolverOperando = jest
                .fn()
                .mockReturnValueOnce({ valor: 'esquerdo', tipo: 'inteiro' })
                .mockReturnValueOnce({ valor: 'direito', tipo: 'inteiro' });
            (compiladorLocal as any).definirTipoPrevalente = jest.fn().mockReturnValue('inteiro');
            (compiladorLocal as any).tipoEhInteiroDelegua = jest.fn().mockReturnValue(true);
            (compiladorLocal as any).montador = {
                CreateICmpSLT: jest.fn().mockReturnValue('icmp_slt'),
            };

            const resultado = await compiladorLocal.visitarExpressaoBinaria({
                esquerda: { aceitar: jest.fn().mockResolvedValue('valor_esquerdo') },
                direita: { aceitar: jest.fn().mockResolvedValue('valor_direito') },
                operador: { tipo: 'MENOR' },
            } as any);

            expect((compiladorLocal as any).montador.CreateICmpSLT).toHaveBeenCalledWith('esquerdo', 'direito');
            expect(resultado).toBe('icmp_slt');
        });

        it('Binaria MENOR_IGUAL com tipo inteiro usa comparação inteira', async () => {
            const compiladorLocal = new CompiladorLLVM();

            (compiladorLocal as any).resolverTipoConstruto = jest.fn().mockReturnValue('inteiro');
            (compiladorLocal as any).resolverOperando = jest
                .fn()
                .mockReturnValueOnce({ valor: 'esquerdo', tipo: 'inteiro' })
                .mockReturnValueOnce({ valor: 'direito', tipo: 'inteiro' });
            (compiladorLocal as any).definirTipoPrevalente = jest.fn().mockReturnValue('inteiro');
            (compiladorLocal as any).tipoEhInteiroDelegua = jest.fn().mockReturnValue(true);
            (compiladorLocal as any).montador = {
                CreateICmpSLE: jest.fn().mockReturnValue('icmp_sle'),
            };

            const resultado = await compiladorLocal.visitarExpressaoBinaria({
                esquerda: { aceitar: jest.fn().mockResolvedValue('valor_esquerdo') },
                direita: { aceitar: jest.fn().mockResolvedValue('valor_direito') },
                operador: { tipo: 'MENOR_IGUAL' },
            } as any);

            expect((compiladorLocal as any).montador.CreateICmpSLE).toHaveBeenCalledWith('esquerdo', 'direito');
            expect(resultado).toBe('icmp_sle');
        });

        it('Binaria MAIOR com tipo inteiro usa comparação inteira', async () => {
            const compiladorLocal = new CompiladorLLVM();

            (compiladorLocal as any).resolverTipoConstruto = jest.fn().mockReturnValue('inteiro');
            (compiladorLocal as any).resolverOperando = jest
                .fn()
                .mockReturnValueOnce({ valor: 'esquerdo', tipo: 'inteiro' })
                .mockReturnValueOnce({ valor: 'direito', tipo: 'inteiro' });
            (compiladorLocal as any).definirTipoPrevalente = jest.fn().mockReturnValue('inteiro');
            (compiladorLocal as any).tipoEhInteiroDelegua = jest.fn().mockReturnValue(true);
            (compiladorLocal as any).montador = {
                CreateICmpSGT: jest.fn().mockReturnValue('icmp_sgt'),
            };

            const resultado = await compiladorLocal.visitarExpressaoBinaria({
                esquerda: { aceitar: jest.fn().mockResolvedValue('valor_esquerdo') },
                direita: { aceitar: jest.fn().mockResolvedValue('valor_direito') },
                operador: { tipo: 'MAIOR' },
            } as any);

            expect((compiladorLocal as any).montador.CreateICmpSGT).toHaveBeenCalledWith('esquerdo', 'direito');
            expect(resultado).toBe('icmp_sgt');
        });

        it('Binaria MODULO com tipo número usa módulo de ponto flutuante', async () => {
            const compiladorLocal = new CompiladorLLVM();

            (compiladorLocal as any).resolverTipoConstruto = jest.fn().mockReturnValue('número');
            (compiladorLocal as any).resolverOperando = jest
                .fn()
                .mockReturnValueOnce({ valor: 'esquerdo', tipo: 'número' })
                .mockReturnValueOnce({ valor: 'direito', tipo: 'número' });
            (compiladorLocal as any).definirTipoPrevalente = jest.fn().mockReturnValue('número');
            (compiladorLocal as any).montador = {
                CreateFRem: jest.fn().mockReturnValue('frem'),
            };

            const resultado = await compiladorLocal.visitarExpressaoBinaria({
                esquerda: { aceitar: jest.fn().mockResolvedValue('valor_esquerdo') },
                direita: { aceitar: jest.fn().mockResolvedValue('valor_direito') },
                operador: { tipo: 'MODULO' },
            } as any);

            expect((compiladorLocal as any).montador.CreateFRem).toHaveBeenCalledWith('esquerdo', 'direito');
            expect(resultado).toBe('frem');
        });

        it('Binaria IGUAL_IGUAL com tipo número usa comparação de ponto flutuante', async () => {
            const compiladorLocal = new CompiladorLLVM();

            (compiladorLocal as any).resolverTipoConstruto = jest.fn().mockReturnValue('número');
            (compiladorLocal as any).resolverOperando = jest
                .fn()
                .mockReturnValueOnce({ valor: 'esquerdo', tipo: 'número' })
                .mockReturnValueOnce({ valor: 'direito', tipo: 'número' });
            (compiladorLocal as any).definirTipoPrevalente = jest.fn().mockReturnValue('número');
            (compiladorLocal as any).montador = {
                CreateFCmpOEQ: jest.fn().mockReturnValue('fcmp_oeq'),
            };

            const resultado = await compiladorLocal.visitarExpressaoBinaria({
                esquerda: { aceitar: jest.fn().mockResolvedValue('valor_esquerdo') },
                direita: { aceitar: jest.fn().mockResolvedValue('valor_direito') },
                operador: { tipo: 'IGUAL_IGUAL' },
            } as any);

            expect((compiladorLocal as any).montador.CreateFCmpOEQ).toHaveBeenCalledWith('esquerdo', 'direito');
            expect(resultado).toBe('fcmp_oeq');
        });

        it('Binaria MAIOR_IGUAL com tipo número usa comparação de ponto flutuante', async () => {
            const compiladorLocal = new CompiladorLLVM();

            (compiladorLocal as any).resolverTipoConstruto = jest.fn().mockReturnValue('número');
            (compiladorLocal as any).resolverOperando = jest
                .fn()
                .mockReturnValueOnce({ valor: 'esquerdo', tipo: 'número' })
                .mockReturnValueOnce({ valor: 'direito', tipo: 'número' });
            (compiladorLocal as any).definirTipoPrevalente = jest.fn().mockReturnValue('número');
            (compiladorLocal as any).tipoEhInteiroDelegua = jest.fn().mockReturnValue(false);
            (compiladorLocal as any).montador = {
                CreateFCmpOGE: jest.fn().mockReturnValue('fcmp_oge'),
            };

            const resultado = await compiladorLocal.visitarExpressaoBinaria({
                esquerda: { aceitar: jest.fn().mockResolvedValue('valor_esquerdo') },
                direita: { aceitar: jest.fn().mockResolvedValue('valor_direito') },
                operador: { tipo: 'MAIOR_IGUAL' },
            } as any);

            expect((compiladorLocal as any).montador.CreateFCmpOGE).toHaveBeenCalledWith('esquerdo', 'direito');
            expect(resultado).toBe('fcmp_oge');
        });

        it('Binaria MODULO com tipo inteiro usa módulo inteiro', async () => {
            const compiladorLocal = new CompiladorLLVM();

            (compiladorLocal as any).resolverTipoConstruto = jest.fn().mockReturnValue('inteiro');
            (compiladorLocal as any).resolverOperando = jest
                .fn()
                .mockReturnValueOnce({ valor: 'esquerdo', tipo: 'inteiro' })
                .mockReturnValueOnce({ valor: 'direito', tipo: 'inteiro' });
            (compiladorLocal as any).definirTipoPrevalente = jest.fn().mockReturnValue('inteiro');
            (compiladorLocal as any).montador = {
                CreateSRem: jest.fn().mockReturnValue('srem'),
            };

            const resultado = await compiladorLocal.visitarExpressaoBinaria({
                esquerda: { aceitar: jest.fn().mockResolvedValue('valor_esquerdo') },
                direita: { aceitar: jest.fn().mockResolvedValue('valor_direito') },
                operador: { tipo: 'MODULO' },
            } as any);

            expect((compiladorLocal as any).montador.CreateSRem).toHaveBeenCalledWith('esquerdo', 'direito');
            expect(resultado).toBe('srem');
        });

        it('Binaria IGUAL_IGUAL com tipo inteiro usa comparação inteira', async () => {
            const compiladorLocal = new CompiladorLLVM();

            (compiladorLocal as any).resolverTipoConstruto = jest.fn().mockReturnValue('inteiro');
            (compiladorLocal as any).resolverOperando = jest
                .fn()
                .mockReturnValueOnce({ valor: 'esquerdo', tipo: 'inteiro' })
                .mockReturnValueOnce({ valor: 'direito', tipo: 'inteiro' });
            (compiladorLocal as any).definirTipoPrevalente = jest.fn().mockReturnValue('inteiro');
            (compiladorLocal as any).montador = {
                CreateICmpEQ: jest.fn().mockReturnValue('icmp_eq'),
            };

            const resultado = await compiladorLocal.visitarExpressaoBinaria({
                esquerda: { aceitar: jest.fn().mockResolvedValue('valor_esquerdo') },
                direita: { aceitar: jest.fn().mockResolvedValue('valor_direito') },
                operador: { tipo: 'IGUAL_IGUAL' },
            } as any);

            expect((compiladorLocal as any).montador.CreateICmpEQ).toHaveBeenCalledWith('esquerdo', 'direito');
            expect(resultado).toBe('icmp_eq');
        });

        it('Binaria DIVISAO despacha para resolverDivisao', async () => {
            const compiladorLocal = new CompiladorLLVM();

            (compiladorLocal as any).resolverTipoConstruto = jest.fn().mockReturnValue('inteiro');
            (compiladorLocal as any).resolverOperando = jest
                .fn()
                .mockReturnValueOnce({ valor: 'esquerdo', tipo: 'inteiro' })
                .mockReturnValueOnce({ valor: 'direito', tipo: 'inteiro' });
            (compiladorLocal as any).definirTipoPrevalente = jest.fn().mockReturnValue('inteiro');
            (compiladorLocal as any).resolverDivisao = jest.fn().mockResolvedValue('resultado_divisao');

            const resultado = await compiladorLocal.visitarExpressaoBinaria({
                esquerda: { aceitar: jest.fn().mockResolvedValue('valor_esquerdo') },
                direita: { aceitar: jest.fn().mockResolvedValue('valor_direito') },
                operador: { tipo: 'DIVISAO' },
            } as any);

            expect((compiladorLocal as any).resolverDivisao).toHaveBeenCalledWith(
                { valor: 'esquerdo', tipo: 'inteiro' },
                { valor: 'direito', tipo: 'inteiro' }
            );
            expect(resultado).toBe('resultado_divisao');
        });

        it('VisitarExpressaoDeVariavel lança erro quando símbolo não existe', async () => {
            const compiladorLocal = new CompiladorLLVM();
            compiladorLocal.pilhaVariaveisEscopo.empilhar(new Map());

            await expect(
                compiladorLocal.visitarExpressaoDeVariavel({
                    simbolo: { lexema: 'naoExiste' },
                } as any)
            ).rejects.toThrow('Variável naoExiste não existe neste escopo.');
        });
    });

    describe('Compilar - caminhos internos', () => {
        it('Ajuste de inferência retorna qualquer para tipo iniciando com maiúscula', async () => {
            const compiladorLocal = new CompiladorLLVM();

            (compiladorLocal as any).lexador = {
                mapear: jest.fn().mockReturnValue({}),
            };

            const inferenciaOriginal = jest.fn().mockImplementation(() => {
                throw new Error('falha na inferência');
            });

            (compiladorLocal as any).avaliadorSintatico = {
                logicaComumInferenciaTiposAcessoMetodoOuPropriedade: inferenciaOriginal,
                analisar: jest.fn().mockResolvedValue({ erros: [], declaracoes: [] }),
            };

            (compiladorLocal as any).criarFuncoesNativa = jest.fn();
            (compiladorLocal as any).criarPontoEntrada = jest.fn().mockResolvedValue(undefined);

            await compiladorLocal.compilar([]);

            const inferenciaAjustada = (compiladorLocal as any).avaliadorSintatico.logicaComumInferenciaTiposAcessoMetodoOuPropriedade;
            expect(inferenciaAjustada({ objeto: { tipo: 'MinhaClasse' } })).toBe('qualquer');
            expect(() => inferenciaAjustada({ objeto: { tipo: 'minhaClasse' } })).toThrow('falha na inferência');
        });

        it('Compilar funciona quando inferência original não existe', async () => {
            const compiladorLocal = new CompiladorLLVM();

            (compiladorLocal as any).lexador = {
                mapear: jest.fn().mockReturnValue({}),
            };

            (compiladorLocal as any).avaliadorSintatico = {
                analisar: jest.fn().mockResolvedValue({ erros: [], declaracoes: [] }),
            };

            (compiladorLocal as any).criarFuncoesNativa = jest.fn();
            (compiladorLocal as any).criarPontoEntrada = jest.fn().mockResolvedValue(undefined);

            await expect(compiladorLocal.compilar([])).resolves.toBeTruthy();
            expect((compiladorLocal as any).avaliadorSintatico.__ajusteInferenciaMembroAplicado).toBe(true);
        });

        it('Compilar retorna indefinido quando verifyModule falha', async () => {
            const compiladorLocal = new CompiladorLLVM();

            (compiladorLocal as any).lexador = {
                mapear: jest.fn().mockReturnValue({}),
            };

            (compiladorLocal as any).avaliadorSintatico = {
                analisar: jest.fn().mockResolvedValue({ erros: [], declaracoes: [] }),
            };

            (compiladorLocal as any).criarFuncoesNativa = jest.fn();
            (compiladorLocal as any).criarPontoEntrada = jest.fn().mockResolvedValue(undefined);

            const spyVerifyModule = jest.spyOn(llvm as any, 'verifyModule').mockReturnValue(true);
            const spyConsoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

            const resultado = await compiladorLocal.compilar([]);

            expect(resultado).toBeUndefined();
            expect(spyConsoleError).toHaveBeenCalledWith('Falha ao verificar módulo.');

            spyVerifyModule.mockRestore();
            spyConsoleError.mockRestore();
        });

        it('Compilar registra erro quando verifyFunction falha no ponto de entrada', async () => {
            const compiladorLocal = new CompiladorLLVM();

            (compiladorLocal as any).lexador = {
                mapear: jest.fn().mockReturnValue({}),
            };

            (compiladorLocal as any).avaliadorSintatico = {
                analisar: jest.fn().mockResolvedValue({ erros: [], declaracoes: [] }),
            };

            const spyVerifyFunction = jest.spyOn(llvm as any, 'verifyFunction').mockReturnValue(true);
            const spyVerifyModule = jest.spyOn(llvm as any, 'verifyModule').mockReturnValue(false);
            const spyConsoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

            const resultado = await compiladorLocal.compilar([]);

            expect(resultado).toBeTruthy();
            expect(spyConsoleError).toHaveBeenCalledWith('Falha ao verificar função de início.');

            spyVerifyFunction.mockRestore();
            spyVerifyModule.mockRestore();
            spyConsoleError.mockRestore();
        });

        it('Compilar não reconfigura inferência quando ajuste já foi aplicado', async () => {
            const compiladorLocal = new CompiladorLLVM();

            (compiladorLocal as any).lexador = {
                mapear: jest.fn().mockReturnValue({}),
            };

            const inferenciaOriginal = jest.fn().mockReturnValue('inteiro');
            const avaliador = {
                __ajusteInferenciaMembroAplicado: true,
                tiposDefinidosPorBibliotecas: {},
                logicaComumInferenciaTiposAcessoMetodoOuPropriedade: inferenciaOriginal,
                analisar: jest.fn().mockResolvedValue({ erros: [], declaracoes: [] }),
            };
            (compiladorLocal as any).avaliadorSintatico = avaliador;

            await expect(compiladorLocal.compilar([])).resolves.toBeTruthy();
            expect((compiladorLocal as any).avaliadorSintatico.logicaComumInferenciaTiposAcessoMetodoOuPropriedade).toBe(inferenciaOriginal);
        });

        it('ChamarMetodoInstancia usa tipo do objeto quando VariavelEscopo', async () => {
            const compiladorLocal = new CompiladorLLVM();
            const ponteiroObjeto = { id: 'objeto' } as any;
            const ponteiroArgumento = { id: 'argumento' } as any;

            (compiladorLocal as any).modulo = {
                getFunction: jest.fn().mockReturnValue('funcao_llvM'),
            };
            (compiladorLocal as any).montador = {
                CreateCall: jest.fn().mockReturnValue('resultado_call'),
            };

            const objetoResolvido = new VariavelEscopo(ponteiroObjeto, undefined, 'Pessoa');
            const argumentoResolvido = new VariavelEscopo(ponteiroArgumento, undefined, 'texto');

            const resultado = await (compiladorLocal as any).chamarMetodoInstancia(
                {
                    objeto: { aceitar: jest.fn().mockResolvedValue(objetoResolvido) },
                    nomeMetodo: 'falar',
                },
                [{ aceitar: jest.fn().mockResolvedValue(argumentoResolvido) }]
            );

            expect((compiladorLocal as any).modulo.getFunction).toHaveBeenCalledWith('Pessoa_falar');
            expect((compiladorLocal as any).montador.CreateCall).toHaveBeenCalledWith('funcao_llvM', [ponteiroObjeto, ponteiroArgumento]);
            expect(resultado).toBe('resultado_call');
        });

        it('PilhaVariaveisEscopo lança erro em topoDaPilha quando vazia', () => {
            const pilha = new PilhaVariaveisEscopo();
            expect(() => pilha.topoDaPilha()).toThrow('Pilha vazia.');
        });

        it('PilhaVariaveisEscopo lança erro em removerUltimo quando vazia', () => {
            const pilha = new PilhaVariaveisEscopo();
            expect(() => pilha.removerUltimo()).toThrow('Pilha vazia.');
        });

        it('PilhaVariaveisEscopo lança erro em obterValor quando variável não encontrada', () => {
            const pilha = new PilhaVariaveisEscopo();
            pilha.empilhar(new Map());
            expect(() => pilha.obterValor('naoExiste')).toThrow("Variável não definida: 'naoExiste'.");
        });

        it('ChamarMetodoInstancia resolve classe via variável quando objeto não é VariavelEscopo', async () => {
            const compiladorLocal = new CompiladorLLVM();

            compiladorLocal.pilhaVariaveisEscopo.empilhar(new Map());
            compiladorLocal.pilhaVariaveisEscopo.topoDaPilha().set('p', new VariavelEscopo({ id: 'slot' } as any, undefined, 'Pessoa'));

            (compiladorLocal as any).modulo = {
                getFunction: jest.fn().mockReturnValue('funcao_llvM'),
            };
            (compiladorLocal as any).montador = {
                CreateCall: jest.fn().mockReturnValue('resultado_call'),
            };

            const objetoVariavel = {
                simbolo: { lexema: 'p' },
                aceitar: jest.fn().mockResolvedValue({ id: 'objeto_direto' }),
                constructor: { name: 'Variavel' },
            };

            await (compiladorLocal as any).chamarMetodoInstancia(
                {
                    objeto: objetoVariavel,
                    nomeMetodo: 'falar',
                },
                []
            );

            expect((compiladorLocal as any).modulo.getFunction).toHaveBeenCalledWith('Pessoa_falar');
            expect((compiladorLocal as any).montador.CreateCall).toHaveBeenCalledWith('funcao_llvM', [{ id: 'objeto_direto' }]);
        });
    });

});
