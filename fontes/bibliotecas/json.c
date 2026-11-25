#include "json.h"
#include "terceiros/cjson/cJSON.c"   /* inclui a implementação diretamente */
#include "arc.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// ── Referências ARC ─────────────────────────────────────────────────────────

static void json_destruir(void* payload) {
    JsonRef* ref = (JsonRef*)payload;
    if (ref->raiz) {
        delegua_arc_liberar(ref->raiz);
    } else {
        if (ref->no) cJSON_Delete(ref->no);
        if (ref->removidos) cJSON_Delete(ref->removidos);
    }
    ref->no = NULL;
    ref->raiz = NULL;
    ref->removidos = NULL;
}

static const ArcDescritor DESCRITOR_JSON = {"JsonRef", json_destruir, NULL};

// Nova raiz dona de `no` (+1). NULL se `no` for NULL (ex.: texto JSON inválido).
static JsonRef* nova_raiz(cJSON* no) {
    if (!no) return NULL;
    JsonRef* ref = (JsonRef*)delegua_arc_alocar(sizeof(JsonRef), &DESCRITOR_JSON);
    ref->no = no;
    return ref;
}

static JsonRef* raiz_de(JsonRef* ref) {
    return ref->raiz ? ref->raiz : ref;
}

// Nó cJSON ainda válido da referência, ou NULL (referência nula ou árvore já liberada).
static cJSON* no_de(JsonRef* ref) {
    if (!ref) return NULL;
    if (ref->raiz && !ref->raiz->no) return NULL;
    return ref->no;
}

// Referência a um nó dentro da árvore de `pai`, retendo a raiz (+1).
static JsonRef* novo_filho(JsonRef* pai, cJSON* no) {
    if (!no) return NULL;
    JsonRef* ref = (JsonRef*)delegua_arc_alocar(sizeof(JsonRef), &DESCRITOR_JSON);
    ref->no = no;
    ref->raiz = raiz_de(pai);
    delegua_arc_reter(ref->raiz);
    return ref;
}

// Guarda um nó desligado da árvore até a raiz ser destruída (referências a ele seguem válidas).
static void guardar_removido(JsonRef* obj, cJSON* no) {
    if (!no) return;
    JsonRef* raiz = raiz_de(obj);
    if (!raiz->removidos) raiz->removidos = cJSON_CreateArray();
    if (!raiz->removidos || !cJSON_AddItemToArray(raiz->removidos, no)) cJSON_Delete(no);
}

// Copia um texto alocado pelo cJSON para um texto ARC e libera o original.
static char* texto_cjson_para_arc(char* texto) {
    if (!texto) return NULL;
    char* copia = delegua_arc_texto_copiar(texto);
    cJSON_free(texto);
    return copia;
}

// ── Leitura e escrita ───────────────────────────────────────────────────────

JsonRef* delegua_json_texto_para_objeto(char* texto) {
    if (!texto) return NULL;
    return nova_raiz(cJSON_Parse(texto));
}

char* delegua_json_objeto_para_texto(JsonRef* obj) {
    cJSON* no = no_de(obj);
    if (!no) return NULL;
    return texto_cjson_para_arc(cJSON_PrintUnformatted(no));
}

JsonRef* delegua_json_importar_arquivo(char* caminho) {
    if (!caminho) return NULL;
    FILE* fp = fopen(caminho, "rb");
    if (!fp) return NULL;

    fseek(fp, 0, SEEK_END);
    long tam = ftell(fp);
    rewind(fp);
    if (tam < 0) { fclose(fp); return NULL; }

    char* buf = (char*)malloc((size_t)tam + 1);
    if (!buf) { fclose(fp); return NULL; }
    size_t lidos = fread(buf, 1, (size_t)tam, fp);
    buf[lidos] = '\0';
    fclose(fp);

    cJSON* no = cJSON_Parse(buf);
    free(buf);
    return nova_raiz(no);
}

