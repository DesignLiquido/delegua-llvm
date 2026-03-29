import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Fase 5: Métodos de Vetor com funções de processamento', () => {
    // ──────────────────────────────────────────────────────────
    // filtrarPor — lambda inline
    // ──────────────────────────────────────────────────────────

    it('filtrarPor (inteiro) compila lambda e chama delegua_vetor_filtrar_inteiro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var numeros: inteiro[] = [1, 2, 3, 4, 5]',
            'var pares: inteiro[] = numeros.filtrarPor(funcao(n: inteiro): inteiro { retorna n })',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_filtrar_inteiro');
        expect(resultado).toContain('__lambda_0');
    });

    it('filtrarPor (número) compila lambda e chama delegua_vetor_filtrar_numero', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: número[] = [1.0, 2.0, 3.0]',
            'var resultado: número[] = lista.filtrarPor(funcao(x: número): inteiro { retorna 1 })',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_filtrar_numero');
        expect(resultado).toContain('__lambda_0');
    });

    it('filtrarPor gera um lambda com nome único por compilação', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var a: inteiro[] = [1, 2, 3]',
            'var b: inteiro[] = a.filtrarPor(funcao(n: inteiro): inteiro { retorna n })',
            'var c: inteiro[] = a.filtrarPor(funcao(m: inteiro): inteiro { retorna m })',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('__lambda_0');
        expect(resultado).toContain('__lambda_1');
    });

    // ──────────────────────────────────────────────────────────
    // mapear — método de vetor
    // ──────────────────────────────────────────────────────────

    it('mapear (inteiro) como método chama delegua_vetor_mapear_inteiro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: inteiro[] = [1, 2, 3]',
            'var dobro: inteiro[] = lista.mapear(funcao(n: inteiro): inteiro { retorna n })',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_mapear_inteiro');
        expect(resultado).toContain('__lambda_0');
    });

    it('mapear (número) como método chama delegua_vetor_mapear_numero', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: número[] = [1.0, 2.0, 3.0]',
            'var resultado: número[] = lista.mapear(funcao(x: número): número { retorna x })',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_mapear_numero');
        expect(resultado).toContain('__lambda_0');
    });

    it('mapear (texto) como método chama delegua_vetor_mapear_texto', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: texto[] = ["a", "b", "c"]',
            'var resultado: texto[] = lista.mapear(funcao(s: texto): texto { retorna s })',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_mapear_texto');
        expect(resultado).toContain('__lambda_0');
    });

    it('mapear como método aceita referência a função nomeada', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao dobrar(n: inteiro): inteiro { retorna n }',
            'var lista: inteiro[] = [1, 2, 3]',
            'var resultado: inteiro[] = lista.mapear(dobrar)',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_mapear_inteiro');
        expect(resultado).toContain('@dobrar');
    });

    // ──────────────────────────────────────────────────────────
    // mapear — função global
    // ──────────────────────────────────────────────────────────

    it('mapear (inteiro) compila lambda e chama delegua_vetor_mapear_inteiro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: inteiro[] = [5, 3]',
            'var dobro: inteiro[] = mapear(lista, funcao(a: inteiro): inteiro { retorna a })',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_mapear_inteiro');
        expect(resultado).toContain('__lambda_0');
    });

    it('mapear (número) compila lambda e chama delegua_vetor_mapear_numero', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: número[] = [1.0, 2.0]',
            'var resultado: número[] = mapear(lista, funcao(x: número): número { retorna x })',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_mapear_numero');
        expect(resultado).toContain('__lambda_0');
    });

    // ──────────────────────────────────────────────────────────
    // filtrarPor com função nomeada (referência)
    // ──────────────────────────────────────────────────────────

    it('filtrarPor aceita referência a função nomeada', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'funcao ehPositivo(n: inteiro): inteiro { retorna n }',
            'var lista: inteiro[] = [1, 2, 3]',
            'var resultado: inteiro[] = lista.filtrarPor(ehPositivo)',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_filtrar_inteiro');
        expect(resultado).toContain('@ehPositivo');
    });

    // ──────────────────────────────────────────────────────────
    // lambda com conversão i1→i32 (expressão booleana como retorno)
    // ──────────────────────────────────────────────────────────

    it('filtrarPor com retorno de comparação (i1→i32) gera ZExt', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var lista: inteiro[] = [1, 2, 3, 4]',
            'var pares: inteiro[] = lista.filtrarPor(funcao(n: inteiro): inteiro { retorna n == 2 })',
        ]);
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('delegua_vetor_filtrar_inteiro');
        // ZExt converte i1 para i32
        expect(resultado).toContain('zext i1');
    });
});
