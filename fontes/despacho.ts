import { Classe, InterfaceDeclaracao } from '@designliquido/delegua';
import { ParametroInterface } from '@designliquido/delegua/interfaces';
import llvm, { APInt, ConstantInt } from '@designliquido/llvm-bindings';
import { tipoEhVetor } from './ajudantes';
import type { CompiladorLLVM } from './compilador-llvm';

/**
 * Despacho dinâmico de métodos e interfaces. Chamadas a métodos sobrescritos em alguma subclasse,
 * e a métodos de interface, passam por uma função `__despacho_Tipo_metodo` que escolhe a
 * implementação pelo `__tipoId` do objeto (campo 0). Implementado como mixin de CompiladorLLVM.
 */

/**
 * Registra uma interface: os tipos de retorno e os parâmetros das assinaturas servem
 * para inferir tipos e converter argumentos nas chamadas por meio da interface, que são
 * despachadas em tempo de execução para a classe que implementa o método.
 */
export function registrarInterface(this: CompiladorLLVM, declaracao: InterfaceDeclaracao): void {
    const nomeInterface = declaracao.simbolo.lexema;
    this.interfacesDeclaradas.set(nomeInterface, declaracao);
    const tiposRetorno = new Map<string, string>();
    const parametros = new Map<string, ParametroInterface[]>();
    for (const assinatura of declaracao.metodos ?? []) {
        tiposRetorno.set(assinatura.nome.lexema, assinatura.tipoRetorno ?? 'vazio');
        parametros.set(assinatura.nome.lexema, assinatura.parametros ?? []);
    }
    this.metodosClasse.set(nomeInterface, tiposRetorno);
    this.parametrosMetodosClasse.set(nomeInterface, parametros);
}

/**
 * Marca `Ancestral.metodo` para cada método que uma classe declara e que algum ancestral
 * também tem: uma chamada por meio de uma variável do tipo do ancestral pode alcançar a
 * sobrescrita, então precisa de despacho dinâmico. Usa só as declarações (antes de compilar
 * as classes), porque um método da superclasse pode chamar `isto.metodo()` antes de a
 * subclasse ser compilada.
 */
export function registrarMetodosSobrescritos(this: CompiladorLLVM, classes: Classe[]): void {
    const superclasses = new Map<string, string>();
    const metodos = new Map<string, Set<string>>();
    for (const classe of classes) {
        if (classe.estrangeira) continue;
        const nome = classe.simbolo.lexema;
        const referencia = classe.superClasses?.[0] as { simbolo?: { lexema?: string }; tipo?: string };
        const nomeSuper = referencia?.simbolo?.lexema ?? referencia?.tipo;
        if (nomeSuper) superclasses.set(nome, nomeSuper);
        metodos.set(nome, new Set(classe.metodos.map((m) => m.simbolo.lexema).filter((m) => m !== 'construtor')));
    }
    for (const [nome, metodosProprios] of metodos) {
        const visitados = new Set<string>([nome]);
        let ancestral = superclasses.get(nome);
        while (ancestral && !visitados.has(ancestral)) {
            visitados.add(ancestral);
            for (const metodo of metodosProprios) this.metodosSobrescritos.add(`${ancestral}.${metodo}`);
            ancestral = superclasses.get(ancestral);
        }
    }
}

/** Tipo LLVM de função de uma função já criada (o binding não expõe Function.getFunctionType). */
export function tipoFuncaoDe(this: CompiladorLLVM, funcao: llvm.Function): llvm.FunctionType {
    const tiposParametros: llvm.Type[] = [];
    for (let i = 0; i < funcao.arg_size(); i++) tiposParametros.push(funcao.getArg(i).getType());
    return llvm.FunctionType.get(funcao.getReturnType(), tiposParametros, false);
}

/** Dois tipos LLVM são iguais (compara TypeID e, para inteiros, a largura). */
export function tiposLlvmIguais(this: CompiladorLLVM, a: llvm.Type, b: llvm.Type): boolean {
    if (a.getTypeID() !== b.getTypeID()) return false;
    return a.getTypeID() !== llvm.Type.TypeID.IntegerTyID || this.larguraTipoInteiro(a) === this.larguraTipoInteiro(b);
}

