#include "arc.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Contadores globais (o runtime Delégua é monothread).
static int64_t arc_alocacoes_vivas = 0;
static int64_t arc_total_alocacoes = 0;
static int64_t arc_total_liberacoes = 0;
static int64_t arc_ciclos_coletados = 0;
static int arc_fim_normal = 0;
static ArcQuadroLimpeza* arc_topo_limpeza = NULL;

// ─── Cabeçalho: magia (24 bits) + estado do coletor de ciclos (8 bits) ───────
//
// Os 24 bits altos de `magia` identificam o cabeçalho; o byte baixo guarda a cor e os
// marcadores do coletor de ciclos (Fase 4.1). Literais imortais usam DELEGUA_ARC_MAGIA
// inteira (byte baixo qualquer): o coletor nunca os visita, porque têm rc < 0.
#define MAGIA_BASE (DELEGUA_ARC_MAGIA >> 8)
#define COR_MASCARA 0x03u
#define COR_PRETO 0x00u  // em uso
#define COR_CINZA 0x01u  // possível membro de ciclo (contagem tentativamente decrementada)
#define COR_BRANCO 0x02u // lixo: só referenciado de dentro do ciclo
#define COR_ROXO 0x03u   // possível raiz de ciclo
#define MARCA_BUFERIZADO 0x04u // está no buffer de raízes candidatas
#define MARCA_DESTRUIDO 0x08u  // rc chegou a 0 enquanto buferizado: só falta liberar a memória
#define MARCA_COLETADO 0x10u   // já incluído na lista de lixo da coleta atual
#define MARCA_TEM_FRACOS 0x20u // há referências fracas (@fraco) registradas para este objeto

static ArcCabecalho* cabecalho_de(const void* p) {
    return (ArcCabecalho*)((char*)p - sizeof(ArcCabecalho));
}

static void* payload_de(ArcCabecalho* c) {
    return (char*)c + sizeof(ArcCabecalho);
}

// Leitura especulativa da magia: para ponteiros não gerenciados (memória de FFI, ponteiros
// brutos guardados como `qualquer`) lê 12 bytes antes do início do bloco. Só esta leitura é
// isenta do AddressSanitizer: os acessos a rc e ao descritor continuam verificados.
#if defined(__clang__) || defined(__GNUC__)
__attribute__((no_sanitize("address")))
#endif
static ArcCabecalho* cabecalho_valido(const void* p) {
    if (!p) return NULL;
    ArcCabecalho* c = cabecalho_de(p);
    return (c->magia >> 8) == MAGIA_BASE ? c : NULL;
}

static unsigned cor(const ArcCabecalho* c) { return c->magia & COR_MASCARA; }
static void pintar(ArcCabecalho* c, unsigned nova) { c->magia = (c->magia & ~COR_MASCARA) | nova; }
static int tem(const ArcCabecalho* c, unsigned marca) { return (c->magia & marca) != 0; }
static void marcar(ArcCabecalho* c, unsigned marca) { c->magia |= marca; }
static void desmarcar(ArcCabecalho* c, unsigned marca) { c->magia &= ~marca; }

static int pode_ter_ciclo(const ArcCabecalho* c) {
    return c->tipo && c->tipo->visitar_filhos;
}

static void sem_memoria(size_t tamanho) {
    fprintf(stderr, "[DELEGUA ERRO] Memoria insuficiente (%zu bytes).\n", tamanho);
    fflush(stderr);
    abort();
}

// Desaloca a memória de um cabeçalho cujo destrutor já rodou.
static void desalocar(ArcCabecalho* c) {
    // Apaga a magia: um uso após a liberação deixa de ser reconhecido como gerenciado.
    c->magia = 0;
    free(c);
    arc_alocacoes_vivas--;
    arc_total_liberacoes++;
}

// ─── Referências fracas (@fraco, Fase 4.2) ───────────────────────────────────
//
// Tabela lateral: objeto alvo → slots (campos @fraco) que apontam para ele. Uma referência
// fraca não conta no rc; quando o alvo morre, todos os slots registrados viram nulo, então
// ler um campo @fraco nunca devolve memória liberada.

