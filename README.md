# Biblioteca de Compilação Delégua para LLVM

Converte código Delégua no _assembly_ [LLVM](https://pt.wikipedia.org/wiki/LLVM) (ou representação intermediária de código [LLVM](https://pt.wikipedia.org/wiki/LLVM)), que pode ser usada para gerar executáveis, seja em qualquer sistema operacional, seja em certos dispositivos específicos. 

Funciona apenas com Node.js.

## Pré-requisitos

- [Node.js](https://nodejs.org/pt), pelo menos a versão LTS;
- [Yarn](https://yarnpkg.com/);
- [CMake](https://cmake.org/);
- [LLVM](https://llvm.org/);

É possível fazer funcionar em Windows (roteiro abaixo), mas recomendamos um ecossistema baseado em Unix, como Linux e MacOS, que são mais fáceis de obter essas dependências.

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

### Instalação para Windows

A biblioteca [llvm-bindings](https://github.com/ApsarasX/llvm-bindings), parte essencial deste projeto, funciona até a versão 14 do LLVM. [A versão 14.0.6](https://github.com/llvm/llvm-project/releases/tag/llvmorg-14.0.6) compila sem problemas. 

Você precisará baixar os fontes do projeto ([link direto aqui](https://github.com/llvm/llvm-project/archive/refs/tags/llvmorg-14.0.6.zip)), o instalador do CMake, que [pode ser a versão mais recente](https://cmake.org/download/) com todas as opções padrão marcadas no instalador, e algum Visual Studio versões 2019 ou mais recente. [Há uma versão Community que é gratuita](https://visualstudio.microsoft.com/vs/community/). Ao executar o instalador do Visual Studio, marque a opção "Desenvolvimento em Desktop com C++" (ou, em inglês, _"Desktop Development with C++"_). 

Baixados os fontes do projeto, descompacte o arquivo em um diretório qualquer (por exemplo, `C:\Estudos`). Feito isso, abra um prompt de comando (ou uma janela do PowerShell), navegue até o diretório descompactado do LLVM (por exemplo, `C:\Estudos\llvm-project-llvmorg-14.0.6`) e dentro deve haver um diretório `llvm`, ou seja, `C:\Estudos\llvm-project-llvmorg-14.0.6\llvm`. Neste diretório, execute os seguintes comandos:

```powershell
mkdir build
cd build
# Compila para x64
cmake -Thost=x64 -DLLVM_TARGETS_TO_BUILD=X86 -DLLVM_INCLUDE_TESTS=OFF ..
cmake --build . --config Release
```

Após esses comandos, uma versão funcional do LLVM estará no diretório `C:\Estudos\llvm-project-llvmorg-14.0.6\llvm\build\Release\bin`. 

Adicione o diretório na sua variável de ambiente `PATH`, e crie uma outra variável de ambiente chamada `CMAKE_PREFIX_PATH`. Esta variável guarda o diretório que contém os arquivos `.cmake` necessários para que `llvm-bindings` saiba como construir o pacote no ambiente local. Considerando os fontes do LLVN que baixamos, estes arquivos vivem dentro do subdiretório `llvm\build\lib\cmake\llvm`. No nosso exemplo, `C:\Estudos\llvm-project-llvmorg-14.0.6\llvm\build\lib\cmake\llvm`. 

Finalmente, execute:

```powershell
yarn
```

A instalação e construção de pacotes deve ocorrer sem erros.

## Compilando seu programa para código de máquina

Para compilar seu código para código de máquina, utilizamos o [Clang](https://clang.llvm.org/), que é o compilador do LLVM para C e C++.

O comando para compilar seu programa Delégua já convertido para LLVM é:

```sh
clang meu_programa.ll -o meu_programa
```

## Considerações na compilação

Todo código Delégua que passa por este compilador precisa ser fortemente tipado. Diferentemente do interpretador Delégua, que deduz o tipo de variável em tempo de execução, a arquitetura de LLVM nos obriga a ter tipos definidos, que são mapeados para os tipos correspondentes em LLVM.

Delégua por definição não possui um ponto de entrada, ou seja, uma função `main()`, mas LLVM requer este ponto de entrada, que é criado automaticamente. Este ponto de entrada chama as demais funções, classes, etc.

Todo o código gerado por esta biblioteca _não é otimizado_, e nem precisa ser. A otimização do código pode ser feita [pelo comando `opt` do LLVM](https://llvm.org/docs/CommandGuide/opt.html), usando, por exemplo:

```sh
opt -S meu_programa.ll > meu_programa.otimizado.ll
```

## Inspiração

- https://mcyoung.xyz/2023/08/01/llvm-ir/ (em inglês)
- https://mukulrathi.com/create-your-own-programming-language/llvm-ir-cpp-api-tutorial/ (em inglês)