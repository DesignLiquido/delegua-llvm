import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';
import { criarRegistradorFuncaoModulo } from './registrador';

export function registrarModuloHttp(this: CompiladorLLVM): void {
    const reg = criarRegistradorFuncaoModulo(this);

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['novoClienteHttp', reg('delegua_http_novo_cliente', ['texto', 'inteiro'], 'opaco:http_cliente')],
        ['adicionarCabecalho', reg('delegua_http_add_cabecalho', ['opaco:http_cliente', 'texto'], 'vazio')],
        ['requisicaoGet', reg('delegua_http_get', ['opaco:http_cliente', 'texto'], 'opaco:http_resposta')],
        ['requisicaoPost', reg('delegua_http_post', ['opaco:http_cliente', 'texto', 'texto'], 'opaco:http_resposta')],
        ['requisicaoPut', reg('delegua_http_put', ['opaco:http_cliente', 'texto', 'texto'], 'opaco:http_resposta')],
        ['requisicaoDelete', reg('delegua_http_delete', ['opaco:http_cliente', 'texto'], 'opaco:http_resposta')],
        ['requisicaoPatch', reg('delegua_http_patch', ['opaco:http_cliente', 'texto', 'texto'], 'opaco:http_resposta')],
        ['codigoStatus', reg('delegua_http_codigo_status', ['opaco:http_resposta'], 'inteiro')],
        ['dados', reg('delegua_http_dados', ['opaco:http_resposta'], 'texto')],
        ['mensagemStatus', reg('delegua_http_mensagem', ['opaco:http_resposta'], 'texto')],
        ['liberarResposta', reg('delegua_http_liberar_resp', ['opaco:http_resposta'], 'vazio')],
        ['liberarCliente', reg('delegua_http_liberar_cliente', ['opaco:http_cliente'], 'vazio')],
    ]);

    this.mapaModulos.set('http', funcoes);
}
