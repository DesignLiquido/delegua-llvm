import llvm from '@designliquido/llvm-bindings';
import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';

export function registrarModuloCsv(this: CompiladorLLVM): void {
    const ptr = this.montador.getPtrTy();
    const i8 = llvm.Type.getInt8Ty(this.contexto);
    const i32 = this.montador.getInt32Ty();
    const vazio = llvm.Type.getVoidTy(this.contexto);

    const reg = (nomeCFunc: string, tiposParametros: string[], tipoRetorno: string): EntradaFuncaoModulo => {
        const tiposLlvm = tiposParametros.map((t) => (t === 'inteiro' ? i32 : t === 'char' ? i8 : ptr));
        const tipoRetLlvm = tipoRetorno === 'inteiro' ? i32 : tipoRetorno === 'vazio' ? vazio : ptr;
        const tipo = llvm.FunctionType.get(tipoRetLlvm, tiposLlvm, false);
        const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
        return { callee, tiposParametros, tipoRetorno };
    };

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['textoParaObjetoCsv', reg('delegua_csv_texto_para_tabela', ['texto', 'inteiro'], 'texto')],
        ['objetoCsvParaTexto', reg('delegua_csv_tabela_para_texto', ['texto', 'inteiro'], 'texto')],
        ['lerCsv', reg('delegua_csv_ler', ['texto', 'inteiro'], 'texto')],
        ['escreverCsv', reg('delegua_csv_escrever', ['texto', 'texto', 'inteiro'], 'vazio')],
        ['totalLinhas', reg('delegua_csv_total_linhas', ['texto'], 'inteiro')],
        ['totalColunas', reg('delegua_csv_total_colunas', ['texto'], 'inteiro')],
        ['obterCelula', reg('delegua_csv_obter_celula', ['texto', 'inteiro', 'inteiro'], 'texto')],
        ['liberar', reg('delegua_csv_liberar', ['texto'], 'vazio')],
    ]);

    this.mapaModulos.set('csv', funcoes);
}
