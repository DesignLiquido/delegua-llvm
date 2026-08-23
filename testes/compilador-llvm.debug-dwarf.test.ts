/// <reference types="jest" />
import { CompiladorLLVM } from '../fontes/compilador-llvm';

describe('Compilador - Metadados de depuração DWARF (emitirDebug)', () => {
    it('emite metadados de compile unit e versão de debug quando emitirDebug=true', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar(
            ['funcao soma(a: inteiro, b: inteiro): inteiro {', '    retorna a + b', '}'],
            false,
            undefined,
            'teste.delegua',
            'D:/Delegua/teste',
            true
        );

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('!llvm.dbg.cu');
        expect(resultado).toContain('DICompileUnit(language: DW_LANG_C');
        expect(resultado).toContain('"Debug Info Version"');
        expect(resultado).toContain('DISubprogram');
        expect(resultado).toContain('!DILocation');
    });

    it('emite dbg.declare para parâmetros e variáveis locais tipadas', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar(
            [
                'funcao dobro(x: inteiro): inteiro {',
                '    var y: inteiro = x * 2',
                '    retorna y',
                '}',
            ],
            false,
            undefined,
            'dobro.delegua',
            undefined,
            true
        );

        expect(resultado).toBeTruthy();
        expect(resultado).toContain('#dbg_declare(');
        expect(resultado).toContain('!DILocalVariable(name: "x", arg: 1');
        expect(resultado).toContain('!DILocalVariable(name: "y"');
    });

    it('sem nomeArquivoFonte, emitirDebug=true não gera metadados DWARF', async () => {
        const compilador = new CompiladorLLVM();
        const resultado = await compilador.compilar(
            ['funcao f(): inteiro {', '    retorna 1', '}'],
            false,
            undefined,
            undefined,
            undefined,
            true
        );

        expect(resultado).toBeTruthy();
        expect(resultado).not.toContain('!llvm.dbg.cu');
    });
});
