import llvm from '@designliquido/llvm-bindings';
import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';

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
    ]);

    this.mapaModulos.set('json', funcoes);
}
