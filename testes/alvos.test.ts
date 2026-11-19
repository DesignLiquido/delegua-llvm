/// <reference types="jest" />
import { ajustarAlvoParaZig, alvoDaMaquinaAtual, nomesAlvos, resolverAlvo } from '../fontes/alvos';
import {
    argumentosAlvo,
    compatibilizarIrComLlvm,
    bibliotecasSuporteExecucao,
    comandoCompilarObjeto,
    comandoLigar,
    prepararIrParaAlvo,
    resolverCadeiaFerramentas,
} from '../fontes/cadeia-ferramentas';
import { CompiladorLLVM } from '../fontes/compilador-llvm';

const semZig = () => false;
const comZig = (programa: string) => programa === 'zig';
const naMaquina = { plataforma: 'win32', arquitetura: 'x64' };

describe('alvos', () => {
    it('resolve nomes <sistema>-<arquitetura> e apelidos', () => {
        expect(resolverAlvo('linux-arm64').triplo).toBe('aarch64-unknown-linux-gnu');
        expect(resolverAlvo('macos-aarch64').nome).toBe('darwin-arm64');
        expect(resolverAlvo('windows-x64').nome).toBe('windows-amd64');
        expect(resolverAlvo('Linux-X86_64').nome).toBe('linux-amd64');
    });

    it('rejeita alvo desconhecido listando os disponíveis', () => {
        expect(() => resolverAlvo('solaris-sparc')).toThrow(`Alvo desconhecido: 'solaris-sparc'. Alvos disponíveis: ${nomesAlvos().join(', ')}.`);
        expect(() => resolverAlvo('linux-arm64-extra')).toThrow('Alvo desconhecido');
    });

    it('identifica a máquina atual', () => {
        expect(alvoDaMaquinaAtual('win32', 'x64').nome).toBe('windows-amd64');
        expect(alvoDaMaquinaAtual('darwin', 'arm64').nome).toBe('darwin-arm64');
        expect(alvoDaMaquinaAtual('linux', 'riscv64').nome).toBe('linux-riscv64');
        expect(alvoDaMaquinaAtual('aix', 'ppc64')).toBeUndefined();
    });

    it('com zig, Windows usa a ABI GNU e personalidade SEH', () => {
        const alvo = ajustarAlvoParaZig(resolverAlvo('windows-arm64'));
        expect(alvo.triplo).toBe('aarch64-w64-windows-gnu');
        expect(alvo.personalidadeExcecoes).toBe('__gxx_personality_seh0');
        expect(ajustarAlvoParaZig(resolverAlvo('linux-amd64')).triplo).toBe('x86_64-unknown-linux-gnu');
    });
});

describe('cadeia de ferramentas', () => {
    it('nativo: clang sem argumentos de alvo, mesmo com zig instalado', () => {
        const cadeia = resolverCadeiaFerramentas({ ...naMaquina, existeNoPath: comZig });
        expect(cadeia.cruzada).toBe(false);
        expect(cadeia.compiladorC).toEqual(['clang']);
        expect(argumentosAlvo(cadeia)).toEqual([]);
        expect(bibliotecasSuporteExecucao(cadeia)).toEqual([]);
    });

    it('nativo no Linux liga a biblioteca de exceções C++ (__cxa_throw do runtime)', () => {
        const cadeia = resolverCadeiaFerramentas({ plataforma: 'linux', arquitetura: 'x64', existeNoPath: semZig });
        expect(bibliotecasSuporteExecucao(cadeia)).toEqual(['-lstdc++']);
    });

    it('cruzada com zig instalado: zig cc -target', () => {
        const cadeia = resolverCadeiaFerramentas({ ...naMaquina, alvo: 'linux-arm64', existeNoPath: comZig });
        expect(cadeia.cruzada).toBe(true);
        expect(cadeia.compiladorC).toEqual(['zig', 'cc']);
        expect(argumentosAlvo(cadeia)).toEqual(['-target', 'aarch64-linux-gnu']);
        expect(bibliotecasSuporteExecucao(cadeia)).toEqual(['-lc++']);
    });

    it('cruzada sem zig: clang --target e --sysroot', () => {
        const cadeia = resolverCadeiaFerramentas({
            ...naMaquina,
            alvo: 'darwin-arm64',
            sysroot: '/sdk/MacOSX.sdk',
            existeNoPath: semZig,
        });
        expect(cadeia.compiladorC).toEqual(['clang']);
        expect(argumentosAlvo(cadeia)).toEqual(['--target=arm64-apple-macosx11.0.0', '--sysroot=/sdk/MacOSX.sdk']);
        expect(bibliotecasSuporteExecucao(cadeia)).toEqual(['-lc++']);
    });

    it('compilador C explícito tem prioridade; zig explícito no nativo também usa -target', () => {
        const explicito = resolverCadeiaFerramentas({ ...naMaquina, alvo: 'linux-amd64', compiladorC: 'clang-19', existeNoPath: comZig });
        expect(explicito.compiladorC).toEqual(['clang-19']);
        const zigNativo = resolverCadeiaFerramentas({ ...naMaquina, compiladorC: 'zig cc' });
        expect(zigNativo.cruzada).toBe(false);
        expect(zigNativo.alvo.triplo).toBe('x86_64-w64-windows-gnu');
        expect(argumentosAlvo(zigNativo)).toEqual(['-target', 'x86_64-windows-gnu']);
    });

    it('monta os comandos de compilação de objeto e de ligação', () => {
        const cadeia = resolverCadeiaFerramentas({ ...naMaquina, alvo: 'linux-arm64', existeNoPath: comZig });
        expect(comandoCompilarObjeto(cadeia, 'padrao.c', 'padrao.o', '-O2', ['inc'])).toEqual([
            'zig',
            ['cc', '-target', 'aarch64-linux-gnu', '-O2', '-I', 'inc', '-c', 'padrao.c', '-o', 'padrao.o'],
        ]);
        expect(comandoLigar(cadeia, 'p.ll', ['a.o'], ['-lm'], 'p', ['-O2'])).toEqual([
            'zig',
            ['cc', '-target', 'aarch64-linux-gnu', '-Wno-override-module', '-O2', 'p.ll', 'a.o', '-lm', '-lc++', '-o', 'p'],
        ]);
    });

    it('remove o data layout do IR apenas na compilação cruzada', () => {
        const ir = 'target datalayout = "e-m:w"\ntarget triple = "x"\n';
        const cruzada = resolverCadeiaFerramentas({ ...naMaquina, alvo: 'linux-amd64', existeNoPath: semZig });
        const nativa = resolverCadeiaFerramentas({ ...naMaquina, existeNoPath: semZig });
        expect(prepararIrParaAlvo(ir, cruzada)).toBe('target triple = "x"\n');
        expect(prepararIrParaAlvo(ir, nativa)).toBe(ir);
    });
});

