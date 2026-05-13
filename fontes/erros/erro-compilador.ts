export class ErroCompilador extends Error {
    linha?: number;
    coluna?: number;
    tamanhoToken?: number;
    arquivo?: string;

    constructor(mensagem: string) {
        super(mensagem);
        this.name = 'ErroCompilador';
    }
}
