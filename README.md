# Biblioteca de Compilação Delégua para LLVM

Converte código Delégua no _assembly_ [LLVM](https://pt.wikipedia.org/wiki/LLVM) (ou representação intermediária de código [LLVM](https://pt.wikipedia.org/wiki/LLVM)), que pode ser usada para gerar executáveis, seja em qualquer sistema operacional, seja em certos dispositivos específicos. 

Funciona apenas com Node.js.

## Pré-requisitos

- [Node.js](https://nodejs.org/pt), pelo menos a versão LTS;
- [Yarn](https://yarnpkg.com/);
- [CMake](https://cmake.org/);
- [LLVM](https://llvm.org/);

É possível fazer funcionar em Windows (roteiro abaixo), mas recomendamos um ecossistema baseado em Unix, como Linux e MacOS, que são mais fáceis de obter e configurar essas dependências.

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
sudo ./llvm.sh 17

# Instalar bibliotecas dependentes
sudo apt-get install cmake zlib1g-dev

# Após clonar este projeto, navegar para o diretório raiz e usar o comando
yarn
```

### Instalação para Mac

```sh
# O comando abaixo supõe que o Homebrew está instalado.
# Se você não sabe o que é o Homebrew, acesse: https://brew.sh/
brew install cmake llvm@17

# O Homebrew deve pedir para executar os comandos abaixo:
echo 'export PATH="/opt/homebrew/opt/llvm@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Após clonar este projeto, navegar para o diretório raiz e usar o comando
yarn
```

### Instalação para Windows

Temos dois outros projetos, [`llvm-bindings`](https://github.com/DesignLiquido/llvm-bindings) e [`llvm-windows`](https://github.com/DesignLiquido/llvm-windows), justamente para suportar essa instalação para Windows. Todo lançamento de versão em `llvm-windows` é feito a partir de uma versão do LLVM compilada no GitHub, e o `llvm-bindings` é atualizado para suportar essa versão. Por isso, é importante [seguir a paridade de versões entre os dois projetos](https://github.com/DesignLiquido/llvm-bindings?tab=readme-ov-file#compatibility). Toda versão maior deste projeto segue a mesma versão maior do `llvm-bindings`, e toda versão menor deste projeto segue a mesma versão menor do `llvm-bindings`.

Como exemplo, digamos que você quer instalar a versão 4 deste pacote, cuja paridade com `llvm-bindings` também é a versão 4. `llvm-bindings` na versão 4 utiliza o LLVM 17. A versão correspondente do `llvm-windows` é a versão 17.0.6, [listada aqui](https://github.com/DesignLiquido/llvm-windows/releases). Baixe o arquivo zip correspondente e descompacte o arquivo em um diretório qualquer (por exemplo, `C:\Estudos`). No exemplo do LLVM 17, o diretório descompactado deve ser `C:\Estudos\LLVM-17.0.6-win64`. Dentro deste diretório, deve haver um subdiretório `bin`, ou seja, `C:\Estudos\LLVM-17.0.6-win64\bin`, que contém os arquivos executáveis do LLVM, como `clang.exe` e `opt.exe`.

Adicione o diretório na sua variável de ambiente `PATH`, e crie uma outra variável de ambiente chamada `CMAKE_PREFIX_PATH`. Esta variável guarda o diretório que contém os arquivos `.cmake` necessários para que `llvm-bindings` saiba como construir o pacote no ambiente local. Considerando o diretório do `llvm-windows` que baixamos, estes arquivos vivem dentro do subdiretório `lib\cmake\llvm`. No nosso exemplo, `C:\Estudos\LLVM-17.0.6-win64\lib\cmake\llvm`.

#### Alternativa: compilando fontes do LLVM

Você precisará baixar os fontes do projeto ([link direto aqui](https://github.com/llvm/llvm-project/archive/refs/tags/llvmorg-17.0.6.zip)), o instalador do CMake, que [pode ser a versão mais recente](https://cmake.org/download/) com todas as opções padrão marcadas no instalador, e algum Visual Studio versões 2022 ou mais recente. [Há uma versão Community que é gratuita](https://visualstudio.microsoft.com/vs/community/). Ao executar o instalador do Visual Studio, marque a opção "Desenvolvimento em Desktop com C++" (ou, em inglês, _"Desktop Development with C++"_).

Baixado o LLVM e instalados Visual Studio Code e CMake, abra um prompt de comando (ou uma janela do PowerShell), navegue até o diretório descompactado do LLVM (por exemplo, `C:\Estudos\llvm-project-llvmorg-17.0.6`) e dentro deve haver um diretório `llvm`, ou seja, `C:\Estudos\llvm-project-llvmorg-17.0.6\llvm`. Neste diretório, execute os seguintes comandos:

```powershell
mkdir build
cd build
# Compila para x64
cmake -Thost=x64 -DLLVM_TARGETS_TO_BUILD=X86 -DLLVM_INCLUDE_TESTS=OFF ..
cmake --build . --config Release
```

Após esses comandos, uma versão funcional do LLVM estará no diretório `C:\Estudos\llvm-project-llvmorg-17.0.6\llvm\build\Release\bin`.

Adicione o diretório na sua variável de ambiente `PATH`, e crie uma outra variável de ambiente chamada `CMAKE_PREFIX_PATH`. Esta variável guarda o diretório que contém os arquivos `.cmake` necessários para que `llvm-bindings` saiba como construir o pacote no ambiente local. Considerando os fontes do LLVM que baixamos, estes arquivos vivem dentro do subdiretório `llvm\build\lib\cmake\llvm`. No nosso exemplo, `C:\Estudos\llvm-project-llvmorg-17.0.6\llvm\build\lib\cmake\llvm`.

#### Verificando a instalação

Seja qual for a forma que você escolheu para instalar o LLVM, é importante verificar se a instalação foi bem-sucedida. Para isso, abra um terminal (Prompt de Comando ou PowerShell) e execute os seguintes comandos:

```powershell
clang --version
opt --version
```

Se ambos imprimirem informações sobre a versão do LLVM, então a instalação foi bem-sucedida e o `PATH` do sistema está configurado corretamente.

O `cmake-js` precisa estar instalado globalmente e visível no `PATH` do sistema para que o CMake consiga localizá-lo durante a construção do pacote nativo (`llvm-bindings.node`). Após instalar com `yarn global add cmake-js`, certifique-se de que o diretório de binários globais do Yarn (ex.: `%LOCALAPPDATA%\Yarn\bin`) esteja no `PATH` do sistema.

```powershell
yarn global add cmake-js
yarn
```

A instalação e construção de pacotes deve ocorrer sem erros.

## Uso

Com todos os pré-requisitos instalados, o compilador pode ser usado diretamente via `npx`, sem necessidade de instalação global:

```sh
npx @designliquido/delegua-llvm <arquivo.delegua>
```

O compilador executa todo o pipeline automaticamente:

1. Lê o código-fonte Delégua
2. Gera a representação intermediária LLVM (arquivo `.ll`)
3. Compila as bibliotecas nativas
4. Linka tudo e gera o binário executável
5. Remove os arquivos temporários

O binário gerado ficará no mesmo diretório do arquivo de entrada, com o mesmo nome (sem extensão).

### Opções

| Opção | Descrição |
|-------|-----------|
| `-o <nome>` | Define o nome do binário de saída |

Exemplo com nome de saída personalizado:

```sh
npx @designliquido/delegua-llvm meu_programa.delegua -o saida
```

### Variáveis de ambiente

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `DELEGUA_DEBUG` | `true` | Exibe o LLVM IR gerado no console antes de compilar |

Exemplo:

```sh
DELEGUA_DEBUG=true npx @designliquido/delegua-llvm meu_programa.delegua
```

### Executando o binário gerado

Após a compilação, execute o binário gerado diretamente:

```sh
./meu_programa
```

## Compilação manual (avançado)

Caso queira compilar manualmente a partir de um arquivo `.ll` já gerado, utilize o [Clang](https://clang.llvm.org/):

```sh
clang meu_programa.ll -o meu_programa
```

## Considerações na compilação

Todo código Delégua que passa por este compilador precisa ser fortemente tipado. Diferentemente do interpretador Delégua, que deduz o tipo de variável em tempo de execução, a arquitetura de LLVM nos obriga a ter tipos definidos, que são mapeados para os tipos correspondentes em LLVM. Certos literais, como números, têm o tipo deduzido de acordo com o local onde são usados, e algumas conversões são implícitas: por exemplo, `1` pode ser um número inteiro ou um número real (com parte decimal). 

Delégua por definição não possui um ponto de entrada, ou seja, uma função `main()`, mas LLVM requer este ponto de entrada, que é criado automaticamente. Este ponto de entrada chama as demais funções, classes, etc.

Todo o código gerado por esta biblioteca _não é otimizado_, e nem precisa ser. A otimização do código pode ser feita [pelo comando `opt` do LLVM](https://llvm.org/docs/CommandGuide/opt.html), usando, por exemplo:

```sh
opt -S meu_programa.ll > meu_programa.otimizado.ll
```

## Contribuindo

- Nomes de variáveis, comentários e documentação devem estar em português, pois o projeto é em português.
- Utilize o Yarn como gerenciador de pacotes. Não utilize o `npm` diretamente.

## Inspiração

- https://mcyoung.xyz/2023/08/01/llvm-ir/ (em inglês)
- https://mukulrathi.com/create-your-own-programming-language/llvm-ir-cpp-api-tutorial/ (em inglês)