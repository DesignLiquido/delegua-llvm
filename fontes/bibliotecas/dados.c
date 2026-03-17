// G.1 — delegua-dados: estruturas tipo DataFrame (RecorteDados) e Série (Serie).
// Compilar com: clang ... dados.c csv.c
#include "dados.h"
#include "csv.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <float.h>

// ── Utilitários internos ─────────────────────────────────────────────────────

static int eh_nulo_ou_vazio(const char* s) {
    return !s || s[0] == '\0';
}

static int tentar_double(const char* s, double* saida) {
    if (eh_nulo_ou_vazio(s)) return 0;
    char* fim;
    *saida = strtod(s, &fim);
    return *fim == '\0';
}

// Libera as colunas internas de RecorteDados sem liberar a própria estrutura.
static void liberar_colunas(RecorteDados* rd) {
    for (int c = 0; c < rd->num_colunas; c++) {
        Coluna* col = rd->colunas[c];
        if (!col) continue;
        free(col->nome);
        if (col->tipo == TIPO_DOUBLE) {
            free(col->dados);
        } else {
            char** arr = (char**)col->dados;
            for (int r = 0; r < col->tamanho; r++) free(arr[r]);
            free(arr);
        }
        free(col);
    }
    free(rd->colunas);
    for (int c = 0; c < rd->num_colunas; c++) free(rd->nomes_colunas[c]);
    free(rd->nomes_colunas);
}

// Aloca RecorteDados vazio (sem dados de coluna preenchidos).
static RecorteDados* alocar_recorte(int num_colunas, int num_linhas) {
    RecorteDados* rd = (RecorteDados*)calloc(1, sizeof(RecorteDados));
    if (!rd) return NULL;
    rd->num_colunas = num_colunas;
    rd->num_linhas  = num_linhas;
    rd->colunas       = (Coluna**)calloc(num_colunas, sizeof(Coluna*));
    rd->nomes_colunas = (char**)  calloc(num_colunas, sizeof(char*));
    if (!rd->colunas || !rd->nomes_colunas) {
        free(rd->colunas);
        free(rd->nomes_colunas);
        free(rd);
        return NULL;
    }
    return rd;
}

// ── Detecção de tipo e construção a partir de TabelaCsv ──────────────────────

static int coluna_numerica(TabelaCsv* tabela, int col) {
    for (int r = 1; r < tabela->total_linhas; r++) {
        const char* cel = tabela->linhas[r].celulas[col];
        if (eh_nulo_ou_vazio(cel)) continue; // células vazias são permitidas
        double dummy;
        if (!tentar_double(cel, &dummy)) return 0;
    }
    return 1;
}

static RecorteDados* tabela_para_recorte(TabelaCsv* tabela) {
    if (!tabela || tabela->total_linhas < 1) return NULL;
    int nc = tabela->colunas;
    int nr = tabela->total_linhas - 1; // linha 0 = cabeçalho

    RecorteDados* rd = alocar_recorte(nc, nr);
    if (!rd) return NULL;

    for (int c = 0; c < nc; c++) {
        Coluna* col = (Coluna*)calloc(1, sizeof(Coluna));
        if (!col) { liberar_colunas(rd); free(rd); return NULL; }

        const char* nome_cab = tabela->linhas[0].celulas[c];
        col->nome = strdup(nome_cab ? nome_cab : "");
        col->tamanho = nr;
        rd->nomes_colunas[c] = strdup(col->nome);

        if (coluna_numerica(tabela, c)) {
            col->tipo = TIPO_DOUBLE;
            double* arr = (double*)calloc(nr, sizeof(double));
            for (int r = 0; r < nr; r++) {
                const char* cel = tabela->linhas[r + 1].celulas[c];
                double v = 0.0;
                if (!eh_nulo_ou_vazio(cel)) tentar_double(cel, &v);
                arr[r] = v;
            }
            col->dados = arr;
        } else {
            col->tipo = TIPO_STRING;
            char** arr = (char**)calloc(nr, sizeof(char*));
            for (int r = 0; r < nr; r++) {
                const char* cel = tabela->linhas[r + 1].celulas[c];
                arr[r] = strdup(cel ? cel : "");
            }
            col->dados = arr;
        }
        rd->colunas[c] = col;
    }
    return rd;
}

// ── I/O ──────────────────────────────────────────────────────────────────────

RecorteDados* delegua_dados_ler_csv(char* caminho) {
    TabelaCsv* tabela = delegua_csv_ler(caminho, ',');
    if (!tabela) return NULL;
    RecorteDados* rd = tabela_para_recorte(tabela);
    delegua_csv_liberar(tabela);
    return rd;
}

// ── Liberação ─────────────────────────────────────────────────────────────────

void delegua_dados_liberar(RecorteDados* rd) {
    if (!rd) return;
    liberar_colunas(rd);
    free(rd);
}

