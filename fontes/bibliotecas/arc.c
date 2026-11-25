#include "arc.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Contadores globais (o runtime Delégua é monothread).
static int64_t arc_alocacoes_vivas = 0;
static int64_t arc_total_alocacoes = 0;
static int64_t arc_total_liberacoes = 0;
static int arc_fim_normal = 0;
static ArcQuadroLimpeza* arc_topo_limpeza = NULL;

static ArcCabecalho* cabecalho_de(const void* p) {
    return (ArcCabecalho*)((char*)p - sizeof(ArcCabecalho));
}

// Leitura especulativa da magia: para ponteiros não gerenciados (literais ainda sem
// cabeçalho, memória de FFI) lê a magia 12 bytes antes do início do bloco. É o custo da migração
// gradual; some quando todo `texto` tiver cabeçalho (Fase 2.1 e cópia na fronteira FFI).
// Só esta leitura é isenta do AddressSanitizer: os acessos a rc e ao descritor continuam
// verificados.
#if defined(__clang__) || defined(__GNUC__)
__attribute__((no_sanitize("address")))
#endif
static ArcCabecalho* cabecalho_valido(const void* p) {
    if (!p) return NULL;
    ArcCabecalho* c = cabecalho_de(p);
    return c->magia == DELEGUA_ARC_MAGIA ? c : NULL;
}

static void sem_memoria(size_t tamanho) {
    fprintf(stderr, "[DELEGUA ERRO] Memoria insuficiente (%zu bytes).\n", tamanho);
    fflush(stderr);
    abort();
}

static void relatorio_depuracao(void) {
    const char* modo = getenv("DELEGUA_ARC_DEPURACAO");
    fprintf(stderr,
            "[DELEGUA ARC] alocacoes=%lld liberacoes=%lld vivas=%lld\n",
            (long long)arc_total_alocacoes,
            (long long)arc_total_liberacoes,
            (long long)arc_alocacoes_vivas);
    fflush(stderr);
    if (modo && strcmp(modo, "estrito") == 0 && arc_fim_normal && arc_alocacoes_vivas > 0) {
        _Exit(99);
    }
}

#if defined(__GNUC__) || defined(__clang__)
__attribute__((constructor))
#endif
static void registrar_depuracao(void) {
    if (getenv("DELEGUA_ARC_DEPURACAO")) atexit(relatorio_depuracao);
}

void* delegua_arc_alocar(size_t tamanho, const ArcDescritor* descritor) {
    ArcCabecalho* c = (ArcCabecalho*)calloc(1, sizeof(ArcCabecalho) + tamanho);
    if (!c) sem_memoria(tamanho);
    c->rc = 1;
    c->magia = DELEGUA_ARC_MAGIA;
    c->tipo = descritor;
    arc_alocacoes_vivas++;
    arc_total_alocacoes++;
    return (char*)c + sizeof(ArcCabecalho);
}

void* delegua_arc_realocar(void* p, size_t novo_tamanho) {
    if (!p) return delegua_arc_alocar(novo_tamanho, NULL);
    ArcCabecalho* c = cabecalho_valido(p);
    if (!c || c->rc != 1) {
        // Não gerenciado, imortal ou compartilhado: realocar moveria memória de outro dono.
        fprintf(stderr, "[DELEGUA ERRO] delegua_arc_realocar: ponteiro nao gerenciado ou compartilhado.\n");
        fflush(stderr);
        abort();
    }
    ArcCabecalho* novo = (ArcCabecalho*)realloc(c, sizeof(ArcCabecalho) + novo_tamanho);
    if (!novo) sem_memoria(novo_tamanho);
    return (char*)novo + sizeof(ArcCabecalho);
}

void delegua_arc_reter(void* p) {
    ArcCabecalho* c = cabecalho_valido(p);
    if (!c || c->rc < 0) return;
    c->rc++;
}

void delegua_arc_liberar(void* p) {
    ArcCabecalho* c = cabecalho_valido(p);
    if (!c || c->rc < 0) return;
    if (c->rc <= 0) {
        fprintf(stderr, "[DELEGUA ERRO] delegua_arc_liberar: liberacao dupla (rc=%d).\n", c->rc);
        fflush(stderr);
        abort();
    }
    if (--c->rc > 0) return;

    if (c->tipo && c->tipo->destrutor) c->tipo->destrutor(p);
    // Apaga a magia: um uso após a liberação deixa de ser reconhecido como gerenciado.
    c->magia = 0;
    free(c);
    arc_alocacoes_vivas--;
    arc_total_liberacoes++;
}

void delegua_arc_atribuir(void** slot, void* novo) {
    if (!slot) return;
    delegua_arc_reter(novo);
    void* antigo = *slot;
    *slot = novo;
    delegua_arc_liberar(antigo);
}

int delegua_arc_eh_gerenciado(const void* p) {
    return cabecalho_valido(p) != NULL;
}

int32_t delegua_arc_contagem(const void* p) {
    ArcCabecalho* c = cabecalho_valido(p);
    return c ? c->rc : 0;
}

char* delegua_arc_texto_criar(size_t tamanho) {
    return (char*)delegua_arc_alocar(tamanho + 1, NULL);
}

char* delegua_arc_texto_copiar_trecho(const char* s, size_t tamanho) {
    char* copia = delegua_arc_texto_criar(tamanho);
    if (s && tamanho > 0) memcpy(copia, s, tamanho);
    copia[tamanho] = '\0';
    return copia;
}

char* delegua_arc_texto_copiar(const char* s) {
    if (!s) return NULL;
    return delegua_arc_texto_copiar_trecho(s, strlen(s));
}

void* delegua_arc_caixa(size_t tamanho) {
    return delegua_arc_alocar(tamanho, NULL);
}

int64_t delegua_arc_alocacoes_vivas(void) {
    return arc_alocacoes_vivas;
}

void delegua_arc_quadro_empilhar(ArcQuadroLimpeza* quadro) {
    if (!quadro) return;
    quadro->anterior = arc_topo_limpeza;
    arc_topo_limpeza = quadro;
}

void delegua_arc_quadro_desempilhar(ArcQuadroLimpeza* quadro) {
    if (!quadro) return;
    arc_topo_limpeza = quadro->anterior;
}

void* delegua_arc_quadro_topo(void) {
    return arc_topo_limpeza;
}

void delegua_arc_desenrolar_ate(void* marca) {
    while (arc_topo_limpeza && arc_topo_limpeza != (ArcQuadroLimpeza*)marca) {
        ArcQuadroLimpeza* quadro = arc_topo_limpeza;
        // Desempilha antes de liberar: um destrutor nunca vê este quadro como ativo.
        arc_topo_limpeza = quadro->anterior;
        for (int32_t i = 0; i < quadro->quantidade; i++) {
            void* valor = *quadro->slots[i];
            *quadro->slots[i] = NULL;
            delegua_arc_liberar(valor);
        }
    }
}

void delegua_arc_fim_normal(void) {
    arc_fim_normal = 1;
}
