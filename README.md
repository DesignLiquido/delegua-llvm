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
# Bibliotecas necessárias para adicionar o repositório do LLVM e instalar o LLVM
sudo apt-get update
sudo apt-get install -y wget gnupg lsb-release ca-certificates cmake zlib1g-dev build-essential python3

# Descarregar o script de instalação do LLVM
wget https://apt.llvm.org/llvm.sh
chmod +x llvm.sh
sudo ./llvm.sh 22

# Verificar se o LLVM foi instalado corretamente
sudo update-alternatives --install /usr/bin/clang clang /usr/bin/clang-22 220
sudo update-alternatives --install /usr/bin/clang++ clang++ /usr/bin/clang++-22 220
sudo update-alternatives --install /usr/bin/opt opt /usr/bin/opt-22 220
sudo update-alternatives --install /usr/bin/llvm-config llvm-config /usr/bin/llvm-config-22 220
clang --version
opt --version
llvm-config --version

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
| `-g`, `--debug` | Emite símbolos de depuração DWARF no binário |
| `--alvo <sistema-arquitetura>` (ou `--target`) | Compila para outro sistema/arquitetura (ver abaixo) |
| `--listar-alvos` | Lista os alvos disponíveis |
| `--compilador-c <comando>` | Compilador C do runtime e da ligação (padrão: `clang`; `zig cc` na compilação cruzada, se o zig estiver instalado) |
| `--sysroot <diretório>` | Cabeçalhos e bibliotecas do alvo, para compilação cruzada com `clang` |

Exemplo com nome de saída personalizado:

```sh
npx @designliquido/delegua-llvm meu_programa.delegua -o saida
```

### Compilação cruzada

```sh
npx @designliquido/delegua-llvm programa.delegua --alvo linux-arm64 -o programa-linux-arm64
```

Alvos: `linux-amd64`, `linux-arm64`, `linux-riscv64`, `darwin-amd64`, `darwin-arm64`, `windows-amd64`, `windows-arm64` (também aceitos: `macos-…`, `…-x64`, `…-aarch64`). As mesmas opções podem ficar em `configuracao.delprops` como `compilacao.alvo`, `compilacao.compiladorC` e `compilacao.sysroot`.