void delegua_dados_serie_liberar(Serie* s) {
    if (!s) return;
    if (s->tipo == TIPO_DOUBLE) {
        free(s->dados);
    } else {
        char** arr = (char**)s->dados;
        for (int i = 0; i < s->tamanho; i++) free(arr[i]);
        free(arr);
    }
    if (s->indices) {
        for (int i = 0; i < s->tamanho; i++) free(s->indices[i]);
        free(s->indices);
    }
    free(s);
}

// ── Slice: cabeca / cauda ────────────────────────────────────────────────────

// Copia n linhas a partir de inicio para um novo RecorteDados.
static RecorteDados* fatiar(RecorteDados* rd, int inicio, int n) {
    if (!rd || n <= 0) return NULL;
    if (inicio < 0) inicio = 0;
    if (inicio + n > rd->num_linhas) n = rd->num_linhas - inicio;
    if (n <= 0) return NULL;

    RecorteDados* novo = alocar_recorte(rd->num_colunas, n);
    if (!novo) return NULL;

    for (int c = 0; c < rd->num_colunas; c++) {
        Coluna* orig = rd->colunas[c];
        Coluna* col  = (Coluna*)calloc(1, sizeof(Coluna));
        if (!col) { liberar_colunas(novo); free(novo); return NULL; }

        col->nome = strdup(orig->nome);
        col->tipo = orig->tipo;
        col->tamanho = n;
        novo->nomes_colunas[c] = strdup(orig->nome);

        if (orig->tipo == TIPO_DOUBLE) {
            double* src = (double*)orig->dados;
            double* dst = (double*)malloc(n * sizeof(double));
            memcpy(dst, src + inicio, n * sizeof(double));
            col->dados = dst;
        } else {
            char** src = (char**)orig->dados;
            char** dst = (char**)malloc(n * sizeof(char*));
            for (int r = 0; r < n; r++) dst[r] = strdup(src[inicio + r]);
            col->dados = dst;
        }
        novo->colunas[c] = col;
    }
    return novo;
}

RecorteDados* delegua_dados_cabeca(RecorteDados* rd, int n) {
    return fatiar(rd, 0, n);
}

RecorteDados* delegua_dados_cauda(RecorteDados* rd, int n) {
    if (!rd) return NULL;
    int inicio = rd->num_linhas - n;
    return fatiar(rd, inicio < 0 ? 0 : inicio, n);
}

// ── Info / representação textual ──────────────────────────────────────────────

char* delegua_dados_info(RecorteDados* rd) {
    if (!rd) return strdup("(nulo)");
    int tam = 128 + rd->num_colunas * 64;
    char* buf = (char*)malloc(tam);
    if (!buf) return NULL;
    int pos = snprintf(buf, tam,
        "RecorteDados: %d linhas x %d colunas\n",
        rd->num_linhas, rd->num_colunas);
    for (int c = 0; c < rd->num_colunas && pos < tam - 32; c++) {
        Coluna* col = rd->colunas[c];
        pos += snprintf(buf + pos, tam - pos, "  %s: %s\n",
            col->nome,
            col->tipo == TIPO_DOUBLE ? "numero" : "texto");
    }
    return buf;
}

char* delegua_dados_para_texto(RecorteDados* rd) {
    if (!rd) return strdup("");

    // Calcula largura de cada coluna
    int* larguras = (int*)calloc(rd->num_colunas, sizeof(int));
    for (int c = 0; c < rd->num_colunas; c++) {
        larguras[c] = (int)strlen(rd->nomes_colunas[c]);
    }
    for (int r = 0; r < rd->num_linhas; r++) {
        for (int c = 0; c < rd->num_colunas; c++) {
            char tmp[64];
            Coluna* col = rd->colunas[c];
            int w;
            if (col->tipo == TIPO_DOUBLE)
                w = snprintf(tmp, sizeof(tmp), "%.6g", ((double*)col->dados)[r]);
            else
                w = (int)strlen(((char**)col->dados)[r]);
            if (w > larguras[c]) larguras[c] = w;
        }
    }

    // Estima tamanho do buffer
    int total_cols = 0;
    for (int c = 0; c < rd->num_colunas; c++) total_cols += larguras[c] + 3;
    int tam = (rd->num_linhas + 4) * (total_cols + 4);
    char* buf = (char*)malloc(tam);
    if (!buf) { free(larguras); return NULL; }
    int pos = 0;

    // Linha de cabeçalho
    for (int c = 0; c < rd->num_colunas; c++) {
        pos += snprintf(buf + pos, tam - pos, "%-*s", larguras[c], rd->nomes_colunas[c]);
        if (c < rd->num_colunas - 1) pos += snprintf(buf + pos, tam - pos, " | ");
    }
    buf[pos++] = '\n';

    // Separador
    for (int c = 0; c < rd->num_colunas; c++) {
        for (int i = 0; i < larguras[c]; i++) buf[pos++] = '-';
        if (c < rd->num_colunas - 1) { buf[pos++] = '-'; buf[pos++] = '+'; buf[pos++] = '-'; }
    }
    buf[pos++] = '\n';

    // Linhas de dados
    for (int r = 0; r < rd->num_linhas; r++) {
        for (int c = 0; c < rd->num_colunas; c++) {
            char tmp[64];
            Coluna* col = rd->colunas[c];
            if (col->tipo == TIPO_DOUBLE)
                snprintf(tmp, sizeof(tmp), "%.6g", ((double*)col->dados)[r]);
            else
                snprintf(tmp, sizeof(tmp), "%s", ((char**)col->dados)[r]);
            pos += snprintf(buf + pos, tam - pos, "%-*s", larguras[c], tmp);
            if (c < rd->num_colunas - 1) pos += snprintf(buf + pos, tam - pos, " | ");
        }
        buf[pos++] = '\n';
    }
    buf[pos] = '\0';
    free(larguras);
    return buf;
}

