#include "vetor.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// ───────────────────────────────────────────────────────────
// Comparadores para qsort
// ───────────────────────────────────────────────────────────

static int comparar_inteiro(const void* a, const void* b) {
    int ia = *(const int*)a;
    int ib = *(const int*)b;
    return (ia > ib) - (ia < ib);
}

static int comparar_numero(const void* a, const void* b) {
    double da = *(const double*)a;
    double db = *(const double*)b;
    return (da > db) - (da < db);
}

static int comparar_texto(const void* a, const void* b) {
    const char* ta = *(const char* const*)a;
    const char* tb = *(const char* const*)b;
    if (!ta || !tb) return (ta != NULL) - (tb != NULL);
    return strcmp(ta, tb);
}

// Garante capacidade para pelo menos `min_cap` elementos (crescimento geométrico 2x).
static int vetor_garantir_capacidade(Vetor* v, int min_cap, int tam_elem) {
    if (!v || tam_elem <= 0) return 0;
    if (min_cap <= v->capacidade && v->ptr != NULL) return 1;
    int nova_cap = v->capacidade > 0 ? v->capacidade : 4;
    while (nova_cap < min_cap) {
        if (nova_cap > 0x3fffffff) {
            nova_cap = min_cap;
            break;
        }
        nova_cap *= 2;
    }
    void* novo_ptr = realloc(v->ptr, (size_t)nova_cap * (size_t)tam_elem);
    if (!novo_ptr) return 0;
    v->ptr = novo_ptr;
    v->capacidade = nova_cap;
    v->tam_elem = tam_elem;
    return 1;
}

// ───────────────────────────────────────────────────────────
// Implementações
// ───────────────────────────────────────────────────────────

Vetor* delegua_vetor_criar(int tamanho_inicial, int tam_elem) {
    if (tamanho_inicial < 0) tamanho_inicial = 0;
    if (tam_elem <= 0) tam_elem = (int)sizeof(void*);
    Vetor* v = (Vetor*)calloc(1, sizeof(Vetor));
    if (!v) return NULL;
    v->tam_elem = tam_elem;
    v->tamanho = tamanho_inicial;
    if (tamanho_inicial > 0) {
        int cap = tamanho_inicial < 4 ? 4 : tamanho_inicial;
        v->ptr = calloc((size_t)cap, (size_t)tam_elem);
        if (!v->ptr) {
            free(v);
            return NULL;
        }
        v->capacidade = cap;
    }
    return v;
}

int delegua_vetor_adicionar(Vetor* v, void* elem, int tam_elem) {
    if (!v || !elem || tam_elem <= 0) {
        fprintf(stderr, "[DELEGUA ERRO] delegua_vetor_adicionar: argumento invalido"
                        " (v=%p, elem=%p, tam_elem=%d)\n", (void*)v, elem, tam_elem);
        fflush(stderr);
        return v ? v->tamanho : -1;
    }
    if (v->tamanho < 0) {
        fprintf(stderr, "[DELEGUA ERRO] delegua_vetor_adicionar: vetor corrompido"
                        " (tamanho=%d)\n", v->tamanho);
        fflush(stderr);
        return -1;
    }
    int novo_tam = v->tamanho + 1;
    if (!vetor_garantir_capacidade(v, novo_tam, tam_elem)) {
        return v->tamanho;
    }

    memcpy((char*)v->ptr + (size_t)v->tamanho * (size_t)tam_elem, elem, (size_t)tam_elem);
    v->tamanho = novo_tam;
    return novo_tam;
}

