#pragma once

typedef struct {
    char** celulas;
    int    colunas;
} LinhaCsv;

typedef struct {
    LinhaCsv* linhas;
    int       total_linhas;
    int       colunas;
} TabelaCsv;

// Converte texto CSV em TabelaCsv*. sep = separador (normalmente ',').
TabelaCsv* delegua_csv_texto_para_tabela (char* texto, char sep);

// Serializa TabelaCsv* para texto CSV. Retorna string alocada.
char*      delegua_csv_tabela_para_texto (TabelaCsv* tabela, char sep);

// Lê arquivo CSV do caminho e retorna TabelaCsv*.
TabelaCsv* delegua_csv_ler              (char* caminho, char sep);

// Serializa e escreve TabelaCsv* no arquivo indicado.
void       delegua_csv_escrever         (char* caminho, TabelaCsv* tabela, char sep);

// Acessores de instância.
int        delegua_csv_total_linhas     (TabelaCsv* tabela);
int        delegua_csv_total_colunas    (TabelaCsv* tabela);
char*      delegua_csv_obter_celula     (TabelaCsv* tabela, int linha, int coluna);
void       delegua_csv_liberar          (TabelaCsv* tabela);
