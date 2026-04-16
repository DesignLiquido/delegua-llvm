#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

import { CompiladorLLVM } from './compilador-llvm';
import { detectarModulosImportados, obterBibliotecasParaCompilacao } from './bibliotecas-compilacao';

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

function log(mensagem: string, cor: string = CORES.reset) {
    console.log(`${cor}${mensagem}${CORES.reset}`);
}

function logEtapa(etapa: string) {
    console.log(`\n${CORES.ciano}${CORES.negrito}▶ ${etapa}${CORES.reset}`);
}

function logSucesso(mensagem: string) {
    console.log(`${CORES.verde}  ✓ ${mensagem}${CORES.reset}`);
}

function logInfo(mensagem: string) {
    console.log(`${CORES.azul}  ℹ ${mensagem}${CORES.reset}`);
}

function logErro(mensagem: string) {
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
    const nomeComExtensao = path.extname(nomeBinario) || !extensaoExecutavel
        ? nomeBinario
        : `${nomeBinario}${extensaoExecutavel}`;

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
    
    if (args.length === 0) {
        log('Uso:', CORES.amarelo);
        log('  npx @designliquido/delegua-llvm <arquivo.delegua>', CORES.reset);
        console.log('');
        log('Opções:', CORES.amarelo);
        log('  -o <nome>    Nome do binário de saída', CORES.reset);
        console.log('');
        process.exit(1);
    }

    let arquivoEntrada: string = '';
    let nomeSaida: string = '';

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-o' && args[i + 1]) {
            nomeSaida = args[i + 1];
            i++;
        } else if (!arquivoEntrada) {
            arquivoEntrada = args[i];
        }
    }

    if (!arquivoEntrada) {
        logErro('Arquivo de entrada não especificado');
        process.exit(1);
    }

    if (!fs.existsSync(arquivoEntrada)) {
        logErro(`Arquivo não encontrado: ${arquivoEntrada}`);
        process.exit(1);
    }

    const nomeBase = path.basename(arquivoEntrada, path.extname(arquivoEntrada));
    const nomeBinario = nomeSaida || nomeBase;
    const diretorioSaida = path.dirname(arquivoEntrada);
    const caminhoBinario = determinarCaminhoBinario(diretorioSaida, nomeBinario);

    logEtapa('Lendo código fonte');
    const conteudo = fs.readFileSync(arquivoEntrada, 'utf-8');
    const codigo = conteudo.split('\n');
    logSucesso(`Arquivo: ${arquivoEntrada}`);
    logInfo(`Linhas: ${codigo.length}`);

    const compilador = new CompiladorLLVM();
    const arquivosTemporarios: string[] = [];

    try {
        logEtapa('Gerando LLVM IR');
        const ir = await compilador.compilar(codigo, true, diretorioSaida);
        
        const irPath = path.join(diretorioSaida, `${nomeBase}.ll`);
        fs.writeFileSync(irPath, ir);
        arquivosTemporarios.push(irPath);
        logSucesso(`IR gerado`);

        if (process.env.DELEGUA_DEBUG === 'true') {
            console.log('');
            log('=== LLVM IR ===', CORES.amarelo);
            console.log(ir);
            log('===============', CORES.amarelo);
        }

        logEtapa('Compilando bibliotecas nativas');
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
            logSucesso(`Compilado: ${path.basename(arquivoC)} → ${path.basename(objPath)}`);
        }

        logEtapa('Linkando binário');
        const objetosStr = arquivosObj.map(o => `"${o}"`).join(' ');
        const flagsStr = flagsLink.length > 0 ? ' ' + flagsLink.join(' ') : '';
        execSync(`clang++ -O2 "${irPath}" ${objetosStr}${flagsStr} -o "${caminhoBinario}"`, { stdio: 'pipe' });
        logSucesso(`Binário gerado: ${caminhoBinario}`);

        logEtapa('Limpando arquivos temporários');
        limparArquivosTemporarios(arquivosTemporarios);
        logSucesso(`${arquivosTemporarios.length} arquivos removidos`);

        console.log('');
        console.log(`${CORES.verde}${CORES.negrito}════════════════════════════════════════════════════════════════${CORES.reset}`);
        console.log(`${CORES.verde}${CORES.negrito}  ✓ Compilação concluída com sucesso!${CORES.reset}`);
        console.log(`${CORES.verde}${CORES.negrito}════════════════════════════════════════════════════════════════${CORES.reset}`);
        console.log('');
        logInfo(`Binário: ${CORES.negrito}${caminhoBinario}${CORES.reset}`);
        logInfo(`Para executar: ${CORES.negrito}./${path.relative('.', caminhoBinario)}${CORES.reset}`);
        console.log('');

    } catch (error: any) {
        logErro('Erro durante compilação:');
        console.error(error.message || error);
        
        logEtapa('Limpando arquivos temporários');
        limparArquivosTemporarios(arquivosTemporarios);
        
        process.exit(1);
    }
}

principal();
