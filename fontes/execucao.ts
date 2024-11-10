import { Command } from 'commander';
import { CompiladorLLVM } from './compilador-llvm';

const principal = async () => {
    const analisadorArgumentos = new Command();

    analisadorArgumentos
        .helpOption('-h, --ajuda', 'Exibe a ajuda para o comando.');
    
    analisadorArgumentos.parse();
    // const opcoes = analisadorArgumentos.opts();

    const compilador = new CompiladorLLVM();
    compilador.compilar([]);
}

principal();