/** A função `candidata` pode ser chamada com os argumentos e o retorno de `despacho`. */
export function assinaturasCompativeis(
    this: CompiladorLLVM,
    despacho: llvm.Function,
    candidata: llvm.Function
): boolean {
    if (despacho.arg_size() !== candidata.arg_size()) return false;
    if (!this.tiposLlvmIguais(despacho.getReturnType(), candidata.getReturnType())) return false;
    for (let i = 0; i < despacho.arg_size(); i++) {
        if (!this.tiposLlvmIguais(despacho.getArg(i).getType(), candidata.getArg(i).getType())) return false;
    }
    return true;
}

/** Implementação de `metodo` que uma instância de `nomeClasse` executa (sobe a herança). */
export function resolverImplementacaoMetodo(
    this: CompiladorLLVM,
    nomeClasse: string,
    metodo: string
): llvm.Function | null {
    let atual: string | undefined = nomeClasse;
    while (atual) {
        const funcao = this.modulo.getFunction(`${atual}_${metodo}`);
        if (funcao) return funcao;
        atual = this.superClasses.get(atual);
    }
    return null;
}

/** `nomeClasse` é `ancestral` ou descende dele. */
export function classeDescendeDe(this: CompiladorLLVM, nomeClasse: string, ancestral: string): boolean {
    let atual: string | undefined = nomeClasse;
    while (atual) {
        if (atual === ancestral) return true;
        atual = this.superClasses.get(atual);
    }
    return false;
}

/** `nomeClasse`, ou uma de suas superclasses, declara implementar `nomeInterface`. */
export function classeImplementaInterface(this: CompiladorLLVM, nomeClasse: string, nomeInterface: string): boolean {
    let atual: string | undefined = nomeClasse;
    while (atual) {
        if (this.interfacesDaClasse.get(atual)?.includes(nomeInterface)) return true;
        atual = this.superClasses.get(atual);
    }
    return false;
}

/**
 * Função de despacho para `metodo` chamado por meio de uma variável do tipo `nomeClasse`:
 * mesma assinatura da implementação estática; o corpo, criado em preencherDespachos(),
 * escolhe a sobrescrita pelo `__tipoId` do objeto.
 */
export function obterDespachoVirtual(
    this: CompiladorLLVM,
    nomeClasse: string,
    metodo: string,
    padrao: llvm.Function
): llvm.Function {
    const chave = `${nomeClasse}.${metodo}`;
    const existente = this.despachos.get(chave);
    if (existente) return existente.funcao;
    const funcao = llvm.Function.Create(
        this.tipoFuncaoDe(padrao),
        llvm.Function.LinkageTypes.InternalLinkage,
        `__despacho_${nomeClasse}_${metodo}`,
        this.modulo
    );
    // Function.Create não passa pelos ganchos do ARC: sem o nome, o retorno (+1) da
    // implementação seria tratado como emprestado e nunca liberado por quem chama.
    this.nomesFuncoesArc.set(funcao, `__despacho_${nomeClasse}_${metodo}`);
    this.despachos.set(chave, { funcao, tipo: nomeClasse, metodo, padrao });
    return funcao;
}

/** Função de despacho para `metodo` chamado por meio de uma variável do tipo de uma interface. */
export function obterDespachoInterface(
    this: CompiladorLLVM,
    nomeInterface: string,
    metodo: string
): llvm.Function | null {
    const chave = `${nomeInterface}.${metodo}`;
    const existente = this.despachos.get(chave);
    if (existente) return existente.funcao;
    const assinatura = this.interfacesDeclaradas.get(nomeInterface).metodos?.find((m) => m.nome.lexema === metodo);
    if (!assinatura) return null;
    const tiposParametros: llvm.Type[] = [this.montador.getPtrTy()];
    for (const parametro of assinatura.parametros ?? []) {
        tiposParametros.push(
            tipoEhVetor(parametro.tipoDado) ? this.montador.getPtrTy() : this.obterTipoLlvm(parametro.tipoDado)
        );
    }
    const tipoRetornoStr = assinatura.tipoRetorno ?? 'vazio';
    const tipoRetorno =
        tipoRetornoStr === 'vazio' ? llvm.Type.getVoidTy(this.contexto) : this.obterTipoLlvm(tipoRetornoStr);
    const funcao = llvm.Function.Create(
        llvm.FunctionType.get(tipoRetorno, tiposParametros, false),
        llvm.Function.LinkageTypes.InternalLinkage,
        `__despacho_${nomeInterface}_${metodo}`,
        this.modulo
    );
    // Ver obterDespachoVirtual: registra o nome para o ARC reconhecer o retorno +1.
    this.nomesFuncoesArc.set(funcao, `__despacho_${nomeInterface}_${metodo}`);
    this.despachos.set(chave, { funcao, tipo: nomeInterface, metodo });
    return funcao;
}