typedef struct EntradaFraca {
    ArcCabecalho* alvo;
    void*** slots;
    size_t tamanho;
    size_t capacidade;
    struct EntradaFraca* proxima;
} EntradaFraca;

#define BALDES_FRACOS 1024
static EntradaFraca* arc_fracos[BALDES_FRACOS];

static EntradaFraca** balde_fraco(ArcCabecalho* alvo) {
    uintptr_t chave = (uintptr_t)alvo >> 4;
    return &arc_fracos[(chave ^ (chave >> 10)) % BALDES_FRACOS];
}

static EntradaFraca* entrada_fraca(ArcCabecalho* alvo, int criar) {
    EntradaFraca** balde = balde_fraco(alvo);
    for (EntradaFraca* e = *balde; e; e = e->proxima) {
        if (e->alvo == alvo) return e;
    }
    if (!criar) return NULL;
    EntradaFraca* nova = (EntradaFraca*)calloc(1, sizeof(EntradaFraca));
    if (!nova) sem_memoria(sizeof(EntradaFraca));
    nova->alvo = alvo;
    nova->proxima = *balde;
    *balde = nova;
    return nova;
}

static void remover_entrada_fraca(EntradaFraca* entrada) {
    EntradaFraca** atual = balde_fraco(entrada->alvo);
    while (*atual && *atual != entrada) atual = &(*atual)->proxima;
    if (*atual) *atual = entrada->proxima;
    free(entrada->slots);
    free(entrada);
}

static void desregistrar_fraco(ArcCabecalho* alvo, void** slot) {
    if (!tem(alvo, MARCA_TEM_FRACOS)) return;
    EntradaFraca* entrada = entrada_fraca(alvo, 0);
    if (!entrada) return;
    for (size_t i = 0; i < entrada->tamanho; i++) {
        if (entrada->slots[i] == slot) {
            entrada->slots[i] = entrada->slots[--entrada->tamanho];
            break;
        }
    }
    if (entrada->tamanho == 0) {
        remover_entrada_fraca(entrada);
        desmarcar(alvo, MARCA_TEM_FRACOS);
    }
}

// O alvo vai morrer: zera todos os slots fracos que apontam para ele.
static void zerar_fracos(ArcCabecalho* alvo) {
    if (!tem(alvo, MARCA_TEM_FRACOS)) return;
    EntradaFraca* entrada = entrada_fraca(alvo, 0);
    desmarcar(alvo, MARCA_TEM_FRACOS);
    if (!entrada) return;
    for (size_t i = 0; i < entrada->tamanho; i++) *entrada->slots[i] = NULL;
    remover_entrada_fraca(entrada);
}

void delegua_arc_fraco_atribuir(void** slot, void* novo) {
    if (!slot) return;
    ArcCabecalho* antigo = cabecalho_valido(*slot);
    if (antigo && antigo->rc >= 0) desregistrar_fraco(antigo, slot);
    *slot = novo;
    ArcCabecalho* alvo = cabecalho_valido(novo);
    // Imortais e ponteiros sem cabeçalho nunca morrem: não precisam de registro.
    if (!alvo || alvo->rc < 0) return;
    EntradaFraca* entrada = entrada_fraca(alvo, 1);
    if (entrada->tamanho == entrada->capacidade) {
        size_t nova = entrada->capacidade ? entrada->capacidade * 2 : 4;
        void*** slots = (void***)realloc(entrada->slots, nova * sizeof(void**));
        if (!slots) sem_memoria(nova * sizeof(void**));
        entrada->slots = slots;
        entrada->capacidade = nova;
    }
    entrada->slots[entrada->tamanho++] = slot;
    marcar(alvo, MARCA_TEM_FRACOS);
}

// ─── Listas auxiliares (sem recursão: grafos longos não estouram a pilha de C) ──

typedef struct {
    ArcCabecalho** itens;
    size_t tamanho;
    size_t capacidade;
} ListaCabecalhos;

