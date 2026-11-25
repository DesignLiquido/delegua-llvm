import llvm from '@designliquido/llvm-bindings';
import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';
import { criarRegistradorFuncaoModulo } from './registrador';

export function registrarModuloJson(this: CompiladorLLVM): void {
    const regModulo = criarRegistradorFuncaoModulo(this);
    const d = this.montador.getDoubleTy();
    const ptr = this.montador.getPtrTy();

    // valorNumero retorna 'numero' (double); criarRegistradorFuncaoModulo já aceita 'numero'/'número'.
    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['textoParaJson', regModulo('delegua_json_texto_para_objeto', ['texto'], 'opaco:json')],
        ['objetoParaTextoJson', regModulo('delegua_json_objeto_para_texto', ['opaco:json'], 'texto')],
        ['importarArquivoJson', regModulo('delegua_json_importar_arquivo', ['texto'], 'opaco:json')],
        ['exportarObjetoParaArquivoJson', regModulo('delegua_json_exportar_arquivo', ['opaco:json', 'texto'], 'vazio')],
        ['obterCampo', regModulo('delegua_json_obter_campo', ['opaco:json', 'texto'], 'opaco:json')],
        ['obterItem', regModulo('delegua_json_obter_item', ['opaco:json', 'inteiro'], 'opaco:json')],
        ['tamanho', regModulo('delegua_json_tamanho', ['opaco:json'], 'inteiro')],
        ['valorTexto', regModulo('delegua_json_valor_texto', ['opaco:json'], 'texto')],
        [
            'valorNumero',
            {
                callee: this.modulo.getOrInsertFunction(
                    'delegua_json_valor_numero',
                    llvm.FunctionType.get(d, [ptr], false)
                ),
                tiposParametros: ['opaco:json'],
                tipoRetorno: 'numero',
            },
        ],
        ['liberar', regModulo('delegua_json_liberar', ['opaco:json'], 'vazio')],

        // Inspeção.
        ['tipo', regModulo('delegua_json_tipo', ['opaco:json'], 'texto')],
        ['valorLogico', regModulo('delegua_json_valor_logico', ['opaco:json'], 'lógico')],
        ['contemCampo', regModulo('delegua_json_contem_campo', ['opaco:json', 'texto'], 'lógico')],
        ['chaves', regModulo('delegua_json_chaves', ['opaco:json'], 'texto[]')],
        [
            'objetoParaTextoJsonFormatado',
            regModulo('delegua_json_objeto_para_texto_formatado', ['opaco:json'], 'texto'),
        ],

        // Construção (definirCampo e adicionarItem copiam o valor).
        ['criarObjeto', regModulo('delegua_json_criar_objeto', [], 'opaco:json')],
        ['criarVetor', regModulo('delegua_json_criar_vetor', [], 'opaco:json')],
        ['criarTexto', regModulo('delegua_json_criar_texto', ['texto'], 'opaco:json')],
        ['criarNumero', regModulo('delegua_json_criar_numero', ['número'], 'opaco:json')],
        ['criarLogico', regModulo('delegua_json_criar_logico', ['lógico'], 'opaco:json')],
        ['criarNulo', regModulo('delegua_json_criar_nulo', [], 'opaco:json')],
        ['definirCampo', regModulo('delegua_json_definir_campo', ['opaco:json', 'texto', 'opaco:json'], 'lógico')],
        ['removerCampo', regModulo('delegua_json_remover_campo', ['opaco:json', 'texto'], 'lógico')],
        ['adicionarItem', regModulo('delegua_json_adicionar_item', ['opaco:json', 'opaco:json'], 'lógico')],
    ]);

    this.mapaModulos.set('json', funcoes);
}
