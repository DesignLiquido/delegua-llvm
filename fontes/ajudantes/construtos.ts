/**
 * Ajudantes puros para inspecionar construtos da AST do Delégua.
 */
import { Unario } from '@designliquido/delegua';
import { ConstrutoInterface } from '@designliquido/delegua/interfaces';

/** Verdadeiro se `incrementar` for o unário pós/pré-incremento (`i++` ou `++i`) de `nomeVariavel`. */
export function incrementoEhPositivo(
    incrementar: ConstrutoInterface | null | undefined,
    nomeVariavel: string
): boolean {
    if (!incrementar) return false;
    // Unário pós/pré-incremento: i++  ou  ++i
    if (incrementar instanceof Unario) {
        const operando = incrementar.operando as unknown as { simbolo?: { lexema?: string }; lexema?: string };
        const lexemaOperador = incrementar.operador?.lexema;
        const lexemaOperando = operando?.simbolo?.lexema ?? operando?.lexema;
        return lexemaOperador === '++' && lexemaOperando === nomeVariavel;
    }
    return false;
}
