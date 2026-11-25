import {
    AcessoMetodo,
    AcessoMetodoOuPropriedade,
    Classe,
    Para,
    Se,
    Super,
    Variavel,
    Vetor,
} from '@designliquido/delegua';
import { ConstrutoInterface } from '@designliquido/delegua/interfaces';
import llvm, { APInt, ConstantInt } from '@designliquido/llvm-bindings';
import { tipoEhDicionario, tipoEhInteiroDelegua, tipoEhPonteiro, tipoEhVetor, tipoElementoVetor } from './ajudantes';
import { ErroCompilador } from './erros/erro-compilador';
import { idsDescendentes } from './excecoes';
import { VariavelEscopo } from './variavel-escopo';
import { CompiladorLLVM } from './compilador-llvm';

/**
 * Instanciação de classes e chamadas de método: métodos de classes Delégua, de classes
 * estrangeiras, de módulos importados e os embutidos de texto, dicionário e vetor.
 * Implementado como mixin de CompiladorLLVM.
 */

export async function instanciarClasse(
    this: CompiladorLLVM,
    nomeClasse: string,
    argumentos: ConstrutoInterface[]
): Promise<llvm.Value> {
    const tipoStruct = this.registroClasses.get(nomeClasse);
    // Alocar no montão (heap) para que o objeto sobreviva ao escopo de pilha atual.
    // alloca produzia ponteiro dangling quando armazenado em campo de outra classe.
    const tamanhoStruct = this.layoutDados.getTypeAllocSize(tipoStruct);
    const tamanhoConst = ConstantInt.get(this.contexto, new APInt(64, tamanhoStruct));

    // Estrutura estrangeira: memória zerada (como uma struct C inicializada com zeros), sem construtor.
    if (this.estruturasEstrangeiras.has(nomeClasse)) {
        if (argumentos.length > 0) {
            throw new ErroCompilador(`Estrutura estrangeira '${nomeClasse}' é criada sem argumentos: ${nomeClasse}().`);
        }
        const i64 = llvm.Type.getInt64Ty(this.contexto);
        const calloc = this.obterFuncaoRuntime('calloc', this.montador.getPtrTy(), [i64, i64]);
        return this.montador.CreateCall(
            calloc,
            [ConstantInt.get(this.contexto, new APInt(64, 1)), tamanhoConst],
            `estrutura_${nomeClasse}`
        );
    }

    const objetoAlloc = this.montador.CreateCall(this.funcaoMalloc, [tamanhoConst], `obj_${nomeClasse}`);

    // Estampa o id de identidade em tempo de execução (campo oculto __tipoId, sempre no
    // índice 0) usado por eInstanciaDe.
    const indiceTipoId = this.indicesPropriedades.get(nomeClasse)?.get('__tipoId');
    if (indiceTipoId !== undefined && this.idClasse.has(nomeClasse)) {
        const gepTipoId = this.montador.CreateInBoundsGEP(
            tipoStruct,
            objetoAlloc,
            [
                ConstantInt.get(this.contexto, new APInt(32, 0)),
                ConstantInt.get(this.contexto, new APInt(32, indiceTipoId)),
            ],
            'tipo_id_ptr'
        );
        this.montador.CreateStore(
            ConstantInt.get(this.contexto, new APInt(32, this.idClasse.get(nomeClasse))),
            gepTipoId
        );
    }

    let classeDoConstrutor: string | undefined = nomeClasse;
    let funcaoConstrutor = this.modulo.getFunction(`${nomeClasse}_construtor`);
    while (!funcaoConstrutor && classeDoConstrutor) {
        classeDoConstrutor = this.superClasses.get(classeDoConstrutor);
        if (classeDoConstrutor) funcaoConstrutor = this.modulo.getFunction(`${classeDoConstrutor}_construtor`);
    }
    if (funcaoConstrutor) {
        const args: llvm.Value[] = [objetoAlloc];
        const paramDefsConstrutor = this.parametrosMetodosClasse.get(classeDoConstrutor)?.get('construtor') ?? [];
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
            const construtorEsperaPtr = tipoEhPonteiro(tipoEsperado);
            if (argResolvido instanceof VariavelEscopo) {
                const llvmValue = argResolvido.variavelLlvm;
                if (construtorEsperaPtr && this.ehTipoObjeto(argResolvido.tipo)) {
                    valor = this.carregarPtrClasseSePreciso(argResolvido);
                } else if (construtorEsperaPtr) {
                    // Parâmetro ptr: passa alloca diretamente; o construtor faz load para obter o valor.
                    valor = llvmValue;
                } else if (tipoEhPonteiro(llvmValue.getType())) {
                    // Parâmetro primitivo: carrega o valor da alloca.
                    const tipoLlvm = this.obterTipoLlvm(argResolvido.tipo ?? 'número');
                    valor = this.montador.CreateLoad(tipoLlvm, llvmValue, 'load_arg_construtor');
                } else {
                    valor = llvmValue;
                }
            } else {
                valor = argResolvido as llvm.Value;
                const tipoArgBruto = noArgumento ? this.resolverTipoConstruto(noArgumento) : undefined;
                if (construtorEsperaPtr && this.ehTipoObjeto(tipoArgBruto)) {
                    // Instância de classe crua (ex.: resultado de método/índice de vetor):
                    // sempre ponteiro direto, nunca embrulhar em alloca extra.
                } else {
                    const construtorInstanciaValor = valor?.constructor;
                    // GEP e Alloca já apontam para onde o valor está (ptr indireto): passa diretamente.
                    // CallInst, ConstantPointerNull, LoadInst, etc. SÃO o valor (ptr direto):
                    // precisa embrulhar em alloca para o construtor poder fazer load.
                    const valorEhPtrDireto =
                        construtorInstanciaValor !== llvm.GetElementPtrInst &&
                        construtorInstanciaValor !== llvm.AllocaInst;
                    if (construtorEsperaPtr && valor && tipoEhPonteiro(valor.getType()) && valorEhPtrDireto) {
                        const tmpAlloca = this.criarAllocaNoBlocoEntrada(this.montador.getPtrTy(), 'box_arg_ptr');
                        this.montador.CreateStore(valor, tmpAlloca);
                        valor = tmpAlloca;
                    } else if (valor && tipoEhPonteiro(valor.getType()) && !construtorEsperaPtr) {
                        valor = this.montador.CreateLoad(tipoEsperado, valor, 'load_arg_construtor_bruto');
                    }
                }
            }
            // Conversão de tipos: i32 ↔ double ↔ ptr conforme assinatura do construtor.
            // Compara o construtor (classe LLVM) em vez da instância de Type (===), pois
            // instâncias de Type retornadas pelo binding Napi não são singletons garantidos.
            if (!valor) {
                valor = llvm.Constant.getNullValue(this.montador.getPtrTy()) as unknown as llvm.Value;
            }
            const construtorValor = valor.getType()?.constructor;
            const construtorTipoEsperado = tipoEsperado?.constructor;
            const tipoEsperadoEhDouble = construtorTipoEsperado === llvm.Type;
            const tipoEsperadoEhInt = construtorTipoEsperado === llvm.IntegerType;
            const tipoEsperadoEhPtr = construtorTipoEsperado === llvm.PointerType;
            const tipoValorEhInt = construtorValor === llvm.IntegerType;
            const tipoValorEhDouble = construtorValor === llvm.Type;
            if (tipoEsperadoEhInt && tipoValorEhInt) {
                // i32/i64 têm mesmo construtor (IntegerType): usa isIntegerTy(N) para largura.
                const valorEh64 = valor.getType().isIntegerTy(64);
                const esperadoEh64 = tipoEsperado.isIntegerTy(64);
                if (!valorEh64 && esperadoEh64) {
                    valor = this.montador.CreateSExt(valor, tipoEsperado, 'sext_int');
                } else if (valorEh64 && !esperadoEh64) {
                    valor = this.montador.CreateTrunc(valor, tipoEsperado, 'trunc_int');
                }
            } else if (construtorValor !== construtorTipoEsperado) {
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

export async function chamarMetodoInstancia(
    this: CompiladorLLVM,
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
        const construtorObjeto = (acesso.objeto as any)?.constructor;
        if (construtorObjeto === Variavel && (acesso.objeto as Variavel).simbolo?.lexema) {
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
        const nomeClasseAlvo = argAlvo?.constructor === Variavel ? (argAlvo as Variavel).simbolo?.lexema : undefined;
        if (!nomeClasseAlvo || !this.registroClasses.has(nomeClasseAlvo)) {
            const erroAlvo = new ErroCompilador(`eInstanciaDe espera o nome de uma classe conhecida como argumento.`);
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

    // Métodos embutidos de dicionário
    if (tipoEhDicionario(nomeClasse)) {
        const dicionarioPtr =
            objetoResolvido instanceof VariavelEscopo ? this.resolverPonteiroDireto(objetoResolvido) : objetoPtr;
        return await this.chamarMetodoDicionario(nomeMetodo, dicionarioPtr, argumentos, acesso.linha);
    }

    // Métodos embutidos de texto
    if (nomeClasse === 'texto') {
        // chamarMetodoTexto espera ptr* (char**): alloca ou gepPtr.
        // Se objetoPtr for LoadInst/CallInst, já é char* — embrulha em alloca temporária.
        // Só alloca (variável local), Argument (parâmetro texto, dupla indireção) e GEP
        // (slot de campo) já são char**; o resto — inclusive literais, que são constantes —
        // é o próprio char*.
        let textoSlot = objetoPtr;
        const construtorObjPtr = objetoPtr?.constructor;
        const ehSlotTexto =
            construtorObjPtr === llvm.AllocaInst ||
            construtorObjPtr === llvm.Argument ||
            construtorObjPtr === llvm.GetElementPtrInst;
        if (!ehSlotTexto) {
            textoSlot = this.criarAllocaNoBlocoEntrada(this.montador.getPtrTy(), 'texto_slot');
            this.montador.CreateStore(objetoPtr, textoSlot);
        }
        return await this.chamarMetodoTexto(nomeMetodo, textoSlot, argumentos, acesso.linha);
    }

    // Métodos embutidos de vetor
    if (tipoEhVetor(nomeClasse)) {
        const tipoElem = tipoElementoVetor(nomeClasse);
        // Um vetor devolvido por função (`lista().tamanho()`) chega como %Vetor por valor.
        const vetorPtr = objetoPtr ? this.ponteiroParaVetor(objetoPtr) : objetoPtr;
        return await this.chamarMetodoVetor(nomeMetodo, vetorPtr, tipoElem, argumentos, acesso.linha);
    }

    // Fallback: parâmetro tipado como qualquer, mas o método é de vetor (ex.: qualquer.tamanho())
    if ((!nomeClasse || nomeClasse === 'qualquer') && CompiladorLLVM.METODOS_VETOR_BUILTIN.has(nomeMetodo)) {
        return await this.chamarMetodoVetor(nomeMetodo, objetoPtr, 'qualquer', argumentos, acesso.linha);
    }

    // Despacho de módulo importado:
    //   var mod = importar('nome')         → tipo 'modulo:nome'
    //   importar tudo como mod de 'nome'   → tipo 'modulo:nome'
    if (nomeClasse?.startsWith('modulo:')) {
        const nomeModulo = nomeClasse.slice(7);
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
            } else if (tipoPar === 'lógico' || tipoPar === 'logico') {
                // Na ABI dos módulos, lógico é um int C (0/1).
                args.push(await this.carregarArgumentoLogicoComoInteiro(argumentos[i]));
            } else if (tipoPar === 'longo' || tipoPar === 'ponteiro') {
                args.push(await this.carregarArgumentoFFI(argumentos[i], tipoPar));
            } else if (tipoEhVetor(tipoPar)) {
                // Vetor*: ponteiro para o struct %Vetor.
                const argResolvido = await argumentos[i].aceitar(this);
                const valorVetor =
                    argResolvido instanceof VariavelEscopo ? argResolvido.variavelLlvm : (argResolvido as llvm.Value);
                args.push(this.resolverPonteiroEstruturaVetor(valorVetor));
            } else {
                const argResolvido = await argumentos[i].aceitar(this);
                args.push(
                    argResolvido instanceof VariavelEscopo
                        ? this.ehTipoObjeto(tipoPar)
                            ? this.carregarPtrClasseSePreciso(argResolvido)
                            : argResolvido.variavelLlvm
                        : (argResolvido as llvm.Value)
                );
            }
        }
        // Argumentos finais omitidos chegam como zero/nulo (ex.: diretório opcional).
        for (let i = args.length; i < entrada.tiposParametros.length; i++) {
            const tipoPar = entrada.tiposParametros[i];
            const tipoLlvm =
                tipoPar === 'inteiro' || tipoPar === 'lógico' || tipoPar === 'logico'
                    ? this.montador.getInt32Ty()
                    : tipoPar === 'longo'
                      ? llvm.Type.getInt64Ty(this.contexto)
                      : tipoPar === 'numero' || tipoPar === 'número'
                        ? this.montador.getDoubleTy()
                        : this.montador.getPtrTy();
            args.push(llvm.Constant.getNullValue(tipoLlvm) as unknown as llvm.Value);
        }
        const resultadoModulo = this.montador.CreateCall(entrada.callee, args);
        if (entrada.tipoRetorno === 'lógico' || entrada.tipoRetorno === 'logico') {
            return this.inteiroParaLogico(resultadoModulo, `${nomeMetodo}_logico`);
        }
        return resultadoModulo;
    }

    // Despacho de classe estrangeira (@definicao):
    //   LibM.cosseno(x) → tipo 'classeEstrangeira:LibM'
    if (nomeClasse?.startsWith('classeEstrangeira:')) {
        const nomeClasseReal = nomeClasse.slice('classeEstrangeira:'.length);
        const funcoes = this.mapaModulos.get(nomeClasseReal);
        const entrada = funcoes?.get(nomeMetodo);
        // Estrutura.tamanhoEmBytes(): sizeof da estrutura estrangeira na plataforma alvo.
        if (!entrada && nomeMetodo === 'tamanhoEmBytes' && this.estruturasEstrangeiras.has(nomeClasseReal)) {
            return ConstantInt.get(
                this.contexto,
                new APInt(32, this.tamanhoEstruturaEstrangeira(nomeClasseReal))
            ) as unknown as llvm.Value;
        }
        if (!entrada) {
            const erroMetodo = new ErroCompilador(
                `Método '${nomeMetodo}' não encontrado na classe estrangeira '${nomeClasseReal}'.`
            );
            erroMetodo.linha = acesso.linha;
            erroMetodo.tamanhoToken = nomeMetodo.length;
            throw erroMetodo;
        }
        if (argumentos.length > entrada.tiposParametros.length) {
            const erroAridade = new ErroCompilador(
                `Método '${nomeMetodo}' da classe estrangeira '${nomeClasseReal}' recebe ${entrada.tiposParametros.length} argumento(s), mas recebeu ${argumentos.length}.`
            );
            erroAridade.linha = acesso.linha;
            throw erroAridade;
        }
        const argsEstrangeira: llvm.Value[] = [];
        for (let i = 0; i < entrada.tiposParametros.length; i++) {
            const tipoPar = entrada.tiposParametros[i];
            if (i < argumentos.length) {
                argsEstrangeira.push(await this.carregarArgumentoFFI(argumentos[i], tipoPar));
            } else {
                // Argumentos finais omitidos: zero/nulo do tipo C.
                argsEstrangeira.push(
                    llvm.Constant.getNullValue(this.tipoFFIParaLlvm(tipoPar)) as unknown as llvm.Value
                );
            }
        }
        const resultadoEstrangeira = this.montador.CreateCall(entrada.callee, argsEstrangeira);
        if (entrada.tipoRetorno === 'byte') {
            return this.montador.CreateZExt(resultadoEstrangeira, this.montador.getInt32Ty(), `${nomeMetodo}_byte`);
        }
        return resultadoEstrangeira;
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
            const objPtr = tipoEhPonteiro(objetoPtr?.getType?.())
                ? this.montador.CreateLoad(this.montador.getPtrTy(), objetoPtr, 'qualquer_obj')
                : objetoPtr;
            const argsQualquer: llvm.Value[] = [objPtr];
            for (const argumento of argumentos) {
                const argResolvido = await argumento.aceitar(this);
                argsQualquer.push(
                    argResolvido instanceof VariavelEscopo ? argResolvido.variavelLlvm : (argResolvido as llvm.Value)
                );
            }
            return this.montador.CreateCall(funcaoLlvm, argsQualquer);
        }
    }

    // Despacho dinâmico: por uma interface, sempre; por uma classe, para que a chamada
    // alcance a sobrescrita de uma subclasse. `super.metodo()` chama a versão da
    // superclasse diretamente.
    if (!funcaoLlvm && this.interfacesDeclaradas.has(nomeClasse)) {
        funcaoLlvm = this.obterDespachoInterface(nomeClasse, nomeMetodo);
    } else if (
        funcaoLlvm &&
        this.metodosSobrescritos.has(`${nomeClasse}.${nomeMetodo}`) &&
        acesso.objeto?.constructor !== Super
    ) {
        funcaoLlvm = this.obterDespachoVirtual(nomeClasse, nomeMetodo, funcaoLlvm);
    }

    if (!funcaoLlvm) {
        const erroMetodo = new ErroCompilador(`Método '${nomeMetodo}' não encontrado na classe '${nomeClasse}'.`);
        erroMetodo.linha = acesso.linha;
        erroMetodo.tamanhoToken = nomeMetodo.length;
        throw erroMetodo;
    }

    const paramDefsMetodo = this.parametrosMetodosClasse.get(nomeClasse)?.get(nomeMetodo) ?? [];
    const args: llvm.Value[] = [objetoPtr];
    for (const [indiceArgumento, argumentoOriginal] of argumentos.entries()) {
        const tipoParamDeclarado = paramDefsMetodo[indiceArgumento]?.tipoDado;
        const argumento = tipoParamDeclarado
            ? this.resolverArgumentoChamada(argumentoOriginal, tipoParamDeclarado)
            : argumentoOriginal;
        const argResolvido = await argumento.aceitar(this);
        if (argResolvido instanceof VariavelEscopo) {
            const valVE = argResolvido.variavelLlvm;
            const construtorInstVE = valVE?.constructor;
            // O parâmetro declarado no callee manda: se ele espera uma classe conhecida,
            // o valor é sempre ponteiro direto para essa classe, mesmo que o TIPO INFERIDO
            // da expressão de origem seja apenas "qualquer" (ex.: leitura de campo de
            // `dicionário`). Sem isto, um argumento como `dicionario["chave"]` passado a um
            // parâmetro `Classe` cai no ramo de baixo (convenção ptr* de "qualquer") e é
            // reembrulhado numa alloca extra — ponteiro-para-ponteiro que o corpo do
            // método, ao acessar campo com GEP direto em cima do parâmetro, interpreta
            // incorretamente como o próprio objeto (endereço de memória arbitrário/lixo).
            //
            // No sentido inverso, quando o parâmetro do callee é EXPLICITAMENTE "qualquer",
            // ele sempre faz um load para desembrulhar (ver Interpretador_criarValor gerado
            // — `load ptr, ptr %2`); nesse caso NÃO tratamos como classe direta mesmo que o
            // tipo inferido do argumento seja uma classe conhecida, senão esse load lê os
            // primeiros 8 bytes do próprio objeto como se fossem um ponteiro (lixo).
            const paramExplicitamenteQualquer = tipoParamDeclarado === 'qualquer';
            const paramEsperaClasseDireta = this.ehTipoObjeto(tipoParamDeclarado);
            if (
                paramEsperaClasseDireta ||
                (!paramExplicitamenteQualquer && this.ehTipoObjeto(argResolvido.tipo))
            ) {
                // Instâncias de classe são sempre ponteiro direto (single indirection) —
                // mesma convenção de carregarPtrClasseSePreciso/resolverOperando: só
                // AllocaInst aponta PARA o ponteiro do objeto (precisa de load antes de
                // passar); Argument/CallInst/LoadInst/GEP já SÃO o ponteiro do objeto e
                // nunca devem ser reembrulhados numa alloca extra (isso criaria um
                // ponteiro-para-ponteiro que o corpo do método, ao fazer acesso a campo,
                // interpretaria incorretamente como o próprio objeto).
                const precisaCarregar = construtorInstVE === llvm.AllocaInst;
                args.push(
                    precisaCarregar ? this.montador.CreateLoad(this.montador.getPtrTy(), valVE, 'load_obj_arg') : valVE
                );
            } else {
                const indiceArgAtual = args.length;
                const tipoParamEsperado =
                    typeof (funcaoLlvm as any).arg_size === 'function' && indiceArgAtual < funcaoLlvm.arg_size()
                        ? funcaoLlvm.getArg(indiceArgAtual).getType()
                        : undefined;
                const tipoArgEhEscalarConcreto =
                    tipoEhInteiroDelegua(argResolvido.tipo) ||
                    argResolvido.tipo === 'número' ||
                    argResolvido.tipo === 'lógico';
                if (tipoParamEsperado && tipoEhPonteiro(tipoParamEsperado) && tipoArgEhEscalarConcreto) {
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
                    const tmpAllocaCaixa = this.criarAllocaNoBlocoEntrada(
                        this.montador.getPtrTy(),
                        'arg_ptr_box_qualquer'
                    );
                    this.montador.CreateStore(caixaArg, tmpAllocaCaixa);
                    args.push(tmpAllocaCaixa);
                    continue;
                }

                // Parâmetro escalar (ex.: `lógico` declarado no método) e argumento que é
                // o endereço de uma variável local ou campo: passa o valor, não o endereço.
                if (
                    tipoParamEsperado &&
                    !tipoEhPonteiro(tipoParamEsperado) &&
                    valVE &&
                    tipoEhPonteiro(valVE.getType()) &&
                    (construtorInstVE === llvm.AllocaInst || construtorInstVE === llvm.GetElementPtrInst)
                ) {
                    args.push(this.montador.CreateLoad(tipoParamEsperado, valVE, 'load_arg_escalar'));
                    continue;
                }

                // texto/lógico/qualquer/dicionário: convenção ptr* — AllocaInst/GEP/Argument
                // já são ptr* (apontam PARA o valor) e passam direto; um valor já
                // materializado (CallInst/LoadInst) precisa ser embrulhado numa alloca
                // temporária para o callee poder fazer o load.
                const valVEEhPtrDireto =
                    construtorInstVE !== llvm.GetElementPtrInst &&
                    construtorInstVE !== llvm.AllocaInst &&
                    construtorInstVE !== llvm.Argument;
                if (valVE && tipoEhPonteiro(valVE?.getType?.()) && valVEEhPtrDireto) {
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
            // Vetor devolvido por valor (ex.: `objeto.metodo(criarLista())`): parâmetros de
            // vetor recebem o endereço de um %Vetor, não uma caixa de `qualquer`.
            if (
                tipoParamEsperado &&
                tipoEhPonteiro(tipoParamEsperado) &&
                val &&
                val.getType().isStructTy() &&
                (tipoEhVetor(tipoParamDeclarado) || tipoEhVetor(this.resolverTipoConstruto(argumento as ConstrutoInterface)))
            ) {
                args.push(this.resolverPonteiroEstruturaVetor(val));
                continue;
            }
            if (tipoParamEsperado && tipoEhPonteiro(tipoParamEsperado) && val && !tipoEhPonteiro(val.getType())) {
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
            // VariavelEscopo acima). Mas só quando o parâmetro do callee não é
            // EXPLICITAMENTE "qualquer": um parâmetro `qualquer` sempre faz um load para
            // desembrulhar (ver Interpretador_criarValor gerado — `load ptr, ptr %2`), e
            // passar o ponteiro de objeto cru ali faria esse load ler os primeiros 8 bytes
            // do próprio objeto como se fossem um ponteiro (lixo). Sem essa exclusão, um
            // argumento como uma instância de classe passada a um parâmetro `valor: qualquer`
            // (ex.: `criarValor("funcao", instanciaDeClasse)`) corrompe o ponteiro guardado.
            const tipoArgBruto = this.resolverTipoConstruto(argumento as ConstrutoInterface);
            const paramExplicitamenteQualquer = tipoParamDeclarado === 'qualquer';
            const paramEsperaClasseDireta = this.ehTipoObjeto(tipoParamDeclarado);
            const podeTratarComoClasseDireta =
                paramEsperaClasseDireta ||
                (!paramExplicitamenteQualquer && this.ehTipoObjeto(tipoArgBruto));
            if (podeTratarComoClasseDireta) {
                args.push(val);
                continue;
            }

            // Délégua usa convenção ptr*: LoadInst/CallInst etc. são ptrs diretos que precisam
            // de alloca para que o callee possa fazer "load ptr, ptr %arg".
            // AllocaInst e GetElementPtrInst já são ptr* — passam direto.
            const construtorInstVal = val?.constructor;
            const valEhPtrDireto =
                construtorInstVal !== llvm.GetElementPtrInst && construtorInstVal !== llvm.AllocaInst;
            if (val && tipoEhPonteiro(val.getType()) && valEhPtrDireto) {
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
