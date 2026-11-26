import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';
import { criarRegistradorFuncaoModulo } from './registrador';

export function registrarModuloArquivos(this: CompiladorLLVM): void {
    const regModulo = criarRegistradorFuncaoModulo(this);

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['abrir', regModulo('delegua_arq_abrir', ['texto'], 'opaco:arquivo')],
        ['diretorioAtual', regModulo('delegua_arq_diretorio_atual', [], 'texto')],
        ['diretorioExiste', regModulo('delegua_arq_diretorio_existe', ['texto'], 'inteiro')],
        ['eArquivo', regModulo('delegua_arq_e_arquivo', ['texto'], 'inteiro')],
        ['eDiretorio', regModulo('delegua_arq_e_diretorio', ['texto'], 'inteiro')],
        ['paraTexto', regModulo('delegua_arq_para_texto', ['opaco:arquivo'], 'texto')],
        ['escrever', regModulo('delegua_arq_escrever', ['opaco:arquivo', 'texto'], 'vazio')],
        ['sobrescrever', regModulo('delegua_arq_sobrescrever', ['opaco:arquivo', 'texto'], 'vazio')],
        ['recarregar', regModulo('delegua_arq_recarregar', ['opaco:arquivo'], 'vazio')],
        ['instanciaEArquivo', regModulo('delegua_arq_instancia_e_arquivo', ['opaco:arquivo'], 'inteiro')],
        ['instanciaEDiretorio', regModulo('delegua_arq_instancia_e_diretorio', ['opaco:arquivo'], 'inteiro')],
        ['liberar', regModulo('delegua_arq_liberar', ['opaco:arquivo'], 'vazio')],

        // Sistema de arquivos (lógico: verdadeiro em caso de sucesso).
        ['existe', regModulo('delegua_arq_existe', ['texto'], 'lógico')],
        ['criarDiretorio', regModulo('delegua_arq_criar_diretorio', ['texto'], 'lógico')],
        ['remover', regModulo('delegua_arq_remover', ['texto'], 'lógico')],
        ['renomear', regModulo('delegua_arq_renomear', ['texto', 'texto'], 'lógico')],
        ['listarDiretorio', regModulo('delegua_arq_listar_diretorio', ['texto'], 'texto[]')],
        [
            'criarDiretorioTemporario',
            regModulo('delegua_arq_criar_diretorio_temporario', ['texto', 'texto'], 'texto'),
        ],
        ['diretorioPessoal', regModulo('delegua_arq_diretorio_pessoal', [], 'texto')],
        ['lerTexto', regModulo('delegua_arq_ler_texto', ['texto'], 'texto')],
        ['escreverTexto', regModulo('delegua_arq_escrever_texto', ['texto', 'texto'], 'lógico')],
        ['definirPermissoes', regModulo('delegua_arq_definir_permissoes', ['texto', 'inteiro'], 'lógico')],

        // Caminhos.
        ['juntarCaminhos', regModulo('delegua_arq_juntar_caminhos', ['texto', 'texto'], 'texto')],
        ['diretorioPai', regModulo('delegua_arq_diretorio_pai', ['texto'], 'texto')],
        ['nomeBase', regModulo('delegua_arq_nome_base', ['texto'], 'texto')],
        ['caminhoAbsoluto', regModulo('delegua_arq_caminho_absoluto', ['texto'], 'texto')],
    ]);

    this.mapaModulos.set('arquivos', funcoes);
}
