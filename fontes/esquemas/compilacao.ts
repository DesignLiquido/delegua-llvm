import { DefinicaoPropriedade } from '@designliquido/delprops';

const esquemaCompilacao: DefinicaoPropriedade[] = [
    {
        nome: 'arquivoSaida',
        tipo: 'texto',
        detalhe: 'Nome do arquivo executável gerado pela compilação.',
    },
    {
        nome: 'pontoEntrada',
        tipo: 'texto',
        detalhe: 'Caminho do arquivo de entrada do projeto, relativo à raiz.',
        padrao: 'inicial.delegua',
    },
    {
        nome: 'emitirDebug',
        tipo: 'logico',
        detalhe: 'Emite símbolos de depuração DWARF no binário gerado. Equivalente à flag -g na linha de comando.',
        padrao: 'falso',
    },
    {
        nome: 'alvo',
        tipo: 'texto',
        detalhe: 'Alvo da compilação, no formato <sistema>-<arquitetura> (ex.: linux-arm64). Vazio: a máquina atual. Equivalente a --alvo.',
    },
    {
        nome: 'compiladorC',
        tipo: 'texto',
        detalhe: 'Compilador C usado para o runtime e a ligação (ex.: clang, zig cc). Padrão: clang, ou zig cc na compilação cruzada se o zig estiver instalado.',
    },
    {
        nome: 'sysroot',
        tipo: 'texto',
        detalhe: 'Diretório com as bibliotecas do alvo, para compilação cruzada com clang.',
    },
];

export default esquemaCompilacao;
