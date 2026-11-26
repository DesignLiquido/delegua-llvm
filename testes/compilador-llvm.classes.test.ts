/// <reference types="jest" />
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
        // Campo 0 (i32) é o id de identidade oculto usado por eInstanciaDe; x/y vêm depois.
        expect(resultado).toContain('%Ponto = type { i32, double, double }');
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
        // Objeto ARC (memória zerada) com o descritor da classe e destrutor gerado.
        expect(resultado).toMatch(/call ptr @delegua_arc_alocar\(i64 \d+, ptr @__arc_desc_Ponto\)/);
        expect(resultado).toContain('define internal void @__destrutor_Ponto(ptr %0)');
        expect(resultado).toContain('call void @Ponto_construtor(ptr');
    });

    it('Instanciação passa vetores para construtor como Vetor* e inicializa campos vetor', async () => {
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
        // Vetores são referências no heap: o construtor recebe Vetor* (nunca %Vetor por valor).
        expect(resultado).toContain('define void @RetornoLexador_construtor(ptr %0, ptr %1, ptr %2)');
        expect(resultado).toMatch(/call void @RetornoLexador_construtor\(ptr %obj_RetornoLexador, ptr %vetor\d*, ptr %vetor\d*\)/);
        expect(resultado).not.toContain('load %Vetor');
        // Objeto zerado e campos vetor começam como Vetor* vazio.
        expect(resultado).toContain('call ptr @delegua_arc_alocar(i64 24, ptr @__arc_desc_RetornoLexador)');
        // O destrutor libera os dois campos vetor.
        expect(resultado).toMatch(/@__destrutor_RetornoLexador[\s\S]*%simbolos = load ptr[\s\S]*call void @delegua_arc_liberar\(ptr %simbolos\)/);
        // texto[]: elementos de 8 bytes gerenciados pelo ARC (gerenciado = 1).
        expect(resultado).toContain('%simbolos_vazio = call ptr @delegua_vetor_criar(i32 0, i32 8, i32 1)');
        expect(resultado).toContain('%erros_vazio = call ptr @delegua_vetor_criar(i32 0, i32 8, i32 1)');
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
    it('campo @fraco usa delegua_arc_fraco_atribuir e fica fora do visitante de ciclos', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'classe No {',
            '    @fraco',
            '    pai: No',
            '    filhos: No[]',
            '}',
            'var raiz = No()',
            'var filho = No()',
            'filho.pai = raiz',
        ]);
        expect(resultado).toMatch(/call void @delegua_arc_fraco_atribuir\(ptr %pai_\w+, ptr %\w+\)/);
        // O destrutor só cancela o registro do campo fraco e libera o forte.
        expect(resultado).toMatch(/@__destrutor_No[\s\S]*call void @delegua_arc_fraco_atribuir\(ptr %pai_ptr, ptr null\)/);
        // O visitante de ciclos segue `filhos`, não `pai`.
        const visitante = resultado.slice(resultado.indexOf('define internal void @__visitar_No'));
        const corpoVisitante = visitante.slice(0, visitante.indexOf('}'));
        expect(corpoVisitante).toContain('%filhos = load ptr');
        expect(corpoVisitante).not.toContain('%pai = load ptr');
        expect(resultado).toContain('ptr @__destrutor_No, ptr @__visitar_No }');
    });

    it('classe só com campos texto não tem visitante de ciclos', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar(['classe P {', '    nome: texto', '}', 'var p = P()']);
        expect(resultado).toContain('ptr @__destrutor_P, ptr null }');
    });

    it('@fraco em campo que não é referência é erro de compilação', async () => {
        const compilador = new CompiladorLLVM();
        await expect(compilador.compilar(['classe A {', '    @fraco', '    n: inteiro', '}', 'var a = A()'])).rejects.toThrow(
            "@fraco só se aplica a campos que referenciam objetos, vetores ou dicionários; 'n' é 'inteiro'."
        );
    });
});
