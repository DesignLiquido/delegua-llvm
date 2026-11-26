#pragma once
#include "terceiros/cjson/cJSON.h"
#include "vetor.h"

// Referência ARC a um nó JSON (handle opaco `opaco:json` em Delégua).
//
// - Raiz (`raiz == NULL`): dona da árvore cJSON; o destrutor ARC a apaga.
// - Filho (obterCampo/obterItem): aponta um nó dentro da árvore e retém a raiz, de modo que
//   a árvore vive enquanto houver qualquer referência a ela ou a seus nós.
// - Nós removidos ou substituídos (removerCampo, definirCampo) não são apagados na hora: vão
//   para `removidos` da raiz, para que referências a eles nunca fiquem pendentes.
// - `liberar` apaga a árvore antecipadamente; depois disso a raiz e os filhos se comportam
//   como JSON inválido (NULL), sem uso de memória liberada.
typedef struct JsonRef {
    cJSON* no;
    struct JsonRef* raiz;
    cJSON* removidos;
} JsonRef;

// Converte texto JSON em JsonRef*. Retorna NULL se inválido.
JsonRef* delegua_json_texto_para_objeto         (char* texto);

// Serializa para texto JSON compacto (texto ARC).
char*    delegua_json_objeto_para_texto         (JsonRef* obj);

// Lê arquivo e faz parse do JSON. Retorna NULL se falha.
JsonRef* delegua_json_importar_arquivo          (char* caminho);

// Serializa e escreve JSON no arquivo.
void     delegua_json_exportar_arquivo          (JsonRef* obj, char* caminho);

// Acessores.
JsonRef* delegua_json_obter_campo               (JsonRef* obj, char* chave);
JsonRef* delegua_json_obter_item                (JsonRef* arr, int indice);
int      delegua_json_tamanho                   (JsonRef* arr);
char*    delegua_json_valor_texto               (JsonRef* item);
double   delegua_json_valor_numero              (JsonRef* item);
void     delegua_json_liberar                   (JsonRef* obj);

// Tipo do item: "objeto", "vetor", "texto", "numero", "logico", "nulo" ou "invalido" (NULL).
char*    delegua_json_tipo                      (JsonRef* item);
int      delegua_json_valor_logico              (JsonRef* item);
int      delegua_json_contem_campo              (JsonRef* obj, char* chave);
// Chaves do objeto, na ordem do documento.
Vetor*   delegua_json_chaves                    (JsonRef* obj);
// Serializa com indentação.
char*    delegua_json_objeto_para_texto_formatado(JsonRef* obj);

// Construção. definirCampo e adicionarItem copiam o valor recebido.
JsonRef* delegua_json_criar_objeto              (void);
JsonRef* delegua_json_criar_vetor               (void);
JsonRef* delegua_json_criar_texto               (char* texto);
JsonRef* delegua_json_criar_numero              (double valor);
JsonRef* delegua_json_criar_logico              (int valor);
JsonRef* delegua_json_criar_nulo                (void);
int      delegua_json_definir_campo             (JsonRef* obj, char* chave, JsonRef* valor);
int      delegua_json_remover_campo             (JsonRef* obj, char* chave);
int      delegua_json_adicionar_item            (JsonRef* arr, JsonRef* valor);
