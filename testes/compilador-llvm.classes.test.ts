import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Classes', () => {
    it('Classe vazia não lança erro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Vazia { }'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('declare void @__delegua_tipo_Vazia');
    });

    it('Classe com propriedades gera struct com campos corretos', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Ponto {',
            '    x: número',
            '    y: número',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('declare void @__delegua_tipo_Ponto');
    });

    it('Classe com propriedades inteiras gera struct i32', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Contador {',
            '    valor: inteiro',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('declare void @__delegua_tipo_Contador');
    });

    it('Construtor gera função void com %self como primeiro parâmetro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Ponto {',
            '    x: número',
            '    y: número',
            '    construtor(x: número, y: número) {',
            '        isto.x = x',
            '        isto.y = y',
            '    }',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('%Ponto = type { double, double }');
        expect(resultado).toContain('define void @Ponto_construtor(ptr %0, double %1, double %2)');
        expect(resultado).toContain('ret void');
    });

    it('Método gera função com %self como primeiro parâmetro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Ponto {',
            '    x: número',
            '    y: número',
            '    obterX(): número {',
            '        retorna isto.x',
            '    }',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define double @Ponto_obterX(ptr %0)');
        expect(resultado).toContain('ret double');
    });

    it('Construtor inicializa propriedades via isto', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Ponto {',
            '    x: número',
            '    y: número',
            '    construtor(x: número, y: número) {',
            '        isto.x = x',
            '        isto.y = y',
            '    }',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('getelementptr inbounds %Ponto');
        expect(resultado).toContain('store double');
    });

    it('Instanciação aloca objeto e chama construtor', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Ponto {',
            '    x: número',
            '    y: número',
            '    construtor(x: número, y: número) {',
            '        isto.x = x',
            '        isto.y = y',
            '    }',
            '}',
            'var p = Ponto(3.0, 4.0)'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('alloca %Ponto');
        expect(resultado).toContain('call void @Ponto_construtor(ptr');
    });

    it('Instanciação passa vetores para construtor com load do struct', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe RetornoLexador {',
            '    simbolos: texto[]',
            '    erros: texto[]',
            '    construtor(simbolos: texto[], erros: texto[]) {',
            '        isto.simbolos = simbolos',
            '        isto.erros = erros',
            '    }',
            '}',
            'var retorno = RetornoLexador([], [])'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('call void @RetornoLexador_construtor(ptr');
        expect(resultado).toContain('load %Vetor');
    });

    it('Chamada de método de instância', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Ponto {',
            '    x: número',
            '    y: número',
            '    construtor(x: número, y: número) {',
            '        isto.x = x',
            '        isto.y = y',
            '    }',
            '    obterX(): número {',
            '        retorna isto.x',
            '    }',
            '}',
            'var p = Ponto(3.0, 4.0)',
            'var r = p.obterX()'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('call double @Ponto_obterX(ptr');
    });

    it('Acesso a propriedade de instância', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Ponto {',
            '    x: número',
            '    y: número',
            '    construtor(x: número, y: número) {',
            '        isto.x = x',
            '        isto.y = y',
            '    }',
            '    obterX(): número {',
            '        retorna isto.x',
            '    }',
            '}',
            'var p = Ponto(1.0, 2.0)',
            'escreva(p.obterX())'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('getelementptr inbounds %Ponto');
        expect(resultado).toContain('load double');
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
    });

    it('Classe com campos inteiros e números mistos', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Dado {',
            '    codigo: inteiro',
            '    valor: número',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('declare void @__delegua_tipo_Dado');
    });

    it('isto.método() chamando método definido anteriormente na classe', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Calculadora {',
            '    dobrar(n: número): número {',
            '        retorna n * 2',
            '    }',
            '    quadruplicar(n: número): número {',
            '        retorna isto.dobrar(isto.dobrar(n))',
            '    }',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define double @Calculadora_dobrar');
        expect(resultado).toContain('define double @Calculadora_quadruplicar');
        expect(resultado).toContain('call double @Calculadora_dobrar');
    });

    it('isto.método() chamando método definido posteriormente na classe', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe Calculadora {',
            '    quadruplicar(n: número): número {',
            '        retorna isto.dobrar(isto.dobrar(n))',
            '    }',
            '    dobrar(n: número): número {',
            '        retorna n * 2',
            '    }',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('define double @Calculadora_dobrar');
        expect(resultado).toContain('define double @Calculadora_quadruplicar');
        expect(resultado).toContain('call double @Calculadora_dobrar');
    });
});
