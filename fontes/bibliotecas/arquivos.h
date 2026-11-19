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

// ── Sistema de arquivos ──────────────────────────────────────────────────────
// Funções que retornam int retornam 1 em caso de sucesso e 0 em caso de falha.
#include "vetor.h"

int      delegua_arq_existe                (char* caminho);
// Cria o diretório e todos os diretórios pais que faltarem (como `mkdir -p`).
int      delegua_arq_criar_diretorio       (char* caminho);
// Remove arquivo ou diretório (recursivamente). Caminho inexistente conta como sucesso.
int      delegua_arq_remover               (char* caminho);
// Renomeia/move, substituindo o destino se for um arquivo.
int      delegua_arq_renomear              (char* origem, char* destino);
// Nomes das entradas do diretório (sem "." e ".."), em ordem alfabética.
Vetor*   delegua_arq_listar_diretorio      (char* caminho);
// Cria um diretório novo e exclusivo dentro de `pai` (vazio: diretório temporário do sistema).
char*    delegua_arq_criar_diretorio_temporario(char* pai, char* prefixo);
char*    delegua_arq_diretorio_pessoal     (void);
// Conteúdo do arquivo, ou NULL se não puder ser lido.
char*    delegua_arq_ler_texto             (char* caminho);
// Cria ou substitui o arquivo com o conteúdo informado.
int      delegua_arq_escrever_texto        (char* caminho, char* conteudo);
// Permissões Unix (ex.: 448 = 0700). No Windows, apenas o bit de somente leitura é aplicado.
int      delegua_arq_definir_permissoes    (char* caminho, int modo);

// ── Caminhos ─────────────────────────────────────────────────────────────────
char*    delegua_arq_juntar_caminhos       (char* base, char* parte);
char*    delegua_arq_diretorio_pai         (char* caminho);
char*    delegua_arq_nome_base             (char* caminho);
char*    delegua_arq_caminho_absoluto      (char* caminho);
