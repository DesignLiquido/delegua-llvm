/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Erros', () => {
    it('Acesso a propriedade inexistente deve lançar erro', async () => {
        const compilador = new CompiladorLLVM();

        await expect(compilador.compilar([
            'classe Pessoa {',
            '    nome: texto',
            '    construtor(nome: texto) {',
            '        isto.nome = nome',
            '    }',
            '}',
            'var p = Pessoa("Delegua")',
            'escreva(p.idade)'
        ])).rejects.toThrow("Propriedade 'idade' não encontrada na classe 'Pessoa'.");
    });

    it('Chamada de método inexistente deve lançar erro', async () => {
        const compilador = new CompiladorLLVM();

        await expect(compilador.compilar([
            'classe Pessoa {',
            '    nome: texto',
            '    construtor(nome: texto) {',
            '        isto.nome = nome',
            '    }',
            '}',
            'var p = Pessoa("Delegua")',
            'p.falar()'
        ])).rejects.toThrow("Método 'falar' não encontrado na classe 'Pessoa'.");
    });

    it('Variável inexistente deve lançar erro', async () => {
        const compilador = new CompiladorLLVM();

        await expect(compilador.compilar([
            'escreva(naoDeclarada)'
        ])).rejects.toThrow("Erro sintático: Variável não definida: 'naoDeclarada'.");
    });

    it('Classe estrangeira sem @definicao deve lançar erro de compilação', async () => {
        const compilador = new CompiladorLLVM();

        await expect(compilador.compilar([
            'classe estrangeira LibC {',
            '    puts(s: texto): inteiro',
            '}'
        ])).rejects.toThrow("Classe estrangeira 'LibC' não tem @definicao(biblioteca=\"...\").");
    });
});
