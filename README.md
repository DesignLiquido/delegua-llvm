# Biblioteca de Compilação Delégua para LLVM

Converte código Delégua no _assembly_ [LLVM](https://pt.wikipedia.org/wiki/LLVM) (ou representação intermediária de código [LLVM](https://pt.wikipedia.org/wiki/LLVM)), que pode ser usada para gerar executáveis, seja em qualquer sistema operacional, seja em certos dispositivos específicos. 

Funciona apenas com Node.js.

## Pré-requisitos

- [Node.js](https://nodejs.org/pt), pelo menos a versão LTS;
- [Yarn](https://yarnpkg.com/);
- [CMake](https://cmake.org/);
- [LLVM](https://llvm.org/);

É possível fazer funcionar em Windows, mas recomendamos um ecossistema baseado em Unix, como Linux e MacOS, que são mais fáceis de obter essas dependências.

Após instalar qualquer versão do Node.js, o Yarn pode ser instalado usando o seguinte comando:

```sh
npm i -g yarn
```

### Instalação para Linux

O script de instalação abaixo supõe uma distribuição Linux compatível com Ubuntu e Debian:

```sh
# Descarregar o script de instalação do LLVM
wget https://apt.llvm.org/llvm.sh
sudo chmod +x llvm.sh
sudo ./llvm.sh 14

# Instalar bibliotecas dependentes
sudo apt-get install cmake zlib1g-dev

# Após clonar este projeto, navegar para o diretório raiz e usar o comando
yarn
```

### Instalação para Mac

```sh
# O comando abaixo supõe que o Homebrew está instalado.
# Se você não sabe o que é o Homebrew, acesse: https://brew.sh/
brew install cmake llvm@14

# O Homebrew deve pedir para executar os comandos abaixo:
echo 'export PATH="/opt/homebrew/opt/llvm@14/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Após clonar este projeto, navegar para o diretório raiz e usar o comando
yarn
```

## Compilando seu programa para código de máquina

Para compilar seu código para código de máquina, utilizamos o [Clang](https://clang.llvm.org/), que é o compilador do LLVM para C e C++.

O comando para compilar seu programa Delégua já convertido para LLVM é:

```sh
clang meu_programa.ll -o meu_programa
```

## Considerações na compilação

Todo código que passa por este compilador precisa ser fortemente tipado. Diferentemente do interpretador Delégua, que deduz o tipo de variável em tempo de execução, a arquitetura de LLVM nos obriga a ter tipos definidos, que são mapeados para os tipos correspondentes em LLVM.

Delégua por definição não possui um ponto de entrada, ou seja, uma função `main()`, mas LLVM requer este ponto de entrada, que é criado automaticamente. 

Todo o código gerado por esta biblioteca _não é otimizado_, e nem precisa ser. A otimização do código pode ser feita [pelo comando `opt` do LLVM](https://llvm.org/docs/CommandGuide/opt.html), usando, por exemplo:

```sh
opt -S meu_programa.ll > meu_programa.otimizado.ll
```

## Inspiração

- https://mcyoung.xyz/2023/08/01/llvm-ir/ (em inglês)
- https://mukulrathi.com/create-your-own-programming-language/llvm-ir-cpp-api-tutorial/ (em inglês)