#include "dicionario.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define DICIONARIO_CAPACIDADE_INICIAL 16

struct DicionarioEntrada {
    char* chave;
    void* valor;
    DicionarioEntrada* proximo;
    DicionarioEntrada* anteriorInsercao;
    DicionarioEntrada* proximoInsercao;
};

// ───────────────────────────────────────────────────────────
// Hash (djb2)
// ───────────────────────────────────────────────────────────

static unsigned long hash_chave(const char* chave) {
    unsigned long hash = 5381;
    int c;
    while ((c = (unsigned char)*chave++)) {
        hash = ((hash << 5) + hash) + (unsigned long)c;
    }
    return hash;
}

// ───────────────────────────────────────────────────────────
// Implementações
// ───────────────────────────────────────────────────────────

Dicionario* delegua_dicionario_criar(void) {
    Dicionario* d = (Dicionario*)malloc(sizeof(Dicionario));
    if (!d) {
        fprintf(stderr, "[DELEGUA ERRO] delegua_dicionario_criar: falha ao alocar dicionario\n");
        fflush(stderr);
        return NULL;
    }
    d->capacidade = DICIONARIO_CAPACIDADE_INICIAL;
    d->tamanho = 0;
    d->primeiro = NULL;
    d->ultimo = NULL;
    d->baldes = (DicionarioEntrada**)calloc((size_t)d->capacidade, sizeof(DicionarioEntrada*));
    if (!d->baldes) {
        fprintf(stderr, "[DELEGUA ERRO] delegua_dicionario_criar: falha ao alocar baldes\n");
        fflush(stderr);
        free(d);
        return NULL;
    }
    return d;
}

static void redimensionar_se_necessario(Dicionario* d) {
    // Fator de carga > 0.75: dobra a capacidade e reencadeia as entradas existentes.
    if (d->tamanho * 4 < d->capacidade * 3) {
        return;
    }

    int capacidadeAntiga = d->capacidade;
    DicionarioEntrada** baldesAntigos = d->baldes;

    int novaCapacidade = capacidadeAntiga * 2;
    DicionarioEntrada** novosBaldes = (DicionarioEntrada**)calloc((size_t)novaCapacidade, sizeof(DicionarioEntrada*));
    if (!novosBaldes) {
        // Falha ao redimensionar: mantém a tabela antiga (mais colisões, mas funcional).
        return;
    }

    for (int i = 0; i < capacidadeAntiga; i++) {
        DicionarioEntrada* entrada = baldesAntigos[i];
        while (entrada) {
            DicionarioEntrada* proximo = entrada->proximo;
            unsigned long indice = hash_chave(entrada->chave) % (unsigned long)novaCapacidade;
            entrada->proximo = novosBaldes[indice];
            novosBaldes[indice] = entrada;
            entrada = proximo;
        }
    }

    free(baldesAntigos);
    d->baldes = novosBaldes;
    d->capacidade = novaCapacidade;
}

void delegua_dicionario_definir(Dicionario* d, const char* chave, void* valor) {
    if (!d || !chave) {
        fprintf(stderr, "[DELEGUA ERRO] delegua_dicionario_definir: argumento invalido"
                        " (d=%p, chave=%p)\n", (void*)d, (const void*)chave);
        fflush(stderr);
        return;
    }

    unsigned long indice = hash_chave(chave) % (unsigned long)d->capacidade;
    DicionarioEntrada* entrada = d->baldes[indice];
    while (entrada) {
        if (strcmp(entrada->chave, chave) == 0) {
            entrada->valor = valor;
            return;
        }
        entrada = entrada->proximo;
    }

    DicionarioEntrada* nova = (DicionarioEntrada*)malloc(sizeof(DicionarioEntrada));
    if (!nova) {
        fprintf(stderr, "[DELEGUA ERRO] delegua_dicionario_definir: falha ao alocar entrada\n");
        fflush(stderr);
        return;
    }
    nova->chave = strdup(chave);
    if (!nova->chave) {
        free(nova);
        return;
    }
    nova->valor = valor;
    nova->proximo = d->baldes[indice];
    d->baldes[indice] = nova;
    nova->anteriorInsercao = d->ultimo;
    nova->proximoInsercao = NULL;
    if (d->ultimo) {
        d->ultimo->proximoInsercao = nova;
    } else {
        d->primeiro = nova;
    }
    d->ultimo = nova;
    d->tamanho += 1;

    redimensionar_se_necessario(d);
}