void* delegua_vetor_definir_indice(Vetor* v, int indice, int tam_elem) {
    if (!v || indice < 0 || tam_elem <= 0) {
        fprintf(stderr, "[DELEGUA ERRO] delegua_vetor_definir_indice: argumento invalido"
                        " (v=%p, indice=%d, tam_elem=%d)\n", (void*)v, indice, tam_elem);
        fflush(stderr);
        return NULL;
    }
    if (indice >= v->tamanho) {
        int novo_tam = indice + 1;
        if (!vetor_garantir_capacidade(v, novo_tam, tam_elem)) {
            fprintf(stderr, "[DELEGUA ERRO] delegua_vetor_definir_indice: falha ao realocar"
                            " (indice=%d, tam_elem=%d)\n", indice, tam_elem);
            fflush(stderr);
            return NULL;
        }
        /* Zera os "buracos" deixados entre o tamanho antigo e o novo índice. */
        memset((char*)v->ptr + (size_t)v->tamanho * (size_t)tam_elem, 0,
               (size_t)(novo_tam - v->tamanho) * (size_t)tam_elem);
        v->tamanho = novo_tam;
    }
    return (char*)v->ptr + (size_t)indice * (size_t)tam_elem;
}

int delegua_vetor_remover_ultimo(Vetor* v) {
    if (!v || v->tamanho <= 0) return -1;
    v->tamanho -= 1;
    return v->tamanho;
}

int delegua_vetor_remover_primeiro(Vetor* v, int tam_elem) {
    if (!v || v->tamanho <= 0) return -1;
    if (v->tamanho == 1) {
        v->tamanho = 0;
        return 0;
    }
    memmove(v->ptr,
            (char*)v->ptr + tam_elem,
            (size_t)(v->tamanho - 1) * (size_t)tam_elem);
    v->tamanho -= 1;
    return v->tamanho;
}

void delegua_vetor_inverter(Vetor* v, int tam_elem) {
    if (!v || v->tamanho <= 1) return;
    char* tmp = (char*)malloc((size_t)tam_elem);
    if (!tmp) return;

    int esq = 0;
    int dir = v->tamanho - 1;
    while (esq < dir) {
        char* pe = (char*)v->ptr + (size_t)esq * (size_t)tam_elem;
        char* pd = (char*)v->ptr + (size_t)dir * (size_t)tam_elem;
        memcpy(tmp, pe, (size_t)tam_elem);
        memcpy(pe, pd, (size_t)tam_elem);
        memcpy(pd, tmp, (size_t)tam_elem);
        esq++;
        dir--;
    }
    free(tmp);
}

void delegua_vetor_ordenar(Vetor* v, int tam_elem, int tipo) {
    if (!v || v->tamanho <= 1) return;
    int (*comparar)(const void*, const void*) =
        tipo == 1 ? comparar_numero : tipo == 2 ? comparar_texto : comparar_inteiro;
    qsort(v->ptr, (size_t)v->tamanho, (size_t)tam_elem, comparar);
}

// Ordenação por intercalação (merge sort) de baixo para cima: estável, O(n log n).
void delegua_vetor_ordenar_com_funcao(Vetor* v, int tam_elem, int (*comparar)(const void*, const void*)) {
    if (!v || v->tamanho <= 1 || !comparar || tam_elem <= 0) return;
    size_t n = (size_t)v->tamanho;
    size_t tamanho = (size_t)tam_elem;
    char* origem = (char*)v->ptr;
    char* auxiliar = (char*)malloc(n * tamanho);
    if (!auxiliar) return;

    char* de = origem;
    char* para = auxiliar;
    for (size_t largura = 1; largura < n; largura *= 2) {
        for (size_t inicio = 0; inicio < n; inicio += 2 * largura) {
            size_t meio = inicio + largura < n ? inicio + largura : n;
            size_t fim = inicio + 2 * largura < n ? inicio + 2 * largura : n;
            size_t i = inicio, j = meio, k = inicio;
            while (i < meio && j < fim) {
                if (comparar(de + i * tamanho, de + j * tamanho) > 0) {
                    memcpy(para + k++ * tamanho, de + j++ * tamanho, tamanho);
                } else {
                    memcpy(para + k++ * tamanho, de + i++ * tamanho, tamanho);
                }
            }
            while (i < meio) memcpy(para + k++ * tamanho, de + i++ * tamanho, tamanho);
            while (j < fim) memcpy(para + k++ * tamanho, de + j++ * tamanho, tamanho);
        }
        char* troca = de;
        de = para;
        para = troca;
    }
    if (de != origem) memcpy(origem, de, n * tamanho);
    free(auxiliar);
}

