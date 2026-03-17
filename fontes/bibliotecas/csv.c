#include "csv.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// ── Utilitários internos ────────────────────────────────────────────────────

// Buffer de strings dinâmico (usado durante o parse).
typedef struct {
    char** itens;
    int    tamanho;
    int    capacidade;
} VetorStrings;

static void vs_iniciar(VetorStrings* v) {
    v->itens      = NULL;
    v->tamanho    = 0;
    v->capacidade = 0;
}

static int vs_adicionar(VetorStrings* v, char* s) {
    if (v->tamanho == v->capacidade) {
        int nova = v->capacidade == 0 ? 8 : v->capacidade * 2;
        char** tmp = (char**)realloc(v->itens, nova * sizeof(char*));
        if (!tmp) return 0;
        v->itens     = tmp;
        v->capacidade = nova;
    }
    v->itens[v->tamanho++] = s;
    return 1;
}

// ── Parser de campos RFC 4180 ───────────────────────────────────────────────

// Lê um campo do texto a partir da posição *pos com separador sep.
// Avança *pos. Seta *eol=1 se fim de linha/string foi atingido.
// Retorna string alocada (nunca NULL — campos vazios viram "").
static char* ler_campo(const char* texto, int* pos, char sep, int* eol) {
    *eol = 0;
    int cap = 64, len = 0;
    char* buf = (char*)malloc(cap);
    if (!buf) { *eol = 1; return NULL; }

#define BUF_APPEND(c) \
    do { \
        if (len + 1 >= cap) { cap *= 2; char* t = (char*)realloc(buf, cap); if (!t) { free(buf); *eol = 1; return NULL; } buf = t; } \
        buf[len++] = (c); \
    } while (0)

    if (texto[*pos] == '"') {
        (*pos)++; // pula aspas inicial
        while (texto[*pos] != '\0') {
            if (texto[*pos] == '"') {
                if (texto[*pos + 1] == '"') {
                    BUF_APPEND('"');
                    (*pos) += 2;
                } else {
                    (*pos)++; // aspas de fechamento
                    break;
                }
            } else {
                BUF_APPEND(texto[(*pos)++]);
            }
        }
    } else {
        while (texto[*pos] != '\0' && texto[*pos] != sep &&
               texto[*pos] != '\r' && texto[*pos] != '\n') {
            BUF_APPEND(texto[(*pos)++]);
        }
    }
#undef BUF_APPEND

    buf[len] = '\0';

    // Avança separador ou fim de linha
    if (texto[*pos] == sep) {
        (*pos)++;
    } else if (texto[*pos] == '\r') {
        (*pos)++;
        if (texto[*pos] == '\n') (*pos)++;
        *eol = 1;
    } else if (texto[*pos] == '\n') {
        (*pos)++;
        *eol = 1;
    } else {
        *eol = 1; // fim da string
    }
    return buf;
}

// ── Funções públicas ────────────────────────────────────────────────────────

TabelaCsv* delegua_csv_texto_para_tabela(char* texto, char sep) {
    if (!texto) return NULL;

    TabelaCsv* tabela = (TabelaCsv*)calloc(1, sizeof(TabelaCsv));
    if (!tabela) return NULL;

    // Crescimento dinâmico de linhas
    int cap_linhas = 16;
    tabela->linhas = (LinhaCsv*)malloc(cap_linhas * sizeof(LinhaCsv));
    if (!tabela->linhas) { free(tabela); return NULL; }

    int pos = 0;
    int max_colunas = 0;

    while (texto[pos] != '\0') {
        // Pula linhas vazias (\r\n no início de uma linha)
        if (texto[pos] == '\r' || texto[pos] == '\n') {
            if (texto[pos] == '\r' && texto[pos + 1] == '\n') pos++;
            pos++;
            continue;
        }

        VetorStrings celulas;
        vs_iniciar(&celulas);
        int eol = 0;

        while (!eol) {
            char* campo = ler_campo(texto, &pos, sep, &eol);
            if (!campo) { eol = 1; break; }
            vs_adicionar(&celulas, campo);
        }

        if (celulas.tamanho == 0) { free(celulas.itens); continue; }

        // Garante capacidade para nova linha
        if (tabela->total_linhas == cap_linhas) {
            cap_linhas *= 2;
            LinhaCsv* tmp = (LinhaCsv*)realloc(tabela->linhas, cap_linhas * sizeof(LinhaCsv));
            if (!tmp) {
                for (int i = 0; i < celulas.tamanho; i++) free(celulas.itens[i]);
                free(celulas.itens);
                break;
            }
            tabela->linhas = tmp;
        }

        LinhaCsv* linha = &tabela->linhas[tabela->total_linhas++];
        linha->celulas = celulas.itens;
        linha->colunas = celulas.tamanho;
        if (celulas.tamanho > max_colunas) max_colunas = celulas.tamanho;
    }

    tabela->colunas = max_colunas;
    return tabela;
}

