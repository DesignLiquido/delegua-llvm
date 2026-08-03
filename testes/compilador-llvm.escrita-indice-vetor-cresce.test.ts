/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

// Regressão: `vetor[indice] = valor` gerava um GEP cru sobre o ponteiro de
// elementos ATUAL do vetor, sem checar limites nem crescer o buffer — o
// runtime C não tinha (e o codegen não chamava) nenhuma função de "definir
// por índice, crescendo se preciso" (só existia `delegua_vetor_adicionar`,
// que só cresce ao final). Escrever num índice além do tamanho atual (ex.:
// usar `vetor[indice] = valor` para empilhar, como em `PilhaEscoposExecucao`
// no MVP autointerpretador de `delegua-delegua`) corrompia o heap
// silenciosamente assim que excedesse a folga inicial — manifestando como
// segmentation fault ou corrupção de estado após poucas chamadas recursivas
// (ver docs/estagios/estagio-0.md nesse repositório).
//
// Corrigido adicionando `delegua_vetor_definir_indice` (bibliotecas/vetor.c),
// que realoca e zera os "buracos" quando `indice >= tamanho`, e usando-a no
// lugar do GEP cru no caminho de escrita por índice.
describe('Compilador - Escrita por índice em vetor cresce o buffer', () => {
    it('chama delegua_vetor_definir_indice em vez de um GEP cru sobre o ponteiro de elementos', async () => {
        const compilador = new CompiladorLLVM();
        const ir = await compilador.compilar([
            'var pilha: inteiro[] = []',
            'var topo: inteiro = 0',
            'pilha[topo] = 42',
        ]);

        expect(ir).toBeTruthy();
        expect(ir).toContain('declare ptr @delegua_vetor_definir_indice(ptr, i32, i32)');
        expect(ir).toMatch(/call ptr @delegua_vetor_definir_indice\(/);
    });

    it('funciona também para vetor de classe (elemento ponteiro)', async () => {
        const compilador = new CompiladorLLVM();
        const ir = await compilador.compilar([
            'classe Item {',
            '    x: número',
            '    construtor() { isto.x = 1 }',
            '}',
            'classe Pilha {',
            '    itens: Item[]',
            '    construtor() { isto.itens = [] }',
            '    empilhar(pos: inteiro, item: Item) { isto.itens[pos] = item }',
            '}',
            'var p: Pilha = Pilha()',
            'var item: Item = Item()',
            'p.empilhar(0, item)',
        ]);

        expect(ir).toBeTruthy();
        expect(ir).toMatch(/call ptr @delegua_vetor_definir_indice\(/);
    });
});
