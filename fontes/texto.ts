import { Literal, Se } from '@designliquido/delegua';
import { ConstrutoInterface } from '@designliquido/delegua/interfaces';
import llvm, { APInt, ConstantInt } from '@designliquido/llvm-bindings';
import { tipoEhPonteiro } from './ajudantes';
import { ErroCompilador } from './erros/erro-compilador';
import { OperandoInterface } from './interfaces';
import { VariavelEscopo } from './variavel-escopo';
import type { CompiladorLLVM } from './compilador-llvm';

/**
 * Texto: métodos embutidos (`maiusculo`, `dividir`...), a função `texto()`, interpolação
 * (`"${nome}"`), formatos de `leia` e ponteiros de texto nunca nulos. Implementado como mixin
 * de CompiladorLLVM.
 */

export function obterLiteralTextoSeguro(this: CompiladorLLVM, valor: string, sufixoNome: string): llvm.Value {
    return this.montador.CreateGlobalStringPtr(valor, `${sufixoNome}_${++this._contadorNomesAnonimos}`, 0, this.modulo);
}

export function garantirPonteiroTextoNaoNulo(
    this: CompiladorLLVM,
    textoPtr: llvm.Value,
    sufixoNome: string
): llvm.Value {
    const nuloPtr = llvm.Constant.getNullValue(this.montador.getPtrTy()) as unknown as llvm.Value;
    const vazio = this.obterLiteralTextoSeguro('', `texto_vazio_${sufixoNome}`);
    const ehNulo = this.montador.CreateICmpEQ(textoPtr, nuloPtr, `texto_nulo_${sufixoNome}`);
    return this.montador.CreateSelect(ehNulo, vazio, textoPtr, `texto_seguro_${sufixoNome}`);
}

export function normalizarOperandoParaTextoSeguro(
    this: CompiladorLLVM,
    operando: OperandoInterface,
    sufixoNome: string
): llvm.Value {
    if (operando.tipo === 'nulo') {
        return this.obterLiteralTextoSeguro('', `texto_nulo_${sufixoNome}`);
    }

    if (!tipoEhPonteiro(operando.valor?.getType?.())) {
        return this.obterLiteralTextoSeguro('<nao-texto>', `texto_nao_texto_${sufixoNome}`);
    }

    if (operando.tipo === 'texto' || operando.tipo === 'qualquer') {
        return this.garantirPonteiroTextoNaoNulo(operando.valor, sufixoNome);
    }

    // Ponteiro não textual (objeto, vetor etc.): evita uso como C-string e crash de %s/strcmp.
    return this.obterLiteralTextoSeguro(`<${operando.tipo || 'ponteiro'}>`, `texto_tipo_${sufixoNome}`);
}

export async function chamarMetodoTexto(
    this: CompiladorLLVM,
    nomeMetodo: string,
    objetoPtr: llvm.Value,
    argumentos: ConstrutoInterface[],
    linha?: number
): Promise<llvm.Value> {
    // Carrega o char* real a partir do ponteiro da variável
    const strPtr = this.montador.CreateLoad(this.montador.getPtrTy(), objetoPtr, 'load_texto');
    const ptr = this.montador.getPtrTy();
    const i32 = this.montador.getInt32Ty();

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

        case 'aparar':
        case 'apararInicio':
        case 'apararInício':
        case 'apararFim':
        case 'inverter': {
            const nomesC: { [metodo: string]: string } = {
                aparar: 'delegua_texto_aparar',
                apararInicio: 'delegua_texto_aparar_inicio',
                apararInício: 'delegua_texto_aparar_inicio',
                apararFim: 'delegua_texto_aparar_fim',
                inverter: 'delegua_texto_inverter',
            };
            const funcao = this.obterFuncaoRuntime(nomesC[nomeMetodo], ptr, [ptr]);
            return this.montador.CreateCall(funcao, [strPtr]);
        }

        case 'concatenar': {
            const outro = await this.carregarArgumentoTexto(argumentos[0]);
            const funcao = this.obterFuncaoRuntime('delegua_texto_concatenar', ptr, [ptr, ptr]);
            return this.montador.CreateCall(funcao, [strPtr, outro]);
        }

        case 'dividir': {
            // dividir(delimitador = "", limite = 0) → texto[]
            const delimitador = argumentos[0]
                ? await this.carregarArgumentoTexto(argumentos[0])
                : this.montador.CreateGlobalStringPtr('', 'str_vazio', 0, this.modulo);
            const limite = argumentos[1]
                ? await this.carregarArgumentoInteiro(argumentos[1])
                : ConstantInt.get(this.contexto, new APInt(32, 0));
            const funcao = this.obterFuncaoRuntime('delegua_texto_dividir', ptr, [ptr, ptr, i32]);
            return this.montador.CreateCall(funcao, [strPtr, delimitador, limite], 'texto_dividido');
        }

        case 'encontrar': {
            // encontrar(subtexto, inicio = 0) → inteiro (-1 se não encontrar)
            const sub = await this.carregarArgumentoTexto(argumentos[0]);
            const inicio = argumentos[1]
                ? await this.carregarArgumentoInteiro(argumentos[1])
                : ConstantInt.get(this.contexto, new APInt(32, 0));
            const funcao = this.obterFuncaoRuntime('delegua_texto_encontrar', i32, [ptr, ptr, i32]);
            return this.montador.CreateCall(funcao, [strPtr, sub, inicio]);
        }

        case 'encontrarUltimo':
        case 'encontrarÚltimo': {
            const sub = await this.carregarArgumentoTexto(argumentos[0]);
            const funcao = this.obterFuncaoRuntime('delegua_texto_encontrar_ultimo', i32, [ptr, ptr]);
            return this.montador.CreateCall(funcao, [strPtr, sub]);
        }

        case 'comecaCom':
        case 'começaCom':
        case 'terminaCom': {
            const nomeC = nomeMetodo === 'terminaCom' ? 'delegua_texto_termina_com' : 'delegua_texto_comeca_com';
            const afixo = await this.carregarArgumentoTexto(argumentos[0]);
            const funcao = this.obterFuncaoRuntime(nomeC, i32, [ptr, ptr]);
            const resultado = this.montador.CreateCall(funcao, [strPtr, afixo]);
            return this.inteiroParaLogico(resultado, nomeMetodo);
        }

        default: {
            const erroTexto = new ErroCompilador(`Método de texto '${nomeMetodo}' não implementado.`);
            erroTexto.linha = linha;
            erroTexto.tamanhoToken = nomeMetodo.length;
            throw erroTexto;
        }
    }
}

