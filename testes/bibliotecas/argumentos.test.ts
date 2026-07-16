/// <reference types="jest" />
import { CompiladorLLVM } from '../../fontes/compilador-llvm';

describe('Compilador - Biblioteca argumentos', () => {
    describe('Importação dinâmica: var arg = importar("argumentos")', () => {
        it('importar("argumentos") gera IR válido', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var arg = importar("argumentos")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @main()');
        });

        it('chama arg.quantidadeArgumentos e gera declare para delegua_arg_quantidade_argumentos', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var arg = importar("argumentos")',
                'var n: inteiro = arg.quantidadeArgumentos()',
                'escreva(n)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_arg_quantidade_argumentos');
        });

        it('chama arg.argumento e gera declare para delegua_arg_argumento', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var arg = importar("argumentos")',
                'var a: texto = arg.argumento(0)',
                'escreva(a)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_arg_argumento');
        });

        it('lança erro ao chamar método inexistente no módulo argumentos', async () => {
            const compilador = new CompiladorLLVM();
            await expect(compilador.compilar([
                'var arg = importar("argumentos")',
                'arg.metodoInexistente()',
            ])).rejects.toThrow("Função 'metodoInexistente' não encontrada no módulo 'argumentos'");
        });
    });

    describe('Importação estruturada: importar { fn } de "argumentos"', () => {
        it('importa argumento e declara função no IR', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'importar { argumento } de "argumentos"',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_arg_argumento');
        });
    });

    describe('Coexistência com outras bibliotecas', () => {
        it('usa argumentos junto com arquivos', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var arg = importar("argumentos")',
                'var arq = importar("arquivos")',
                'var caminho: texto = arg.argumento(0)',
                'var d: texto = arq.diretorioAtual()',
                'escreva(caminho)',
                'escreva(d)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_arg_argumento');
            expect(resultado).toContain('delegua_arq_diretorio_atual');
        });
    });
});
