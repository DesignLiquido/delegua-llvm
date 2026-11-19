/**
 * Alvos de compilação (sistema operacional + arquitetura) suportados pelo `--alvo`.
 *
 * Cada alvo define o triplo LLVM usado no IR e pelo clang, o triplo equivalente do
 * `zig cc` (que traz a biblioteca C de cada alvo e por isso permite compilação cruzada
 * sem instalar nada além do zig) e a disposição de memória (data layout) usada para
 * calcular tamanhos de estruturas quando o LLVM das ligações não tem o backend do alvo.
 */

export type SistemaAlvo = 'windows' | 'linux' | 'darwin';
export type ArquiteturaAlvo = 'amd64' | 'arm64' | 'riscv64';

export interface AlvoCompilacao {
    // Nome no formato <sistema>-<arquitetura>, como nos binários de release (ex.: linux-arm64).
    nome: string;
    sistema: SistemaAlvo;
    arquitetura: ArquiteturaAlvo;
    // Triplo LLVM do IR e do clang.
    triplo: string;
    // Triplo para `zig cc -target`.
    triploZig: string;
    // Disposição de memória do alvo (sizeof/alinhamento). Usada quando não há backend.
    layoutDados: string;
    extensaoExecutavel: string;
    // Função de personalidade das exceções (landingpad).
    personalidadeExcecoes: string;
}

const LAYOUT_X86_64_ELF = 'e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128';
const LAYOUT_X86_64_COFF = 'e-m:w-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128';
const LAYOUT_X86_64_MACHO = 'e-m:o-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128';
const LAYOUT_AARCH64_ELF = 'e-m:e-p270:32:32-p271:32:32-p272:64:64-i8:8:32-i16:16:32-i64:64-i128:128-n32:64-S128-Fn32';
const LAYOUT_AARCH64_MACHO = 'e-m:o-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-n32:64-S128-Fn32';
const LAYOUT_AARCH64_COFF = 'e-m:w-p270:32:32-p271:32:32-p272:64:64-p:64:64-i32:32-i64:64-i128:128-n32:64-S128-Fn32';
const LAYOUT_RISCV64_ELF = 'e-m:e-p:64:64-i64:64-i128:128-n32:64-S128';

const PERSONALIDADE_ITANIUM = '__gxx_personality_v0';
// MinGW (Windows com ABI GNU, usada pelo zig) desempilha exceções via SEH.
const PERSONALIDADE_SEH = '__gxx_personality_seh0';

/**
 * Alvos conhecidos. No Windows, o triplo padrão é a ABI MSVC (clang nativo com as
 * bibliotecas do Visual Studio); com `zig cc`, a ABI GNU (MinGW) — ver ajustarAlvoParaZig.
 */
export const ALVOS: AlvoCompilacao[] = [
    {
        nome: 'linux-amd64',
        sistema: 'linux',
        arquitetura: 'amd64',
        triplo: 'x86_64-unknown-linux-gnu',
        triploZig: 'x86_64-linux-gnu',
        layoutDados: LAYOUT_X86_64_ELF,
        extensaoExecutavel: '',
        personalidadeExcecoes: PERSONALIDADE_ITANIUM,
    },
    {
        nome: 'linux-arm64',
        sistema: 'linux',
        arquitetura: 'arm64',
        triplo: 'aarch64-unknown-linux-gnu',
        triploZig: 'aarch64-linux-gnu',
        layoutDados: LAYOUT_AARCH64_ELF,
        extensaoExecutavel: '',
        personalidadeExcecoes: PERSONALIDADE_ITANIUM,
    },
    {
        nome: 'linux-riscv64',
        sistema: 'linux',
        arquitetura: 'riscv64',
        triplo: 'riscv64-unknown-linux-gnu',
        triploZig: 'riscv64-linux-gnu',
        layoutDados: LAYOUT_RISCV64_ELF,
        extensaoExecutavel: '',
        personalidadeExcecoes: PERSONALIDADE_ITANIUM,
    },
    {
        nome: 'darwin-amd64',
        sistema: 'darwin',
        arquitetura: 'amd64',
        triplo: 'x86_64-apple-macosx11.0.0',
        triploZig: 'x86_64-macos',
        layoutDados: LAYOUT_X86_64_MACHO,
        extensaoExecutavel: '',
        personalidadeExcecoes: PERSONALIDADE_ITANIUM,
    },
    {
        nome: 'darwin-arm64',
        sistema: 'darwin',
        arquitetura: 'arm64',
        triplo: 'arm64-apple-macosx11.0.0',
        triploZig: 'aarch64-macos',
        layoutDados: LAYOUT_AARCH64_MACHO,
        extensaoExecutavel: '',
        personalidadeExcecoes: PERSONALIDADE_ITANIUM,
    },
    {
        nome: 'windows-amd64',
        sistema: 'windows',
        arquitetura: 'amd64',
        triplo: 'x86_64-pc-windows-msvc',
        triploZig: 'x86_64-windows-gnu',
        layoutDados: LAYOUT_X86_64_COFF,
        extensaoExecutavel: '.exe',
        personalidadeExcecoes: PERSONALIDADE_ITANIUM,
    },
    {
        nome: 'windows-arm64',
        sistema: 'windows',
        arquitetura: 'arm64',
        triplo: 'aarch64-pc-windows-msvc',
        triploZig: 'aarch64-windows-gnu',
        layoutDados: LAYOUT_AARCH64_COFF,
        extensaoExecutavel: '.exe',
        personalidadeExcecoes: PERSONALIDADE_ITANIUM,
    },
];

