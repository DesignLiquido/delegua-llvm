# Biblioteca de Compilação Delégua para LLVM

Converte código Delégua no _assembly_ [LLVM](https://pt.wikipedia.org/wiki/LLVM) (ou representação intermediária de código [LLVM](https://pt.wikipedia.org/wiki/LLVM)), que pode ser usada para gerar executáveis, seja em qualquer sistema operacional, seja em certos dispositivos específicos. 

Funciona apenas com Node.js.

## Pré-requisitos

- [CMake](https://cmake.org/);
- [LLVM](https://llvm.org/);

É possível fazer funcionar em Windows, mas recomendamos um ecossistema baseado em Unix, como Linux e MacOS, que são mais fáceis de obter essas dependências.

## Considerações na compilação

Todo código que passa por este compilador precisa ser fortemente tipado. Diferentemente do interpretador Delégua, que deduz o tipo de variável em tempo de execução, a arquitetura de LLVM nos obriga a ter tipos definidos, que são mapeados para os tipos correspondentes em LLVM.

Delégua por definição não possui um ponto de entrada, ou seja, uma função `main()`, mas LLVM requer este ponto de entrada, que é criado automaticamente. 

## Inspiração

- https://mcyoung.xyz/2023/08/01/llvm-ir/ (em inglês)