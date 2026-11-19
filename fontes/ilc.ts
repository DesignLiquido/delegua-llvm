#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { execFileSync, execSync } from 'child_process';

import { registrar } from '@designliquido/delprops';

import { CompiladorLLVM } from './compilador-llvm';
import { detectarModulosImportados, obterBibliotecasParaCompilacao } from './bibliotecas-compilacao';
import esquemaCompilacao from './esquemas/compilacao';
import { ErroCompilador } from './erros/erro-compilador';
import { ALVOS } from './alvos';
import {
    CadeiaFerramentas,
    compatibilizarIrComLlvm,
    comandoCompilarObjeto,
    detectarVersaoLlvm,
    comandoLigar,
    descreverComando,
    prepararIrParaAlvo,
    resolverCadeiaFerramentas,
} from './cadeia-ferramentas';

registrar('compilacao', '@designliquido/delegua-llvm', esquemaCompilacao);

function lerConfiguracaoDelprops(diretorio: string): Record<string, string> {
    const caminhoConfig = path.join(diretorio, 'configuracao.delprops');
    if (!fs.existsSync(caminhoConfig)) return {};

    const resultado: Record<string, string> = {};
    const linhas = fs.readFileSync(caminhoConfig, 'utf-8').split(/\r?\n/);
    for (const linha of linhas) {
        const aparado = linha.trim();
        if (!aparado || aparado.startsWith('#')) continue;
        const indice = aparado.indexOf('=');
        if (indice === -1) continue;
        const chave = aparado.slice(0, indice).trim();
        const valor = aparado.slice(indice + 1).trim();
        resultado[chave] = valor;
    }
    return resultado;
}

const LOGO = `
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║     ██████╗ ███████╗██╗     ███████╗ ██████╗ ██╗   ██╗ █████╗    ║
║     ██╔══██╗██╔════╝██║     ██╔════╝██╔════╝ ██║   ██║██╔══██╗   ║
║     ██║  ██║█████╗  ██║     █████╗  ██║  ███╗██║   ██║███████║   ║
║     ██║  ██║██╔══╝  ██║     ██╔══╝  ██║   ██║██║   ██║██╔══██║   ║
║     ██████╔╝███████╗███████╗███████╗╚██████╔╝╚██████╔╝██║  ██║   ║
║     ╚═════╝ ╚══════╝╚══════╝╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝   ║
║                                                                  ║
║                    ██╗     ██╗    ██╗   ██╗███╗   ███╗           ║
║                    ██║     ██║    ██║   ██║████╗ ████║           ║
║                    ██║     ██║    ██║   ██║██╔████╔██║           ║
║                    ██║     ██║    ╚██╗ ██╔╝██║╚██╔╝██║           ║
║                    ███████╗███████╗╚████╔╝ ██║ ╚═╝ ██║           ║
║                    ╚══════╝╚══════╝ ╚═══╝  ╚═╝     ╚═╝           ║
║                                                                  ║
║              Compilador Delégua → LLVM → Nativo                  ║
║                         v9.2.0                                   ║
╚══════════════════════════════════════════════════════════════════╝
`;

const CORES = {
    reset: '\x1b[0m',
    verde: '\x1b[32m',
    amarelo: '\x1b[33m',
    azul: '\x1b[34m',
    magenta: '\x1b[35m',
    ciano: '\x1b[36m',
    vermelho: '\x1b[31m',
    negrito: '\x1b[1m',
};

function taquigrafar(mensagem: string, cor: string = CORES.reset) {
    console.log(`${cor}${mensagem}${CORES.reset}`);
}

function taquigrafarEtapa(etapa: string) {
    console.log(`\n${CORES.ciano}${CORES.negrito}▶ ${etapa}${CORES.reset}`);
}

function taquigrafarSucesso(mensagem: string) {
    console.log(`${CORES.verde}  ✓ ${mensagem}${CORES.reset}`);
}

function taquigrafarInfo(mensagem: string) {
    console.log(`${CORES.azul}  ℹ ${mensagem}${CORES.reset}`);
}

function taquigrafarErro(mensagem: string) {
    console.log(`${CORES.vermelho}  ✗ ${mensagem}${CORES.reset}`);
}

