import { CompiladorLLVM } from '../../fontes/compilador-llvm';

describe('Compilador - delegua-dados G.1: RecorteDados e Serie', () => {
    describe('I/O', () => {
        it('lerCSV gera declare para delegua_dados_ler_csv', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var dados = importar("dados")',
                'var rd: texto = dados.lerCSV("arquivo.csv")',
                'escreva(rd)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_dados_ler_csv');
        });
    });

    describe('Operações sobre RecorteDados', () => {
        it('cabeca gera declare para delegua_dados_cabeca', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var dados = importar("dados")',
                'var rd: texto = dados.lerCSV("arquivo.csv")',
                'var topo: texto = dados.cabeca(rd, 5)',
                'escreva(topo)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_dados_cabeca');
        });

        it('cauda gera declare para delegua_dados_cauda', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var dados = importar("dados")',
                'var rd: texto = dados.lerCSV("arquivo.csv")',
                'var fim: texto = dados.cauda(rd, 3)',
                'escreva(fim)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_dados_cauda');
        });

        it('info gera declare para delegua_dados_info', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var dados = importar("dados")',
                'var rd: texto = dados.lerCSV("arquivo.csv")',
                'var descricao: texto = dados.info(rd)',
                'escreva(descricao)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_dados_info');
        });

        it('paraTexto gera declare para delegua_dados_para_texto', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var dados = importar("dados")',
                'var rd: texto = dados.lerCSV("arquivo.csv")',
                'var tabela: texto = dados.paraTexto(rd)',
                'escreva(tabela)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_dados_para_texto');
        });

        it('removerNulo gera declare para delegua_dados_remover_nulo', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var dados = importar("dados")',
                'var rd: texto = dados.lerCSV("arquivo.csv")',
                'var limpo: texto = dados.removerNulo(rd)',
                'escreva(limpo)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_dados_remover_nulo');
        });

        it('selecionarColuna gera declare para delegua_dados_selecionar_coluna', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var dados = importar("dados")',
                'var rd: texto = dados.lerCSV("arquivo.csv")',
                'var col: texto = dados.selecionarColuna(rd, "preco")',
                'escreva(col)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_dados_selecionar_coluna');
        });
    });

    describe('Operações sobre Serie', () => {
        it('serieMax gera declare para delegua_dados_serie_max', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var dados = importar("dados")',
                'var rd: texto = dados.lerCSV("arquivo.csv")',
                'var col: texto = dados.selecionarColuna(rd, "valor")',
                'var maximo: numero = dados.serieMax(col)',
                'escreva(maximo)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_dados_serie_max');
        });

        it('serieMin gera declare para delegua_dados_serie_min', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var dados = importar("dados")',
                'var rd: texto = dados.lerCSV("arquivo.csv")',
                'var col: texto = dados.selecionarColuna(rd, "valor")',
                'var minimo: numero = dados.serieMin(col)',
                'escreva(minimo)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_dados_serie_min');
        });

        it('serieMedia gera declare para delegua_dados_serie_media', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var dados = importar("dados")',
                'var rd: texto = dados.lerCSV("arquivo.csv")',
                'var col: texto = dados.selecionarColuna(rd, "nota")',
                'var media: numero = dados.serieMedia(col)',
                'escreva(media)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_dados_serie_media');
        });

        it('serieTamanho gera declare para delegua_dados_serie_tamanho', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var dados = importar("dados")',
                'var rd: texto = dados.lerCSV("arquivo.csv")',
                'var col: texto = dados.selecionarColuna(rd, "id")',
                'var tam: inteiro = dados.serieTamanho(col)',
                'escreva(tam)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_dados_serie_tamanho');
        });
    });

    describe('Importação estruturada', () => {
        it('importa lerCSV e selecionarColuna juntos', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'importar { lerCSV, selecionarColuna } de "dados"',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_dados_ler_csv');
            expect(resultado).toContain('delegua_dados_selecionar_coluna');
        });
    });

    describe('Pipeline completo', () => {
        it('ler → cabeca → selecionarColuna → serieMedia', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var dados = importar("dados")',
                'var rd: texto = dados.lerCSV("dados.csv")',
                'var topo: texto = dados.cabeca(rd, 10)',
                'var col: texto = dados.selecionarColuna(topo, "preco")',
                'var media: numero = dados.serieMedia(col)',
                'escreva(media)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_dados_ler_csv');
            expect(resultado).toContain('delegua_dados_cabeca');
            expect(resultado).toContain('delegua_dados_selecionar_coluna');
            expect(resultado).toContain('delegua_dados_serie_media');
        });

        it('ler → removerNulo → info', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var dados = importar("dados")',
                'var rd: texto = dados.lerCSV("dados.csv")',
                'var limpo: texto = dados.removerNulo(rd)',
                'var descricao: texto = dados.info(limpo)',
                'escreva(descricao)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_dados_remover_nulo');
            expect(resultado).toContain('delegua_dados_info');
        });
    });
});
