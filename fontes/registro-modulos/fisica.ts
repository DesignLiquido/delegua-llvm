import llvm from '@designliquido/llvm-bindings';
import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';

export function registrarModuloFisica(this: CompiladorLLVM): void {
    const d = this.montador.getDoubleTy();

    const reg = (nomeCFunc: string, tiposParametros: string[]): EntradaFuncaoModulo => {
        const tiposLlvm = tiposParametros.map(() => d);
        const tipo = llvm.FunctionType.get(d, tiposLlvm, false);
        const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
        return { callee, tiposParametros, tipoRetorno: 'numero' };
    };

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['velocidadeMedia', reg('delegua_fis_velocidade_media', ['numero', 'numero'])],
        ['deltaS',          reg('delegua_fis_delta_s',          ['numero', 'numero'])],
        ['deltaT',          reg('delegua_fis_delta_t',          ['numero', 'numero'])],
        ['aceleracao',      reg('delegua_fis_aceleracao',       ['numero', 'numero', 'numero', 'numero'])],
    ]);

    this.mapaModulos.set('fisica', funcoes);
}
