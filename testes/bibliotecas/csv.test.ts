import { CompiladorLLVM } from '../../fontes/compilador-llvm';

describe('Compilador - Biblioteca delegua-csv (Fase C.1)', () => {
    describe('Importação dinâmica: var csv = importar("csv")', () => {
        it('importar("csv") gera IR válido', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var csv = importar("csv")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @main()');
        });

        it('chama csv.lerCsv e gera declare para delegua_csv_ler', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var csv = importar("csv")',
                'var tabela: texto = csv.lerCsv("./dados.csv", 44)',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_csv_ler');
        });

        it('chama csv.textoParaObjetoCsv e gera declare para delegua_csv_texto_para_tabela', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var csv = importar("csv")',
                'var tabela: texto = csv.textoParaObjetoCsv("a,b,c", 44)',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_csv_texto_para_tabela');
        });

        it('chama csv.objetoCsvParaTexto e gera declare para delegua_csv_tabela_para_texto', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var csv = importar("csv")',
                'var tabela: texto = csv.textoParaObjetoCsv("a,b,c", 44)',
                'var texto: texto = csv.objetoCsvParaTexto(tabela, 44)',
                'escreva(texto)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_csv_tabela_para_texto');
        });

        it('chama csv.totalLinhas e gera declare para delegua_csv_total_linhas', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var csv = importar("csv")',
                'var tabela: texto = csv.textoParaObjetoCsv("a,b\\nc,d", 44)',
                'var n: inteiro = csv.totalLinhas(tabela)',
                'escreva(n)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_csv_total_linhas');
        });

        it('chama csv.totalColunas e gera declare para delegua_csv_total_colunas', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var csv = importar("csv")',
                'var tabela: texto = csv.textoParaObjetoCsv("a,b,c", 44)',
                'var n: inteiro = csv.totalColunas(tabela)',
                'escreva(n)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_csv_total_colunas');
        });

        it('chama csv.obterCelula e gera declare para delegua_csv_obter_celula', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var csv = importar("csv")',
                'var tabela: texto = csv.textoParaObjetoCsv("a,b,c", 44)',
                'var cel: texto = csv.obterCelula(tabela, 0, 1)',
                'escreva(cel)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_csv_obter_celula');
        });

        it('chama csv.escreverCsv (retorno vazio) e gera declare para delegua_csv_escrever', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var csv = importar("csv")',
                'var tabela: texto = csv.textoParaObjetoCsv("a,b,c", 44)',
                'csv.escreverCsv("./saida.csv", tabela, 44)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_csv_escrever');
        });

        it('chama csv.liberar (retorno vazio) e gera declare para delegua_csv_liberar', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var csv = importar("csv")',
                'var tabela: texto = csv.textoParaObjetoCsv("a,b,c", 44)',
                'csv.liberar(tabela)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_csv_liberar');
        });

        it('lança erro ao chamar método inexistente no módulo csv', async () => {
            const compilador = new CompiladorLLVM();
            await expect(compilador.compilar([
                'var csv = importar("csv")',
                'csv.funcaoInexistente()',
            ])).rejects.toThrow("Função 'funcaoInexistente' não encontrada no módulo 'csv'");
        });
    });

    describe('Importação estruturada: importar { fn } de "csv"', () => {
        it('importa lerCsv e declara função no IR', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'importar { lerCsv } de "csv"',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_csv_ler');
        });
    });

    describe('Coexistência com outras bibliotecas', () => {
        it('usa csv junto com arquivos', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var csv = importar("csv")',
                'var arq = importar("arquivos")',
                'var dir: texto = arq.diretorioAtual()',
                'var tabela: texto = csv.textoParaObjetoCsv("a,b", 44)',
                'var n: inteiro = csv.totalColunas(tabela)',
                'escreva(n)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_csv_texto_para_tabela');
            expect(resultado).toContain('delegua_arq_diretorio_atual');
        });
    });
});