void* delegua_dicionario_obter(Dicionario* d, const char* chave) {
    if (!d || !chave) return NULL;

    unsigned long indice = hash_chave(chave) % (unsigned long)d->capacidade;
    DicionarioEntrada* entrada = d->baldes[indice];
    while (entrada) {
        if (strcmp(entrada->chave, chave) == 0) {
            return entrada->valor;
        }
        entrada = entrada->proximo;
    }
    return NULL;
}

int delegua_dicionario_contem(Dicionario* d, const char* chave) {
    if (!d || !chave) return 0;

    unsigned long indice = hash_chave(chave) % (unsigned long)d->capacidade;
    DicionarioEntrada* entrada = d->baldes[indice];
    while (entrada) {
        if (strcmp(entrada->chave, chave) == 0) {
            return 1;
        }
        entrada = entrada->proximo;
    }
    return 0;
}

int delegua_dicionario_tamanho(Dicionario* d) {
    return d ? d->tamanho : 0;
}

int delegua_dicionario_remover(Dicionario* d, const char* chave) {
    if (!d || !chave) return 0;

    unsigned long indice = hash_chave(chave) % (unsigned long)d->capacidade;
    DicionarioEntrada* anterior = NULL;
    DicionarioEntrada* entrada = d->baldes[indice];
    while (entrada) {
        if (strcmp(entrada->chave, chave) == 0) {
            if (anterior) {
                anterior->proximo = entrada->proximo;
            } else {
                d->baldes[indice] = entrada->proximo;
            }

            if (entrada->anteriorInsercao) {
                entrada->anteriorInsercao->proximoInsercao = entrada->proximoInsercao;
            } else {
                d->primeiro = entrada->proximoInsercao;
            }
            if (entrada->proximoInsercao) {
                entrada->proximoInsercao->anteriorInsercao = entrada->anteriorInsercao;
            } else {
                d->ultimo = entrada->anteriorInsercao;
            }

            free(entrada->chave);
            free(entrada);
            d->tamanho -= 1;
            return 1;
        }
        anterior = entrada;
        entrada = entrada->proximo;
    }
    return 0;
}

// Copia, em ordem de inserção, a chave (duplicada) ou o valor de cada entrada para um novo Vetor*.
static Vetor* coletar(Dicionario* d, int coletarChaves) {
    Vetor* saida = delegua_vetor_criar(0, (int)sizeof(void*));
    if (!saida || !d || d->tamanho <= 0) return saida;

    for (DicionarioEntrada* e = d->primeiro; e; e = e->proximoInsercao) {
        void* item = coletarChaves ? (void*)strdup(e->chave ? e->chave : "") : e->valor;
        delegua_vetor_adicionar(saida, &item, (int)sizeof(void*));
    }
    return saida;
}

Vetor* delegua_dicionario_chaves(Dicionario* d) {
    return coletar(d, 1);
}

Vetor* delegua_dicionario_valores(Dicionario* d) {
    return coletar(d, 0);
}

void delegua_dicionario_liberar(Dicionario* d) {
    if (!d) return;
    DicionarioEntrada* atual = d->primeiro;
    while (atual) {
        DicionarioEntrada* proximo = atual->proximoInsercao;
        free(atual->chave);
        free(atual);
        atual = proximo;
    }
    free(d->baldes);
    free(d);
}
