import llvm from '@designliquido/llvm-bindings';

export interface PassesModuloComRun {
    run(modulo: llvm.Module, maquinaAlvo: llvm.TargetMachine): void;
}
