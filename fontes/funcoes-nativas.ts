import { Dicionario, Vetor } from '@designliquido/delegua';
import llvm from '@designliquido/llvm-bindings';
import type { CompiladorLLVM } from './compilador-llvm';

/**
 * Declarações das funções do runtime C (`bibliotecas/*.c`) usadas pelo código gerado.
 * Implementado como mixin de CompiladorLLVM.
 */

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
export function criarFuncaoNativa(this: CompiladorLLVM, modulosImportados?: Set<string>): void {
    // %Vetor = type { ptr, i32, i32, i32, i32 }
    // (elementos + tamanho + capacidade + tam_elem + gerenciado); ver bibliotecas/vetor.h.
    this.tipoEstruturaVetor = llvm.StructType.create(this.contexto, 'Vetor');
    this.tipoEstruturaVetor.setBody([
        llvm.PointerType.get(this.contexto, 0),
        this.montador.getInt32Ty(),
        this.montador.getInt32Ty(),
        this.montador.getInt32Ty(),
        this.montador.getInt32Ty(),
    ]);

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

    // long long longo(void *valor)
    const tipoFuncaoLongo = llvm.FunctionType.get(
        llvm.Type.getInt64Ty(this.contexto),
        [this.montador.getPtrTy()],
        false
    );

    this.funcaoLongo = this.modulo.getOrInsertFunction('longo', tipoFuncaoLongo);

    // double numero(void *valor)
    const tipoFuncaoNumero = llvm.FunctionType.get(this.montador.getDoubleTy(), [this.montador.getPtrTy()], false);

    this.funcaoNumero = this.modulo.getOrInsertFunction('numero', tipoFuncaoNumero);

    // void falhar(const char *msg)

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
    this.funcaoTextoSubstituir = this.modulo.getOrInsertFunction('delegua_texto_substituir', tipoFuncaoTextoSubstituir);

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

    // Vetor* delegua_vetor_criar(int tamanho_inicial, int tam_elem, int gerenciado)
    const tipoFuncaoVetorCriar = llvm.FunctionType.get(
        this.montador.getPtrTy(),
        [this.montador.getInt32Ty(), this.montador.getInt32Ty(), this.montador.getInt32Ty()],
        false
    );
    this.funcaoVetorCriar = this.modulo.getOrInsertFunction('delegua_vetor_criar', tipoFuncaoVetorCriar);

    // int delegua_vetor_adicionar(Vetor* v, void* elem, int tam_elem)
    const tipoFuncaoVetorAdicionar = llvm.FunctionType.get(
        this.montador.getInt32Ty(),
        [this.montador.getPtrTy(), this.montador.getPtrTy(), this.montador.getInt32Ty()],
        false
    );
    this.funcaoVetorAdicionar = this.modulo.getOrInsertFunction('delegua_vetor_adicionar', tipoFuncaoVetorAdicionar);

    // void* delegua_vetor_definir_indice(Vetor* v, int indice, int tam_elem)
    const tipoFuncaoVetorDefinirIndice = llvm.FunctionType.get(
        this.montador.getPtrTy(),
        [this.montador.getPtrTy(), this.montador.getInt32Ty(), this.montador.getInt32Ty()],
        false
    );
    this.funcaoVetorDefinirIndice = this.modulo.getOrInsertFunction(
        'delegua_vetor_definir_indice',
        tipoFuncaoVetorDefinirIndice
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
    const tipoFuncaoVetorTamanho = llvm.FunctionType.get(this.montador.getInt32Ty(), [this.montador.getPtrTy()], false);
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
    this.funcaoDicionarioCriar = this.modulo.getOrInsertFunction('delegua_dicionario_criar', tipoFuncaoDicionarioCriar);

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
    this.funcaoDicionarioObter = this.modulo.getOrInsertFunction('delegua_dicionario_obter', tipoFuncaoDicionarioObter);

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

    // Vetor* delegua_vetor_fatiar(Vetor* v, int inicio, int fim, int tam_elem)
    const tipoFuncaoVetorFatiar = llvm.FunctionType.get(
        this.montador.getPtrTy(),
        [
            this.montador.getPtrTy(),
            this.montador.getInt32Ty(),
            this.montador.getInt32Ty(),
            this.montador.getInt32Ty(),
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
    this.funcaoVetorJuntarTexto = this.modulo.getOrInsertFunction('delegua_vetor_juntar_texto', tipoFuncaoVetorJuntar);

    // Vetor* delegua_vetor_filtrar_inteiro(Vetor* v, ptr fn)
    // Vetor* delegua_vetor_filtrar_numero (Vetor* v, ptr fn)
    // Vetor* delegua_vetor_mapear_inteiro (Vetor* v, ptr fn)
    // Vetor* delegua_vetor_mapear_numero  (Vetor* v, ptr fn)
    // Vetor* delegua_vetor_mapear_texto   (Vetor* v, ptr fn)
    const tipoFuncaoVetorCallback = llvm.FunctionType.get(
        this.montador.getPtrTy(),
        [this.montador.getPtrTy(), this.montador.getPtrTy()],
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
        ['argumentos', () => this.registrarModuloArgumentos()],
        ['processo', () => this.registrarModuloProcesso()],
        ['memoria', () => this.registrarModuloMemoria()],
        ['rede', () => this.registrarModuloRede()],
        ['tempo', () => this.registrarModuloTempo()],
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
