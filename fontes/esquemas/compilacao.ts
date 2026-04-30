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
];

export default esquemaCompilacao;
