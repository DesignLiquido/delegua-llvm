#include "json.h"
#include "terceiros/cjson/cJSON.c"   /* inclui a implementação diretamente */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

cJSON* delegua_json_texto_para_objeto(char* texto) {
    if (!texto) return NULL;
    return cJSON_Parse(texto);
}

char* delegua_json_objeto_para_texto(cJSON* obj) {
    if (!obj) return NULL;
    return cJSON_PrintUnformatted(obj);
}

cJSON* delegua_json_importar_arquivo(char* caminho) {
    if (!caminho) return NULL;
    FILE* fp = fopen(caminho, "rb");
    if (!fp) return NULL;

    fseek(fp, 0, SEEK_END);
    long tam = ftell(fp);
    rewind(fp);

    char* buf = (char*)malloc(tam + 1);
    if (!buf) { fclose(fp); return NULL; }
    fread(buf, 1, tam, fp);
    buf[tam] = '\0';
    fclose(fp);

    cJSON* obj = cJSON_Parse(buf);
    free(buf);
    return obj;
}

void delegua_json_exportar_arquivo(cJSON* obj, char* caminho) {
    if (!obj || !caminho) return;
    char* texto = cJSON_Print(obj);
    if (!texto) return;
    FILE* fp = fopen(caminho, "w");
    if (fp) { fputs(texto, fp); fclose(fp); }
    free(texto);
}

cJSON* delegua_json_obter_campo(cJSON* obj, char* chave) {
    if (!obj || !chave) return NULL;
    return cJSON_GetObjectItem(obj, chave);
}

cJSON* delegua_json_obter_item(cJSON* arr, int indice) {
    if (!arr) return NULL;
    return cJSON_GetArrayItem(arr, indice);
}

int delegua_json_tamanho(cJSON* arr) {
    if (!arr) return 0;
    return cJSON_GetArraySize(arr);
}

char* delegua_json_valor_texto(cJSON* item) {
    if (!item) return NULL;
    return cJSON_GetStringValue(item);
}

double delegua_json_valor_numero(cJSON* item) {
    if (!item) return 0.0;
    return cJSON_GetNumberValue(item);
}

void delegua_json_liberar(cJSON* obj) {
    if (obj) cJSON_Delete(obj);
}
