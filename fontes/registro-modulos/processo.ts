import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';
import { criarRegistradorFuncaoModulo } from './registrador';

/**
 * Módulo `processo`: informações e controle do processo atual e execução de programas.
 *
 *   var processo = importar("processo")
 *   processo.sair(1)
 *   processo.escreverErro("falhou")
 *   processo.sistemaOperacional()           // "windows" | "darwin" | "linux" | ...
 *   processo.arquitetura()                  // "amd64" | "arm64" | ...
 *   processo.variavelAmbiente("HOME")       // texto ou nulo
 *   processo.definirVariavelAmbiente("X", "1")
 *   processo.executar("git", ["status"], "./repo")             // código de saída
 *   processo.executarCapturando("git", ["rev-parse", "HEAD"])  // stdout
 *   processo.ultimoCodigoSaida()
 */
export function registrarModuloProcesso(this: CompiladorLLVM): void {
    const reg = criarRegistradorFuncaoModulo(this);

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['sair', reg('delegua_processo_sair', ['inteiro'], 'vazio')],
        ['escreverErro', reg('delegua_processo_escrever_erro', ['texto'], 'vazio')],
        ['sistemaOperacional', reg('delegua_processo_sistema_operacional', [], 'texto')],
        ['arquitetura', reg('delegua_processo_arquitetura', [], 'texto')],
        ['variavelAmbiente', reg('delegua_processo_variavel_ambiente', ['texto'], 'texto')],
        [
            'definirVariavelAmbiente',
            reg('delegua_processo_definir_variavel_ambiente', ['texto', 'texto'], 'lógico'),
        ],
        ['executar', reg('delegua_processo_executar', ['texto', 'texto[]', 'texto'], 'inteiro')],
        [
            'executarCapturando',
            reg('delegua_processo_executar_capturando', ['texto', 'texto[]', 'texto'], 'texto'),
        ],
        ['ultimoCodigoSaida', reg('delegua_processo_ultimo_codigo_saida', [], 'inteiro')],
    ]);

    this.mapaModulos.set('processo', funcoes);
}
