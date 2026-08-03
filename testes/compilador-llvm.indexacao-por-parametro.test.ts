/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

// Regressão: indexar um vetor (leitura OU escrita) usando uma variável de
// parâmetro como índice, fora do modo de depuração (`-g`/`--debug`), gerava
// IR inválido — o verificador do LLVM rejeitava com "Load operand must be a
// pointer.". A causa: parâmetros escalares só recebem uma alloca (e portanto
// só viram ponteiro) quando a depuração DWARF está habilitada
// (`visitarCorpoFuncao`); sem `-g`, o argumento já chega como valor pronto no
// registrador, mas a resolução de índice de vetor sempre assumia um ponteiro
// e fazia um `CreateLoad` incondicional sobre ele.
describe('Compilador - Indexação de vetor por parâmetro (sem depuração)', () => {
    it('leitura de vetor de classe indexado por parâmetro não lança erro de verificação do LLVM', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Item {',
            '    x: número',
            '    construtor() { isto.x = 1 }',
            '}',
            'classe Caixa {',
            '    itens: Item[]',
            '    construtor() { isto.itens = [] }',
            '    adicionarItem(item: Item) { isto.itens.adicionar(item) }',
            '    lerItem(pos: inteiro): Item { retorna isto.itens[pos] }',
            '}',
            'var caixa: Caixa = Caixa()',
            'var item: Item = Item()',
            'caixa.adicionarItem(item)',
            'var lido: Item = caixa.lerItem(0)',
        ]);

        expect(resultado).toBeTruthy();
    });

    it('escrita em vetor de classe indexado por parâmetro não lança erro de verificação do LLVM', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Item {',
            '    x: número',
            '    construtor() { isto.x = 1 }',
            '}',
            'classe Caixa {',
            '    itens: Item[]',
            '    construtor() { isto.itens = [] }',
            '    adicionarItem(item: Item) { isto.itens.adicionar(item) }',
            '    escreverPorIndice(pos: inteiro, item: Item) { isto.itens[pos] = item }',
            '}',
            'var caixa: Caixa = Caixa()',
            'var item: Item = Item()',
            'caixa.adicionarItem(item)',
            'caixa.escreverPorIndice(0, item)',
        ]);

        expect(resultado).toBeTruthy();
    });

    it('leitura de vetor de inteiro indexado por parâmetro não lança erro de verificação do LLVM', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Caixa {',
            '    itens: inteiro[]',
            '    construtor() { isto.itens = [10, 20, 30] }',
            '    lerItem(pos: inteiro): inteiro { retorna isto.itens[pos] }',
            '}',
            'var caixa: Caixa = Caixa()',
            'var lido: inteiro = caixa.lerItem(1)',
        ]);

        expect(resultado).toBeTruthy();
    });
});