// ── Filtragem ────────────────────────────────────────────────────────────────

RecorteDados* delegua_dados_remover_nulo(RecorteDados* rd) {
    if (!rd) return NULL;

    // Marca linhas sem células nulas/vazias
    int* manter = (int*)calloc(rd->num_linhas, sizeof(int));
    int total = 0;
    for (int r = 0; r < rd->num_linhas; r++) {
        int ok = 1;
        for (int c = 0; c < rd->num_colunas && ok; c++) {
            if (rd->colunas[c]->tipo == TIPO_STRING) {
                const char* cel = ((char**)rd->colunas[c]->dados)[r];
                if (eh_nulo_ou_vazio(cel)) ok = 0;
            }
        }
        manter[r] = ok;
        if (ok) total++;
    }

    RecorteDados* novo = alocar_recorte(rd->num_colunas, total);
    if (!novo) { free(manter); return NULL; }

    for (int c = 0; c < rd->num_colunas; c++) {
        Coluna* orig = rd->colunas[c];
        Coluna* col  = (Coluna*)calloc(1, sizeof(Coluna));
        if (!col) { liberar_colunas(novo); free(novo); free(manter); return NULL; }

        col->nome = strdup(orig->nome);
        col->tipo = orig->tipo;
        col->tamanho = total;
        novo->nomes_colunas[c] = strdup(orig->nome);

        if (orig->tipo == TIPO_DOUBLE) {
            double* src = (double*)orig->dados;
            double* dst = (double*)malloc(total * sizeof(double));
            int j = 0;
            for (int r = 0; r < rd->num_linhas; r++) if (manter[r]) dst[j++] = src[r];
            col->dados = dst;
        } else {
            char** src = (char**)orig->dados;
            char** dst = (char**)malloc(total * sizeof(char*));
            int j = 0;
            for (int r = 0; r < rd->num_linhas; r++) if (manter[r]) dst[j++] = strdup(src[r]);
            col->dados = dst;
        }
        novo->colunas[c] = col;
    }
    free(manter);
    return novo;
}

// ── Seleção de coluna ────────────────────────────────────────────────────────

Serie* delegua_dados_selecionar_coluna(RecorteDados* rd, char* nome) {
    if (!rd || !nome) return NULL;

    for (int c = 0; c < rd->num_colunas; c++) {
        if (strcmp(rd->colunas[c]->nome, nome) != 0) continue;

        Coluna* orig = rd->colunas[c];
        Serie*  s    = (Serie*)calloc(1, sizeof(Serie));
        if (!s) return NULL;

        s->tipo    = orig->tipo;
        s->tamanho = orig->tamanho;
        s->indices = NULL;

        if (orig->tipo == TIPO_DOUBLE) {
            double* dst = (double*)malloc(orig->tamanho * sizeof(double));
            memcpy(dst, orig->dados, orig->tamanho * sizeof(double));
            s->dados = dst;
        } else {
            char** src = (char**)orig->dados;
            char** dst = (char**)malloc(orig->tamanho * sizeof(char*));
            for (int i = 0; i < orig->tamanho; i++) dst[i] = strdup(src[i]);
            s->dados = dst;
        }
        return s;
    }
    return NULL; // coluna não encontrada
}

// ── Agregações de Serie ───────────────────────────────────────────────────────

double delegua_dados_serie_max(Serie* s) {
    if (!s || s->tamanho == 0 || s->tipo != TIPO_DOUBLE) return 0.0;
    double* arr = (double*)s->dados;
    double  max = -DBL_MAX;
    for (int i = 0; i < s->tamanho; i++) if (arr[i] > max) max = arr[i];
    return max;
}

double delegua_dados_serie_min(Serie* s) {
    if (!s || s->tamanho == 0 || s->tipo != TIPO_DOUBLE) return 0.0;
    double* arr = (double*)s->dados;
    double  min = DBL_MAX;
    for (int i = 0; i < s->tamanho; i++) if (arr[i] < min) min = arr[i];
    return min;
}

double delegua_dados_serie_media(Serie* s) {
    if (!s || s->tamanho == 0 || s->tipo != TIPO_DOUBLE) return 0.0;
    double* arr  = (double*)s->dados;
    double  soma = 0.0;
    for (int i = 0; i < s->tamanho; i++) soma += arr[i];
    return soma / s->tamanho;
}

int delegua_dados_serie_tamanho(Serie* s) {
    return s ? s->tamanho : 0;
}
