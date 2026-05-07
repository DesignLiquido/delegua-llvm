/// <reference types="jest" />
import { CompiladorLLVM } from '../../fontes/compilador-llvm';

describe('Compilador - Biblioteca delegua-arquivos (Fase B.1)', () => {
    describe('Importação dinâmica: var arq = importar("arquivos")', () => {
        it('importar("arquivos") gera IR válido', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var arq = importar("arquivos")',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('define i32 @main()');
        });

        it('chama arquivos.abrir e gera declare para delegua_arq_abrir', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var arq = importar("arquivos")',
                'var f: texto = arq.abrir("./arquivo.txt")',
                'escreva(f)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_arq_abrir');
        });

        it('chama arquivos.diretorioAtual e gera declare para delegua_arq_diretorio_atual', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var arq = importar("arquivos")',
                'var d: texto = arq.diretorioAtual()',
                'escreva(d)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_arq_diretorio_atual');
        });

        it('chama arquivos.diretorioExiste e gera declare para delegua_arq_diretorio_existe', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var arq = importar("arquivos")',
                'var existe: inteiro = arq.diretorioExiste("./pasta")',
                'escreva(existe)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_arq_diretorio_existe');
        });

        it('chama arquivos.eArquivo e gera declare para delegua_arq_e_arquivo', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var arq = importar("arquivos")',
                'var ok: inteiro = arq.eArquivo("./arquivo.txt")',
                'escreva(ok)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_arq_e_arquivo');
        });

        it('chama arquivos.eDiretorio e gera declare para delegua_arq_e_diretorio', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var arq = importar("arquivos")',
                'var ok: inteiro = arq.eDiretorio("./pasta")',
                'escreva(ok)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_arq_e_diretorio');
        });

        it('chama arquivos.paraTexto passando handle e gera declare para delegua_arq_para_texto', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var arq = importar("arquivos")',
                'var f: texto = arq.abrir("./arquivo.txt")',
                'var conteudo: texto = arq.paraTexto(f)',
                'escreva(conteudo)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_arq_para_texto');
        });

        it('chama arquivos.escrever (retorno vazio) e gera declare para delegua_arq_escrever', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var arq = importar("arquivos")',
                'var f: texto = arq.abrir("./arquivo.txt")',
                'arq.escrever(f, "nova linha")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_arq_escrever');
        });

        it('chama arquivos.sobrescrever e gera declare para delegua_arq_sobrescrever', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var arq = importar("arquivos")',
                'var f: texto = arq.abrir("./arquivo.txt")',
                'arq.sobrescrever(f, "novo conteudo")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_arq_sobrescrever');
        });

        it('chama arquivos.recarregar e gera declare para delegua_arq_recarregar', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var arq = importar("arquivos")',
                'var f: texto = arq.abrir("./arquivo.txt")',
                'arq.recarregar(f)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_arq_recarregar');
        });

        it('lança erro ao chamar método inexistente no módulo arquivos', async () => {
            const compilador = new CompiladorLLVM();
            await expect(compilador.compilar([
                'var arq = importar("arquivos")',
                'arq.metodoInexistente()',
            ])).rejects.toThrow("Função 'metodoInexistente' não encontrada no módulo 'arquivos'");
        });
    });

    describe('Importação estruturada: importar { fn } de "arquivos"', () => {
        it('importa abrir e declara função no IR', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'importar { abrir } de "arquivos"',
                'escreva("ok")',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_arq_abrir');
        });
    });

    describe('Coexistência com outras bibliotecas', () => {
        it('usa arquivos junto com matematica', async () => {
            const compilador = new CompiladorLLVM();
            const resultado = await compilador.compilar([
                'var arq = importar("arquivos")',
                'var mat = importar("matematica")',
                'var d: texto = arq.diretorioAtual()',
                'var p: numero = mat.pi()',
                'escreva(d)',
                'escreva(p)',
            ]);
            expect(resultado).toBeTruthy();
            expect(resultado).toContain('delegua_arq_diretorio_atual');
            expect(resultado).toContain('delegua_mat_pi');
        });
    });
});
