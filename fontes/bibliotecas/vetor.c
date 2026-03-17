#include "vetor.h"
#include <stdio.h>

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
    void* novo_ptr = malloc((size_t)novo_tam * (size_t)tam_elem);
    if (!novo_ptr) return v->tamanho;

    if (v->ptr && v->tamanho > 0) {
        memcpy(novo_ptr, v->ptr, (size_t)v->tamanho * (size_t)tam_elem);
    }

    // Copia o elemento novo na última posição
    memcpy((char*)novo_ptr + (size_t)v->tamanho * (size_t)tam_elem, elem, (size_t)tam_elem);

    v->ptr = novo_ptr;
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