static void lista_empilhar(ListaCabecalhos* lista, ArcCabecalho* c) {
    if (lista->tamanho == lista->capacidade) {
        size_t nova = lista->capacidade ? lista->capacidade * 2 : 64;
        ArcCabecalho** itens = (ArcCabecalho**)realloc(lista->itens, nova * sizeof(ArcCabecalho*));
        if (!itens) sem_memoria(nova * sizeof(ArcCabecalho*));
        lista->itens = itens;
        lista->capacidade = nova;
    }
    lista->itens[lista->tamanho++] = c;
}

static ArcCabecalho* lista_desempilhar(ListaCabecalhos* lista) {
    return lista->tamanho ? lista->itens[--lista->tamanho] : NULL;
}

static void lista_liberar(ListaCabecalhos* lista) {
    free(lista->itens);
    lista->itens = NULL;
    lista->tamanho = lista->capacidade = 0;
}

// ─── Coletor de ciclos (Bacon & Rajan, "trial deletion" síncrono) ────────────
//
// Uma liberação que deixa rc > 0 num objeto que pode ter filhos (vetor, dicionário, instância
// de classe com campos que não são só texto) o torna raiz candidata. A coleta roda quando o
// buffer de raízes enche (num ponto de alocação, nunca dentro de um destrutor) e ao fim do
// programa no modo de depuração:
//   1. marcar cinza: a partir de cada raiz, subtrai as referências internas ao subgrafo;
//   2. varrer: o que ficou com rc > 0 tem referência externa e é repintado de preto (as
//      contagens do caminho são restauradas); o resto é branco (lixo);
//   3. coletar: as referências do lixo para objetos vivos são restauradas, o lixo é tornado
//      imortal (liberar sobre ele não faz nada) e os destrutores normais rodam (soltando os
//      filhos vivos); por fim a memória do lixo é desalocada.

#define LIMIAR_RAIZES 10000

static ListaCabecalhos arc_raizes = {0};
static int arc_coletando = 0;
static int arc_coleta_pendente = 0;

static void possivel_raiz(ArcCabecalho* c) {
    if (cor(c) == COR_ROXO) return;
    pintar(c, COR_ROXO);
    if (tem(c, MARCA_BUFERIZADO)) return;
    marcar(c, MARCA_BUFERIZADO);
    lista_empilhar(&arc_raizes, c);
    if (arc_raizes.tamanho >= LIMIAR_RAIZES) arc_coleta_pendente = 1;
}

// Visita os filhos gerenciados (mortais) de `c`, chamando `acao` com o cabeçalho de cada um.
typedef struct {
    void (*acao)(ArcCabecalho* filho, ListaCabecalhos* pilha);
    ListaCabecalhos* pilha;
} ContextoVisita;

static void visitar_um(void* filho, void* contexto) {
    ArcCabecalho* c = cabecalho_valido(filho);
    if (!c || c->rc < 0) return;
    ContextoVisita* ctx = (ContextoVisita*)contexto;
    ctx->acao(c, ctx->pilha);
}

static void visitar_filhos(ArcCabecalho* c, void (*acao)(ArcCabecalho*, ListaCabecalhos*), ListaCabecalhos* pilha) {
    if (!pode_ter_ciclo(c)) return;
    ContextoVisita ctx = {acao, pilha};
    c->tipo->visitar_filhos(payload_de(c), visitar_um, &ctx);
}

static void acao_cinza(ArcCabecalho* filho, ListaCabecalhos* pilha) {
    filho->rc--;
    lista_empilhar(pilha, filho);
}

static void marcar_cinza(ArcCabecalho* raiz, ListaCabecalhos* pilha) {
    lista_empilhar(pilha, raiz);
    ArcCabecalho* c;
    while ((c = lista_desempilhar(pilha))) {
        if (cor(c) == COR_CINZA) continue;
        pintar(c, COR_CINZA);
        visitar_filhos(c, acao_cinza, pilha);
    }
}