void delegua_json_exportar_arquivo(JsonRef* obj, char* caminho) {
    cJSON* no = no_de(obj);
    if (!no || !caminho) return;
    char* texto = cJSON_Print(no);
    if (!texto) return;
    FILE* fp = fopen(caminho, "w");
    if (fp) { fputs(texto, fp); fclose(fp); }
    cJSON_free(texto);
}

// ── Acessores ───────────────────────────────────────────────────────────────

JsonRef* delegua_json_obter_campo(JsonRef* obj, char* chave) {
    cJSON* no = no_de(obj);
    if (!no || !chave) return NULL;
    return novo_filho(obj, cJSON_GetObjectItem(no, chave));
}

JsonRef* delegua_json_obter_item(JsonRef* arr, int indice) {
    cJSON* no = no_de(arr);
    if (!no) return NULL;
    return novo_filho(arr, cJSON_GetArrayItem(no, indice));
}

int delegua_json_tamanho(JsonRef* arr) {
    cJSON* no = no_de(arr);
    if (!no) return 0;
    return cJSON_GetArraySize(no);
}

char* delegua_json_valor_texto(JsonRef* item) {
    const char* s = cJSON_GetStringValue(no_de(item));
    return s ? delegua_arc_texto_copiar(s) : NULL;
}

double delegua_json_valor_numero(JsonRef* item) {
    cJSON* no = no_de(item);
    if (!no) return 0.0;
    return cJSON_GetNumberValue(no);
}

// Libera a árvore agora (idempotente). A referência em si é do ARC; filhos já obtidos
// passam a ver JSON inválido. Liberar um filho não afeta a árvore.
void delegua_json_liberar(JsonRef* obj) {
    if (!obj || obj->raiz) return;
    if (obj->no) cJSON_Delete(obj->no);
    if (obj->removidos) cJSON_Delete(obj->removidos);
    obj->no = NULL;
    obj->removidos = NULL;
}

// ── Inspeção ────────────────────────────────────────────────────────────────

DELEGUA_TEXTO_ESTATICO(texto_invalido, "invalido");
DELEGUA_TEXTO_ESTATICO(texto_objeto, "objeto");
DELEGUA_TEXTO_ESTATICO(texto_vetor, "vetor");
DELEGUA_TEXTO_ESTATICO(texto_texto, "texto");
DELEGUA_TEXTO_ESTATICO(texto_numero, "numero");
DELEGUA_TEXTO_ESTATICO(texto_logico, "logico");
DELEGUA_TEXTO_ESTATICO(texto_nulo, "nulo");

char* delegua_json_tipo(JsonRef* item) {
    cJSON* no = no_de(item);
    if (!no) return DELEGUA_TEXTO(texto_invalido);
    if (cJSON_IsObject(no)) return DELEGUA_TEXTO(texto_objeto);
    if (cJSON_IsArray(no)) return DELEGUA_TEXTO(texto_vetor);
    if (cJSON_IsString(no)) return DELEGUA_TEXTO(texto_texto);
    if (cJSON_IsNumber(no)) return DELEGUA_TEXTO(texto_numero);
    if (cJSON_IsBool(no)) return DELEGUA_TEXTO(texto_logico);
    if (cJSON_IsNull(no)) return DELEGUA_TEXTO(texto_nulo);
    return DELEGUA_TEXTO(texto_invalido);
}

int delegua_json_valor_logico(JsonRef* item) {
    cJSON* no = no_de(item);
    return (no && cJSON_IsTrue(no)) ? 1 : 0;
}

int delegua_json_contem_campo(JsonRef* obj, char* chave) {
    cJSON* no = no_de(obj);
    if (!no || !chave || !cJSON_IsObject(no)) return 0;
    return cJSON_GetObjectItemCaseSensitive(no, chave) ? 1 : 0;
}

