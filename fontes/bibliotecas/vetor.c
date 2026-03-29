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

// ───────────────────────────────────────────────────────────
// Implementações
// ───────────────────────────────────────────────────────────

int delegua_vetor_adicionar(Vetor* v, void* elem, int tam_elem) {
    int novo_tam = v->tamanho + 1;
    /* Redimensiona o buffer existente, evitando vazamento de memória */
    void* novo_ptr = realloc(v->ptr, (size_t)novo_tam * (size_t)tam_elem);
    if (!novo_ptr) {
        /* Falha ao realocar: mantém o vetor inalterado */
        return v->tamanho;
    }

    /* Atualiza o ponteiro após realocação bem-sucedida */
    v->ptr = novo_ptr;

    /* Copia o elemento novo na última posição */
    memcpy((char*)v->ptr + (size_t)v->tamanho * (size_t)tam_elem, elem, (size_t)tam_elem);

    v->tamanho = novo_tam;
    return novo_tam;
}

int delegua_vetor_remover_ultimo(Vetor* v) {
    if (v->tamanho <= 0) return -1;
    v->tamanho -= 1;
    return v->tamanho;
}

int delegua_vetor_remover_primeiro(Vetor* v, int tam_elem) {
    if (v->tamanho <= 0) return -1;
    if (v->tamanho == 1) {
        v->tamanho = 0;
        return 0;
    }
    // Desloca todos os elementos uma posição para a esquerda
    memmove(v->ptr,
            (char*)v->ptr + tam_elem,
            (size_t)(v->tamanho - 1) * (size_t)tam_elem);
    v->tamanho -= 1;
    return v->tamanho;
}

