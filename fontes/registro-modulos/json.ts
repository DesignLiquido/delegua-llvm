import llvm from '@designliquido/llvm-bindings';
import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';
import { criarRegistradorFuncaoModulo } from './registrador';

export function registrarModuloJson(this: CompiladorLLVM): void {
    const ptr = this.montador.getPtrTy();
    const i32 = this.montador.getInt32Ty();
    const d = this.montador.getDoubleTy();
    const vazio = llvm.Type.getVoidTy(this.contexto);

    const reg = (nomeCFunc: string, tiposParametros: string[], tipoRetorno: string): EntradaFuncaoModulo => {
        const tiposLlvm = tiposParametros.map((t) => (t === 'inteiro' ? i32 : ptr));
        const tipoRetLlvm =
            tipoRetorno === 'inteiro' ? i32 : tipoRetorno === 'numero' ? d : tipoRetorno === 'vazio' ? vazio : ptr;
        const tipo = llvm.FunctionType.get(tipoRetLlvm, tiposLlvm, false);
        const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
        return { callee, tiposParametros, tipoRetorno };
    };
    const regModulo = criarRegistradorFuncaoModulo(this);

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['textoParaJson', reg('delegua_json_texto_para_objeto', ['texto'], 'texto')],
        ['objetoParaTextoJson', reg('delegua_json_objeto_para_texto', ['texto'], 'texto')],
        ['importarArquivoJson', reg('delegua_json_importar_arquivo', ['texto'], 'texto')],
        ['exportarObjetoParaArquivoJson', reg('delegua_json_exportar_arquivo', ['texto', 'texto'], 'vazio')],
        ['obterCampo', reg('delegua_json_obter_campo', ['texto', 'texto'], 'texto')],
        ['obterItem', reg('delegua_json_obter_item', ['texto', 'inteiro'], 'texto')],
        ['tamanho', reg('delegua_json_tamanho', ['texto'], 'inteiro')],
        ['valorTexto', reg('delegua_json_valor_texto', ['texto'], 'texto')],
        ['valorNumero', reg('delegua_json_valor_numero', ['texto'], 'numero')],
        ['liberar', reg('delegua_json_liberar', ['texto'], 'vazio')],

        // Inspeção.
        ['tipo', regModulo('delegua_json_tipo', ['texto'], 'texto')],
        ['valorLogico', regModulo('delegua_json_valor_logico', ['texto'], 'lógico')],
        ['contemCampo', regModulo('delegua_json_contem_campo', ['texto', 'texto'], 'lógico')],
        ['chaves', regModulo('delegua_json_chaves', ['texto'], 'texto[]')],
        [
            'objetoParaTextoJsonFormatado',
            regModulo('delegua_json_objeto_para_texto_formatado', ['texto'], 'texto'),
        ],

        // Construção (definirCampo e adicionarItem copiam o valor).
        ['criarObjeto', regModulo('delegua_json_criar_objeto', [], 'texto')],
        ['criarVetor', regModulo('delegua_json_criar_vetor', [], 'texto')],
        ['criarTexto', regModulo('delegua_json_criar_texto', ['texto'], 'texto')],
        ['criarNumero', regModulo('delegua_json_criar_numero', ['número'], 'texto')],
        ['criarLogico', regModulo('delegua_json_criar_logico', ['lógico'], 'texto')],
        ['criarNulo', regModulo('delegua_json_criar_nulo', [], 'texto')],
        ['definirCampo', regModulo('delegua_json_definir_campo', ['texto', 'texto', 'texto'], 'lógico')],
        ['removerCampo', regModulo('delegua_json_remover_campo', ['texto', 'texto'], 'lógico')],
        ['adicionarItem', regModulo('delegua_json_adicionar_item', ['texto', 'texto'], 'lógico')],
    ]);

    this.mapaModulos.set('json', funcoes);
}
