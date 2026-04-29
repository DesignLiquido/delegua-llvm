import llvm from '@designliquido/llvm-bindings';
import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';

export function registrarModuloDados(this: CompiladorLLVM): void {
    const ptr = this.montador.getPtrTy();
    const i32 = this.montador.getInt32Ty();
    const d = this.montador.getDoubleTy();

    const reg = (nomeCFunc: string, tiposParametros: string[]): EntradaFuncaoModulo => {
        const tiposLlvm = tiposParametros.map((t) => (t === 'inteiro' ? i32 : ptr));
        const tipo = llvm.FunctionType.get(ptr, tiposLlvm, false);
        const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
        return { callee, tiposParametros, tipoRetorno: 'texto' };
    };
    const regInt = (nomeCFunc: string, tiposParametros: string[]): EntradaFuncaoModulo => {
        const tiposLlvm = tiposParametros.map((t) => (t === 'inteiro' ? i32 : ptr));
        const tipo = llvm.FunctionType.get(i32, tiposLlvm, false);
        const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
        return { callee, tiposParametros, tipoRetorno: 'inteiro' };
    };
    const regDouble = (nomeCFunc: string, tiposParametros: string[]): EntradaFuncaoModulo => {
        const tiposLlvm = tiposParametros.map((t) => (t === 'inteiro' ? i32 : t === 'numero' ? d : ptr));
        const tipo = llvm.FunctionType.get(d, tiposLlvm, false);
        const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
        return { callee, tiposParametros, tipoRetorno: 'numero' };
    };

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['lerCSV', reg('delegua_dados_ler_csv', ['texto'])],
        ['cabeca', reg('delegua_dados_cabeca', ['texto', 'inteiro'])],
        ['cauda', reg('delegua_dados_cauda', ['texto', 'inteiro'])],
        ['info', reg('delegua_dados_info', ['texto'])],
        ['paraTexto', reg('delegua_dados_para_texto', ['texto'])],
        ['removerNulo', reg('delegua_dados_remover_nulo', ['texto'])],
        ['selecionarColuna', reg('delegua_dados_selecionar_coluna', ['texto', 'texto'])],
        ['serieMax', regDouble('delegua_dados_serie_max', ['texto'])],
        ['serieMin', regDouble('delegua_dados_serie_min', ['texto'])],
        ['serieMedia', regDouble('delegua_dados_serie_media', ['texto'])],
        ['serieTamanho', regInt('delegua_dados_serie_tamanho', ['texto'])],
    ]);

    this.mapaModulos.set('dados', funcoes);
}
