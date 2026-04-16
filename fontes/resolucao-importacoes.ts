import * as fs from 'fs';
import * as caminho from 'path';

import { Lexador } from '@designliquido/delegua/lexador';
import { AvaliadorSintatico } from '@designliquido/delegua/avaliador-sintatico';
import { cyrb53 } from '@designliquido/delegua/geracao-identificadores';
import { Declaracao, Classe } from '@designliquido/delegua';

const regexImportacaoArquivo = /importar\s+.*\s+de\s+['"](\.{1,2}[^'"]*)['"]/;

export function ehImportacaoArquivo(linha: string): boolean {
    return regexImportacaoArquivo.test(linha);
}

function extrairCaminhoImportacao(linha: string): string | null {
    const correspondencia = regexImportacaoArquivo.exec(linha);
    return correspondencia ? correspondencia[1] : null;
}

/**
 * Resolve importações de arquivo de forma recursiva, parseando cada arquivo com um
 * AvaliadorSintatico independente. Classes descobertas são pré-registradas progressivamente
 * para que arquivos subsequentes as reconheçam como tipos válidos.
 *
 * Retorna todas as declarações coletadas dos arquivos importados, em ordem de dependência.
 */
export async function resolverEMesclarDeclaracoes(
    codigo: string[],
    diretorioBase: string,
    arquivosVisitados: Set<string> = new Set(),
    registroClasses: { [nome: string]: Declaracao } = {}
): Promise<Declaracao[]> {
    const resultado: Declaracao[] = [];

    for (const linha of codigo) {
        const caminhoImportado = extrairCaminhoImportacao(linha);
        if (caminhoImportado === null) continue;

        let caminhoAbsoluto = caminho.resolve(diretorioBase, caminhoImportado);
        if (!caminhoAbsoluto.endsWith('.delegua')) {
            caminhoAbsoluto += '.delegua';
        }

        if (arquivosVisitados.has(caminhoAbsoluto)) continue;
        arquivosVisitados.add(caminhoAbsoluto);

        if (!fs.existsSync(caminhoAbsoluto)) {
            throw new Error(`Arquivo importado não encontrado: ${caminhoAbsoluto}`);
        }

        const conteudo = fs.readFileSync(caminhoAbsoluto, 'utf-8');
        const linhasArquivo = conteudo.split('\n');
        const diretorioArquivo = caminho.dirname(caminhoAbsoluto);

        // Resolve dependências do arquivo importado antes de parseá-lo.
        const declaracoesDeps = await resolverEMesclarDeclaracoes(
            linhasArquivo,
            diretorioArquivo,
            arquivosVisitados,
            registroClasses
        );
        resultado.push(...declaracoesDeps);

        // Parseia o arquivo com as classes já descobertas pré-registradas.
        // analisar() reseta tiposDefinidosEmCodigo internamente; usa o mesmo hook de
        // inicializarPilhaEscopos para injetar o registroClasses após o reset.
        const linhasSemImportacoes = linhasArquivo.map(l => ehImportacaoArquivo(l) ? '' : l);
        const hashArquivo = cyrb53(caminhoAbsoluto.toLowerCase());

        const lexador = new Lexador();
        const avaliador = new AvaliadorSintatico();
        const avaliadorAny = avaliador as any;
        const inicializarOriginal = avaliadorAny.inicializarPilhaEscopos?.bind(avaliadorAny);
        if (inicializarOriginal) {
            const capturedRegistro = { ...registroClasses };
            avaliadorAny.inicializarPilhaEscopos = () => {
                inicializarOriginal();
                Object.assign(avaliadorAny.tiposDefinidosEmCodigo, capturedRegistro);
            };
        }

        const retornoLexador = lexador.mapear(linhasSemImportacoes, hashArquivo);
        const retornoAvaliador = await avaliador.analisar(retornoLexador, hashArquivo);

        // Registra classes encontradas para arquivos seguintes.
        for (const decl of retornoAvaliador.declaracoes) {
            if (decl instanceof Classe) {
                registroClasses[(decl as Classe).simbolo.lexema] = decl;
            }
        }

        resultado.push(...retornoAvaliador.declaracoes);
    }

    return resultado;
}