Vetor* delegua_vetor_fatiar(Vetor* v, int inicio, int fim, int tam_elem) {
    if (!v) return delegua_vetor_criar(0, tam_elem);
    if (inicio < 0) inicio = 0;
    if (fim > v->tamanho) fim = v->tamanho;
    if (inicio >= fim) {
        return delegua_vetor_criar(0, tam_elem);
    }

    int novo_tam = fim - inicio;
    Vetor* saida = delegua_vetor_criar(novo_tam, tam_elem);
    if (!saida) return NULL;
    memcpy(saida->ptr,
           (char*)v->ptr + (size_t)inicio * (size_t)tam_elem,
           (size_t)novo_tam * (size_t)tam_elem);
    return saida;
}

char* delegua_vetor_juntar_inteiro(Vetor* v, const char* sep) {
    if (!v || v->tamanho == 0) {
        char* vazio = (char*)malloc(1);
        if (vazio) vazio[0] = '\0';
        return vazio;
    }

    size_t tam_sep = sep ? strlen(sep) : 0;
    size_t tam_total = 0;
    int* elems = (int*)v->ptr;
    char buf[32];

    for (int i = 0; i < v->tamanho; i++) {
        tam_total += (size_t)snprintf(buf, sizeof(buf), "%d", elems[i]);
        if (i < v->tamanho - 1) tam_total += tam_sep;
    }

    char* resultado = (char*)malloc(tam_total + 1);
    if (!resultado) return NULL;

    char* pos = resultado;
    for (int i = 0; i < v->tamanho; i++) {
        int escrito = snprintf(pos, tam_total + 1 - (size_t)(pos - resultado), "%d", elems[i]);
        pos += escrito;
        if (i < v->tamanho - 1 && sep) {
            memcpy(pos, sep, tam_sep);
            pos += tam_sep;
        }
    }
    *pos = '\0';
    return resultado;
}

char* delegua_vetor_juntar_numero(Vetor* v, const char* sep) {
    if (!v || v->tamanho == 0) {
        char* vazio = (char*)malloc(1);
        if (vazio) vazio[0] = '\0';
        return vazio;
    }

    size_t tam_sep = sep ? strlen(sep) : 0;
    size_t tam_total = 0;
    double* elems = (double*)v->ptr;
    char buf[64];

    for (int i = 0; i < v->tamanho; i++) {
        tam_total += (size_t)snprintf(buf, sizeof(buf), "%g", elems[i]);
        if (i < v->tamanho - 1) tam_total += tam_sep;
    }

    char* resultado = (char*)malloc(tam_total + 1);
    if (!resultado) return NULL;

    char* pos = resultado;
    for (int i = 0; i < v->tamanho; i++) {
        int escrito = snprintf(pos, tam_total + 1 - (size_t)(pos - resultado), "%g", elems[i]);
        pos += escrito;
        if (i < v->tamanho - 1 && sep) {
            memcpy(pos, sep, tam_sep);
            pos += tam_sep;
        }
    }
    *pos = '\0';
    return resultado;
}

