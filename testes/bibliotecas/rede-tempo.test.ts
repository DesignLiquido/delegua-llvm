/// <reference types="jest" />
import { CompiladorLLVM } from '../../fontes/compilador-llvm';
import { obterBibliotecasParaCompilacao } from '../../fontes/bibliotecas-compilacao';

async function compilar(linhas: string[]): Promise<string> {
    return await new CompiladorLLVM().compilar(linhas, false);
}

describe('Compilador - módulo rede', () => {
    it('servidor: escutar, portaLocal, aceitar, lerAte, escrever e fechar', async () => {
        const ir = await compilar([
            'var rede = importar("rede")',
            'var servidor = rede.escutar("127.0.0.1", 0)',
            'var porta = rede.portaLocal(servidor)',
            'var conexao = rede.aceitar(servidor, 120000)',
            'var requisicao = rede.lerAte(conexao, "\\r\\n\\r\\n", 65536, 5000)',
            'rede.escrever(conexao, "HTTP/1.1 200 OK\\r\\n\\r\\n")',
            'rede.fechar(conexao)',
            'escreva(porta)',
            'escreva(requisicao)',
        ]);
        expect(ir).toMatch(/call ptr @delegua_rede_escutar\(ptr getelementptr inbounds \(\{[^}]*\}, ptr @texto_arc_\d+, i32 0, i32 3, i32 0\), i32 0\)/);
        expect(ir).toMatch(/call i32 @delegua_rede_porta_local\(ptr %ponteiro_val\d*\)/);
        expect(ir).toMatch(/call ptr @delegua_rede_aceitar\(ptr %ponteiro_val\d*, i32 120000\)/);
        expect(ir).toMatch(/call ptr @delegua_rede_ler_ate\(ptr %ponteiro_val\d*, ptr getelementptr inbounds \(\{[^}]*\}, ptr @texto_arc_\d+, i32 0, i32 3, i32 0\), i32 65536, i32 5000\)/);
        expect(ir).toContain('call i32 @delegua_rede_escrever(');
        expect(ir).toContain('call void @delegua_rede_fechar(');
        // porta é inteiro e requisicao é texto.
        expect(ir).toContain('%porta = alloca i32');
        expect(ir).toContain('%requisicao = alloca ptr');
    });

    it('soquetes são handles ARC: a variável assume a referência, liberada só na saída', async () => {
        const ir = await compilar([
            'var rede = importar("rede")',
            'var servidor = rede.escutar("127.0.0.1", 0)',
            'var conexao = rede.aceitar(servidor, 1000)',
            'rede.fechar(conexao)',
        ]);
        // O +1 do temporário passa para a variável (slot zerado), em vez de o temporário ser
        // liberado no fim da instrução — o que destruía (e fechava) o soquete na hora.
        for (const nome of ['escutar', 'aceitar']) {
            expect(ir).toMatch(
                new RegExp(
                    `(%\\d+) = call ptr @delegua_rede_${nome}\\([^\\n]*\\n\\s+store ptr \\1, ptr (%arc_tmp\\d*)[^\\n]*\\n\\s+store ptr null, ptr \\2`
                )
            );
        }
        expect(ir).toMatch(/%arc_saida\d+ = load ptr, ptr %servidor/);
        expect(ir).toMatch(/%arc_saida\d+ = load ptr, ptr %conexao/);
    });

    it('cliente: conectar, ler e ultimoErro; nulo indica falha', async () => {
        const ir = await compilar([
            'var rede = importar("rede")',
            'var cliente = rede.conectar("exemplo.com", 80, 3000)',
            'se cliente == nulo {',
            '  escreva(rede.ultimoErro())',
            '}',
            'escreva(rede.ler(cliente, 1024, 1000))',
        ]);
        expect(ir).toMatch(/call ptr @delegua_rede_conectar\(ptr getelementptr inbounds \(\{[^}]*\}, ptr @texto_arc_\d+, i32 0, i32 3, i32 0\), i32 80, i32 3000\)/);
        expect(ir).toContain('call ptr @delegua_rede_ultimo_erro()');
        expect(ir).toMatch(/call ptr @delegua_rede_ler\(ptr %ponteiro_val\d*, i32 1024, i32 1000\)/);
    });

    it('codificar e decodificar componentes de URL', async () => {
        const ir = await compilar([
            'var rede = importar("rede")',
            'escreva(rede.codificarComponenteUrl("a b"))',
            'escreva(rede.decodificarComponenteUrl("a%20b"))',
        ]);
        expect(ir).toContain('call ptr @delegua_rede_codificar_componente_url(');
        expect(ir).toContain('call ptr @delegua_rede_decodificar_componente_url(');
    });

    it('liga ws2_32 apenas no Windows', () => {
        const windows = obterBibliotecasParaCompilacao(['rede'], '/b', 'windows');
        const linux = obterBibliotecasParaCompilacao(['rede'], '/b', 'linux');
        expect(windows.flagsLink).toContain('-lws2_32');
        expect(linux.flagsLink).not.toContain('-lws2_32');
        expect(linux.arquivosC.some((arquivo) => arquivo.endsWith('rede.c'))).toBe(true);
    });
});

describe('Compilador - módulo tempo', () => {
    it('carimbos de tempo, relógio monotônico e dormir', async () => {
        const ir = await compilar([
            'var tempo = importar("tempo")',
            'var agora = tempo.carimboDeTempoUnix()',
            'var agoraMs = tempo.carimboDeTempoUnixMilissegundos()',
            'var inicio = tempo.monotonicoMilissegundos()',
            'tempo.dormir(10)',
            'escreva(agora)',
            'escreva(agoraMs)',
            'escreva(inicio)',
        ]);
        expect(ir).toContain('call i64 @delegua_tempo_carimbo_unix()');
        expect(ir).toContain('call i64 @delegua_tempo_carimbo_unix_milissegundos()');
        expect(ir).toContain('call i64 @delegua_tempo_monotonico_milissegundos()');
        expect(ir).toContain('call void @delegua_tempo_dormir(i32 10)');
        expect(ir).toContain('%agora = alloca i64');
    });

    it('diferença entre valores longo de módulo é longo, não ponteiro', async () => {
        const ir = await compilar([
            'var tempo = importar("tempo")',
            'var inicio = tempo.monotonicoMilissegundos()',
            'var decorrido = tempo.monotonicoMilissegundos() - inicio',
            'se decorrido >= 100 {',
            '  escreva("ok")',
            '}',
        ]);
        expect(ir).toContain('%decorrido = alloca i64');
        expect(ir).not.toMatch(/sitofp ptr/);
    });
});
