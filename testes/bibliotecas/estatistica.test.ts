import { CompiladorLLVM } from '../../fontes/compilador-llvm';

describe('Compilador - Biblioteca delegua-estatistica (Fase A.3)', () => {
    describe('Importação dinâmica: var est = importar("estatistica")', () => {
        it('importar("estatistica") gera IR válido', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var est = importar("estatistica")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @main()');
        });

        it('chama est.max e gera call para delegua_est_max', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var est = importar("estatistica")',
                'var lista: numero[] = [1.0, 5.0, 3.0]',
                'var m: numero = est.max(lista)',
                'escreva(m)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_est_max');
        });

        it('chama est.min e gera call para delegua_est_min', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var est = importar("estatistica")',
                'var lista: numero[] = [1.0, 5.0, 3.0]',
                'var m: numero = est.min(lista)',
                'escreva(m)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_est_min');
        });

        it('chama est.media e gera call para delegua_est_media', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var est = importar("estatistica")',
                'var lista: numero[] = [2.0, 4.0, 6.0]',
                'var m: numero = est.media(lista)',
                'escreva(m)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_est_media');
        });

        it('chama est.mediana e gera call para delegua_est_mediana', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var est = importar("estatistica")',
                'var lista: numero[] = [3.0, 1.0, 2.0]',
                'var m: numero = est.mediana(lista)',
                'escreva(m)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_est_mediana');
        });

        it('chama est.ve e gera call para delegua_est_variancia', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var est = importar("estatistica")',
                'var lista: numero[] = [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]',
                'var v: numero = est.ve(lista)',
                'escreva(v)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_est_variancia');
        });

        it('chama est.covariancia e gera call para delegua_est_covariancia', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var est = importar("estatistica")',
                'var x: numero[] = [1.0, 2.0, 3.0]',
                'var y: numero[] = [4.0, 5.0, 6.0]',
                'var c: numero = est.covariancia(x, y)',
                'escreva(c)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_est_covariancia');
        });

        it('lança erro ao chamar método inexistente no módulo estatistica', async () => {
            const compilador = new CompiladorLLVM();
            await expect(compilador.compilar([
                'var est = importar("estatistica")',
                'est.funcaoInexistente()',
            ])).rejects.toThrow("Função 'funcaoInexistente' não encontrada no módulo 'estatistica'");
        });
    });

    describe('Importação estruturada desestruturada: importar { fn } de "estatistica"', () => {
        it('importa media e declara função no IR', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'importar { media } de "estatistica"',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_est_media');
        });
    });

    describe('Coexistência com outras bibliotecas', () => {
        it('usa estatistica junto com matematica', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var est = importar("estatistica")',
                'var mat = importar("matematica")',
                'var lista: numero[] = [4.0, 9.0, 16.0]',
                'var m: numero = est.media(lista)',
                'var r: numero = mat.raizQuadrada(m)',
                'escreva(r)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_est_media');
            expect(resultado).toContain('delegua_mat_raiz_quadrada');
        });
    });
});
