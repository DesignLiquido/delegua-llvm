#pragma once

// G.1 — delegua-dados: estruturas tipo DataFrame (RecorteDados) e Série (Serie).
// Depende de csv.h / csv.c em tempo de compilação e link.

#define TIPO_DOUBLE  0
#define TIPO_INT     1
#define TIPO_STRING  2

typedef struct {
    char*  nome;
    int    tipo;     // TIPO_DOUBLE, TIPO_INT ou TIPO_STRING
    void*  dados;    // double*, int* ou char** conforme o tipo
    int    tamanho;
} Coluna;

typedef struct {
    Coluna** colunas;
    int      num_colunas;
    int      num_linhas;
    char**   nomes_colunas;
} RecorteDados;

typedef struct {
    void*  dados;    // double*, int* ou char** conforme o tipo
    int    tipo;     // TIPO_DOUBLE, TIPO_INT ou TIPO_STRING
    int    tamanho;
    char** indices;  // rótulos de índice; NULL = índice numérico implícito
} Serie;

// I/O
RecorteDados* delegua_dados_ler_csv           (char* caminho);
void          delegua_dados_liberar           (RecorteDados* rd);
void          delegua_dados_serie_liberar     (Serie* s);

// Operações sobre RecorteDados
RecorteDados* delegua_dados_cabeca            (RecorteDados* rd, int n);
RecorteDados* delegua_dados_cauda             (RecorteDados* rd, int n);
char*         delegua_dados_info              (RecorteDados* rd);
char*         delegua_dados_para_texto        (RecorteDados* rd);
RecorteDados* delegua_dados_remover_nulo      (RecorteDados* rd);
Serie*        delegua_dados_selecionar_coluna (RecorteDados* rd, char* nome);

// Operações sobre Serie
double        delegua_dados_serie_max         (Serie* s);
double        delegua_dados_serie_min         (Serie* s);
double        delegua_dados_serie_media       (Serie* s);
int           delegua_dados_serie_tamanho     (Serie* s);