void delegua_vetor_inverter(Vetor* v, int tam_elem) {
    if (v->tamanho <= 1) return;
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

void delegua_vetor_ordenar(Vetor* v, int tam_elem, int eh_numero) {
    if (v->tamanho <= 1) return;
    if (eh_numero) {
        qsort(v->ptr, (size_t)v->tamanho, (size_t)tam_elem, comparar_numero);
    } else {
        qsort(v->ptr, (size_t)v->tamanho, (size_t)tam_elem, comparar_inteiro);
    }
}

void delegua_vetor_fatiar(Vetor* v, int inicio, int fim, int tam_elem, Vetor* saida) {
    // Normaliza limites
    if (inicio < 0) inicio = 0;
    if (fim > v->tamanho) fim = v->tamanho;
    if (inicio >= fim) {
        saida->ptr = NULL;
        saida->tamanho = 0;
        return;
    }

    int novo_tam = fim - inicio;
    void* novo_ptr = malloc((size_t)novo_tam * (size_t)tam_elem);
    if (!novo_ptr) {
        saida->ptr = NULL;
        saida->tamanho = 0;
        return;
    }
    memcpy(novo_ptr,
           (char*)v->ptr + (size_t)inicio * (size_t)tam_elem,
           (size_t)novo_tam * (size_t)tam_elem);

    saida->ptr = novo_ptr;
    saida->tamanho = novo_tam;
}

char* delegua_vetor_juntar_inteiro(Vetor* v, const char* sep) {
    if (!v || v->tamanho == 0) {
        char* vazio = (char*)malloc(1);
        if (vazio) vazio[0] = '\0';
        return vazio;
    }

    // Primeira passagem: calcular tamanho necessário
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

    // Primeira passagem: calcular tamanho
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

void delegua_vetor_filtrar_inteiro(Vetor* v, int (*fn)(int), Vetor* saida) {
    if (!v || v->tamanho == 0) { saida->ptr = NULL; saida->tamanho = 0; return; }
    int* elems = (int*)v->ptr;

    /* Armazena os resultados do predicado para evitar chamá-lo duas vezes. */
    char* flags = (char*)malloc((size_t)v->tamanho * sizeof(char));
    if (!flags) {
        saida->ptr = NULL;
        saida->tamanho = 0;
        return;
    }

    int aprovados = 0;
    for (int i = 0; i < v->tamanho; i++) {
        int res = fn(elems[i]);
        flags[i] = (char)(res != 0);
        if (flags[i]) {
            aprovados++;
        }
    }

    if (aprovados == 0) {
        free(flags);
        saida->ptr = NULL;
        saida->tamanho = 0;
        return;
    }

    int* resultado = (int*)malloc((size_t)aprovados * sizeof(int));
    if (!resultado) {
        free(flags);
        saida->ptr = NULL;
        saida->tamanho = 0;
        return;
    }

    int j = 0;
    for (int i = 0; i < v->tamanho; i++) {
        if (flags[i]) {
            resultado[j++] = elems[i];
        }
    }

    free(flags);
    saida->ptr = resultado;
    saida->tamanho = aprovados;
}

void delegua_vetor_filtrar_numero(Vetor* v, int (*fn)(double), Vetor* saida) {
    if (!v || v->tamanho == 0) { saida->ptr = NULL; saida->tamanho = 0; return; }
    double* elems = (double*)v->ptr;

    /* Armazena os resultados do predicado para evitar chamá-lo duas vezes. */
    char* flags = (char*)malloc((size_t)v->tamanho * sizeof(char));
    if (!flags) {
        saida->ptr = NULL;
        saida->tamanho = 0;
        return;
    }

    int aprovados = 0;
    for (int i = 0; i < v->tamanho; i++) {
        int res = fn(elems[i]);
        flags[i] = (char)(res != 0);
        if (flags[i]) {
            aprovados++;
        }
    }

    if (aprovados == 0) {
        free(flags);
        saida->ptr = NULL;
        saida->tamanho = 0;
        return;
    }

    double* resultado = (double*)malloc((size_t)aprovados * sizeof(double));
    if (!resultado) {
        free(flags);
        saida->ptr = NULL;
        saida->tamanho = 0;
        return;
    }

    int j = 0;
    for (int i = 0; i < v->tamanho; i++) {
        if (flags[i]) {
            resultado[j++] = elems[i];
        }
    }

    free(flags);
    saida->ptr = resultado;
    saida->tamanho = aprovados;
}

void delegua_vetor_mapear_inteiro(Vetor* v, int (*fn)(int), Vetor* saida) {
    if (!v || v->tamanho == 0) { saida->ptr = NULL; saida->tamanho = 0; return; }
    int* elems = (int*)v->ptr;
    int* resultado = (int*)malloc((size_t)v->tamanho * sizeof(int));
    if (!resultado) { saida->ptr = NULL; saida->tamanho = 0; return; }
    for (int i = 0; i < v->tamanho; i++) { resultado[i] = fn(elems[i]); }
    saida->ptr = resultado; saida->tamanho = v->tamanho;
}

void delegua_vetor_mapear_numero(Vetor* v, double (*fn)(double), Vetor* saida) {
    if (!v || v->tamanho == 0) { saida->ptr = NULL; saida->tamanho = 0; return; }
    double* elems = (double*)v->ptr;
    double* resultado = (double*)malloc((size_t)v->tamanho * sizeof(double));
    if (!resultado) { saida->ptr = NULL; saida->tamanho = 0; return; }
    for (int i = 0; i < v->tamanho; i++) { resultado[i] = fn(elems[i]); }
    saida->ptr = resultado; saida->tamanho = v->tamanho;
}

// Mapeia elementos texto (char*→char*) — cria novo vetor em *saida.
void delegua_vetor_mapear_texto(Vetor* v, char* (*fn)(char*), Vetor* saida) {
    if (!v || v->tamanho == 0) { saida->ptr = NULL; saida->tamanho = 0; return; }
    char** elems = (char**)v->ptr;
    char** resultado = (char**)calloc((size_t)v->tamanho, sizeof(char*));
    if (!resultado) { saida->ptr = NULL; saida->tamanho = 0; return; }
    for (int i = 0; i < v->tamanho; i++) { resultado[i] = fn(elems[i]); }
    saida->ptr = resultado; saida->tamanho = v->tamanho;
}
