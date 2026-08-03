/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

// Regressão: passar uma instância de classe conhecida (`Item`) como argumento
// para um parâmetro DECLARADO como `qualquer` (`Caixa.guardar(valor: qualquer)`)
// gerava IR que corrompia o ponteiro guardado. A causa: o argumento tinha tipo
// inferido "Item" (uma classe registrada), então o marshaling de argumentos de
// chamada de método tratava-o pela convenção de "instância de classe crua"
// (sempre ponteiro direto, sem empacotar) — ignorando que o parâmetro do
// callee é `qualquer` e, por isso, sempre faz um `load` para desembrulhar
// (mesma convenção de dupla indireção de texto/dicionário). Sem empacotar o
// argumento numa alloca antes de passar, esse load lia os primeiros 8 bytes do
// próprio objeto `Item` como se fossem um ponteiro — um valor de lixo, que
// mais tarde causa segmentation fault ao ser desreferenciado (ver
// `docs/estagios/estagio-0.md` no repositório `delegua-delegua`, onde isto
// bloqueava a chamada de qualquer função definida pelo usuário).
describe('Compilador - Instância de classe passada a parâmetro `qualquer`', () => {
    it('empacota a instância numa alloca (ptr*) em vez de passar o ponteiro cru', async () => {
        const compilador = new CompiladorLLVM();
        const ir = await compilador.compilar([
            'classe Item {',
            '    x: número',
            '    construtor() { isto.x = 1 }',
            '}',
            'classe Caixa {',
            '    valor: qualquer',
            '    guardar(valor: qualquer) {',
            '        isto.valor = valor',
            '    }',
            '}',
            'var caixa: Caixa = Caixa()',
            'var item: Item = Item()',
            'caixa.guardar(item)',
        ]);

        expect(ir).toBeTruthy();

        // O callee (`Caixa_guardar`) segue a convenção de dupla indireção de `qualquer`:
        // recebe um ptr* e faz UM load para obter o ponteiro real do objeto.
        expect(ir).toContain('define void @Caixa_guardar(ptr %0, ptr %1)');
        expect(ir).toMatch(/load ptr, ptr %1, align 8/);

        // A chamada precisa passar a ALLOCA de `item` (a caixa ptr*), nunca o ponteiro
        // do objeto já carregado/desreferenciado.
        expect(ir).toMatch(/%item = alloca ptr/);
        expect(ir).toMatch(/call void @Caixa_guardar\(ptr %[\w.]+, ptr %item\)/);
    });
});
