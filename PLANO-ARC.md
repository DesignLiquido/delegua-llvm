# Auditoria de Vazamentos de Memória e Plano de Arquitetura ARC (`delegua-llvm`)

Este documento registra a auditoria completa de vazamentos de memória e riscos de tempo de execução em `@designliquido/delegua-llvm`, bem como o plano em fases para adotar **ARC (Automatic Reference Counting)** com coletor de ciclos auxiliar — sem Garbage Collector (Boehm GC).

---

## Decisões de Arquitetura Aprovadas

1. **`Vetor` como referência ARC no heap:** Deixa de ser um struct copiado por valor (`{ ptr, i32 }`) para ser um objeto no heap gerenciado por ARC (com `capacidade`, crescimento geométrico e elemento gerenciado), eliminando cópia rasa + *use-after-free* e unificando `vetor.h` e `estatistica.h`.
2. **Literais `texto` com cabeçalho imortal (`rc = -1`):** Literais globais no LLVM IR e constantes C no tempo de execução recebem um cabeçalho negativo `{ rc = -1, descritor = NULL }` antes dos bytes UTF-8 em `.rodata`, preservando 100% de compatibilidade com `char*` em `printf`/FFI sem tabela hash de ponteiros. Strings retornadas por funções FFI externas (`@definicao`) são copiadas na fronteira para strings ARC.
3. **Handles opacos C encapsulados em caixas ARC:** Handles de módulos (`json`, `csv`, `dados`, `arquivos`, `http`, `rede`) deixam de usar o tipo `'texto'` em `registro-modulos/*.ts`, passam a usar tipos opacos distintos (`opaco:*`) encapsulados em objetos ARC com destrutor C automático (mantendo `.liberar()` / `.fechar()` idempotentes), e todos os acessores de string retornam cópias ARC seguras em vez de ponteiros emprestados/internos.
4. **Quebra de ciclos via coletor de ciclos auxiliar (+ `fraco`):** Além da contagem de referências determinística e suporte a referências fracas (`fraco`), o `ArcDescritor` incluirá suporte a visitação de filhos para um coletor de ciclos por *trial deletion* (estilo Bacon-Rajan) para grafos cíclicos de classes, vetores e dicionários.

---

## Parte 1 — Auditoria de Vazamentos e Problemas Estruturais

### 1.1 Vazamentos Ativos Mapeados