export async function chamarFuncaoTexto(this: CompiladorLLVM, argumentos: ConstrutoInterface[]): Promise<llvm.Value> {
    const argumento = argumentos[0];
    const resolvido = await argumento.aceitar(this);

    let valor: llvm.Value;
    let tipo: string;

    if (resolvido instanceof VariavelEscopo && this.herdaDeExcecao(resolvido.tipo)) {
        return this.mensagemDeExcecao(this.carregarPtrClasseSePreciso(resolvido), resolvido.tipo);
    }
    if (resolvido instanceof VariavelEscopo) {
        tipo = resolvido.tipo ?? argumento.tipo ?? 'número';
        // Parâmetros escalares (inteiro/número/lógico) chegam por valor (Argument não é
        // ponteiro) — só carrega se variavelLlvm realmente for um ponteiro (alloca local
        // ou parâmetro texto/qualquer/dicionário de dupla indireção).
        valor = tipoEhPonteiro(resolvido.variavelLlvm.getType())
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

    // O tipo LLVM do valor decide a conversão quando ele contradiz o tipo inferido (ex.:
    // retorno de método ou campo de estrutura cujo tipo o avaliador não conhece, que
    // chega aqui como 'número' por padrão).
    const tipoLlvmValor = valor.getType();
    if (tipoLlvmValor.isIntegerTy(64)) {
        const funcao = this.obterFuncaoRuntime('texto_de_longo', this.montador.getPtrTy(), [
            llvm.Type.getInt64Ty(this.contexto),
        ]);
        return this.montador.CreateCall(funcao, [valor]);
    }
    if (tipoLlvmValor.isIntegerTy(1)) {
        const verdadeiro = this.montador.CreateGlobalStringPtr('verdadeiro', 'texto_verdadeiro', 0, this.modulo);
        const falso = this.montador.CreateGlobalStringPtr('falso', 'texto_falso', 0, this.modulo);
        return this.montador.CreateSelect(valor, verdadeiro, falso, 'texto_logico');
    }
    if (tipoLlvmValor.isIntegerTy(8)) {
        valor = this.montador.CreateZExt(valor, this.montador.getInt32Ty(), 'byte_para_int');
        return this.montador.CreateCall(this.funcaoTextoDeInteiro, [valor]);
    }
    if (tipoLlvmValor.isIntegerTy(32)) {
        return this.montador.CreateCall(this.funcaoTextoDeInteiro, [valor]);
    }
    if (tipoEhPonteiro(tipoLlvmValor)) {
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

export function parsearTemplateString(this: CompiladorLLVM, modelo: string): Array<string | { nomeVar: string }> {
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

export async function resolverTextoInterpolado(this: CompiladorLLVM, modelo: string): Promise<llvm.Value> {
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

export function buscarFormatoLeia(this: CompiladorLLVM, tipoDelegua: string): llvm.Constant {
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