function exibirErroCompilador(erro: ErroCompilador, nomeArquivo: string, linhasCodigo: string[]) {
    console.log('');
    console.log(`${CORES.vermelho}${CORES.negrito}erro${CORES.reset}${CORES.negrito}: ${erro.message}${CORES.reset}`);

    if (erro.linha !== undefined) {
        const arquivoReal = erro.arquivo ?? nomeArquivo;
        let linhasReais = linhasCodigo;
        if (erro.arquivo && erro.arquivo !== nomeArquivo) {
            try {
                linhasReais = fs.readFileSync(erro.arquivo, 'utf-8').split('\n');
            } catch {
                linhasReais = [];
            }
        }
        const col = erro.coluna !== undefined ? `:${erro.coluna}` : '';
        console.log(`${CORES.azul} --> ${CORES.reset}${arquivoReal}:${erro.linha}${col}`);

        const linhaIdx = erro.linha - 1;
        const linhaTexto = linhasReais[linhaIdx];
        if (linhaTexto !== undefined) {
            const numStr = String(erro.linha);
            const pad = ' '.repeat(numStr.length);
            console.log(`${CORES.azul}${pad} |${CORES.reset}`);
            console.log(`${CORES.azul}${numStr} |${CORES.reset} ${linhaTexto}`);

            const colInicio = erro.coluna ?? (linhaTexto.length - linhaTexto.trimStart().length);
            const tam = erro.tamanhoToken ?? 1;
            const setas = `${' '.repeat(colInicio)}${'~'.repeat(tam)}`;
            console.log(`${CORES.azul}${pad} |${CORES.reset} ${CORES.vermelho}${setas}${CORES.reset}`);
            console.log(`${CORES.azul}${pad} |${CORES.reset}`);
        }
    }
    console.log('');
}

function limparArquivosTemporarios(arquivos: string[]) {
    for (const arquivo of arquivos) {
        if (fs.existsSync(arquivo)) {
            fs.unlinkSync(arquivo);
        }
    }
}

// Executa um comando do compilador C. Na compilação cruzada sem zig, uma falha quase
// sempre é falta dos cabeçalhos/bibliotecas do alvo: explica como resolver.
function executarFerramenta(comando: [string, string[]], cadeia: CadeiaFerramentas) {
    try {
        execFileSync(comando[0], comando[1], { stdio: 'pipe' });
    } catch (erro: any) {
        if (cadeia.cruzada && !cadeia.ehZig) {
            taquigrafarErro(
                `Falha ao compilar para ${cadeia.alvo.nome} com ${cadeia.compiladorC.join(' ')}. A compilação cruzada ` +
                    'precisa dos cabeçalhos e bibliotecas C do alvo: instale o zig (https://ziglang.org) para usar ' +
                    '`zig cc` automaticamente, ou informe --sysroot.'
            );
        }
        taquigrafarInfo(`Comando: ${descreverComando(comando)}`);
        throw erro;
    }
}

function determinarCaminhoBinario(diretorioSaida: string, nomeBinario: string, extensaoExecutavel: string): string {
    const nomeComExtensao =
        path.extname(nomeBinario) || !extensaoExecutavel ? nomeBinario : `${nomeBinario}${extensaoExecutavel}`;

    let caminhoBinario = path.join(diretorioSaida, nomeComExtensao);
    if (fs.existsSync(caminhoBinario) && fs.statSync(caminhoBinario).isDirectory()) {
        const extensaoAlternativa = extensaoExecutavel || '.out';
        caminhoBinario = path.join(diretorioSaida, `${nomeBinario}${extensaoAlternativa}`);
    }

    return caminhoBinario;
}