| Categoria | Localização | Causa e impacto |
| :--- | :--- | :--- |
| **Instâncias de classes e exceções** | [`fontes/classes.ts`](fontes/classes.ts#L50), [`fontes/excecoes.ts`](fontes/excecoes.ts#L126) | `malloc`/`calloc` sem nenhum `free()`. |
| **Textos temporários e concatenações** | [`fontes/operacoes.ts`](fontes/operacoes.ts#L95-L101), [`fontes/texto.ts`](fontes/texto.ts#L262-L297), [`fontes/bibliotecas/padrao.c`](fontes/bibliotecas/padrao.c#L198-L220) | Cada `+` e interpolação `${...}` chama `delegua_formatar` (`malloc`); laços de concatenação vazam $O(N^2)$ bytes. |
| **Indexação de texto (`texto[i]`)** | [`fontes/compilador-llvm.ts`](fontes/compilador-llvm.ts#L1658-L1674) | Aloca `malloc(2)` a cada leitura de caractere, nunca liberado. |
| **Operações de `texto`, `leia` e conversões** | [`fontes/bibliotecas/padrao.c`](fontes/bibliotecas/padrao.c#L82-L196), [`fontes/bibliotecas/texto.c`](fontes/bibliotecas/texto.c#L4-L208) | Retornam buffers `malloc`/`realloc` sem dono (`texto_de_*`, `leia`, `maiusculo`, `dividir`, `substituir`, `aparar`, etc.). |
| **Vetores (`Vetor`)** | [`fontes/compilador-llvm.ts`](fontes/compilador-llvm.ts#L2692-L2756), [`fontes/bibliotecas/vetor.c`](fontes/bibliotecas/vetor.c#L33-L428) | Buffers nunca liberados; `removerUltimo`/`removerPrimeiro` não destroem elementos; sem `capacidade` (`realloc` a cada `adicionar`). |
| **Dicionários (`Dicionario`)** | [`fontes/bibliotecas/dicionario.c`](fontes/bibliotecas/dicionario.c#L33-L219) | Não existe `delegua_dicionario_liberar`; sobrescrita em `definir` e remoção em `remover` vazam `entrada->valor`. |
| **Boxing em heap (`embalarValorEmHeap`)** | [`fontes/colecoes.ts`](fontes/colecoes.ts#L100-L112), [`fontes/classes.ts`](fontes/classes.ts#L539) e [L592](fontes/classes.ts#L592) | Escalares guardados em dicionários ou passados a parâmetros `qualquer` fazem `malloc(1\|4\|8)` e nunca são liberados. |
| **Módulos C padrão** | [`fontes/bibliotecas/dados.c`](fontes/bibliotecas/dados.c#L125-L145), [`fontes/registro-modulos/dados.ts`](fontes/registro-modulos/dados.ts), [`fontes/bibliotecas/arquivos.c`](fontes/bibliotecas/arquivos.c), `json.c`, `csv.c`, `http.c`, `rede.c`, `processo.c`, `criptografia*.c`, `memoria.c` | `delegua_dados_liberar`/`serie_liberar` não são expostas em TS; `Arquivo*` não tem `liberar`; strings retornadas não têm dono. |

### 1.2 Problemas Estruturais Subjacentes

1. **4 tempos de vida incompatíveis atrás do mesmo `ptr`/`char*`:**
   - Literais estáticos `.rodata` e buffers estáticos globais (`ultimo_erro` em `rede.c`, `"windows"` em `processo.c`, `"objeto"` em `json.c`).
   - Ponteiros emprestados/internos (`cJSON_GetStringValue`, `filho->string` em `delegua_json_chaves`, `e->chave` em `delegua_dicionario_chaves`, `arq->conteudo` em `delegua_arq_para_texto` liberado por `recarregar`, `l->celulas[c]` em `csv.c`, `resp->dados` em `http.c`, `delegua_arg_argv_cache`).
   - Ponteiro de pilha exposto como `texto` em `para cada c em texto` (`alloca [2 x i8]` em `compilador-llvm.ts` L1330-L1363) — *dangling pointer* se armazenado ou retornado.
   - Handles opacos C (`cJSON*`, `Arquivo*`, `TabelaCsv*`, `ClienteHttp*`, `RespostaHttp*`, `RecorteDados*`, `Serie*`) registrados com tipo Delégua `'texto'`.
2. **Cópia rasa de `%Vetor` (`{ ptr, i32 }`) por valor** em retornos e campos de classe, gerando *use-after-free* após `realloc` e impossibilitando ARC sem referência compartilhada. Além disso, `estatistica.h` redeclara `Vetor` separadamente de `vetor.h`.
3. **`CreateAlloca` emitido no bloco atual em vez do bloco de entrada** em `visitarDeclaracaoVar`, `visitarDeclaracaoConst`, `visitarDeclaracaoVarMultiplo`, `visitarDeclaracaoConstMultiplo` e `visitarExpressaoVetor`.
4. **`setjmp`/`longjmp` (`excecoes.ts` / `excecoes.c`)** pula epílogos de funções intermediárias, exigindo uma pilha cooperativa de limpeza ARC antes do `longjmp`.
5. **Assimetria de indireção (`ptr*` vs `ptr`)** entre parâmetros `texto`/`dicionário`/`qualquer` e instâncias de classe.
6. **Ciclos de referência** entre classes, vetores e dicionários.

---

## Parte 2 — Plano de Implementação por Fases

### Fase 0 — Higienização Pré-ARC e Unificação de ABI
- [x] **0.1 Alocações de pilha no bloco de entrada:** Trocar `CreateAlloca` inline por `criarAllocaNoBlocoEntrada` em `visitarDeclaracaoVar`, `visitarDeclaracaoConst`, `visitarDeclaracaoVarMultiplo`, `visitarDeclaracaoConstMultiplo` e `visitarExpressaoVetor`, inicializando slots de ponteiro com `null` na entrada da função.
- [x] **0.2 Separar handles C opacos de `'texto'`:** Introduzir tipos `opaco:*` nos registros de módulos (`json.ts`, `http.ts`, `arquivos.ts`, `csv.ts`, `dados.ts`, `rede.ts`) para que handles opacos não sejam tratados como `texto` pelo compilador.
- [x] **0.3 Unificar `Vetor` como referência no heap:**
  - Remover a definição duplicada de `Vetor` em `estatistica.h` (incluindo `vetor.h`).
  - Adicionar `capacidade` (crescimento $2\times$), `tam_elem` e metadados de elemento em `Vetor`, passando a alocar a estrutura `Vetor` no heap via `delegua_vetor_criar` e representá-la no LLVM IR como `ptr` (eliminando cópia por valor `{ ptr, i32 }`).
  - Unificar funções que retornavam `Vetor*` vs out-param `Vetor*`.
- [x] **0.4 Corrigir segurança de ponteiros e checagens no tempo de execução C:**
  - Substituir o `[2 x i8]` na pilha em `para cada c em texto` por alocação segura (`delegua_texto_caractere_em` ou buffer heap).
  - Fazer funções que retornam ponteiros emprestados (`delegua_arq_para_texto`, `delegua_json_valor_texto`, `delegua_json_chaves`, `delegua_dicionario_chaves`, `delegua_csv_obter_celula`, `delegua_http_dados`, `delegua_rede_ultimo_erro`, `delegua_arg_argumento`) retornarem cópias próprias ou estáticas seguras.
  - Corrigir checagens de `ftell < 0` / `fread` / `strdup == NULL` em `arquivos.c`, `csv.c`, `json.c`, `http.c` e `dicionario.c`.
  - Expor `liberar` em `dados.ts` e `arquivos.c`/`arquivos.ts` até a entrada do ARC automático.

  - **Estado (2026-11-25):** Fase 0 concluída e verificada (testes de unidade + execução em `testes/compilador-llvm.vetores-execucao.test.ts`). Correções adicionais encontradas na verificação:
    - Objetos de classe passam a ser alocados com `calloc` (campos de ponteiro começam nulos) e campos `vetor` (próprios e herdados) começam como `Vetor*` vazio — antes `isto.itens.adicionar(x)` sem inicialização corrompia o heap.
    - `var f = v.fatiar(...)` sem anotação: o analisador tipava como `qualquer[]`; o compilador agora refina pelo tipo do inicializador.
    - `retorna [1, 2]` numa função `: inteiro[]` gravava doubles lidos como i32; o literal agora assume o tipo de elemento declarado.
    - `para cada c em "literal"` não gerava o laço; texto bruto agora é guardado num slot.
    - `arquivos.c` não compilava (`duplicar_texto` usado antes de declarado).

### Fase 1 — Tempo de execução ARC (`arc.h` / `arc.c`) e Migração das Coleções
- [x] **1.1 Criar `fontes/bibliotecas/arc.h` e `fontes/bibliotecas/arc.c`** e incluí-los em `BIBLIOTECAS_NUCLEO`:
  - `ArcCabecalho { int32_t rc; uint32_t magia; const ArcDescritor* tipo; }` (16 bytes antes do payload). A `magia` (`DELEGUA_ARC_MAGIA`) identifica ponteiros gerenciados: `reter`/`liberar` ignoram ponteiros sem ela, o que permite migrar tempo de execução e compilador aos poucos.
  - `ArcDescritor { const char* nome; void (*destrutor)(void*); void (*visitar_filhos)(void*, visitante, contexto); }`.
  - Primitivas: `delegua_arc_alocar`, `delegua_arc_reter`, `delegua_arc_liberar`, `delegua_arc_atribuir(void** slot, void* novo)`, `delegua_arc_texto_criar`, `delegua_arc_texto_copiar`, `DELEGUA_TEXTO_ESTATICO("...")`.
  - Contadores de depuração (`DELEGUA_ARC_DEPURACAO`) para validar 0 vazamentos em testes.
- [x] **1.2 Migrar todas as alocações do tempo de execução C** (`padrao.c`, `texto.c`, `vetor.c`, `dicionario.c`, `arquivos.c`, `csv.c`, `dados.c`, `http.c`, `json.c`, `rede.c`, `processo.c`, `criptografia*.c`, `memoria.c`) para o alocador ARC.
- [x] **1.3 Destrutores completos de coleções, caixas `qualquer` e handles opacos (`ARC_OPACO`):**
  - `Vetor`: libera elementos gerenciados em `remover*`, sobrescrita e destruição, e libera o buffer de elementos.
  - `Dicionario`: `definir` e `remover` liberam valores antigos/removidos; destrutor libera todas as entradas, chaves, valores e `baldes`.
  - `ArcCaixa`: substitui `embalarValorEmHeap` para valores escalares em dicionários e parâmetros `qualquer`.
  - `ARC_OPACO`: caixas ARC para `cJSON*`, `Arquivo*`, `TabelaCsv*`, `RecorteDados*`, `Serie*`, `ClienteHttp*`, `RespostaHttp*`, `SoqueteDelegua*` com limpeza automática (e `.liberar()`/`.fechar()` idempotentes).

  - **Estado (2026-11-25):** Fase 1 concluída. `arc.h`/`arc.c` no núcleo; todo texto devolvido pelo tempo de execução C é ARC (+1); `Vetor`, `Dicionario`, `JsonRef`, `TabelaCsv`, `RecorteDados`, `Serie`, `Arquivo`, `SoqueteDelegua`, `ClienteHttp` e `RespostaHttp` são objetos ARC com destrutor, e os `liberar`/`fechar` manuais liberam o conteúdo de forma idempotente (a estrutura em si fica para o ARC). Verificado por `testes/bibliotecas/arc-teste.c` (0 alocações vivas, limpo sob AddressSanitizer), pela suíte de execução e compilando o `delegua-delegua`.
    - **Convenção do tempo de execução:** funções devolvem +1; coleções retêm o que guardam e liberam o que removem, sobrescrevem ou destroem; parâmetros são emprestados (+0).
    - **`Vetor`** ganhou o campo `gerenciado` (`%Vetor = { ptr, i32, i32, i32, i32 }`) e `delegua_vetor_criar(tamanho, tam_elem, gerenciado)`; o compilador marca como gerenciados os elementos que não são escalares, ponteiros de função ou `ponteiro`.
    - **JSON:** `cJSON*` não pode ter cabeçalho, então o handle virou `JsonRef { no, raiz, removidos }`. Filhos (`obterCampo`/`obterItem`) retêm a raiz; nós substituídos ou removidos vão para `removidos` (nunca ficam pendentes); `json.liberar` apaga a árvore e os filhos passam a ver JSON inválido.
    - **Caixas `qualquer`:** `embalarValorEmHeap` usa `delegua_arc_caixa`. `texto[i]` e `para cada c em texto` leem o byte direto e criam um texto ARC de 1 caractere (sem `strlen` por iteração).
    - **Literais devolvidos pelo C** (`json.tipo`, `processo.sistemaOperacional`, ...) usam `DELEGUA_TEXTO_ESTATICO` (imortais).

### Fase 2 — Instrumentação ARC no `CompiladorLLVM`

- [x] **2.1 Literais imortais no IR:** literais globais de texto com `{ i32 -1, i32 0xA4C0DE1A, ptr null, [N x i8] }` (layout de `ArcCabecalho` + bytes), deduplicados por conteúdo; retornos `texto` de classes estrangeiras (`@definicao`) copiados com `delegua_arc_texto_copiar` na fronteira.
- [x] **2.2 Destrutores gerados para classes:** `__destrutor_<Classe>` e `__arc_desc_<Classe>` criados na primeira instanciação (layout completo, inclusive campos herdados); instâncias e `Excecao` alocadas com `delegua_arc_alocar`.
- [x] **2.3 Convenção de chamadas (+0 emprestado / +1 retornado):**
  - Parâmetros em +0. `retorna` retém o valor devolvido (+1).
  - Temporários: um gancho em `CreateCall` reconhece, pelo nome do alvo (registrado quando a função é obtida ou criada), chamadas que devolvem +1: funções, métodos e lambdas Delégua com retorno de ponteiro, despachos, `delegua_arc_alocar`/criadores do tempo de execução C (com lista de exceções emprestadas: `delegua_dicionario_obter`, `delegua_vetor_definir_indice`, `delegua_excecao_*`, memória bruta). O resultado vai para um slot próprio do ponto de criação; gravar de novo no slot libera o valor anterior (laços), e os slots pendentes são liberados ao fim de cada instrução (expressão, `var`/`const`, `escreva`) e nos retornos. Chamadas indiretas (ponteiro de função) são tratadas como emprestadas: no pior caso vazam, nunca liberam cedo.
  - Caller e callee usam a mesma regra (`retornoPonteiroEhProprio` sobre o tipo de retorno declarado): só tipos explicitamente não gerenciados (`ponteiro`, função, estrangeiros) ficam de fora.
- [x] **2.4 Variáveis e campos donos de referência:**
  - Cada função (inclusive `main` e lambdas) tem um quadro ARC (pilha aninhada). Slots locais gerenciados são gravados com `delegua_arc_atribuir` (declaração, reatribuição, iteração seguinte de um laço) e liberados antes de cada `ret`, inserido ao fim da compilação (com localização de depuração do subprograma). **Diferente do plano original:** a liberação é no fim da função, não no fim de cada bloco léxico; a variável de um bloco dentro de um laço é solta na iteração seguinte (pelo `atribuir`) ou no retorno. `sustar`/`continua` não precisam de tratamento especial.
  - Atribuição a slot de outro dono (parâmetro `texto`/`qualquer`/dicionário, que é o slot de quem chamou) só retém o novo valor.
  - Campos (`isto.campo = x`), elementos (`[a, b]`, `v[i] = x`) e a variável de `pegue (e)` retêm; `para cada` retém o iterável num slot oculto durante o laço e o elemento na variável do laço.
  - Tipo desconhecido ou `nulo` conta como gerenciado (`var r = nulo` que depois recebe um objeto temporário causava uso após liberação).
  - Literais de vetor gravados em destinos tipados (variável, campo, retorno, argumento) assumem o tipo de elemento do destino; sem isso `isto.simbolos = []` num campo `Simbolo[]` criava um vetor não gerenciado e os objetos adicionados eram liberados.
- **Estado (2026-11-25):** Fase 2 concluída. Os programas de teste e o interpretador `delegua-delegua` compilado terminam com 0 alocações vivas (`DELEGUA_ARC_DEPURACAO`) e sem erros sob AddressSanitizer (inclusive sem a isenção da leitura da magia). Testes: `testes/compilador-llvm.arc-execucao.test.ts` (modo estrito).
  - **Vetores sem verificação de limites:** o código compilado não verifica índices. O tempo de execução mantém uma posição sentinela zerada após o último elemento e zera posições removidas, então `v[v.tamanho()]` devolve nulo (o `delegua-delegua` lê o símbolo atual após o fim); leituras mais distantes continuam indefinidas e, com ARC, podem travar ao reter lixo.
  - ~~Pendente para a Fase 3: temporários e variáveis de funções abandonadas por `longjmp` não são liberados; o objeto e a mensagem da exceção vivem até o fim do programa.~~ Resolvido na Fase 3.
  - **Pendente para a Fase 4.3:** pares `reter`/`liberar` redundantes (temporário consumido por variável), temporários da condição de `se`/`enquanto` liberados só na instrução seguinte ou no retorno.

### Fase 3 — Exceções (`setjmp`/`longjmp`) + Desenrolamento ARC
- [x] **3.1 Quadro de limpeza cooperativo em `arc.c` / `excecoes.c` / `arc.ts`:**
  - Cada função Delégua com slots gerenciados monta na própria pilha um quadro `{ anterior, quantidade, [N x ptr] slots }` com os endereços dos seus slots donos e temporários, empilhado no início do corpo (`delegua_arc_quadro_empilhar`) e desempilhado antes de cada `ret`. O quadro é montado ao finalizar a compilação, antes de uma âncora (carga morta) emitida no início do corpo, depois das allocas; só é emitido se o programa tiver algum `tente` (sem `tente`, custo zero).
  - Cada `tente` guarda o topo dos quadros de limpeza ao instalar o tratador; `delegua_excecao_lancar` libera (e anula) os slots de todos os quadros acima dele antes do `longjmp`. A função que contém o `tente` não é afetada (o quadro dela está abaixo da marca).
  - O tempo de execução é dono de uma referência ao objeto e de uma cópia ARC da mensagem em voo (retidos antes de desenrolar). O despacho do `pegue` guarda os dois em slots donos e chama `delegua_excecao_concluir`, que solta os do tempo de execução; o caminho sem `pegue` correspondente (`finalmente` + relançamento) usa os slots.
  - O modo estrito de `DELEGUA_ARC_DEPURACAO` só acusa vazamentos após o fim normal de `main` (`delegua_arc_fim_normal`): exceção não tratada continua saindo com código 1.
- **Estado (2026-11-25):** Fase 3 concluída. 200 exceções atravessando 6 níveis de chamadas com textos, objetos e vetores locais: 7205 alocações, 7205 liberações, sem erros sob AddressSanitizer (também com `-g`). Testes em `testes/compilador-llvm.arc-execucao.test.ts`.
  - Limitação: temporários criados dentro de funções do tempo de execução C que chamam `falhar` (ex.: erro no meio de uma operação de vetor) não são liberados.

### Fase 4 — Coletor de Ciclos Auxiliar, `@fraco` e Otimizações
- [x] **4.1 Coletor de ciclos (Bacon-Rajan *trial deletion* síncrono, em `arc.c`):**
  - `visitar_filhos` em `Vetor` (gerenciado), `Dicionario` e nas classes: `__visitar_<Classe>` é gerado só quando a classe tem campos que podem fechar um ciclo (não só `texto`/`opaco:*`) e ignora campos `@fraco`.
  - Uma liberação que deixa `rc > 0` num objeto com `visitar_filhos` o põe no buffer de raízes candidatas. A coleta roda num ponto de alocação quando o buffer passa de 10 000 raízes (nunca dentro de um destrutor) e ao fim do programa no modo de depuração; `delegua_arc_coletar_ciclos()` também pode ser chamada diretamente.
  - Cor e marcadores do coletor ficam no byte baixo de `magia` (os 24 bits altos continuam identificando o cabeçalho; os literais `{ i32 -1, i32 0xA4C0DE1A, ... }` não mudam).
  - Percursos iterativos (sem recursão em C). No lixo, as arestas para objetos vivos são restauradas, os objetos ficam imortais e passam pelos destrutores normais (que soltam só os filhos vivos); por fim a memória é desalocada. Objeto que chega a `rc = 0` enquanto está no buffer roda o destrutor e só tem a memória desalocada pela coleta.
- [x] **4.2 Referências fracas com o decorador `@fraco` (em vez de palavra reservada; não exige mudança na gramática):**
  - `@fraco` num campo de classe: a gravação usa `delegua_arc_fraco_atribuir`, que não retém e registra o slot numa tabela lateral (alvo → slots, marcador `MARCA_TEM_FRACOS` no cabeçalho). Quando o alvo morre (liberação ou coleta de ciclo), todos os slots registrados viram nulo antes do destrutor dele.
  - O destrutor do dono só cancela o registro; o visitante de ciclos ignora o campo. `@fraco` em campo que não referencia objeto/vetor/dicionário (escalar, `texto`) é erro de compilação.
- [x] **4.3 Elisões e otimização:**
  - `reter`/`liberar` não são emitidos para constantes (literais imortais, nulo); `atribuir` de constante vira carga + gravação + liberação do anterior.
  - Semântica de movimento: um temporário +1 consumido na mesma instrução por variável, campo ou `retorna` passa a referência adiante (slot do temporário anulado), sem par `reter`/`liberar`.
  - Dentro de instruções que liberam seus temporários (expressão, `var`/`const`, `escreva`), o ponto de criação não solta mais o valor anterior do slot (sempre nulo ali); o despacho do `pegue` solta todos os temporários da função, cobrindo a instrução interrompida por `longjmp`.
  - Medição (300 mil iterações com texto, objeto e campo; 1,2 milhão de alocações): chamadas a `reter` 1,5 M → 0,3 M, `liberar` 4,5 M → 2,7 M, tempo ~200 ms → ~184 ms. O relatório de `DELEGUA_ARC_DEPURACAO` passou a mostrar `ciclos`, `reter` e `liberar`.
- **Estado (2026-11-25):** Fase 4 concluída. Testes: ciclos (árvores pai ↔ filhos, cadeia circular de 100 mil nós com coletas automáticas, dicionário que contém a si mesmo), `@fraco` (zerado ao morrer o alvo, sem coleta necessária), exceção interrompendo instrução em laço; tudo com 0 alocações vivas e sem erros sob AddressSanitizer.
  - Correção encontrada nos testes: variável `número` passada a parâmetro `inteiro` era lida como i32 a partir dos bits do double (`var i = 3; g(i)` passava 0); agora é carregada com o tipo da variável e convertida.
  - Pendente: operações com custo ainda evitável (liberações de nulo nas saídas de função, temporários de condições de `se`/`enquanto` liberados só na instrução seguinte).

### Fase 5 — Verificação e Regressão Anti-Vazamento
- [x] **5.1 Modo estrito em todos os testes de execução:** `testes/configuracao-arc.ts` (em `setupFiles` do Jest) define `DELEGUA_ARC_DEPURACAO=estrito` para todo programa que os testes compilam e executam (vetores, despacho, argumentos, HTTP, console, ARC). Um programa que termina normalmente com alocações vivas (após a coleta de ciclos final) sai com código 99 e o teste falha. O relatório mostra `alocacoes`, `liberacoes`, `vivas`, `pico` (máximo de vivas ao mesmo tempo), `ciclos`, `reter` e `liberar`.
- [x] **5.2 Suíte de estresse e sanitizadores:**
  - `testes/compilador-llvm.arc-estresse.test.ts` (com `DELEGUA_TESTES_ESTRESSE=1`): 1 milhão de iterações com textos (concatenação, interpolação, indexação, dividir/juntar); 200 mil objetos em vetores e dicionários sobrescritos e removidos; 200 mil ciclos pai ↔ filho; 100 mil exceções atravessando funções; 3000 rodadas de JSON, CSV e arquivos sem `liberar` manual. Além do resultado e de 0 vivas no fim, cada teste limita o `pico`: a memória precisa ser recuperada durante a execução.
  - `DELEGUA_FLAGS_C`: flags extras do compilador C passadas por `ilc` aos objetos do tempo de execução e à ligação (ex.: `-fsanitize=address -fno-omit-frame-pointer`).
  - CI (`.github/workflows/principal.yml`, job `arc-sanitizadores`, Linux): compila todo o tempo de execução C (inclusive `criptografia*` com OpenSSL e `http` com libcurl) e roda os testes de execução e de estresse com AddressSanitizer + LeakSanitizer no modo estrito.
- **Estado (2026-11-25):** Fase 5 concluída localmente (Windows, AddressSanitizer sem LeakSanitizer, que não existe no Windows); o job de CI no Linux ainda precisa rodar pela primeira vez.
  - Correções encontradas pela suíte de estresse:
    - **Destruição sem recursão:** a destruição de uma cadeia longa (cada objeto liberando o próximo no destrutor) estourava a pilha de C com 200 mil elos. Objetos que chegam a `rc = 0` agora entram numa fila esvaziada em laço pela chamada mais externa de `delegua_arc_liberar`; referências fracas continuam zeradas no momento da morte.
    - Variável `número` gravada em campo `inteiro` era lida como i32 a partir dos bits do double (`a.valor = i` com `var i = 7` gravava 0): `carregarValorSeNecessario` agora carrega com o tipo da variável e converte.
    - `var c = s[i]` sobre um texto era inferido como `qualquer` (`c.tamanho()` virava `delegua_vetor_tamanho`, `escreva(c)` não escrevia nada): a indexação de texto agora é inferida como `texto`.
  - Uma exceção não tratada deixa objetos vivos de propósito; o teste correspondente desliga a detecção do LeakSanitizer para manter o código de saída 1.

---

## Resumo

Com as fases 0–5, programas Delégua compilados liberam a própria memória de forma determinística: textos, vetores, dicionários, instâncias e handles de módulos são contados por referência; ciclos são coletados; campos `@fraco` não retêm; exceções liberam as funções que atravessam. Os testes de execução, a suíte de estresse e o interpretador `delegua-delegua` compilado terminam com 0 alocações vivas e sem erros do AddressSanitizer.

Limitações conhecidas:
- Vetores não verificam limites: além da posição sentinela após o fim, uma leitura fora do intervalo é indefinida.
- Temporários criados dentro de funções do tempo de execução C que chamam `falhar` no meio do trabalho não são liberados.
- Chamadas por ponteiro de função (sem nome conhecido) tratam o resultado como emprestado: no pior caso vazam.
