import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';
import { criarRegistradorFuncaoModulo } from './registrador';

/**
 * Módulo `tempo` (subconjunto do delegua-tempo do Node.js, mais funções para medir
 * intervalos):
 *
 *   var tempo = importar("tempo")
 *   tempo.carimboDeTempoUnix()                // segundos desde 1970 (longo)
 *   tempo.carimboDeTempoUnixMilissegundos()   // milissegundos desde 1970 (longo)
 *   tempo.monotonicoMilissegundos()           // relógio monotônico, para tempos limite (longo)
 *   tempo.dormir(250)
 */
export function registrarModuloTempo(this: CompiladorLLVM): void {
    const reg = criarRegistradorFuncaoModulo(this);

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['carimboDeTempoUnix', reg('delegua_tempo_carimbo_unix', [], 'longo')],
        ['carimboDeTempoUnixMilissegundos', reg('delegua_tempo_carimbo_unix_milissegundos', [], 'longo')],
        ['monotonicoMilissegundos', reg('delegua_tempo_monotonico_milissegundos', [], 'longo')],
        ['dormir', reg('delegua_tempo_dormir', ['inteiro'], 'vazio')],
    ]);

    this.mapaModulos.set('tempo', funcoes);
}