async function principal() {
    console.log(CORES.magenta + LOGO + CORES.reset);

    const args = process.argv.slice(2);

    let arquivoEntradaIlc: string = '';
    let nomeSaida: string = '';
    let emitirDebug: boolean = false;
    let alvoCli: string = '';
    let compiladorCCli: string = '';
    let sysrootCli: string = '';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-o' && args[i + 1]) {
            nomeSaida = args[i + 1];
            i++;
        } else if (args[i] === '--debug' || args[i] === '-g') {
            emitirDebug = true;
        } else if ((args[i] === '--alvo' || args[i] === '--target') && args[i + 1]) {
            alvoCli = args[i + 1];
            i++;
        } else if (args[i] === '--compilador-c' && args[i + 1]) {
            compiladorCCli = args[i + 1];
            i++;
        } else if (args[i] === '--sysroot' && args[i + 1]) {
            sysrootCli = args[i + 1];
            i++;
        } else if (args[i] === '--listar-alvos') {
            taquigrafar('Alvos disponíveis (--alvo):', CORES.amarelo);
            for (const alvo of ALVOS) {
                taquigrafar(`  ${alvo.nome.padEnd(15)} ${alvo.triplo}`, CORES.reset);
            }
            process.exit(0);
        } else if (!arquivoEntradaIlc) {
            arquivoEntradaIlc = args[i];
        }
    }

    const entradaResolvidaCli = arquivoEntradaIlc ? path.resolve(arquivoEntradaIlc) : '';
    const entradaEhDiretorio =
        entradaResolvidaCli && fs.existsSync(entradaResolvidaCli) && fs.statSync(entradaResolvidaCli).isDirectory();

    const diretorioProjeto = entradaEhDiretorio
        ? entradaResolvidaCli
        : arquivoEntradaIlc
          ? path.resolve(path.dirname(arquivoEntradaIlc))
          : process.cwd();

    const configuracao = lerConfiguracaoDelprops(diretorioProjeto);
    const pontoEntradaConfig = configuracao['compilacao.pontoEntrada'];
    emitirDebug = emitirDebug || configuracao['compilacao.emitirDebug'] === 'verdadeiro';

    const arquivoEntrada =
        (!entradaEhDiretorio && arquivoEntradaIlc) ||
        (pontoEntradaConfig ? path.join(diretorioProjeto, pontoEntradaConfig) : '') ||
        path.join(diretorioProjeto, 'inicial.delegua');

    const origemEntrada =
        entradaEhDiretorio || !arquivoEntradaIlc
            ? pontoEntradaConfig
                ? 'configuracao.delprops'
                : 'padrão'
            : 'argumento';

    if (!fs.existsSync(arquivoEntrada)) {
        if (!arquivoEntradaIlc && !pontoEntradaConfig) {
            taquigrafar('Uso:', CORES.amarelo);
            taquigrafar('  npx @designliquido/delegua-llvm <arquivo.delegua>', CORES.reset);
            console.log('');
            taquigrafar('Opções:', CORES.amarelo);
            taquigrafar('  -o <nome>    Nome do binário de saída', CORES.reset);
            taquigrafar('  -g, --debug  Emite símbolos de depuração DWARF no binário', CORES.reset);
            taquigrafar('  --alvo <sistema-arquitetura>  Compila para outro alvo (ex.: linux-arm64); ver --listar-alvos', CORES.reset);
            taquigrafar('  --compilador-c <comando>      Compilador C usado na ligação (padrão: clang; zig cc na compilação cruzada)', CORES.reset);
            taquigrafar('  --sysroot <diretório>         Bibliotecas do alvo, para compilação cruzada com clang', CORES.reset);
            console.log('');
            taquigrafar('Ou adicione compilacao.pontoEntrada em configuracao.delprops.', CORES.reset);
            console.log('');
        } else {
            taquigrafarErro(`Arquivo não encontrado: ${arquivoEntrada}`);
        }
        process.exit(1);
    }

    const nomeBase = path.basename(arquivoEntrada, path.extname(arquivoEntrada));
    const diretorioSaida = path.dirname(arquivoEntrada);

    let cadeia: CadeiaFerramentas;
    try {
        cadeia = resolverCadeiaFerramentas({
            alvo: alvoCli || configuracao['compilacao.alvo'],
            compiladorC: compiladorCCli || configuracao['compilacao.compiladorC'],
            sysroot: sysrootCli || configuracao['compilacao.sysroot'],
        });
    } catch (erro: any) {
        taquigrafarErro(erro.message);
        process.exit(1);
    }

    const nomeSaidaConfig = configuracao['compilacao.arquivoSaida'];
    const nomeBinario = nomeSaida || nomeSaidaConfig || nomeBase;
    const origemNome = nomeSaida ? '-o' : nomeSaidaConfig ? 'configuracao.delprops' : 'nome do arquivo';
    const caminhoBinario = determinarCaminhoBinario(diretorioSaida, nomeBinario, cadeia.alvo.extensaoExecutavel);

    taquigrafarEtapa('Lendo código fonte');
    const conteudo = fs.readFileSync(arquivoEntrada, 'utf-8');
    const codigo = conteudo.split('\n');
    taquigrafarSucesso(`Arquivo: ${arquivoEntrada} (via ${origemEntrada})`);
    taquigrafarInfo(`Linhas: ${codigo.length}`);
    taquigrafarInfo(`Nome de saída: ${nomeBinario} (via ${origemNome})`);
    taquigrafarInfo(
        `Alvo: ${cadeia.alvo.nome} (${cadeia.alvo.triplo})${cadeia.cruzada ? ', compilação cruzada' : ''}, ` +
            `compilador C: ${cadeia.compiladorC.join(' ')}`
    );

    const compilador = new CompiladorLLVM();
    // Na compilação nativa com clang, o compilador usa o triplo padrão do LLVM, como antes.
    if (cadeia.cruzada || cadeia.ehZig) {
        compilador.alvo = cadeia.alvo;
    }
    const arquivosTemporarios: string[] = [];

    try {
        taquigrafarEtapa('Gerando LLVM IR');
        const ir = await compilador.compilar(
            codigo,
            !emitirDebug,
            diretorioSaida,
            path.basename(arquivoEntrada),
            path.dirname(arquivoEntrada),
            emitirDebug
        );

        const irPath = path.join(diretorioSaida, `${nomeBase}.ll`);
        // O LLVM das ligações pode ser mais novo que o do compilador C (clang 19, zig...):
        // reescreve a sintaxe que o compilador C não conhece (ver compatibilizarIrComLlvm).
        const versaoLlvmCompiladorC = detectarVersaoLlvm(cadeia);
        let irCompativel = prepararIrParaAlvo(compatibilizarIrComLlvm(ir, versaoLlvmCompiladorC), cadeia);
        fs.writeFileSync(irPath.replace(/\.ll$/, '_debug.ll'), irCompativel);
        fs.writeFileSync(irPath, irCompativel);
        arquivosTemporarios.push(irPath);
        taquigrafarSucesso(`IR gerado`);

        if (process.env.DELEGUA_DEBUG === 'true') {
            console.log('');
            taquigrafar('=== LLVM IR ===', CORES.amarelo);
            console.log(ir);
            taquigrafar('===============', CORES.amarelo);
        }

        taquigrafarEtapa('Compilando bibliotecas nativas');
        const bibliotecasDir = path.join(__dirname, 'bibliotecas');
        // Módulos importados por qualquer arquivo do programa (inclusive arquivos e pacotes importados).
        const modulos = Array.from(new Set([...detectarModulosImportados(codigo), ...compilador.modulosUtilizados]));
        const { arquivosC, flagsLink } = obterBibliotecasParaCompilacao(modulos, bibliotecasDir);

        // Adiciona flags -l para bibliotecas estrangeiras referenciadas via @definicao
        // e para bibliotecas do sistema declaradas por pacotes ("nativo.bibliotecas").
        for (const lib of [...compilador.bibliotecasEstrangeiras, ...compilador.bibliotecasNativasPacotes]) {
            if (!flagsLink.includes(`-l${lib}`)) flagsLink.push(`-l${lib}`);
        }

        const arquivosObj: string[] = [];
        const nivelOtimizacaoC = emitirDebug ? '-O0' : '-O2';

        for (const arquivoC of arquivosC) {
            const nomeArquivo = path.basename(arquivoC, '.c');
            const objPath = path.join(diretorioSaida, `${nomeArquivo}.o`);

            executarFerramenta(comandoCompilarObjeto(cadeia, arquivoC, objPath, nivelOtimizacaoC), cadeia);
            arquivosObj.push(objPath);
            arquivosTemporarios.push(objPath);
            taquigrafarSucesso(`Compilado: ${path.basename(arquivoC)} → ${path.basename(objPath)}`);
        }

        // Fontes C de pacotes ("nativo.fontes"). Podem incluir os cabeçalhos do runtime
        // (ex.: "vetor.h"). O nome do objeto leva um hash do caminho para não colidir
        // com os objetos do runtime nem com fontes homônimas de outros pacotes.
        for (const arquivoC of compilador.fontesNativasPacotes) {
            const hashCaminho = createHash('sha1').update(arquivoC).digest('hex').slice(0, 8);
            const nomeArquivo = `pacote-${hashCaminho}-${path.basename(arquivoC, '.c')}`;
            const objPath = path.join(diretorioSaida, `${nomeArquivo}.o`);

            executarFerramenta(comandoCompilarObjeto(cadeia, arquivoC, objPath, nivelOtimizacaoC, [bibliotecasDir]), cadeia);
            arquivosObj.push(objPath);
            arquivosTemporarios.push(objPath);
            taquigrafarSucesso(`Compilado (pacote): ${path.relative(diretorioProjeto, arquivoC)} → ${path.basename(objPath)}`);
        }

        taquigrafarEtapa('Linkando binário');
        taquigrafarInfo(`Nível de otimização: ${emitirDebug ? '0' : '2'}`);
        // Em modo de depuração, converte #dbg_declare/#dbg_value (novo formato LLVM 18+) para
        // o formato clássico call void @llvm.dbg.declare/llvm.dbg.value. O clang 19 crasha
        // no X86 Assembly Printer ao processar o novo formato com alvo x86_64-pc-windows-msvc
        // + DWARF. A conversão textual é determinística pois o IR é gerado pelo próprio
        // llvm-bindings com formato conhecido. Tenta opt primeiro (LLVM 18/19); se falhar,
        // aplica a conversão textual como fallback garantido.
        // -gdwarf-4: gera DWARF (não CodeView) para coincidir com os metadados DIBuilder.
        let irParaCompilacao = irPath;
        if (emitirDebug) {
            const irCompatPath = path.join(diretorioSaida, `${nomeBase}_compat.ll`);
            let convertidoViaOpt = false;
            try {
                execSync(`opt -S --no-new-debug-info-format "${irPath}" -o "${irCompatPath}"`, { stdio: 'pipe' });
                irParaCompilacao = irCompatPath;
                arquivosTemporarios.push(irCompatPath);
                convertidoViaOpt = true;
                taquigrafarInfo('Formato de depuração convertido via opt');
            } catch { /* opt não disponível ou não suporta o flag nesta versão */ }

            if (!convertidoViaOpt) {
                // Converte textualmente: #dbg_declare(storage, var, expr, loc)
                //   → call void @llvm.dbg.declare(metadata storage, metadata var, metadata expr), !dbg loc
                const irConvertido = irCompativel
                    .replace(
                        /^\s*#dbg_declare\(\s*([^,]+?),\s*(!\d+),\s*(!DIExpression\([^)]*\)|!\d+),\s*(!\d+)\)\s*$/gm,
                        (_, storage, variable, expression, location) =>
                            `  call void @llvm.dbg.declare(metadata ${storage.trim()}, metadata ${variable}, metadata ${expression}), !dbg ${location}`
                    )
                    .replace(
                        /^\s*#dbg_value\(\s*([^,]+?),\s*(!\d+),\s*(!DIExpression\([^)]*\)|!\d+),\s*(!\d+)\)\s*$/gm,
                        (_, value, variable, expression, location) =>
                            `  call void @llvm.dbg.value(metadata ${value.trim()}, metadata ${variable}, metadata ${expression}), !dbg ${location}`
                    );
                fs.writeFileSync(irCompatPath, irConvertido);
                irParaCompilacao = irCompatPath;
                arquivosTemporarios.push(irCompatPath);
                taquigrafarInfo('Formato de depuração convertido (compatibilidade com clang 19)');
            }
        }
        const flagsOtimizacao = emitirDebug ? ['-O0', '-gdwarf-4'] : ['-O2'];
        executarFerramenta(
            comandoLigar(cadeia, irParaCompilacao, arquivosObj, flagsLink, caminhoBinario, flagsOtimizacao),
            cadeia
        );
        taquigrafarSucesso(`Binário gerado: ${caminhoBinario}`);

        taquigrafarEtapa('Limpando arquivos temporários');
        limparArquivosTemporarios(arquivosTemporarios);
        taquigrafarSucesso(`${arquivosTemporarios.length} arquivos removidos`);

        console.log('');
        console.log(
            `${CORES.verde}${CORES.negrito}════════════════════════════════════════════════════════════════${CORES.reset}`
        );
        console.log(`${CORES.verde}${CORES.negrito}  ✓ Compilação concluída com sucesso!${CORES.reset}`);
        console.log(
            `${CORES.verde}${CORES.negrito}════════════════════════════════════════════════════════════════${CORES.reset}`
        );
        console.log('');
        taquigrafarInfo(`Binário: ${CORES.negrito}${caminhoBinario}${CORES.reset}`);
        taquigrafarInfo(`Para executar: ${CORES.negrito}./${path.relative('.', caminhoBinario)}${CORES.reset}`);
        console.log('');
    } catch (error: any) {
        if (error instanceof ErroCompilador) {
            exibirErroCompilador(error, arquivoEntrada, codigo);
        } else {
            taquigrafarErro('Erro interno durante compilação:');
            console.error(error.message || error);
            if (error.stack) {
                console.error(error.stack);
            }
        }

        taquigrafarEtapa('Limpando arquivos temporários');
        limparArquivosTemporarios(arquivosTemporarios);

        process.exit(1);
    }
}

principal();