O código do alvo é gerado pelo próprio `clang`, que tem todos os backends. Mas compilar o runtime C e ligar o binário exige a biblioteca C do alvo. A forma mais simples é instalar o [zig](https://ziglang.org): ele traz a biblioteca C de cada alvo, e o compilador passa a usar `zig cc` automaticamente na compilação cruzada. Sem o zig, use `--sysroot` com as bibliotecas do alvo.

Observações:

- Com `zig cc`, os executáveis para Windows usam a ABI GNU (MinGW) em vez da MSVC.
- Os tamanhos de estruturas estrangeiras (`tamanhoEmBytes()`) são calculados para o alvo.
- Módulos que dependem de bibliotecas do sistema (`http` → libcurl, `criptografia` → OpenSSL) precisam dessas bibliotecas compiladas para o alvo.

### Depuração simbólica

A flag `-g` (ou `--debug`) ativa a emissão de metadados [DWARF](https://dwarfstd.org/) no arquivo `.ll` gerado e passa `-g` para o Clang ao compilar o binário final. Com isso, depuradores como `gdb` e `lldb` conseguem relacionar as instruções do binário ao código-fonte `.delegua` original (nomes de variáveis, funções e números de linha).

```sh
npx @designliquido/delegua-llvm -g meu_programa.delegua
gdb ./meu_programa
```

```
(gdb) break meu_programa.delegua:10
(gdb) run
```

> **Nota:** O uso de `-g` desativa a otimização `-O2` no binário gerado. Para produção, omita a flag.

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

## Suporte a FFI (classe estrangeira)

O compilador suporta chamadas a bibliotecas nativas do sistema operacional por meio da construção `classe estrangeira` combinada com o decorador `@definicao`:

```delegua
@definicao(biblioteca="m", prefixo="")
classe estrangeira LibM {
    cosseno(x: numero): numero
}

var r = LibM.cosseno(0.0)
```

O compilador emite instruções `declare` no LLVM IR para os símbolos C correspondentes e injeta `!llvm.linker.options` com as flags `-l<biblioteca>` necessárias para o linker.

### Tipos na fronteira com C

| Delégua | C |
|---|---|
| `inteiro` | `int` / `int32_t` |
| `longo` | `int64_t` / `size_t` |
| `número` | `double` |
| `lógico` | `bool` |
| `byte` | `uint8_t` / `char` (lido como `inteiro`) |
| `texto` | `const char*` |
| `ponteiro` | `void*` opaco |
| `função` | ponteiro de função |
| `texto[]`, `inteiro[]`... | `char**`, `int*`... (apenas parâmetros) |
| estrutura estrangeira | `struct X*` |

### Estruturas

Uma `classe estrangeira` com campos descreve uma `struct` C, com a mesma disposição de memória do compilador C da plataforma:

```delegua
classe estrangeira Ponto {
    x: inteiro
    y: inteiro
}

classe estrangeira Retangulo {
    origem: Ponto            // struct aninhada (por valor)
    area: longo
    @definicao(tamanho=20)
    id: byte                 // unsigned char id[20]
    nome: texto
}

var r = Retangulo()          // memória zerada
r.origem.x = 1
escreva(Retangulo.tamanhoEmBytes())   // sizeof(Retangulo)
```

Instâncias são passadas a funções C como ponteiro. Ler um vetor de tamanho fixo (`r.id`) devolve o endereço do primeiro elemento, para uso com o módulo `memoria`.

### Funções de retorno (callbacks)

Um parâmetro `função` recebe uma função Delégua nomeada ou anônima (com parâmetros tipados). O compilador gera um trampolim com convenção C:

```delegua
funcao contar(item: texto, indice: inteiro, carga: ponteiro): inteiro {
    var contexto: Contexto = carga     // objeto Delégua passado como void*
    contexto.total = contexto.total + 1
    retorna 0
}

Biblioteca.para_cada(itens, itens.tamanho(), contar, contexto)
```

Funções anônimas não capturam variáveis: use o parâmetro `ponteiro` de carga, como em C.

### Módulo `memoria`

Para parâmetros de saída (`T** saida`), buffers e acesso a memória sem estrutura declarada. Deslocamentos em bytes:

```delegua
var memoria = importar("memoria")

var saida = memoria.alocar(memoria.tamanhoPonteiro())
Git.git_repository_open(saida, ".")
var repositorio = memoria.lerPonteiro(saida, 0)
memoria.liberar(saida)
```

Funções: `alocar`, `liberar`, `tamanhoPonteiro`, `deslocar`, `copiar`, `lerPonteiro`, `lerInteiro`, `lerLongo`, `lerNumero`, `lerByte`, `lerTexto` (char* guardado no endereço), `escreverPonteiro`, `escreverInteiro`, `escreverLongo`, `escreverNumero`, `escreverByte`, `textoDe` (caracteres no endereço) e `textoDeTamanho`.

### Resolução de nome de classe FFI (implementação interna)

Quando uma `classe estrangeira` é compilada, um objeto sentinela `VariavelEscopo` com `variavelLlvm=null` é inserido no escopo de módulo (o frame mais externo da `PilhaVariaveisEscopo`). O campo `tipo` desse sentinela contém o nome da classe.

Isso permite que chamadas estáticas como `LibM.cosseno(0.0)` resolvam o nome `LibM` pela pilha de escopos sem alocar memória. Quando o compilador encontra uma chamada de método em que `nomeClasse` pertence a `ffiClasses`, despacha para `chamarMetodoFFI()` em vez do caminho padrão de método de classe.

> **Nota:** Essa abordagem de sentinela pode mudar no futuro; consulte o código em `compilarClasseEstrangeira()` e `pilha-variaveis-escopo.ts` para a implementação atual.

## Pacotes

Pacotes instalados pelo gerenciador [`pacote`](https://github.com/DesignLiquido/pacote-go) ficam em `pacotes/llvm/<nome>/` e são importados pelo nome:

```delegua
importar { comparar, satisfaz } de "semver"
```

O compilador procura `pacotes/llvm/<nome>/pacoteca.jsonc` a partir do diretório do arquivo que importa, subindo até a raiz, e compila o `pontoDeEntrada` do manifesto junto com o programa. Módulos embutidos (`json`, `arquivos`, `processo`...) têm prioridade sobre pacotes de mesmo nome.

Um pacote pode trazer código C próprio, declarado em `nativo` no `pacoteca.jsonc`:

```jsonc
{
  "nome": "git",
  "pontoDeEntrada": "git.delegua",
  "nativo": {
    // Compiladas e ligadas junto com o programa; podem incluir os cabeçalhos do runtime (ex.: "vetor.h").
    "fontes": ["c/git.c"],
    // Bibliotecas do sistema (-l): uma lista, ou uma lista por sistema operacional.
    "bibliotecas": { "linux": ["git2"], "darwin": ["git2"], "windows": ["git2"] }
  }
}
```

As funções dessas fontes são declaradas com `biblioteca="nativo"`, que não gera `-l`:

```delegua
@definicao(biblioteca="nativo", prefixo="git_delegua_")
classe estrangeira GitNativo {
    clonar(url: texto, destino: texto): inteiro
}
```

## Módulo `processo`

```delegua
var processo = importar("processo")

processo.sistemaOperacional()            // "windows", "darwin", "linux"...
processo.arquitetura()                   // "amd64", "arm64"...
processo.variavelAmbiente("HOME")        // texto, ou nulo se não definida
processo.executar("git", ["status"], "./repositorio")       // código de saída (-1: não iniciou)
processo.executarCapturando("git", ["rev-parse", "HEAD"])   // saída padrão; código em ultimoCodigoSaida()
processo.escreverErro("mensagem")        // stderr
processo.sair(1)
```

`executar` não passa por um shell: os argumentos chegam ao programa exatamente como informados. No Windows, `executar("npm", ...)` encontra `npm.cmd` no `PATH`; para arquivos de lote (`.cmd`/`.bat`), argumentos com `%`, `"` ou quebras de linha são recusados, porque o `cmd.exe` os interpretaria.

## Módulo `rede`

Soquetes TCP (IPv4/IPv6) com tempo limite em milissegundos (negativo: sem limite). Soquetes são `ponteiro`; `nulo` indica falha, com o motivo em `ultimoErro()`.

```delegua
var rede = importar("rede")

// Servidor local de retorno (ex.: autenticação pelo navegador)
var servidor = rede.escutar("127.0.0.1", 0)          // porta 0: o sistema escolhe
var porta = rede.portaLocal(servidor)
var conexao = rede.aceitar(servidor, 120000)          // nulo se ninguém conectar em 2 minutos
var requisicao = rede.lerAte(conexao, "\r\n\r\n", 65536, 5000)
rede.escrever(conexao, "HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok")
rede.fechar(conexao)
rede.fechar(servidor)

// Cliente
var cliente = rede.conectar("exemplo.com", 80, 3000)
```

Funções: `escutar`, `portaLocal`, `aceitar`, `conectar`, `ler(conexao, maxBytes, tempoLimite)` (o que estiver disponível; `""` quando o outro lado fecha), `lerAte(conexao, delimitador, maxBytes, tempoLimite)`, `escrever`, `fechar`, `ultimoErro`, `codificarComponenteUrl` e `decodificarComponenteUrl`. No Windows o módulo liga o Winsock (`ws2_32`) automaticamente.

## Módulo `tempo`

```delegua
var tempo = importar("tempo")

tempo.carimboDeTempoUnix()                // segundos desde 1970 (como no delegua-tempo do Node.js)
tempo.carimboDeTempoUnixMilissegundos()   // milissegundos desde 1970
tempo.monotonicoMilissegundos()           // relógio monotônico, para medir intervalos e tempos limite
tempo.dormir(250)
```

## Exceções

Mesma semântica do núcleo de Delégua:

```delegua
classe ErroRede herda Excecao {
    codigo: inteiro
    construtor(mensagem: texto, codigo: inteiro) {
        super.construtor(mensagem)
        isto.codigo = codigo
    }
}

tente {
    baixar(url)                         // a exceção pode vir de qualquer profundidade de chamadas
} pegue (erro: ErroRede) {              // só instâncias de ErroRede (ou subclasses)
    escreva(erro.mensagem + " " + texto(erro.codigo))
} pegue (erro) {                        // qualquer outra
    escreva(erro)                       // escreve a mensagem
} finalmente {
    escreva("sempre")
}
```

- `falhar <instância de classe>` lança o objeto; `falhar "texto"` (ou outro valor) lança uma instância da classe embutida `Excecao`, com `mensagem`.
- Vale o primeiro `pegue` correspondente; sem correspondência, `finalmente` executa e a exceção continua propagando. `senão` executa só quando não houve exceção.
- Exceção não tratada: a mensagem vai para a saída de erro e o programa termina com código 1.

As exceções são implementadas com `setjmp`/`longjmp` da biblioteca C (`bibliotecas/excecoes.c`), sem a ABI de exceções de C++: funcionam igual em Linux, macOS e Windows, inclusive com o clang nativo do Windows (ABI MSVC). Funções que contêm `tente` são compiladas sem otimização (`optnone`), para que variáveis alteradas dentro do `tente` mantenham seus valores no `pegue`.

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

## Benchmarks

O diretório [`benchmarks/`](benchmarks/) contém programas equivalentes em Delégua, C e Rust para medir o desempenho do código compilado. Os três cenários cobertos são:

| Benchmark | Descrição |
|-----------|-----------|
| Fibonacci recursivo | Calcula `fib(40)` por recursão |
| Contagem de primos | Conta primos até 1.000.000 |
| Bubble sort | Ordena um vetor de 10.000 elementos |

Todos os binários são compilados com `-O2` (Delégua via LLVM, C via `clang`, Rust via `rustc`). O script valida que os resultados são idênticos entre as três linguagens antes de medir o tempo.

### Executando os benchmarks

Requer `clang`, `rustc` e `python3` disponíveis no `PATH`:

```sh
cd benchmarks
bash executar.sh        # 3 execuções por linguagem (padrão)
bash executar.sh 10     # 10 execuções por linguagem
```

## Contribuindo

- Nomes de variáveis, comentários e documentação devem estar em português, pois o projeto é em português.
- Utilize o Yarn como gerenciador de pacotes. Não utilize o `npm` diretamente.

## Inspiração

- https://mcyoung.xyz/2023/08/01/llvm-ir/ (em inglês)
- https://mukulrathi.com/create-your-own-programming-language/llvm-ir-cpp-api-tutorial/ (em inglês)