static void acao_preto(ArcCabecalho* filho, ListaCabecalhos* pilha) {
    filho->rc++;
    if (cor(filho) != COR_PRETO) {
        pintar(filho, COR_PRETO);
        lista_empilhar(pilha, filho);
    }
}

static void varrer_preto(ArcCabecalho* inicio, ListaCabecalhos* pilha) {
    pintar(inicio, COR_PRETO);
    lista_empilhar(pilha, inicio);
    ArcCabecalho* c;
    while ((c = lista_desempilhar(pilha))) visitar_filhos(c, acao_preto, pilha);
}

static void acao_empilhar(ArcCabecalho* filho, ListaCabecalhos* pilha) {
    lista_empilhar(pilha, filho);
}

static void varrer(ArcCabecalho* raiz, ListaCabecalhos* pilha, ListaCabecalhos* pilha_preta) {
    lista_empilhar(pilha, raiz);
    ArcCabecalho* c;
    while ((c = lista_desempilhar(pilha))) {
        if (cor(c) != COR_CINZA) continue;
        if (c->rc > 0) {
            varrer_preto(c, pilha_preta);
        } else {
            pintar(c, COR_BRANCO);
            visitar_filhos(c, acao_empilhar, pilha);
        }
    }
}

static void coletar_branco(ArcCabecalho* raiz, ListaCabecalhos* pilha, ListaCabecalhos* lixo) {
    lista_empilhar(pilha, raiz);
    ArcCabecalho* c;
    while ((c = lista_desempilhar(pilha))) {
        if (cor(c) != COR_BRANCO || tem(c, MARCA_COLETADO) || tem(c, MARCA_BUFERIZADO)) continue;
        marcar(c, MARCA_COLETADO);
        lista_empilhar(lixo, c);
        visitar_filhos(c, acao_empilhar, pilha);
    }
}

// Referência do lixo para um objeto vivo: o passo cinza a descontou; devolve-a para que o
// destrutor do lixo a solte normalmente.
static void acao_restaurar(ArcCabecalho* filho, ListaCabecalhos* pilha) {
    (void)pilha;
    if (!tem(filho, MARCA_COLETADO)) filho->rc++;
}

void delegua_arc_coletar_ciclos(void) {
    if (arc_coletando) return;
    arc_coletando = 1;
    arc_coleta_pendente = 0;

    // Raízes desta coleta; as que surgirem durante os destrutores vão para um buffer novo.
    ListaCabecalhos raizes = arc_raizes;
    arc_raizes = (ListaCabecalhos){0};
    ListaCabecalhos pilha = {0}, pilha_preta = {0}, lixo = {0};

    // 1. Marcar cinza a partir das raízes ainda candidatas.
    for (size_t i = 0; i < raizes.tamanho; i++) {
        ArcCabecalho* c = raizes.itens[i];
        if (cor(c) == COR_ROXO && c->rc > 0) {
            marcar_cinza(c, &pilha);
        } else {
            desmarcar(c, MARCA_BUFERIZADO);
            if (tem(c, MARCA_DESTRUIDO)) desalocar(c);
            raizes.itens[i] = NULL;
        }
    }
    // 2. Varrer.
    for (size_t i = 0; i < raizes.tamanho; i++) {
        if (raizes.itens[i]) varrer(raizes.itens[i], &pilha, &pilha_preta);
    }
    // 3. Coletar o lixo.
    for (size_t i = 0; i < raizes.tamanho; i++) {
        ArcCabecalho* c = raizes.itens[i];
        if (!c) continue;
        desmarcar(c, MARCA_BUFERIZADO);
        coletar_branco(c, &pilha, &lixo);
    }
    for (size_t i = 0; i < lixo.tamanho; i++) visitar_filhos(lixo.itens[i], acao_restaurar, &pilha);
    for (size_t i = 0; i < lixo.tamanho; i++) {
        zerar_fracos(lixo.itens[i]);
        lixo.itens[i]->rc = DELEGUA_ARC_RC_IMORTAL;
        pintar(lixo.itens[i], COR_PRETO);
    }
    for (size_t i = 0; i < lixo.tamanho; i++) {
        ArcCabecalho* c = lixo.itens[i];
        if (c->tipo && c->tipo->destrutor) c->tipo->destrutor(payload_de(c));
    }
    for (size_t i = 0; i < lixo.tamanho; i++) desalocar(lixo.itens[i]);
    arc_ciclos_coletados += (int64_t)lixo.tamanho;

    lista_liberar(&raizes);
    lista_liberar(&pilha);
    lista_liberar(&pilha_preta);
    lista_liberar(&lixo);
    arc_coletando = 0;
}