// Apelidos aceitos além de <sistema>-<arquitetura> (como GOOS/GOARCH e nomes comuns).
const APELIDOS_SISTEMA: { [apelido: string]: SistemaAlvo } = {
    linux: 'linux',
    windows: 'windows',
    win: 'windows',
    darwin: 'darwin',
    macos: 'darwin',
    mac: 'darwin',
};
const APELIDOS_ARQUITETURA: { [apelido: string]: ArquiteturaAlvo } = {
    amd64: 'amd64',
    x64: 'amd64',
    x86_64: 'amd64',
    arm64: 'arm64',
    aarch64: 'arm64',
    riscv64: 'riscv64',
};

export function nomesAlvos(): string[] {
    return ALVOS.map((alvo) => alvo.nome);
}

/**
 * Resolve um nome de alvo (`linux-arm64`, `macos-aarch64`, `windows-x64`...).
 * Lança erro com a lista de alvos válidos se o nome não for reconhecido.
 */
export function resolverAlvo(nome: string): AlvoCompilacao {
    const [sistemaInformado, arquiteturaInformada, ...resto] = String(nome).trim().toLowerCase().split('-');
    const sistema = APELIDOS_SISTEMA[sistemaInformado];
    const arquitetura = APELIDOS_ARQUITETURA[arquiteturaInformada];
    const alvo = resto.length === 0 ? ALVOS.find((a) => a.sistema === sistema && a.arquitetura === arquitetura) : undefined;
    if (!alvo) {
        throw new Error(`Alvo desconhecido: '${nome}'. Alvos disponíveis: ${nomesAlvos().join(', ')}.`);
    }
    return { ...alvo };
}

/**
 * Alvo correspondente à máquina atual (process.platform / process.arch), ou undefined
 * se a combinação não está na tabela.
 */
export function alvoDaMaquinaAtual(
    plataforma: string = process.platform,
    arquiteturaProcesso: string = process.arch
): AlvoCompilacao | undefined {
    const sistema: SistemaAlvo | undefined =
        plataforma === 'win32' ? 'windows' : plataforma === 'darwin' ? 'darwin' : plataforma === 'linux' ? 'linux' : undefined;
    const arquitetura: ArquiteturaAlvo | undefined =
        arquiteturaProcesso === 'x64' ? 'amd64' : arquiteturaProcesso === 'arm64' ? 'arm64' : arquiteturaProcesso === 'riscv64' ? 'riscv64' : undefined;
    const alvo = ALVOS.find((a) => a.sistema === sistema && a.arquitetura === arquitetura);
    return alvo ? { ...alvo } : undefined;
}

/**
 * Com `zig cc`, o Windows usa a ABI GNU (MinGW): o triplo do IR passa a ser o do zig
 * e as exceções usam a personalidade SEH.
 */
export function ajustarAlvoParaZig(alvo: AlvoCompilacao): AlvoCompilacao {
    if (alvo.sistema !== 'windows') return { ...alvo };
    const arquiteturaLlvm = alvo.arquitetura === 'arm64' ? 'aarch64' : 'x86_64';
    return {
        ...alvo,
        triplo: `${arquiteturaLlvm}-w64-windows-gnu`,
        personalidadeExcecoes: PERSONALIDADE_SEH,
    };
}

/** Prefixo de arquitetura do triplo, para saber se o LLVM das ligações tem o backend. */
export function arquiteturaLlvmDoTriplo(triplo: string): string {
    return triplo.split('-')[0];
}
