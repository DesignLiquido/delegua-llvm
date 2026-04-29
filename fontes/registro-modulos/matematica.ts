import llvm from '@designliquido/llvm-bindings';
import type { CompiladorLLVM } from '../compilador-llvm';
import { EntradaFuncaoModulo } from '../interfaces/entrada-funcao-modulo';

export function registrarModuloMatematica(this: CompiladorLLVM): void {
    const d = this.montador.getDoubleTy();
    const i32 = this.montador.getInt32Ty();

    const reg = (nomeCFunc: string, tiposParametros: string[], tipoRetorno: string = 'numero'): EntradaFuncaoModulo => {
        const tiposLlvm = tiposParametros.map((t) => (t === 'inteiro' ? i32 : d));
        const tipo = llvm.FunctionType.get(d, tiposLlvm, false);
        const callee = this.modulo.getOrInsertFunction(nomeCFunc, tipo);
        return { callee, tiposParametros, tipoRetorno };
    };

    const funcoes = new Map<string, EntradaFuncaoModulo>([
        ['exp', reg('delegua_mat_exp', ['numero'])],
        ['logaritmo', reg('delegua_mat_logaritmo', ['numero'])],
        ['potencia', reg('delegua_mat_potencia', ['numero', 'numero'])],
        ['raizQuadrada', reg('delegua_mat_raiz_quadrada', ['numero'])],
        ['arredondarParaBaixo', reg('delegua_mat_arredondar_para_baixo', ['numero'])],
        ['aprox', reg('delegua_mat_aprox', ['numero', 'inteiro'])],
        ['pi', reg('delegua_mat_pi', [])],
        ['seno', reg('delegua_mat_seno', ['numero'])],
        ['cosseno', reg('delegua_mat_cosseno', ['numero'])],
        ['tangente', reg('delegua_mat_tangente', ['numero'])],
        ['arcoSeno', reg('delegua_mat_arco_seno', ['numero'])],
        ['arcoCosseno', reg('delegua_mat_arco_cosseno', ['numero'])],
        ['arcoTangente', reg('delegua_mat_arco_tangente', ['numero'])],
        ['graus', reg('delegua_mat_graus', ['numero'])],
        ['radiano', reg('delegua_mat_radiano', ['numero'])],
        ['limite', reg('delegua_mat_limite', ['numero', 'numero', 'numero'])],
        ['jurosSimples', reg('delegua_mat_juros_simples', ['numero', 'numero', 'numero'])],
        ['jurosCompostos', reg('delegua_mat_juros_compostos', ['numero', 'numero', 'numero'])],
        ['areaCirculo', reg('delegua_mat_area_circulo', ['numero'])],
        ['areaQuadrado', reg('delegua_mat_area_quadrado', ['numero'])],
        ['areaRetangulo', reg('delegua_mat_area_retangulo', ['numero', 'numero'])],
        ['areaLosango', reg('delegua_mat_area_losango', ['numero', 'numero'])],
        ['areaTrapezio', reg('delegua_mat_area_trapezio', ['numero', 'numero', 'numero'])],
        ['areaTriangulo', reg('delegua_mat_area_triangulo', ['numero', 'numero'])],
        ['distanciaDoisPontos', reg('delegua_mat_distancia_dois_pontos', ['numero', 'numero', 'numero', 'numero'])],
        ['fun1r', reg('delegua_mat_fun1r', ['numero', 'numero'])],
        ['xVertice', reg('delegua_mat_x_vertice', ['numero', 'numero', 'numero'])],
        ['yVertice', reg('delegua_mat_y_vertice', ['numero', 'numero', 'numero'])],
    ]);

    this.mapaModulos.set('matematica', funcoes);
}
