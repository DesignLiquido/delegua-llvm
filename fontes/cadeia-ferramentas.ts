import { spawnSync } from 'child_process';

import { AlvoCompilacao, ajustarAlvoParaZig, alvoDaMaquinaAtual, resolverAlvo } from './alvos';

/**
 * Montagem dos comandos do compilador C (clang ou `zig cc`) usados pelo ilc para compilar
 * o runtime e ligar o binário, nativo ou para outro alvo. Funções puras (exceto a detecção
 * de programas no PATH), para poderem ser testadas sem executar nada.
 */

export interface CadeiaFerramentas {
    alvo: AlvoCompilacao;
    // Verdadeiro quando o alvo difere da máquina atual.
    cruzada: boolean;
    // Comando do compilador C, já separado em argumentos (ex.: ['zig', 'cc']).
    compiladorC: string[];
    ehZig: boolean;
    sysroot?: string;
}

export interface OpcoesCadeiaFerramentas {
    // Nome do alvo (`linux-arm64`...). Vazio ou ausente: máquina atual.
    alvo?: string;
    // Compilador C explícito (`clang`, `zig cc`...). Ausente: detectado.
    compiladorC?: string;
    sysroot?: string;
    // Para testes: diz se um programa está no PATH.
    existeNoPath?: (programa: string) => boolean;
    plataforma?: string;
    arquitetura?: string;
}

/** Verdadeiro se `programa` executa (procura no PATH). */
export function programaDisponivel(programa: string): boolean {
    const argumento = programa === 'zig' ? 'version' : '--version';
    const resultado = spawnSync(programa, [argumento], { stdio: 'ignore', shell: false });
    return !resultado.error && resultado.status === 0;
}

/**
 * Decide alvo e compilador C.
 *   - Compilação nativa: `clang`, como antes.
 *   - Compilação cruzada: `zig cc` se o zig estiver instalado (traz a biblioteca C de cada
 *     alvo); senão `clang --target`, que precisa de `--sysroot` com as bibliotecas do alvo.
 */
export function resolverCadeiaFerramentas(opcoes: OpcoesCadeiaFerramentas = {}): CadeiaFerramentas {
    const existeNoPath = opcoes.existeNoPath ?? programaDisponivel;
    const nativo = alvoDaMaquinaAtual(opcoes.plataforma, opcoes.arquitetura);
    const alvoPedido = opcoes.alvo ? resolverAlvo(opcoes.alvo) : nativo;
    if (!alvoPedido) {
        throw new Error('Não foi possível determinar o alvo da máquina atual; informe --alvo.');
    }
    const cruzada = !nativo || alvoPedido.nome !== nativo.nome;

    let compiladorC: string[];
    if (opcoes.compiladorC && opcoes.compiladorC.trim()) {
        compiladorC = opcoes.compiladorC.trim().split(/\s+/);
    } else if (cruzada && existeNoPath('zig')) {
        compiladorC = ['zig', 'cc'];
    } else {
        compiladorC = ['clang'];
    }
    const ehZig = compiladorC[0].replace(/\.exe$/i, '').endsWith('zig');

    return {
        alvo: ehZig ? ajustarAlvoParaZig(alvoPedido) : alvoPedido,
        cruzada,
        compiladorC,
        ehZig,
        sysroot: opcoes.sysroot || undefined,
    };
}

/** Argumentos que selecionam o alvo no compilador C. */
export function argumentosAlvo(cadeia: CadeiaFerramentas): string[] {
    if (cadeia.ehZig) {
        // zig cc sempre recebe o alvo: sem ele, usaria a ABI própria da máquina atual.
        return ['-target', cadeia.alvo.triploZig];
    }
    const argumentos = cadeia.cruzada ? [`--target=${cadeia.alvo.triplo}`] : [];
    if (cadeia.sysroot) argumentos.push(`--sysroot=${cadeia.sysroot}`);
    return argumentos;
}