Vetor* delegua_json_chaves(JsonRef* obj) {
    Vetor* vetor = delegua_vetor_criar(0, (int)sizeof(char*), 1);
    cJSON* no = no_de(obj);
    if (!vetor || !no || !cJSON_IsObject(no)) return vetor;

    for (cJSON* filho = no->child; filho; filho = filho->next) {
        char* chave = delegua_arc_texto_copiar(filho->string ? filho->string : "");
        delegua_vetor_adicionar(vetor, &chave, (int)sizeof(char*));
        delegua_arc_liberar(chave);  // o vetor retém a sua referência
    }
    return vetor;
}

char* delegua_json_objeto_para_texto_formatado(JsonRef* obj) {
    cJSON* no = no_de(obj);
    if (!no) return NULL;
    return texto_cjson_para_arc(cJSON_Print(no));
}

// ── Construção ──────────────────────────────────────────────────────────────

JsonRef* delegua_json_criar_objeto(void) { return nova_raiz(cJSON_CreateObject()); }
JsonRef* delegua_json_criar_vetor(void) { return nova_raiz(cJSON_CreateArray()); }
JsonRef* delegua_json_criar_texto(char* texto) { return nova_raiz(cJSON_CreateString(texto ? texto : "")); }
JsonRef* delegua_json_criar_numero(double valor) { return nova_raiz(cJSON_CreateNumber(valor)); }
JsonRef* delegua_json_criar_logico(int valor) { return nova_raiz(cJSON_CreateBool(valor ? 1 : 0)); }
JsonRef* delegua_json_criar_nulo(void) { return nova_raiz(cJSON_CreateNull()); }

// O valor é sempre copiado: assim um item obtido de outro documento (obterCampo,
// obterItem) pode ser reutilizado sem que dois documentos compartilhem o mesmo nó.
int delegua_json_definir_campo(JsonRef* obj, char* chave, JsonRef* valor) {
    cJSON* no = no_de(obj);
    if (!no || !chave || !cJSON_IsObject(no)) return 0;
    cJSON* origem = no_de(valor);
    cJSON* copia = origem ? cJSON_Duplicate(origem, 1) : cJSON_CreateNull();
    if (!copia) return 0;
    cJSON* antigo = cJSON_GetObjectItemCaseSensitive(no, chave);
    if (!antigo) return cJSON_AddItemToObject(no, chave, copia) ? 1 : 0;

    // Substitui na mesma posição (mantém a ordem dos campos) sem apagar o valor anterior,
    // que vai para `removidos`: referências a ele continuam válidas. Mesma religação de
    // cJSON_ReplaceItemViaPointer, sem o cJSON_Delete final.
    copia->string = (char*)cJSON_strdup((const unsigned char*)chave, &global_hooks);
    if (!copia->string) {
        cJSON_Delete(copia);
        return 0;
    }
    copia->type &= ~cJSON_StringIsConst;
    copia->next = antigo->next;
    copia->prev = antigo->prev;
    if (copia->next) copia->next->prev = copia;
    if (no->child == antigo) {
        if (no->child->prev == no->child) copia->prev = copia;
        no->child = copia;
    } else {
        if (copia->prev) copia->prev->next = copia;
        if (!copia->next) no->child->prev = copia;
    }
    antigo->next = NULL;
    antigo->prev = NULL;
    guardar_removido(obj, antigo);
    return 1;
}

int delegua_json_remover_campo(JsonRef* obj, char* chave) {
    cJSON* no = no_de(obj);
    if (!no || !chave || !cJSON_IsObject(no)) return 0;
    cJSON* removido = cJSON_DetachItemFromObjectCaseSensitive(no, chave);
    if (!removido) return 0;
    guardar_removido(obj, removido);
    return 1;
}

int delegua_json_adicionar_item(JsonRef* arr, JsonRef* valor) {
    cJSON* no = no_de(arr);
    if (!no || !cJSON_IsArray(no)) return 0;
    cJSON* origem = no_de(valor);
    cJSON* copia = origem ? cJSON_Duplicate(origem, 1) : cJSON_CreateNull();
    if (!copia) return 0;
    return cJSON_AddItemToArray(no, copia) ? 1 : 0;
}