char* delegua_vetor_juntar_texto(Vetor* v, const char* sep) {
    if (!v || v->tamanho == 0) {
        char* vazio = (char*)malloc(1);
        if (vazio) vazio[0] = '\0';
        return vazio;
    }

    size_t tam_sep = sep ? strlen(sep) : 0;
    char** elems = (char**)v->ptr;

    size_t tam_total = 0;
    for (int i = 0; i < v->tamanho; i++) {
        tam_total += elems[i] ? strlen(elems[i]) : 0;
        if (i < v->tamanho - 1) tam_total += tam_sep;
    }

    char* resultado = (char*)malloc(tam_total + 1);
    if (!resultado) return NULL;

    char* pos = resultado;
    for (int i = 0; i < v->tamanho; i++) {
        if (elems[i]) {
            size_t len = strlen(elems[i]);
            memcpy(pos, elems[i], len);
            pos += len;
        }
        if (i < v->tamanho - 1 && sep) {
            memcpy(pos, sep, tam_sep);
            pos += tam_sep;
        }
    }
    *pos = '\0';
    return resultado;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtrar e mapear com callbacks
// ─────────────────────────────────────────────────────────────────────────────

Vetor* delegua_vetor_filtrar_inteiro(Vetor* v, int (*fn)(int)) {
    if (!v || v->tamanho == 0) return delegua_vetor_criar(0, (int)sizeof(int));
    int* elems = (int*)v->ptr;

    char* flags = (char*)malloc((size_t)v->tamanho * sizeof(char));
    if (!flags) return delegua_vetor_criar(0, (int)sizeof(int));

    int aprovados = 0;
    for (int i = 0; i < v->tamanho; i++) {
        int res = fn(elems[i]);
        flags[i] = (char)(res != 0);
        if (flags[i]) aprovados++;
    }

    Vetor* saida = delegua_vetor_criar(aprovados, (int)sizeof(int));
    if (!saida) {
        free(flags);
        return NULL;
    }
    if (aprovados > 0) {
        int* resultado = (int*)saida->ptr;
        int j = 0;
        for (int i = 0; i < v->tamanho; i++) {
            if (flags[i]) resultado[j++] = elems[i];
        }
    }
    free(flags);
    return saida;
}

Vetor* delegua_vetor_filtrar_numero(Vetor* v, int (*fn)(double)) {
    if (!v || v->tamanho == 0) return delegua_vetor_criar(0, (int)sizeof(double));
    double* elems = (double*)v->ptr;

    char* flags = (char*)malloc((size_t)v->tamanho * sizeof(char));
    if (!flags) return delegua_vetor_criar(0, (int)sizeof(double));

    int aprovados = 0;
    for (int i = 0; i < v->tamanho; i++) {
        int res = fn(elems[i]);
        flags[i] = (char)(res != 0);
        if (flags[i]) aprovados++;
    }

    Vetor* saida = delegua_vetor_criar(aprovados, (int)sizeof(double));
    if (!saida) {
        free(flags);
        return NULL;
    }
    if (aprovados > 0) {
        double* resultado = (double*)saida->ptr;
        int j = 0;
        for (int i = 0; i < v->tamanho; i++) {
            if (flags[i]) resultado[j++] = elems[i];
        }
    }
    free(flags);
    return saida;
}

Vetor* delegua_vetor_mapear_inteiro(Vetor* v, int (*fn)(int)) {
    if (!v || v->tamanho == 0) return delegua_vetor_criar(0, (int)sizeof(int));
    Vetor* saida = delegua_vetor_criar(v->tamanho, (int)sizeof(int));
    if (!saida) return NULL;
    int* elems = (int*)v->ptr;
    int* resultado = (int*)saida->ptr;
    for (int i = 0; i < v->tamanho; i++) resultado[i] = fn(elems[i]);
    return saida;
}

Vetor* delegua_vetor_mapear_numero(Vetor* v, double (*fn)(double)) {
    if (!v || v->tamanho == 0) return delegua_vetor_criar(0, (int)sizeof(double));
    Vetor* saida = delegua_vetor_criar(v->tamanho, (int)sizeof(double));
    if (!saida) return NULL;
    double* elems = (double*)v->ptr;
    double* resultado = (double*)saida->ptr;
    for (int i = 0; i < v->tamanho; i++) resultado[i] = fn(elems[i]);
    return saida;
}

Vetor* delegua_vetor_mapear_texto(Vetor* v, char* (*fn)(char*)) {
    if (!v || v->tamanho == 0) return delegua_vetor_criar(0, (int)sizeof(char*));
    Vetor* saida = delegua_vetor_criar(v->tamanho, (int)sizeof(char*));
    if (!saida) return NULL;
    char** elems = (char**)v->ptr;
    char** resultado = (char**)saida->ptr;
    for (int i = 0; i < v->tamanho; i++) resultado[i] = fn(elems[i]);
    return saida;
}

int delegua_vetor_tamanho(Vetor* v) {
    return v ? v->tamanho : 0;
}

int delegua_vetor_inclui_texto(Vetor* v, const char* s) {
    if (!v || !s) return 0;
    char** elems = (char**)v->ptr;
    for (int i = 0; i < v->tamanho; i++) {
        if (elems[i] && strcmp(elems[i], s) == 0) return 1;
    }
    return 0;
}
