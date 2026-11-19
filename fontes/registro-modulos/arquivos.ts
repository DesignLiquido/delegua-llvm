import llvm from '@designliquido/llvm-bindings';
import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';
import { criarRegistradorFuncaoModulo } from './registrador';

export function registrarModuloArquivos(this: CompiladorLLVM): void {
    const ptr = this.montador.getPtrTy();
    const i32 = this.montador.getInt32Ty();
    const vazio = llvm.Type.getVoidTy(this.contexto);

    const reg = (nomeCFunc: string, tiposParametros: string[], tipoRetorno: string): EntradaFuncaoModulo => {
        const tiposLlvm = tiposParametros.map((t) => (t === 'inteiro' ? i32 : ptr));
        const tipoRetLlvm = tipoRetorno === 'inteiro' ? i32 : tipoRetorno === 'vazio' ? vazio : ptr;
        const tipo = llvm.FunctionType.get(tipoRetLlvm, tiposLlvm, false);
        const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
        return { callee, tiposParametros, tipoRetorno };
    };
    const regModulo = criarRegistradorFuncaoModulo(this);

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['abrir', reg('delegua_arq_abrir', ['texto'], 'texto')],
        ['diretorioAtual', reg('delegua_arq_diretorio_atual', [], 'texto')],
        ['diretorioExiste', reg('delegua_arq_diretorio_existe', ['texto'], 'inteiro')],
        ['eArquivo', reg('delegua_arq_e_arquivo', ['texto'], 'inteiro')],
        ['eDiretorio', reg('delegua_arq_e_diretorio', ['texto'], 'inteiro')],
        ['paraTexto', reg('delegua_arq_para_texto', ['texto'], 'texto')],
        ['escrever', reg('delegua_arq_escrever', ['texto', 'texto'], 'vazio')],
        ['sobrescrever', reg('delegua_arq_sobrescrever', ['texto', 'texto'], 'vazio')],
        ['recarregar', reg('delegua_arq_recarregar', ['texto'], 'vazio')],
        ['instanciaEArquivo', reg('delegua_arq_instancia_e_arquivo', ['texto'], 'inteiro')],
        ['instanciaEDiretorio', reg('delegua_arq_instancia_e_diretorio', ['texto'], 'inteiro')],

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
