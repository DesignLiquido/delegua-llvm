# fontes/bibliotecas/terceiros

Dependências C externas incluídas diretamente no repositório (_vendored_).
Cada subdiretório contém uma biblioteca de terceiros com licença compatível com o projeto.

---

## Estrutura

```
terceiros/
└── cjson/
    ├── cJSON.h   — cabeçalho público
    └── cJSON.c   — implementação completa (arquivo único)
```

---

## Política de uso

- **Inclusão direta** — cada biblioteca é compilada junto com o código do projeto, sem etapa de build separada.
  O arquivo `.c` é incluído via `#include` dentro do wrapper correspondente em `fontes/bibliotecas/`:

  ```c
  // fontes/bibliotecas/json.c
  #include "terceiros/cjson/cJSON.c"
  ```

- **Sem submódulos Git** — as fontes são copiadas manualmente para evitar dependência de acesso externo no momento do build.

- **Atualização** — ao atualizar uma biblioteca, substituir os arquivos no subdiretório e registrar a nova versão na seção abaixo.

---

## Bibliotecas incluídas

### cJSON

| Campo | Valor |
|---|---|
| Versão | branch `master` (março 2025) |
| Fonte | https://github.com/DaveGamble/cJSON |
| Licença | MIT |
| Arquivos | `cjson/cJSON.h`, `cjson/cJSON.c` |
| Usada por | `fontes/bibliotecas/json.c` → módulo `delegua-json` |

**Por que cJSON?**
Biblioteca JSON em C de arquivo único, amplamente usada, sem dependências externas e com licença MIT compatível com o projeto.

**Principais funções expostas pelo wrapper `json.c`:**

| Função Delégua | Função cJSON subjacente |
|---|---|
| `json.textoParaJson(texto)` | `cJSON_Parse` |
| `json.objetoParaTextoJson(obj)` | `cJSON_PrintUnformatted` |
| `json.obterCampo(obj, chave)` | `cJSON_GetObjectItem` |
| `json.obterItem(arr, indice)` | `cJSON_GetArrayItem` |
| `json.tamanho(arr)` | `cJSON_GetArraySize` |
| `json.valorTexto(item)` | `cJSON_GetStringValue` |
| `json.valorNumero(item)` | `cJSON_GetNumberValue` |
| `json.liberar(obj)` | `cJSON_Delete` |

---

## Adicionando uma nova biblioteca

1. Crie um subdiretório com o nome da biblioteca: `terceiros/<nome>/`
2. Copie os arquivos-fonte (`.h` e `.c`) para dentro dele
3. Crie o wrapper em `fontes/bibliotecas/<nome>.h` e `<nome>.c`
4. No `.c` do wrapper, inclua a implementação diretamente:
   ```c
   #include "terceiros/<nome>/<arquivo>.c"
   ```
5. Registre o módulo em `fontes/compilador-llvm.ts` com um método `registrarModulo<Nome>()`
6. Documente a biblioteca neste README (versão, fonte, licença, arquivos, uso)
