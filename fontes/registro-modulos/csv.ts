import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';
import { criarRegistradorFuncaoModulo } from './registrador';

export function registrarModuloCsv(this: CompiladorLLVM): void {
    const reg = criarRegistradorFuncaoModulo(this);

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['textoParaObjetoCsv', reg('delegua_csv_texto_para_tabela', ['texto', 'inteiro'], 'opaco:csv')],
        ['objetoCsvParaTexto', reg('delegua_csv_tabela_para_texto', ['opaco:csv', 'inteiro'], 'texto')],
        ['lerCsv', reg('delegua_csv_ler', ['texto', 'inteiro'], 'opaco:csv')],
        ['escreverCsv', reg('delegua_csv_escrever', ['texto', 'opaco:csv', 'inteiro'], 'vazio')],
        ['totalLinhas', reg('delegua_csv_total_linhas', ['opaco:csv'], 'inteiro')],
        ['totalColunas', reg('delegua_csv_total_colunas', ['opaco:csv'], 'inteiro')],
        ['obterCelula', reg('delegua_csv_obter_celula', ['opaco:csv', 'inteiro', 'inteiro'], 'texto')],
        ['liberar', reg('delegua_csv_liberar', ['opaco:csv'], 'vazio')],
    ]);

    this.mapaModulos.set('csv', funcoes);
}
