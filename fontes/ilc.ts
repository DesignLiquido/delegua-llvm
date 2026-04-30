#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

import { registrar } from '@designliquido/delprops';

import { CompiladorLLVM } from './compilador-llvm';
import { detectarModulosImportados, obterBibliotecasParaCompilacao } from './bibliotecas-compilacao';
import esquemaCompilacao from './esquemas/compilacao';

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
║                         v9.0.0                                   ║
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

function limparArquivosTemporarios(arquivos: string[]) {
    for (const arquivo of arquivos) {
        if (fs.existsSync(arquivo)) {
            fs.unlinkSync(arquivo);
        }
    }
}

function determinarCaminhoBinario(diretorioSaida: string, nomeBinario: string): string {
    const extensaoExecutavel = process.platform === 'win32' ? '.exe' : '';
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

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-o' && args[i + 1]) {
            nomeSaida = args[i + 1];
            i++;
        } else if (args[i] === '--debug' || args[i] === '-g') {
            emitirDebug = true;
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

    const nomeSaidaConfig = configuracao['compilacao.arquivoSaida'];
    const nomeBinario = nomeSaida || nomeSaidaConfig || nomeBase;
    const origemNome = nomeSaida ? '-o' : nomeSaidaConfig ? 'configuracao.delprops' : 'nome do arquivo';
    const caminhoBinario = determinarCaminhoBinario(diretorioSaida, nomeBinario);

    taquigrafarEtapa('Lendo código fonte');
    const conteudo = fs.readFileSync(arquivoEntrada, 'utf-8');
    const codigo = conteudo.split('\n');
    taquigrafarSucesso(`Arquivo: ${arquivoEntrada} (via ${origemEntrada})`);
    taquigrafarInfo(`Linhas: ${codigo.length}`);
    taquigrafarInfo(`Nome de saída: ${nomeBinario} (via ${origemNome})`);

    const compilador = new CompiladorLLVM();
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
        // clang 19 uses `nocapture`; LLVM 20+ IR uses `captures(none)`.
        const irCompativel = ir.replace(/captures\(none\)/g, 'nocapture');
        fs.writeFileSync(irPath, irCompativel);
        fs.writeFileSync(irPath.replace(/\.ll$/, '_debug.ll'), irCompativel);
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
        const modulos = detectarModulosImportados(codigo);
        const { arquivosC, flagsLink } = obterBibliotecasParaCompilacao(modulos, bibliotecasDir);
        const arquivosObj: string[] = [];

        for (const arquivoC of arquivosC) {
            const nomeArquivo = path.basename(arquivoC, '.c');
            const objPath = path.join(diretorioSaida, `${nomeArquivo}.o`);

            execSync(`clang -O2 -c "${arquivoC}" -o "${objPath}"`, { stdio: 'pipe' });
            arquivosObj.push(objPath);
            arquivosTemporarios.push(objPath);
            taquigrafarSucesso(`Compilado: ${path.basename(arquivoC)} → ${path.basename(objPath)}`);
        }

        taquigrafarEtapa('Linkando binário');
        const objetosStr = arquivosObj.map((o) => `"${o}"`).join(' ');
        const flagsStr = flagsLink.length > 0 ? ' ' + flagsLink.join(' ') : '';
        const flagDebugClang = emitirDebug ? ' -g' : '';
        execSync(`clang -O2${flagDebugClang} "${irPath}" ${objetosStr}${flagsStr} -o "${caminhoBinario}"`, { stdio: 'pipe' });
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
        taquigrafarErro('Erro durante compilação:');
        console.error(error.message || error);
        if (error.stack) console.error(error.stack);

        taquigrafarEtapa('Limpando arquivos temporários');
        limparArquivosTemporarios(arquivosTemporarios);

        process.exit(1);
    }
}

principal();
