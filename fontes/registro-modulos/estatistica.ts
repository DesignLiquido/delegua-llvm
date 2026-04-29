import llvm from '@designliquido/llvm-bindings';
import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';

export function registrarModuloEstatistica(this: CompiladorLLVM): void {
    const d = this.montador.getDoubleTy();
    const ptr = this.montador.getPtrTy();

    const reg1 = (nomeCFunc: string): EntradaFuncaoModulo => {
        const tipo = llvm.FunctionType.get(d, [ptr], false);
        const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
        return { callee, tiposParametros: ['vetor'], tipoRetorno: 'numero' };
    };
    const reg2 = (nomeCFunc: string): EntradaFuncaoModulo => {
        const tipo = llvm.FunctionType.get(d, [ptr, ptr], false);
        const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
        return { callee, tiposParametros: ['vetor', 'vetor'], tipoRetorno: 'numero' };
    };

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['max', reg1('delegua_est_max')],
        ['min', reg1('delegua_est_min')],
        ['media', reg1('delegua_est_media')],
        ['mediana', reg1('delegua_est_mediana')],
        ['ve', reg1('delegua_est_variancia')],
        ['covariancia', reg2('delegua_est_covariancia')],
    ]);

    this.mapaModulos.set('estatistica', funcoes);
}
