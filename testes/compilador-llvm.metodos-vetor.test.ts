import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Métodos de Vetor (Fase 4)', () => {
    // ──────────────────────────────────────────────────────────
    // adicionar / empilhar
    // ──────────────────────────────────────────────────────────

    it('adicionar chama delegua_vetor_adicionar', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: inteiro[] = [1, 2, 3]',
            'lista.adicionar(4)',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_adicionar');
    });

    it('empilhar chama delegua_vetor_adicionar', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var pilha: inteiro[] = [1, 2]',
            'pilha.empilhar(3)',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_adicionar');
    });

    // ──────────────────────────────────────────────────────────
    // removerUltimo
    // ──────────────────────────────────────────────────────────

    it('removerUltimo chama delegua_vetor_remover_ultimo', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: inteiro[] = [1, 2, 3]',
            'lista.removerUltimo()',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_remover_ultimo');
    });

    // ──────────────────────────────────────────────────────────
    // removerPrimeiro
    // ──────────────────────────────────────────────────────────

    it('removerPrimeiro chama delegua_vetor_remover_primeiro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: inteiro[] = [1, 2, 3]',
            'lista.removerPrimeiro()',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_remover_primeiro');
    });

    // ──────────────────────────────────────────────────────────
    // inverter
    // ──────────────────────────────────────────────────────────

    it('inverter chama delegua_vetor_inverter', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: inteiro[] = [3, 1, 2]',
            'lista.inverter()',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_inverter');
    });

    // ──────────────────────────────────────────────────────────
    // ordenar
    // ──────────────────────────────────────────────────────────

    it('ordenar (inteiro) chama delegua_vetor_ordenar com eh_numero=0', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: inteiro[] = [3, 1, 2]',
            'lista.ordenar()',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_ordenar');
        // eh_numero deve ser 0 para inteiro
        expect(resultado).toContain('i32 0');
    });

    it('ordenar (número) chama delegua_vetor_ordenar com eh_numero=1', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: número[] = [3.0, 1.0, 2.0]',
            'lista.ordenar()',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_ordenar');
        // eh_numero deve ser 1 para número
        expect(resultado).toContain('i32 1');
    });

    // ──────────────────────────────────────────────────────────
    // fatiar
    // ──────────────────────────────────────────────────────────

    it('fatiar chama delegua_vetor_fatiar', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: inteiro[] = [1, 2, 3, 4]',
            'var fatia: inteiro[] = lista.fatiar(1, 3)',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_fatiar');
    });

    // ──────────────────────────────────────────────────────────
    // juntar
    // ──────────────────────────────────────────────────────────

    it('juntar (inteiro) chama delegua_vetor_juntar_inteiro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: inteiro[] = [1, 2, 3]',
            'escreva(lista.juntar(\", \"))',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_juntar_inteiro');
    });

    it('juntar (número) chama delegua_vetor_juntar_numero', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: número[] = [1.0, 2.0, 3.0]',
            'escreva(lista.juntar(\"-\"))',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_juntar_numero');
    });

    // ──────────────────────────────────────────────────────────
    // erro para método inexistente
    // ──────────────────────────────────────────────────────────

    it('lança erro para método de vetor desconhecido', async () => {
        const compilador = new CompiladorLLVM();
        await expect(
            compilador.compilar([
                'var lista: inteiro[] = [1, 2]',
                'lista.metodoInexistente()',
            ])
        ).rejects.toThrow('metodoInexistente');
    });
});
