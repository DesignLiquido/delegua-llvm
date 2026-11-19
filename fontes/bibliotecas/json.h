#pragma once
#include "terceiros/cjson/cJSON.h"

// Converte texto JSON em cJSON*. Retorna NULL se inválido.
cJSON*  delegua_json_texto_para_objeto         (char* texto);

// Serializa cJSON* para texto JSON compacto. Retorna string alocada.
char*   delegua_json_objeto_para_texto         (cJSON* obj);

// Lê arquivo e faz parse do JSON. Retorna NULL se falha.
cJSON*  delegua_json_importar_arquivo          (char* caminho);

// Serializa e escreve JSON no arquivo.
void    delegua_json_exportar_arquivo          (cJSON* obj, char* caminho);

// Acessores — todos recebem cJSON* (opaco).
cJSON*  delegua_json_obter_campo               (cJSON* obj, char* chave);
cJSON*  delegua_json_obter_item                (cJSON* arr, int indice);
int     delegua_json_tamanho                   (cJSON* arr);
char*   delegua_json_valor_texto               (cJSON* item);
double  delegua_json_valor_numero              (cJSON* item);
void    delegua_json_liberar                   (cJSON* obj);

#include "vetor.h"

// Tipo do item: "objeto", "vetor", "texto", "numero", "logico", "nulo" ou "invalido" (NULL).
char*   delegua_json_tipo                      (cJSON* item);
int     delegua_json_valor_logico              (cJSON* item);
int     delegua_json_contem_campo              (cJSON* obj, char* chave);
// Chaves do objeto, na ordem do documento.
Vetor*  delegua_json_chaves                    (cJSON* obj);
// Serializa com indentação.
char*   delegua_json_objeto_para_texto_formatado(cJSON* obj);

// Construção. definirCampo e adicionarItem copiam o valor recebido.
cJSON*  delegua_json_criar_objeto              (void);
cJSON*  delegua_json_criar_vetor               (void);
cJSON*  delegua_json_criar_texto               (char* texto);
cJSON*  delegua_json_criar_numero              (double valor);
cJSON*  delegua_json_criar_logico              (int valor);
cJSON*  delegua_json_criar_nulo                (void);
int     delegua_json_definir_campo             (cJSON* obj, char* chave, cJSON* valor);
int     delegua_json_remover_campo             (cJSON* obj, char* chave);
int     delegua_json_adicionar_item            (cJSON* arr, cJSON* valor);
