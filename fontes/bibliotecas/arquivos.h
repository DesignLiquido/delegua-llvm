#pragma once

// Struct Arquivo: ponteiro opaco passado entre funções do módulo arquivos.
typedef struct {
    char* caminho;
    char* conteudo;
    long  tamanho;
} Arquivo;

Arquivo* delegua_arq_abrir               (char* caminho);
char*    delegua_arq_diretorio_atual     (void);
int      delegua_arq_diretorio_existe    (char* caminho);
int      delegua_arq_e_arquivo           (char* caminho);
int      delegua_arq_e_diretorio         (char* caminho);

// Funções de instância — recebem Arquivo* como primeiro argumento.
char*    delegua_arq_para_texto          (Arquivo* arq);
void     delegua_arq_escrever            (Arquivo* arq, char* texto);
void     delegua_arq_sobrescrever        (Arquivo* arq, char* texto);
void     delegua_arq_recarregar          (Arquivo* arq);
int      delegua_arq_instancia_e_arquivo (Arquivo* arq);
int      delegua_arq_instancia_e_diretorio(Arquivo* arq);
