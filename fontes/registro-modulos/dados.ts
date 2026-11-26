import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';
import { criarRegistradorFuncaoModulo } from './registrador';

export function registrarModuloDados(this: CompiladorLLVM): void {
    const reg = criarRegistradorFuncaoModulo(this);

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['lerCSV', reg('delegua_dados_ler_csv', ['texto'], 'opaco:dados_recorte')],
        ['cabeca', reg('delegua_dados_cabeca', ['opaco:dados_recorte', 'inteiro'], 'opaco:dados_recorte')],
        ['cauda', reg('delegua_dados_cauda', ['opaco:dados_recorte', 'inteiro'], 'opaco:dados_recorte')],
        ['info', reg('delegua_dados_info', ['opaco:dados_recorte'], 'texto')],
        ['paraTexto', reg('delegua_dados_para_texto', ['opaco:dados_recorte'], 'texto')],
        ['removerNulo', reg('delegua_dados_remover_nulo', ['opaco:dados_recorte'], 'opaco:dados_recorte')],
        ['selecionarColuna', reg('delegua_dados_selecionar_coluna', ['opaco:dados_recorte', 'texto'], 'opaco:dados_serie')],
        ['serieMax', reg('delegua_dados_serie_max', ['opaco:dados_serie'], 'numero')],
        ['serieMin', reg('delegua_dados_serie_min', ['opaco:dados_serie'], 'numero')],
        ['serieMedia', reg('delegua_dados_serie_media', ['opaco:dados_serie'], 'numero')],
        ['serieTamanho', reg('delegua_dados_serie_tamanho', ['opaco:dados_serie'], 'inteiro')],
        ['liberar', reg('delegua_dados_liberar', ['opaco:dados_recorte'], 'vazio')],
        ['liberarSerie', reg('delegua_dados_serie_liberar', ['opaco:dados_serie'], 'vazio')],
    ]);

    this.mapaModulos.set('dados', funcoes);
}