/**
 * Gera o corpo das funções de despacho: lê o `__tipoId` (campo 0 de todo objeto) e
 * chama a implementação da classe concreta. Classes cuja implementação tem assinatura
 * diferente ficam com a implementação padrão.
 */
export function preencherDespachos(this: CompiladorLLVM): void {
    for (const despacho of this.despachos.values()) {
        const ehInterface = !despacho.padrao;
        const casos: Array<[number, llvm.Function]> = [];
        for (const [nomeCandidata, idCandidata] of this.idClasse) {
            const pertence = ehInterface
                ? this.classeImplementaInterface(nomeCandidata, despacho.tipo)
                : nomeCandidata !== despacho.tipo && this.classeDescendeDe(nomeCandidata, despacho.tipo);
            if (!pertence) continue;
            const implementacao = this.resolverImplementacaoMetodo(nomeCandidata, despacho.metodo);
            if (!implementacao || implementacao === despacho.padrao) continue;
            if (!this.assinaturasCompativeis(despacho.funcao, implementacao)) continue;
            casos.push([idCandidata, implementacao]);
        }

        this.montador.SetCurrentDebugLocation(new llvm.DebugLoc());
        const funcao = despacho.funcao;
        const argumentos: llvm.Value[] = [];
        for (let i = 0; i < funcao.arg_size(); i++) argumentos.push(funcao.getArg(i));
        const retornaVazio = funcao.getReturnType().isVoidTy();
        const emitirChamada = (alvo: llvm.Function) => {
            const resultado = this.montador.CreateCall(alvo, argumentos);
            if (retornaVazio) this.montador.CreateRetVoid();
            else this.montador.CreateRet(resultado);
        };

        const blocoEntrada = llvm.BasicBlock.Create(this.contexto, 'entrada', funcao);
        const blocoPadrao = llvm.BasicBlock.Create(this.contexto, 'padrao', funcao);
        this.montador.SetInsertPoint(blocoEntrada);
        const idTipo = this.montador.CreateLoad(this.montador.getInt32Ty(), funcao.getArg(0), 'tipo_id');
        const escolha = this.montador.CreateSwitch(idTipo, blocoPadrao, casos.length);
        for (const [idCaso, implementacao] of casos) {
            const blocoCaso = llvm.BasicBlock.Create(this.contexto, `caso_${idCaso}`, funcao);
            escolha.addCase(ConstantInt.get(this.contexto, new APInt(32, idCaso)), blocoCaso);
            this.montador.SetInsertPoint(blocoCaso);
            emitirChamada(implementacao);
        }

        this.montador.SetInsertPoint(blocoPadrao);
        if (despacho.padrao) {
            emitirChamada(despacho.padrao);
        } else {
            // Nenhuma classe conhecida implementa o método para este objeto.
            const mensagem = this.montador.CreateGlobalStringPtr(
                `Método '${despacho.metodo}' da interface '${despacho.tipo}' não implementado pelo objeto.`,
                'msg_despacho',
                0,
                this.modulo
            );
            const falhar = this.obterFuncaoRuntime('falhar', llvm.Type.getVoidTy(this.contexto), [
                this.montador.getPtrTy(),
            ]);
            this.montador.CreateCall(falhar, [mensagem]);
            this.montador.CreateUnreachable();
        }
    }
}
