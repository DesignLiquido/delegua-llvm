import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';
import { criarRegistradorFuncaoModulo } from './registrador';

/**
 * Módulo `rede`: soquetes TCP com tempo limite (em milissegundos; negativo = sem limite).
 * Soquetes são handles `opaco:soquete` gerenciados pelo ARC (o destrutor fecha o descritor);
 * `nulo` indica falha (detalhe em ultimoErro()). rede.fechar() fecha antes, se preciso.
 *
 *   var rede = importar("rede")
 *   var servidor = rede.escutar("127.0.0.1", 0)
 *   var porta = rede.portaLocal(servidor)
 *   var conexao = rede.aceitar(servidor, 120000)
 *   var requisicao = rede.lerAte(conexao, "\r\n\r\n", 65536, 5000)
 *   rede.escrever(conexao, "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
 *   rede.fechar(conexao)
 */
export function registrarModuloRede(this: CompiladorLLVM): void {
    const reg = criarRegistradorFuncaoModulo(this);

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['escutar', reg('delegua_rede_escutar', ['texto', 'inteiro'], 'opaco:soquete')],
        ['portaLocal', reg('delegua_rede_porta_local', ['opaco:soquete'], 'inteiro')],
        ['aceitar', reg('delegua_rede_aceitar', ['opaco:soquete', 'inteiro'], 'opaco:soquete')],
        ['conectar', reg('delegua_rede_conectar', ['texto', 'inteiro', 'inteiro'], 'opaco:soquete')],
        ['ler', reg('delegua_rede_ler', ['opaco:soquete', 'inteiro', 'inteiro'], 'texto')],
        ['lerAte', reg('delegua_rede_ler_ate', ['opaco:soquete', 'texto', 'inteiro', 'inteiro'], 'texto')],
        ['escrever', reg('delegua_rede_escrever', ['opaco:soquete', 'texto'], 'lógico')],
        ['fechar', reg('delegua_rede_fechar', ['opaco:soquete'], 'vazio')],
        ['ultimoErro', reg('delegua_rede_ultimo_erro', [], 'texto')],
        ['codificarComponenteUrl', reg('delegua_rede_codificar_componente_url', ['texto'], 'texto')],
        ['decodificarComponenteUrl', reg('delegua_rede_decodificar_componente_url', ['texto'], 'texto')],
    ]);

    this.mapaModulos.set('rede', funcoes);
}
