import { CompiladorLLVM } from '../../fontes/compilador-llvm';

describe('Compilador - Biblioteca delegua-fisica (Fase A.2)', () => {
    describe('Importação dinâmica: var fis = importar("fisica")', () => {
        it('importar("fisica") gera IR válido', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var fis = importar("fisica")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @main()');
        });

        it('chama fis.velocidadeMedia e gera call para delegua_fis_velocidade_media', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var fis = importar("fisica")',
                'var v: numero = fis.velocidadeMedia(100.0, 5.0)',
                'escreva(v)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_fis_velocidade_media');
        });

        it('chama fis.deltaS e gera call para delegua_fis_delta_s', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var fis = importar("fisica")',
                'var ds: numero = fis.deltaS(10.0, 50.0)',
                'escreva(ds)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_fis_delta_s');
        });

        it('chama fis.deltaT e gera call para delegua_fis_delta_t', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var fis = importar("fisica")',
                'var dt: numero = fis.deltaT(0.0, 10.0)',
                'escreva(dt)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_fis_delta_t');
        });

        it('chama fis.aceleracao e gera call para delegua_fis_aceleracao', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var fis = importar("fisica")',
                'var a: numero = fis.aceleracao(30.0, 10.0, 5.0, 0.0)',
                'escreva(a)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_fis_aceleracao');
        });

        it('lança erro ao chamar método inexistente no módulo fisica', async () => {
            const compilador = new CompiladorLLVM();
            await expect(compilador.compilar([
                'var fis = importar("fisica")',
                'fis.funcaoInexistente()',
            ])).rejects.toThrow("Função 'funcaoInexistente' não encontrada no módulo 'fisica'");
        });
    });

    describe('Importação estruturada desestruturada: importar { fn } de "fisica"', () => {
        it('importa velocidadeMedia e declara função no IR', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'importar { velocidadeMedia } de "fisica"',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_fis_velocidade_media');
        });
    });

    describe('Coexistência com delegua-matematica', () => {
        it('importa fisica e matematica no mesmo programa', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var fis = importar("fisica")',
                'var mat = importar("matematica")',
                'var v: numero = fis.velocidadeMedia(100.0, 5.0)',
                'var r: numero = mat.raizQuadrada(v)',
                'escreva(r)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_fis_velocidade_media');
            expect(resultado).toContain('delegua_mat_raiz_quadrada');
        });
    });
});
