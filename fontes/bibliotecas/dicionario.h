#pragma once
#include <stdlib.h>
#include <string.h>
#include "vetor.h"

typedef struct DicionarioEntrada DicionarioEntrada;

typedef struct {
    DicionarioEntrada** baldes;
    int capacidade;
    int tamanho;
    // Lista duplamente encadeada em ordem de inserção, usada por chaves(),
    // valores() e `para cada`, para que a iteração seja determinística.
    DicionarioEntrada* primeiro;
    DicionarioEntrada* ultimo;
} Dicionario;

// Cria um dicionário vazio (tabela hash com encadeamento separado).
Dicionario* delegua_dicionario_criar(void);

// Define (ou substitui) o valor associado à chave. `valor` é um ponteiro
// opaco (qualquer) — o chamador decide o que ele representa.
void delegua_dicionario_definir(Dicionario* d, const char* chave, void* valor);

// Retorna o valor associado à chave, ou NULL se a chave não existir.
void* delegua_dicionario_obter(Dicionario* d, const char* chave);

// Retorna 1 se a chave existe no dicionário, 0 caso contrário.
int delegua_dicionario_contem(Dicionario* d, const char* chave);

// Retorna o número de pares chave/valor no dicionário.
int delegua_dicionario_tamanho(Dicionario* d);

// Remove a chave do dicionário. Retorna 1 se a chave existia, 0 caso contrário.
int delegua_dicionario_remover(Dicionario* d, const char* chave);

// Retorna um novo Vetor* com as chaves (char*), em ordem de inserção.
Vetor* delegua_dicionario_chaves(Dicionario* d);

// Retorna um novo Vetor* com os valores (void*), em ordem de inserção.
Vetor* delegua_dicionario_valores(Dicionario* d);

// Libera toda a estrutura do dicionário e suas chaves/entradas.
void delegua_dicionario_liberar(Dicionario* d);
