import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Exceções', () => {
    it('Trivial', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'tente {  ',
            '  falhar "falhou"',
            '  escreva("sucesso")',
            '} pegue {',
            '  escreva("Ocorreu uma exceção.")',
            '} finalmente {',
            '  escreva("Ocorrendo exceção ou não, eu sempre executo")',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('tente_corpo');
        expect(resultado).toContain('falhar_normal');
        expect(resultado).toContain('tente_apos');
        expect(resultado).toContain('finalmente_corpo');
        expect(resultado).toContain('pegue_corpo');
        expect(resultado).toContain('pegue_landing');
        expect(resultado).toContain('pegue_corpo');
        expect(resultado).toContain('declare i32 @__gxx_personality_v0(i32, i32, i64, ptr, ptr)');
    });

    it('Try-catch simples (sem finally)', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'tente {',
            '  falhar "erro"',
            '  escreva("sucesso")',
            '} pegue {',
            '  escreva("Exceção capturada")',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('tente_corpo');
        expect(resultado).toContain('pegue_corpo');
        expect(resultado).toContain('pegue_landing');
        expect(resultado).toContain('tente_apos');
        expect(resultado).not.toContain('finalmente_corpo');
        expect(resultado).toContain('declare i32 @__gxx_personality_v0(i32, i32, i64, ptr, ptr)');
    });

    it('Try-catch com parâmetro de erro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'tente {',
            '  falhar "Erro ocorrido"',
            '} pegue (erro) {',
            '  escreva(erro)',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('tente_corpo');
        expect(resultado).toContain('pegue_corpo');
        expect(resultado).toContain('pegue_landing');
        expect(resultado).toContain('call ptr @__cxa_begin_catch');
        expect(resultado).toContain('call void @__cxa_end_catch');
        expect(resultado).toContain('declare i32 @__gxx_personality_v0(i32, i32, i64, ptr, ptr)');
    });

    it('Try-catch-finally com parâmetro de erro', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'tente {',
            '  falhar "Erro ocorrido"',
            '} pegue (erro) {',
            '  escreva(erro)',
            '} finalmente {',
            '  escreva("Sempre executa")',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('tente_corpo');
        expect(resultado).toContain('pegue_corpo');
        expect(resultado).toContain('pegue_landing');
        expect(resultado).toContain('finalmente_corpo');
        expect(resultado).toContain('tente_apos');
        expect(resultado).toContain('call ptr @__cxa_begin_catch');
        expect(resultado).toContain('call void @__cxa_end_catch');
        expect(resultado).toContain('declare i32 @__gxx_personality_v0(i32, i32, i64, ptr, ptr)');
    });

    it('Try apenas com finally (sem catch)', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'tente {',
            '  escreva("tentando")',
            '} finalmente {',
            '  escreva("Sempre executa")',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('tente_corpo');
        expect(resultado).toContain('finalmente_corpo');
        expect(resultado).toContain('tente_apos');
        expect(resultado).not.toContain('pegue_corpo');
        expect(resultado).toContain('pegue_landing');
        expect(resultado).toContain('relancar_excecao');
    });

    it('Try com sucesso (sem exceção)', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'tente {',
            '  escreva("sucesso")',
            '} pegue {',
            '  escreva("Exceção")',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('tente_corpo');
        expect(resultado).toContain('tente_apos');
        expect(resultado).toContain('pegue_corpo');
        expect(resultado).toContain('pegue_landing');
        expect(resultado).toContain('call i32 (ptr, ...) @escreva');
        expect(resultado).toContain('declare i32 @__gxx_personality_v0(i32, i32, i64, ptr, ptr)');
    });

    it('Try aninhado', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'tente {',
            '  tente {',
            '    falhar "erro interno"',
            '  } pegue {',
            '    escreva("Erro interno capturado")',
            '  }',
            '} pegue {',
            '  escreva("Erro externo capturado")',
            '}'
        ]);

        expect(resultado).toBeTruthy();
        const matchesTenteCorpo = (resultado.match(/tente_corpo/g) || []).length;
        const matchesPegueLanding = (resultado.match(/pegue_landing/g) || []).length;
        expect(matchesTenteCorpo).toBeGreaterThanOrEqual(2);
        expect(matchesPegueLanding).toBeGreaterThanOrEqual(2);
        expect(resultado).toContain('pegue_corpo');
        expect(resultado).toContain('declare i32 @__gxx_personality_v0(i32, i32, i64, ptr, ptr)');
    });

    it('Falhar sem try-catch', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar([
            'falhar "mensagem de erro"'
        ]);

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('call void @falhar');
        expect(resultado).not.toContain('invoke void @falhar');
        expect(resultado).not.toContain('pegue_landing');
    });
});
