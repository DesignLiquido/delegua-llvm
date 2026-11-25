#pragma once
#include <stddef.h>
#include <stdint.h>

/*
 * ARC (contagem automática de referências) do runtime Delégua.
 *
 * Toda alocação gerenciada tem um cabeçalho de 16 bytes imediatamente ANTES do payload:
 *
 *     [ rc | magia | descritor ][ payload ... ]
 *                               ^ ponteiro visto por Delégua e pelo código C
 *
 * Assim um `texto` gerenciado continua sendo um `char*` terminado em '\0' (printf, strlen,
 * FFI funcionam sem conversão) e reter/liberar custam O(1), sem tabela auxiliar.
 *
 * - rc >= 1: vivo; rc < 0 (DELEGUA_ARC_RC_IMORTAL): estático, nunca é liberado.
 * - magia: identifica ponteiros gerenciados. reter/liberar ignoram ponteiros sem ela
 *   (literais ainda sem cabeçalho, memória de FFI, `malloc` puro), o que permite migrar o
 *   runtime e o compilador aos poucos sem corromper memória.
 * - descritor: nome e destrutor do tipo; NULL para buffers simples (texto, caixas).
 *
 * Convenção de propriedade do runtime C:
 * - funções que devolvem um ponteiro gerenciado devolvem +1 (o chamador é dono);
 * - coleções (Vetor, Dicionario) retêm o que guardam e liberam o que removem/sobrescrevem;
 * - parâmetros são emprestados (+0): quem guarda um parâmetro o retém.
 */

#define DELEGUA_ARC_MAGIA 0xA4C0DE1Au
#define DELEGUA_ARC_RC_IMORTAL (-1)

typedef struct ArcDescritor {
    const char* nome;
    // Libera os recursos internos do payload (NÃO o payload em si). Pode ser NULL.
    void (*destrutor)(void* payload);
    // Reservado para o coletor de ciclos (Fase 4): visita cada filho gerenciado.
    void (*visitar_filhos)(void* payload, void (*visitante)(void* filho, void* contexto), void* contexto);
} ArcDescritor;

typedef struct {
    int32_t rc;
    uint32_t magia;
    const ArcDescritor* tipo;
} ArcCabecalho;

// Literal de texto imortal com cabeçalho, para constantes devolvidas pelo runtime C:
//     DELEGUA_TEXTO_ESTATICO(texto_linux, "linux");
//     return DELEGUA_TEXTO(texto_linux);
#define DELEGUA_TEXTO_ESTATICO(nome, literal)                                                \
    static const struct {                                                                    \
        ArcCabecalho cabecalho;                                                              \
        char bytes[sizeof(literal)];                                                         \
    } nome = {{DELEGUA_ARC_RC_IMORTAL, DELEGUA_ARC_MAGIA, NULL}, literal}
#define DELEGUA_TEXTO(nome) ((char*)(nome).bytes)

// Aloca `tamanho` bytes zerados com rc = 1. Aborta o programa se faltar memória.
void* delegua_arc_alocar(size_t tamanho, const ArcDescritor* descritor);

// Realoca um buffer gerenciado sem descritor (ex.: texto em construção). `p` pode ser NULL.
// Só é válido enquanto o chamador é o único dono (rc == 1).
void* delegua_arc_realocar(void* p, size_t novo_tamanho);

void delegua_arc_reter(void* p);
void delegua_arc_liberar(void* p);

// *slot = novo, retendo `novo` antes de liberar o valor anterior (seguro com *slot == novo).
void delegua_arc_atribuir(void** slot, void* novo);

// 1 se `p` tem cabeçalho ARC válido (inclui imortais), 0 caso contrário.
int delegua_arc_eh_gerenciado(const void* p);

// Contagem de referências atual (-1 imortal; 0 se `p` não é gerenciado ou é NULL).
int32_t delegua_arc_contagem(const void* p);

// Textos gerenciados.
char* delegua_arc_texto_criar(size_t tamanho);                       // tamanho + 1 bytes zerados
char* delegua_arc_texto_copiar(const char* s);                       // NULL → NULL
char* delegua_arc_texto_copiar_trecho(const char* s, size_t tamanho); // copia exatamente `tamanho` bytes

// Caixa para escalares guardados como `qualquer` (dicionários, parâmetros).
void* delegua_arc_caixa(size_t tamanho);

// ─── Quadros de limpeza (Fase 3: exceções com setjmp/longjmp) ────────────────
//
// Cada função Delégua ativa com variáveis gerenciadas empilha um quadro com os endereços dos
// seus slots donos (o compilador o monta na pilha da função). Um `falhar` que atravessa a
// função via longjmp não executa os retornos dela: delegua_excecao_lancar libera os slots de
// todos os quadros acima do `tente` de destino antes de desviar.
// Layout esperado pelo compilador: { ptr anterior, i32 quantidade, [N x ptr] slots }.
typedef struct ArcQuadroLimpeza {
    struct ArcQuadroLimpeza* anterior;
    int32_t quantidade;
    void** slots[];
} ArcQuadroLimpeza;

void delegua_arc_quadro_empilhar(ArcQuadroLimpeza* quadro);
// Saída normal da função (antes do `ret`).
void delegua_arc_quadro_desempilhar(ArcQuadroLimpeza* quadro);
// Topo atual (guardado por cada `tente` ao instalar o tratador).
void* delegua_arc_quadro_topo(void);
// Libera os slots de todos os quadros acima de `marca` e a torna o topo.
void delegua_arc_desenrolar_ate(void* marca);

// O programa terminou normalmente (fim de `main`): só então o modo estrito de
// DELEGUA_ARC_DEPURACAO acusa vazamentos (exit por erro ou processo.sair não contam).
void delegua_arc_fim_normal(void);

// Depuração: contadores globais. Com DELEGUA_ARC_DEPURACAO definida no ambiente, o
// programa imprime o relatório ao terminar e sai com código 99 se houver alocações vivas
// (quando DELEGUA_ARC_DEPURACAO=estrito).
int64_t delegua_arc_alocacoes_vivas(void);
