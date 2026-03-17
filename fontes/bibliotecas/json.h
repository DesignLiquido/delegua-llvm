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
