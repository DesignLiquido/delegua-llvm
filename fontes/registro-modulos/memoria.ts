import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';
import { criarRegistradorFuncaoModulo } from './registrador';

/**
 * Módulo `memoria`: memória bruta para FFI (parâmetros de saída, buffers, campos C).
 * Deslocamentos em bytes.
 *
 *   var memoria = importar("memoria")
 *   var saida = memoria.alocar(memoria.tamanhoPonteiro())   // void** para T** saida
 *   Git.abrirRepositorio(saida, ".")
 *   var repositorio = memoria.lerPonteiro(saida, 0)
 *   memoria.liberar(saida)
 */
export function registrarModuloMemoria(this: CompiladorLLVM): void {
    const reg = criarRegistradorFuncaoModulo(this);

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['alocar', reg('delegua_memoria_alocar', ['inteiro'], 'ponteiro')],
        ['liberar', reg('delegua_memoria_liberar', ['ponteiro'], 'vazio')],
        ['tamanhoPonteiro', reg('delegua_memoria_tamanho_ponteiro', [], 'inteiro')],
        ['deslocar', reg('delegua_memoria_deslocar', ['ponteiro', 'longo'], 'ponteiro')],
        ['copiar', reg('delegua_memoria_copiar', ['ponteiro', 'ponteiro', 'longo'], 'vazio')],

        ['lerPonteiro', reg('delegua_memoria_ler_ponteiro', ['ponteiro', 'longo'], 'ponteiro')],
        ['lerInteiro', reg('delegua_memoria_ler_inteiro', ['ponteiro', 'longo'], 'inteiro')],
        ['lerLongo', reg('delegua_memoria_ler_longo', ['ponteiro', 'longo'], 'longo')],
        ['lerNumero', reg('delegua_memoria_ler_numero', ['ponteiro', 'longo'], 'número')],
        ['lerByte', reg('delegua_memoria_ler_byte', ['ponteiro', 'longo'], 'inteiro')],
        ['lerTexto', reg('delegua_memoria_ler_texto', ['ponteiro', 'longo'], 'texto')],

        ['escreverPonteiro', reg('delegua_memoria_escrever_ponteiro', ['ponteiro', 'longo', 'ponteiro'], 'vazio')],
        ['escreverInteiro', reg('delegua_memoria_escrever_inteiro', ['ponteiro', 'longo', 'inteiro'], 'vazio')],
        ['escreverLongo', reg('delegua_memoria_escrever_longo', ['ponteiro', 'longo', 'longo'], 'vazio')],
        ['escreverNumero', reg('delegua_memoria_escrever_numero', ['ponteiro', 'longo', 'número'], 'vazio')],
        ['escreverByte', reg('delegua_memoria_escrever_byte', ['ponteiro', 'longo', 'inteiro'], 'vazio')],

        ['textoDe', reg('delegua_memoria_texto_de', ['ponteiro'], 'texto')],
        ['textoDeTamanho', reg('delegua_memoria_texto_de_tamanho', ['ponteiro', 'longo'], 'texto')],
    ]);

    this.mapaModulos.set('memoria', funcoes);
}
