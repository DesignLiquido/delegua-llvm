import llvm from '@designliquido/llvm-bindings';
import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';

export function registrarModuloHttp(this: CompiladorLLVM): void {
    const ptr = this.montador.getPtrTy();
    const i32 = this.montador.getInt32Ty();
    const vazio = llvm.Type.getVoidTy(this.contexto);

    const reg = (nomeCFunc: string, tiposParametros: string[], tipoRetorno: string): EntradaFuncaoModulo => {
        const tiposLlvm = tiposParametros.map((t) => (t === 'inteiro' ? i32 : ptr));
        const tipoRetLlvm = tipoRetorno === 'inteiro' ? i32 : tipoRetorno === 'vazio' ? vazio : ptr;
        const tipo = llvm.FunctionType.get(tipoRetLlvm, tiposLlvm, false);
        const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
        return { callee, tiposParametros, tipoRetorno };
    };

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['novoClienteHttp', reg('delegua_http_novo_cliente', ['texto', 'inteiro'], 'texto')],
        ['adicionarCabecalho', reg('delegua_http_add_cabecalho', ['texto', 'texto'], 'vazio')],
        ['requisicaoGet', reg('delegua_http_get', ['texto', 'texto'], 'texto')],
        ['requisicaoPost', reg('delegua_http_post', ['texto', 'texto', 'texto'], 'texto')],
        ['requisicaoPut', reg('delegua_http_put', ['texto', 'texto', 'texto'], 'texto')],
        ['requisicaoDelete', reg('delegua_http_delete', ['texto', 'texto'], 'texto')],
        ['requisicaoPatch', reg('delegua_http_patch', ['texto', 'texto', 'texto'], 'texto')],
        ['codigoStatus', reg('delegua_http_codigo_status', ['texto'], 'inteiro')],
        ['dados', reg('delegua_http_dados', ['texto'], 'texto')],
        ['mensagemStatus', reg('delegua_http_mensagem', ['texto'], 'texto')],
        ['liberarResposta', reg('delegua_http_liberar_resp', ['texto'], 'vazio')],
        ['liberarCliente', reg('delegua_http_liberar_cliente', ['texto'], 'vazio')],
    ]);

    this.mapaModulos.set('http', funcoes);
}