// ─── Depuração ───────────────────────────────────────────────────────────────

static void relatorio_depuracao(void) {
    const char* modo = getenv("DELEGUA_ARC_DEPURACAO");
    // Ciclos ainda não coletados contam como vazamento só se sobreviverem a uma coleta final.
    delegua_arc_coletar_ciclos();
    fprintf(stderr,
            "[DELEGUA ARC] alocacoes=%lld liberacoes=%lld vivas=%lld ciclos=%lld\n",
            (long long)arc_total_alocacoes,
            (long long)arc_total_liberacoes,
            (long long)arc_alocacoes_vivas,
            (long long)arc_ciclos_coletados);
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

// ─── Primitivas ──────────────────────────────────────────────────────────────

void* delegua_arc_alocar(size_t tamanho, const ArcDescritor* descritor) {
    // Ponto seguro para a coleta: nenhum destrutor em andamento.
    if (arc_coleta_pendente) delegua_arc_coletar_ciclos();
    ArcCabecalho* c = (ArcCabecalho*)calloc(1, sizeof(ArcCabecalho) + tamanho);
    if (!c) sem_memoria(tamanho);
    c->rc = 1;
    c->magia = (uint32_t)MAGIA_BASE << 8;
    c->tipo = descritor;
    arc_alocacoes_vivas++;
    arc_total_alocacoes++;
    return payload_de(c);
}

void* delegua_arc_realocar(void* p, size_t novo_tamanho) {
    if (!p) return delegua_arc_alocar(novo_tamanho, NULL);
    ArcCabecalho* c = cabecalho_valido(p);
    if (!c || c->rc != 1 || tem(c, MARCA_BUFERIZADO)) {
        // Não gerenciado, imortal, compartilhado ou no buffer de raízes: realocar moveria
        // memória que outro dono (ou o coletor) ainda referencia.
        fprintf(stderr, "[DELEGUA ERRO] delegua_arc_realocar: ponteiro nao gerenciado ou compartilhado.\n");
        fflush(stderr);
        abort();
    }
    ArcCabecalho* novo = (ArcCabecalho*)realloc(c, sizeof(ArcCabecalho) + novo_tamanho);
    if (!novo) sem_memoria(novo_tamanho);
    return payload_de(novo);
}

void delegua_arc_reter(void* p) {
    ArcCabecalho* c = cabecalho_valido(p);
    if (!c || c->rc < 0) return;
    c->rc++;
    pintar(c, COR_PRETO);
}

void delegua_arc_liberar(void* p) {
    ArcCabecalho* c = cabecalho_valido(p);
    if (!c || c->rc < 0) return;
    if (c->rc <= 0) {
        fprintf(stderr, "[DELEGUA ERRO] delegua_arc_liberar: liberacao dupla (rc=%d).\n", c->rc);
        fflush(stderr);
        abort();
    }
    if (--c->rc > 0) {
        if (pode_ter_ciclo(c)) possivel_raiz(c);
        return;
    }

    zerar_fracos(c);
    if (c->tipo && c->tipo->destrutor) c->tipo->destrutor(p);
    pintar(c, COR_PRETO);
    if (tem(c, MARCA_BUFERIZADO)) {
        // Ainda referenciado pelo buffer de raízes: a coleta desaloca a memória.
        marcar(c, MARCA_DESTRUIDO);
        return;
    }
    desalocar(c);
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
