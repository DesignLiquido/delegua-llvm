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

// ── Inspeção ────────────────────────────────────────────────────────────────

char* delegua_json_tipo(cJSON* item) {
    if (!item) return (char*)"invalido";
    if (cJSON_IsObject(item)) return (char*)"objeto";
    if (cJSON_IsArray(item)) return (char*)"vetor";
    if (cJSON_IsString(item)) return (char*)"texto";
    if (cJSON_IsNumber(item)) return (char*)"numero";
    if (cJSON_IsBool(item)) return (char*)"logico";
    if (cJSON_IsNull(item)) return (char*)"nulo";
    return (char*)"invalido";
}

int delegua_json_valor_logico(cJSON* item) {
    return (item && cJSON_IsTrue(item)) ? 1 : 0;
}

int delegua_json_contem_campo(cJSON* obj, char* chave) {
    if (!obj || !chave || !cJSON_IsObject(obj)) return 0;
    return cJSON_GetObjectItemCaseSensitive(obj, chave) ? 1 : 0;
}

Vetor* delegua_json_chaves(cJSON* obj) {
    Vetor* vetor = (Vetor*)malloc(sizeof(Vetor));
    if (!vetor) return NULL;
    vetor->ptr = NULL;
    vetor->tamanho = 0;
    if (!obj || !cJSON_IsObject(obj)) return vetor;

    int quantidade = cJSON_GetArraySize(obj);
    if (quantidade <= 0) return vetor;
    char** chaves = (char**)malloc((size_t)quantidade * sizeof(char*));
    if (!chaves) return vetor;

    int i = 0;
    for (cJSON* filho = obj->child; filho && i < quantidade; filho = filho->next) {
        chaves[i++] = filho->string;
    }
    vetor->ptr = chaves;
    vetor->tamanho = i;
    return vetor;
}

char* delegua_json_objeto_para_texto_formatado(cJSON* obj) {
    if (!obj) return NULL;
    return cJSON_Print(obj);
}

// ── Construção ──────────────────────────────────────────────────────────────

cJSON* delegua_json_criar_objeto(void) { return cJSON_CreateObject(); }
cJSON* delegua_json_criar_vetor(void) { return cJSON_CreateArray(); }
cJSON* delegua_json_criar_texto(char* texto) { return cJSON_CreateString(texto ? texto : ""); }
cJSON* delegua_json_criar_numero(double valor) { return cJSON_CreateNumber(valor); }
cJSON* delegua_json_criar_logico(int valor) { return cJSON_CreateBool(valor ? 1 : 0); }
cJSON* delegua_json_criar_nulo(void) { return cJSON_CreateNull(); }

// O valor é sempre copiado: assim um item obtido de outro documento (obterCampo,
// obterItem) pode ser reutilizado sem que dois documentos compartilhem o mesmo nó.
int delegua_json_definir_campo(cJSON* obj, char* chave, cJSON* valor) {
    if (!obj || !chave || !cJSON_IsObject(obj)) return 0;
    cJSON* copia = valor ? cJSON_Duplicate(valor, 1) : cJSON_CreateNull();
    if (!copia) return 0;
    if (cJSON_GetObjectItemCaseSensitive(obj, chave)) {
        return cJSON_ReplaceItemInObjectCaseSensitive(obj, chave, copia) ? 1 : 0;
    }
    return cJSON_AddItemToObject(obj, chave, copia) ? 1 : 0;
}

int delegua_json_remover_campo(cJSON* obj, char* chave) {
    if (!obj || !chave || !cJSON_IsObject(obj)) return 0;
    if (!cJSON_GetObjectItemCaseSensitive(obj, chave)) return 0;
    cJSON_DeleteItemFromObjectCaseSensitive(obj, chave);
    return 1;
}

int delegua_json_adicionar_item(cJSON* arr, cJSON* valor) {
    if (!arr || !cJSON_IsArray(arr)) return 0;
    cJSON* copia = valor ? cJSON_Duplicate(valor, 1) : cJSON_CreateNull();
    if (!copia) return 0;
    return cJSON_AddItemToArray(arr, copia) ? 1 : 0;
}