char* delegua_csv_tabela_para_texto(TabelaCsv* tabela, char sep) {
    if (!tabela) return NULL;

    // Estimativa inicial do buffer de saída
    int cap = 4096, len = 0;
    char* buf = (char*)malloc(cap);
    if (!buf) return NULL;

#define OUT_APPEND(c) \
    do { \
        if (len + 1 >= cap) { cap *= 2; char* t = (char*)realloc(buf, cap); if (!t) { free(buf); return NULL; } buf = t; } \
        buf[len++] = (c); \
    } while (0)

#define OUT_STR(s) \
    do { \
        const char* _s = (s); \
        while (*_s) OUT_APPEND(*_s++); \
    } while (0)

    for (int l = 0; l < tabela->total_linhas; l++) {
        LinhaCsv* linha = &tabela->linhas[l];
        for (int c = 0; c < linha->colunas; c++) {
            const char* cel = linha->celulas[c] ? linha->celulas[c] : "";
            // Determina se precisa de aspas: contém sep, aspas ou newline
            int precisa_aspas = 0;
            for (const char* p = cel; *p; p++) {
                if (*p == sep || *p == '"' || *p == '\n' || *p == '\r') {
                    precisa_aspas = 1; break;
                }
            }
            if (precisa_aspas) {
                OUT_APPEND('"');
                for (const char* p = cel; *p; p++) {
                    if (*p == '"') OUT_APPEND('"'); // escapa aspas duplicando
                    OUT_APPEND(*p);
                }
                OUT_APPEND('"');
            } else {
                OUT_STR(cel);
            }
            if (c < linha->colunas - 1) OUT_APPEND(sep);
        }
        OUT_APPEND('\n');
    }
#undef OUT_APPEND
#undef OUT_STR

    buf[len] = '\0';
    return buf;
}

TabelaCsv* delegua_csv_ler(char* caminho, char sep) {
    FILE* fp = fopen(caminho, "rb");
    if (!fp) return NULL;

    fseek(fp, 0, SEEK_END);
    long tam = ftell(fp);
    rewind(fp);

    char* conteudo = (char*)malloc(tam + 1);
    if (!conteudo) { fclose(fp); return NULL; }
    fread(conteudo, 1, tam, fp);
    conteudo[tam] = '\0';
    fclose(fp);

    TabelaCsv* tabela = delegua_csv_texto_para_tabela(conteudo, sep);
    free(conteudo);
    return tabela;
}

void delegua_csv_escrever(char* caminho, TabelaCsv* tabela, char sep) {
    if (!caminho || !tabela) return;
    char* texto = delegua_csv_tabela_para_texto(tabela, sep);
    if (!texto) return;
    FILE* fp = fopen(caminho, "w");
    if (fp) { fputs(texto, fp); fclose(fp); }
    free(texto);
}

int delegua_csv_total_linhas(TabelaCsv* tabela) {
    return tabela ? tabela->total_linhas : 0;
}

int delegua_csv_total_colunas(TabelaCsv* tabela) {
    return tabela ? tabela->colunas : 0;
}

char* delegua_csv_obter_celula(TabelaCsv* tabela, int linha, int coluna) {
    if (!tabela || linha < 0 || linha >= tabela->total_linhas) return NULL;
    LinhaCsv* l = &tabela->linhas[linha];
    if (coluna < 0 || coluna >= l->colunas) return NULL;
    return l->celulas[coluna];
}

void delegua_csv_liberar(TabelaCsv* tabela) {
    if (!tabela) return;
    for (int l = 0; l < tabela->total_linhas; l++) {
        LinhaCsv* linha = &tabela->linhas[l];
        for (int c = 0; c < linha->colunas; c++) free(linha->celulas[c]);
        free(linha->celulas);
    }
    free(tabela->linhas);
    free(tabela);
}
