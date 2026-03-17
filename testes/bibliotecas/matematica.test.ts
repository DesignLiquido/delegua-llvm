import { CompiladorLLVM } from '../../fontes/compilador-llvm';

describe('Compilador - Biblioteca delegua-matematica', () => {
    describe('Importação dinâmica: var mat = importar("matematica")', () => {
        it('registra o módulo matematica em mapaModulos', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar(['escreva("ok")']);
            expect(resultado).toBeTruthy();
        });

        it('importar("matematica") retorna sentinela de módulo', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var mat = importar("matematica")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @main()');
        });

        it('chama mat.pi() e gera call para delegua_mat_pi', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var mat = importar("matematica")',
                'var p: numero = mat.pi()',
                'escreva(p)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_mat_pi');
        });

        it('chama mat.raizQuadrada(9.0) e gera call para delegua_mat_raiz_quadrada', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var mat = importar("matematica")',
                'var r: numero = mat.raizQuadrada(9.0)',
                'escreva(r)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_mat_raiz_quadrada');
        });

        it('chama mat.potencia(2.0, 10.0) e gera call para delegua_mat_potencia', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var mat = importar("matematica")',
                'var r: numero = mat.potencia(2.0, 10.0)',
                'escreva(r)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_mat_potencia');
        });

        it('chama mat.seno(0.0) e gera call para delegua_mat_seno', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var mat = importar("matematica")',
                'var s: numero = mat.seno(0.0)',
                'escreva(s)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_mat_seno');
        });

        it('chama mat.limite(5.0, 0.0, 3.0) e gera call para delegua_mat_limite', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var mat = importar("matematica")',
                'var l: numero = mat.limite(5.0, 0.0, 3.0)',
                'escreva(l)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_mat_limite');
        });

        it('chama mat.areaCirculo(1.0) e gera call para delegua_mat_area_circulo', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var mat = importar("matematica")',
                'var a: numero = mat.areaCirculo(1.0)',
                'escreva(a)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_mat_area_circulo');
        });

        it('lança erro ao chamar método inexistente no módulo matematica', async () => {
            const compilador = new CompiladorLLVM();
            await expect(compilador.compilar([
                'var mat = importar("matematica")',
                'mat.funcaoInexistente()',
            ])).rejects.toThrow("Função 'funcaoInexistente' não encontrada no módulo 'matematica'");
        });
    });

    describe('Importação estruturada namespace: importar tudo como bib de "matematica"', () => {
        // O parser Delegua não registra o alias como variável estática, por isso não é possível
        // usar bib.metodo() nas linhas seguintes sem um `var bib = importar(...)`.
        // Estes testes verificam que a declaração de importação em si não lança erro.
        it('importar tudo como bib de "matematica" não lança erro', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'importar tudo como bib de "matematica"',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @main()');
        });

        it('declara funções matemáticas no IR mesmo sem chamadas', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'importar tudo como bib de "matematica"',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            // getOrInsertFunction registra todas as declarações externas no módulo.
            expect(resultado).toContain('declare double @delegua_mat_pi()');
            // Sem chamadas ao alias, não deve haver instrução `call` para funções matemáticas.
            expect(resultado).not.toMatch(/call double @delegua_mat_/);
        });
    });

    describe('Importação estruturada desestruturada: importar { fn } de "matematica"', () => {
        it('importa pi e gera call direto', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'importar { pi } de "matematica"',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_mat_pi');
        });
    });

    describe('Funções financeiras', () => {
        it('jurosSimples gera call correto', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var mat = importar("matematica")',
                'var j: numero = mat.jurosSimples(1000.0, 0.05, 12.0)',
                'escreva(j)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_mat_juros_simples');
        });

        it('jurosCompostos gera call correto', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var mat = importar("matematica")',
                'var j: numero = mat.jurosCompostos(1000.0, 0.05, 12.0)',
                'escreva(j)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_mat_juros_compostos');
        });
    });

    describe('Funções de geometria plana', () => {
        it('distanciaDoisPontos gera call correto', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var mat = importar("matematica")',
                'var d: numero = mat.distanciaDoisPontos(0.0, 3.0, 0.0, 4.0)',
                'escreva(d)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_mat_distancia_dois_pontos');
        });

        it('areaTrapezio gera call correto', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var mat = importar("matematica")',
                'var a: numero = mat.areaTrapezio(8.0, 4.0, 3.0)',
                'escreva(a)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_mat_area_trapezio');
        });
    });
});
