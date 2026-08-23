/**
 * Ajudantes puros para inspeção e normalização de tipos Delégua (representados
 * como string, ex.: 'inteiro', 'longo', 'número', 'vetor<inteiro>', 'texto[]').
 * Não dependem de estado do compilador (LLVMContext, IRBuilder etc.).
 */

/** Verdadeiro se o tipo Delégua for um inteiro de largura fixa ('inteiro' ou 'longo'). */
export function tipoEhInteiroDelegua(tipo: string): boolean {
    return tipo === 'inteiro' || tipo === 'longo';
}

// Retorna verdadeiro se o tipo representa um vetor (qualquer notação).
export function tipoEhVetor(tipo: string): boolean {
    return tipo?.startsWith('vetor<') || tipo === 'vetor' || tipo?.endsWith('[]');
}

// Retorna verdadeiro se o tipo representa um dicionário. Restrito a 'dicionário'/
// 'dicionario' (inferido pelo avaliador sintático a partir de um literal {}, ou anotado
// explicitamente) — NÃO inclui o `qualquer` bruto: um campo apenas anotado `qualquer`
// pode ser qualquer coisa (ex.: uma instância de classe), e tratar esse acesso como
// busca em dicionário sem essa confirmação seria uma adivinhação capaz de compilar
// silenciosamente para código incorreto.
export function tipoEhDicionario(tipo: string): boolean {
    return tipo === 'dicionário' || tipo === 'dicionario';
}

// Extrai o tipo do elemento de uma string de tipo vetor.
// Aceita tanto 'vetor<inteiro>' como 'inteiro[]'.
export function tipoElementoVetor(tipoVetor: string): string {
    if (tipoVetor?.endsWith('[]')) {
        return tipoVetor.slice(0, -2);
    }
    const correspondencia = tipoVetor?.match(/^vetor<(.+)>$/);
    return correspondencia ? correspondencia[1] : 'inteiro';
}

/** Dado dois tipos Delégua, decide o tipo prevalente numa operação binária. */
export function definirTipoPrevalente(tipo1: string, tipo2: string): string {
    if (tipo1 === 'texto' || tipo2 === 'texto') {
        return 'texto';
    }

    if (tipo1 === 'número' || tipo2 === 'número') {
        return 'número';
    }

    if (tipo1 === 'longo' || tipo2 === 'longo') {
        return 'longo';
    }

    return 'inteiro';
}

/**
 * A partir de um tipo Delégua já reconhecido como inteiro (ou 'número', caso
 * em que assume 'inteiro' por padrão), retorna o tipo inteiro final e a
 * quantidade de bits correspondente ('longo' = 64, senão 32).
 */
export function normalizarParaTipoInteiro(tipoBase: string): { tipoInteiro: string; bits: number } {
    const tipoInteiro = tipoEhInteiroDelegua(tipoBase) ? tipoBase : 'inteiro';
    const bits = tipoInteiro === 'longo' ? 64 : 32;
    return { tipoInteiro, bits };
}