/**
 * Bibliotecas adicionais exigidas pelo runtime em qualquer alvo. Vazio: as exceções usam
 * setjmp/longjmp da biblioteca C (excecoes.c), sem a ABI de exceções de C++.
 */
export function bibliotecasSuporteExecucao(_cadeia: CadeiaFerramentas): string[] {
    return [];
}

/** Comando para compilar um arquivo C do runtime ou de um pacote em objeto. */
export function comandoCompilarObjeto(
    cadeia: CadeiaFerramentas,
    arquivoC: string,
    objeto: string,
    otimizacao: string,
    diretoriosInclusao: string[] = []
): [string, string[]] {
    const [programa, ...prefixo] = cadeia.compiladorC;
    const inclusoes = diretoriosInclusao.flatMap((diretorio) => ['-I', diretorio]);
    return [programa, [...prefixo, ...argumentosAlvo(cadeia), otimizacao, ...inclusoes, '-c', arquivoC, '-o', objeto]];
}

/** Comando para gerar o binário a partir do IR e dos objetos. */
export function comandoLigar(
    cadeia: CadeiaFerramentas,
    arquivoIr: string,
    objetos: string[],
    flagsLink: string[],
    saida: string,
    flagsOtimizacao: string[]
): [string, string[]] {
    const [programa, ...prefixo] = cadeia.compiladorC;
    const avisos = cadeia.cruzada ? ['-Wno-override-module'] : [];
    const bibliotecas = [...flagsLink];
    for (const biblioteca of bibliotecasSuporteExecucao(cadeia)) {
        if (!bibliotecas.includes(biblioteca)) bibliotecas.push(biblioteca);
    }
    return [
        programa,
        [...prefixo, ...argumentosAlvo(cadeia), ...avisos, ...flagsOtimizacao, arquivoIr, ...objetos, ...bibliotecas, '-o', saida],
    ];
}

/**
 * Prepara o IR para o compilador C do alvo: na compilação cruzada, remove o data layout
 * (o compilador C usa o do próprio alvo, que pode ter outra grafia na sua versão do LLVM).
 */
export function prepararIrParaAlvo(ir: string, cadeia: CadeiaFerramentas): string {
    if (!cadeia.cruzada) return ir;
    return ir.replace(/^target datalayout = .*\r?\n/m, '');
}

/** Representação legível do comando, para mensagens. */
export function descreverComando([programa, argumentos]: [string, string[]]): string {
    return [programa, ...argumentos].map((parte) => (/\s/.test(parte) ? `"${parte}"` : parte)).join(' ');
}

/**
 * Versão maior do LLVM do compilador C (`clang version 19.1.3` → 19), ou undefined se não
 * for possível determinar.
 */
export function detectarVersaoLlvm(cadeia: CadeiaFerramentas): number | undefined {
    const [programa, ...prefixo] = cadeia.compiladorC;
    const resultado = spawnSync(programa, [...prefixo, '--version'], { encoding: 'utf-8', shell: false });
    if (resultado.error || resultado.status !== 0) return undefined;
    const correspondencia = /clang version (\d+)/.exec(String(resultado.stdout));
    return correspondencia ? Number(correspondencia[1]) : undefined;
}

/**
 * Reescreve sintaxe do IR mais nova que o LLVM do compilador C (o LLVM das ligações pode
 * ser mais novo que o clang/zig instalado). Versão desconhecida: aplica todas as reescritas.
 *   - `captures(none)` (LLVM 21+) → `nocapture`;
 *   - `nocreateundeforpoison` (LLVM 22+, só uma dica de otimização em intrínsecos) é removido.
 */
export function compatibilizarIrComLlvm(ir: string, versaoMaior?: number): string {
    let resultado = ir;
    if (versaoMaior === undefined || versaoMaior < 21) {
        resultado = resultado.replace(/captures\(none\)/g, 'nocapture');
    }
    if (versaoMaior === undefined || versaoMaior < 22) {
        resultado = resultado.replace(/ nocreateundeforpoison\b/g, '');
    }
    return resultado;
}
