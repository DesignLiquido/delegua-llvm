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
];

export default esquemaCompilacao;
