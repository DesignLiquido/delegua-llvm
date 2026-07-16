import { CompiladorLLVM } from '../fontes/compilador-llvm';
import { describe, expect, it } from '@jest/globals';

describe('Compilador - Dicionário', () => {
    it('Literal {} vazio gera chamada a delegua_dicionario_criar', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar(['var d: qualquer = {}']);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('declare ptr @delegua_dicionario_criar()');
        expect(resultado).toContain('call ptr @delegua_dicionario_criar()');
    });

    it('Escrita por chave texto gera chamada a delegua_dicionario_definir', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var d: qualquer = {}',
            'd["chave"] = "valor"',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('call void @delegua_dicionario_definir');
    });

    it('Escrita de valor escalar embala em heap via malloc antes de definir', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var d: qualquer = {}',
            'd["imutavel"] = falso',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('call ptr @malloc');
        expect(resultado).toContain('call void @delegua_dicionario_definir');
    });

    it('Leitura por chave texto (literal) gera chamada a delegua_dicionario_obter', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var d: qualquer = {}',
            'escreva(d["chave"])',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('call ptr @delegua_dicionario_obter');
    });

    it('Leitura por chave texto (variável) gera chamada a delegua_dicionario_obter', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var d: qualquer = {}',
            'var nome: texto = "chave"',
            'escreva(d[nome])',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('call ptr @delegua_dicionario_obter');
    });

    it('Vetor de qualquer (qualquer[]) continua usando o caminho de GEP, não o de dicionário', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var args: qualquer[] = []',
            'escreva(args[0])',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('ptr_elemento');
        expect(resultado).not.toContain('call ptr @delegua_dicionario_obter');
    });

    it('Campo bruto `qualquer` (nunca inferido como dicionário) continua barrando acesso por propriedade', async () => {
        const compilador = new CompiladorLLVM();

        await expect(
            compilador.compilar([
                'classe Caixa {',
                '    conteudo: qualquer',
                '}',
                'var c: Caixa = Caixa()',
                'escreva(c.conteudo.rotulo)',
            ])
        ).rejects.toThrow(/não pode ser acessada em valor de tipo 'qualquer'/);
    });

    it('Valor lido de dicionário desembala com load ao ser atribuído a variável escalar concreta', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var d: qualquer = {}',
            'd["x"] = 5',
            'var n: número = d["x"]',
            'escreva(n)',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('desembalar_inicializador');
        expect(resultado).toContain('load double');
    });

    it('Escalar computado passado a parâmetro qualquer de método é embalado em heap', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Caixa {',
            '    conteudo: qualquer',
            '    guardar(valor: qualquer) {',
            '        isto.conteudo = valor',
            '    }',
            '}',
            'var c: Caixa = Caixa()',
            'var a: número = 2',
            'var b: número = 3',
            'c.guardar(a + b)',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('call void @Caixa_guardar');
        expect(resultado).toContain('call ptr @malloc');
    });
});