describe('compilador com alvo', () => {
    async function compilarPara(nomeAlvo: string, linhas: string[], zig = false): Promise<string> {
        const compilador = new CompiladorLLVM();
        compilador.alvo = zig ? ajustarAlvoParaZig(resolverAlvo(nomeAlvo)) : resolverAlvo(nomeAlvo);
        return await compilador.compilar(linhas, true);
    }

    it('usa o triplo e a disposição de memória do alvo, mesmo sem o backend nas ligações', async () => {
        const ir = await compilarPara('linux-arm64', ['escreva("ok")']);
        expect(ir).toContain('target triple = "aarch64-unknown-linux-gnu"');
        expect(ir).toContain(`target datalayout = "${resolverAlvo('linux-arm64').layoutDados}"`);
    });

    it('alvo de mesma arquitetura usa o backend das ligações', async () => {
        const ir = await compilarPara('linux-amd64', ['escreva("ok")']);
        expect(ir).toContain('target triple = "x86_64-unknown-linux-gnu"');
        expect(ir).toContain('target datalayout = "e-m:e-');
    });

    it('tamanhoEmBytes é calculado para o alvo', async () => {
        const ir = await compilarPara('darwin-arm64', [
            'classe estrangeira Par {',
            '  a: byte',
            '  b: longo',
            '}',
            'escreva(Par.tamanhoEmBytes())',
        ]);
        expect(ir).toMatch(/@escreva\(ptr @fmt[.\d]*, i32 16\)/);
    });

    it('Windows com zig usa a personalidade SEH nas exceções', async () => {
        const ir = await compilarPara(
            'windows-amd64',
            ['tente {', '  falhar("x")', '} pegue {', '  escreva("pego")', '}'],
            true
        );
        expect(ir).toContain('target triple = "x86_64-w64-windows-gnu"');
        expect(ir).toContain('personality ptr @__gxx_personality_seh0');
        expect(ir).not.toContain('__gxx_personality_v0');
    });
});

describe('compatibilidade do IR com o LLVM do compilador C', () => {
    const ir = 'declare void @f(ptr captures(none)) #0\nattributes #0 = { nounwind nocreateundeforpoison }';

    it('LLVM antigo (clang 19): reescreve captures(none) e remove nocreateundeforpoison', () => {
        expect(compatibilizarIrComLlvm(ir, 19)).toBe('declare void @f(ptr nocapture) #0\nattributes #0 = { nounwind }');
    });

    it('LLVM 21: mantém captures(none), remove nocreateundeforpoison', () => {
        expect(compatibilizarIrComLlvm(ir, 21)).toBe('declare void @f(ptr captures(none)) #0\nattributes #0 = { nounwind }');
    });

    it('LLVM 22 ou mais novo: IR intacto; versão desconhecida: todas as reescritas', () => {
        expect(compatibilizarIrComLlvm(ir, 22)).toBe(ir);
        expect(compatibilizarIrComLlvm(ir, undefined)).toBe(compatibilizarIrComLlvm(ir, 19));
    });
});

describe('correções encontradas na compilação cruzada', () => {
    async function compilar(linhas: string[]): Promise<string> {
        return await new CompiladorLLVM().compilar(linhas, false);
    }

    it('var com tamanhoEmBytes() é inteiro e compara como número', async () => {
        const ir = await compilar([
            'classe estrangeira Par {',
            '  a: inteiro',
            '}',
            'var t = Par.tamanhoEmBytes()',
            'se t == 4 {',
            '  escreva(t)',
            '}',
        ]);
        expect(ir).toContain('%t = alloca i32');
        expect(ir).not.toMatch(/call i32 @strcmp/);
    });

    it('comparação usa o tipo da variável no escopo, não o palpite do AST', async () => {
        const ir = await compilar([
            '@definicao(biblioteca="nativo")',
            'classe estrangeira C {',
            '  f(): inteiro',
            '}',
            'var a = C.f()',
            'var b = 2',
            'se a == b {',
            '  escreva("igual")',
            '}',
        ]);
        expect(ir).not.toMatch(/call i32 @strcmp/);
    });

    it('método chamado em texto literal recebe o char* numa caixa', async () => {
        const ir = await compilar(['escreva("ab".maiusculo())']);
        expect(ir).toMatch(/store ptr @str[.\d]*, ptr %texto_slot/);
        expect(ir).toMatch(/%load_texto = load ptr, ptr %texto_slot/);
    });
});
