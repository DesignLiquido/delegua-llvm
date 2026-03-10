import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Vetores', () => {
    it('Literal de vetor gera struct %Vetor com array na pilha', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var numeros = [10, 20, 30];',
        ]);

        expect(resultado).toBeTruthy();
        // Struct %Vetor deve ser definido no módulo.
        expect(resultado).toContain('%Vetor = type');
        // Array de elementos alocado na pilha (literais sem tipo são double).
        expect(resultado).toContain('alloca [3 x double]');
        // Struct alocado na pilha.
        expect(resultado).toContain('alloca %Vetor');
        // Valores inicializados como double.
        expect(resultado).toContain('store double 1.000000e+01');
        expect(resultado).toContain('store double 2.000000e+01');
        expect(resultado).toContain('store double 3.000000e+01');
        // Tamanho armazenado no campo 1.
        expect(resultado).toContain('store i32 3');
    });

    it('Acesso a elemento por índice constante gera GEP + load', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var vals = [5, 10, 15];',
            'escreva(vals[1]);',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('%Vetor = type');
        // GEP para o campo de ponteiro (campo 0 do struct).
        expect(resultado).toContain('ptr_campo_elementos');
        // Load do ponteiro de elementos.
        expect(resultado).toContain('ptr_elementos');
        // GEP para o elemento.
        expect(resultado).toContain('ptr_elemento');
        // Load do elemento.
        expect(resultado).toContain('elemento');
    });

    it('Acesso em laço para com inteiro gera GEP com flag nuw', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var nums = [1, 2, 3];',
            'para (var i: inteiro = 0; i < 3; i++) {',
            '    escreva(nums[i]);',
            '}',
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('%Vetor = type');
        // GEP para o elemento dentro do laço deve ter flag nuw.
        expect(resultado).toContain('getelementptr inbounds nuw');
    });

    it('Inicialização de variável a partir de outra variável carrega o valor', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var a: inteiro = 7;',
            'var b: inteiro = a;',
            'escreva(b);',
        ]);

        expect(resultado).toBeTruthy();
        // A variável b deve ser inicializada carregando o valor de a.
        expect(resultado).toContain('load_inicializador_var');
        expect(resultado).toContain('store i32');
    });

    it('Acesso em laço para com número converte índice para inteiro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'var nums = [1, 2, 3];',
            'para (var i = 0; i < 3; i++) {',
            '    escreva(nums[i]);',
            '}',
        ]);

        // Laço com variável double deve gerar conversão FPToSI antes do GEP.
        expect(resultado).toBeTruthy();
        expect(resultado).toContain('%Vetor = type');
        expect(resultado).toContain('fptosi');
    });
});
