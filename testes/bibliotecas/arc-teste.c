// Teste do runtime ARC (Fase 1): cada bloco cria valores pelo runtime, solta as
// referências e confere que nenhuma alocação gerenciada ficou viva.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "arc.h"
#include "csv.h"
#include "dicionario.h"
#include "json.h"
#include "texto.h"
#include "vetor.h"

static int falhas = 0;

#define VERIFICAR(condicao)                                                       \
    do {                                                                          \
        if (!(condicao)) {                                                        \
            printf("FALHA linha %d: %s\n", __LINE__, #condicao);                  \
            falhas++;                                                             \
        }                                                                         \
    } while (0)

#define SEM_VAZAMENTO(antes) VERIFICAR(delegua_arc_alocacoes_vivas() == (antes))

static void testar_primitivas(void) {
    int64_t antes = delegua_arc_alocacoes_vivas();
    char* t = delegua_arc_texto_copiar("ola");
    VERIFICAR(delegua_arc_eh_gerenciado(t));
    VERIFICAR(delegua_arc_contagem(t) == 1);
    delegua_arc_reter(t);
    VERIFICAR(delegua_arc_contagem(t) == 2);
    delegua_arc_liberar(t);
    VERIFICAR(strcmp(t, "ola") == 0);
    delegua_arc_liberar(t);
    SEM_VAZAMENTO(antes);

    // atribuir: retém o novo antes de soltar o antigo (inclusive quando são o mesmo).
    void* slot = NULL;
    char* a = delegua_arc_texto_copiar("a");
    delegua_arc_atribuir(&slot, a);
    delegua_arc_liberar(a);
    delegua_arc_atribuir(&slot, slot);
    VERIFICAR(delegua_arc_contagem(slot) == 1);
    delegua_arc_atribuir(&slot, NULL);
    SEM_VAZAMENTO(antes);

    // Ponteiros sem cabeçalho e imortais são ignorados.
    char* bruto = (char*)malloc(32);
    strcpy(bruto, "sem cabecalho");
    VERIFICAR(!delegua_arc_eh_gerenciado(bruto));
    delegua_arc_reter(bruto);
    delegua_arc_liberar(bruto);
    free(bruto);
    DELEGUA_TEXTO_ESTATICO(imortal, "imortal");
    VERIFICAR(delegua_arc_contagem(DELEGUA_TEXTO(imortal)) == DELEGUA_ARC_RC_IMORTAL);
    delegua_arc_liberar(DELEGUA_TEXTO(imortal));
    VERIFICAR(strcmp(DELEGUA_TEXTO(imortal), "imortal") == 0);
    SEM_VAZAMENTO(antes);
}

static void testar_vetor(void) {
    int64_t antes = delegua_arc_alocacoes_vivas();
    Vetor* v = delegua_vetor_criar(0, (int)sizeof(char*), 1);
    for (int i = 0; i < 100; i++) {
        char* item = delegua_arc_texto_copiar("x");
        delegua_vetor_adicionar(v, &item, (int)sizeof(char*));
        delegua_arc_liberar(item);  // o vetor fica com a única referência
    }
    VERIFICAR(v->tamanho == 100);
    VERIFICAR(v->capacidade > 100 && v->capacidade < 256);
    // Sentinela: a posição logo após o último elemento existe e é nula.
    VERIFICAR(((void**)v->ptr)[v->tamanho] == NULL);
    delegua_vetor_remover_ultimo(v);
    // A posição liberada não guarda o ponteiro do texto já solto.
    VERIFICAR(((void**)v->ptr)[v->tamanho] == NULL);
    delegua_vetor_remover_primeiro(v, (int)sizeof(char*));
    VERIFICAR(delegua_arc_alocacoes_vivas() == antes + 1 + 98);

    Vetor* fatia = delegua_vetor_fatiar(v, 0, 10, (int)sizeof(char*));
    char* junto = delegua_vetor_juntar_texto(fatia, ",");
    VERIFICAR(strlen(junto) == 19);
    delegua_arc_liberar(junto);
    delegua_arc_liberar(v);
    // Os 10 textos seguem vivos pela fatia.
    VERIFICAR(strcmp(((char**)fatia->ptr)[9], "x") == 0);
    delegua_arc_liberar(fatia);
    SEM_VAZAMENTO(antes);

    // Vetor de escalares não toca nos elementos.
    Vetor* numeros = delegua_vetor_criar(3, (int)sizeof(double), 0);
    delegua_arc_liberar(numeros);
    SEM_VAZAMENTO(antes);
}

static void testar_texto(void) {
    int64_t antes = delegua_arc_alocacoes_vivas();
    Vetor* partes = delegua_texto_dividir("a,b,c", ",", 0);
    VERIFICAR(partes->tamanho == 3);
    char* maiusculo = delegua_texto_maiusculo(((char**)partes->ptr)[1]);
    VERIFICAR(strcmp(maiusculo, "B") == 0);
    delegua_arc_liberar(maiusculo);
    delegua_arc_liberar(partes);
    char* trocado = delegua_texto_substituir("aaa", "a", "bb");
    VERIFICAR(strcmp(trocado, "bbbbbb") == 0);
    delegua_arc_liberar(trocado);
    SEM_VAZAMENTO(antes);
}

static void testar_dicionario(void) {
    int64_t antes = delegua_arc_alocacoes_vivas();
    Dicionario* d = delegua_dicionario_criar();
    char* um = delegua_arc_texto_copiar("um");
    delegua_dicionario_definir(d, "k", um);
    VERIFICAR(delegua_arc_contagem(um) == 2);
    delegua_arc_liberar(um);
    // Sobrescrever solta o valor antigo; remover solta o atual.
    char* dois = delegua_arc_texto_copiar("dois");
    delegua_dicionario_definir(d, "k", dois);
    delegua_arc_liberar(dois);
    VERIFICAR(delegua_arc_alocacoes_vivas() == antes + 2);
    void* caixa = delegua_arc_caixa(sizeof(int));
    delegua_dicionario_definir(d, "n", caixa);
    delegua_arc_liberar(caixa);
    Vetor* chaves = delegua_dicionario_chaves(d);
    Vetor* valores = delegua_dicionario_valores(d);
    VERIFICAR(chaves->tamanho == 2 && valores->tamanho == 2);
    delegua_arc_liberar(chaves);
    delegua_arc_liberar(valores);
    delegua_dicionario_remover(d, "k");
    VERIFICAR(delegua_arc_alocacoes_vivas() == antes + 2);
    delegua_dicionario_liberar(d);
    SEM_VAZAMENTO(antes);
}

static void testar_json(void) {
    int64_t antes = delegua_arc_alocacoes_vivas();
    JsonRef* raiz = delegua_json_texto_para_objeto("{\"a\": {\"b\": 1}, \"c\": \"x\"}");
    JsonRef* a = delegua_json_obter_campo(raiz, "a");
    // A raiz pode ser solta: o filho a mantém viva.
    delegua_arc_liberar(raiz);
    JsonRef* b = delegua_json_obter_campo(a, "b");
    VERIFICAR(delegua_json_valor_numero(b) == 1.0);
    // Substituir "b" não invalida a referência ao valor antigo.
    JsonRef* novo = delegua_json_criar_numero(2);
    delegua_json_definir_campo(a, "b", novo);
    delegua_arc_liberar(novo);
    VERIFICAR(delegua_json_valor_numero(b) == 1.0);
    char* texto = delegua_json_objeto_para_texto(a);
    VERIFICAR(strcmp(texto, "{\"b\":2}") == 0);
    delegua_arc_liberar(texto);
    VERIFICAR(strcmp(delegua_json_tipo(b), "numero") == 0);
    delegua_arc_liberar(b);
    delegua_arc_liberar(a);
    SEM_VAZAMENTO(antes);

    // liberar manual: filhos passam a ver JSON inválido, sem uso de memória liberada.
    JsonRef* doc = delegua_json_texto_para_objeto("{\"c\": \"x\"}");
    JsonRef* c = delegua_json_obter_campo(doc, "c");
    delegua_json_liberar(doc);
    delegua_json_liberar(doc);
    VERIFICAR(delegua_json_valor_texto(c) == NULL);
    VERIFICAR(strcmp(delegua_json_tipo(c), "invalido") == 0);
    delegua_arc_liberar(c);
    delegua_arc_liberar(doc);
    SEM_VAZAMENTO(antes);
}

static void testar_csv(void) {
    int64_t antes = delegua_arc_alocacoes_vivas();
    TabelaCsv* t = delegua_csv_texto_para_tabela("a,b\n1,2\n", ',');
    char* celula = delegua_csv_obter_celula(t, 1, 1);
    delegua_csv_liberar(t);
    VERIFICAR(strcmp(celula, "2") == 0);
    delegua_arc_liberar(celula);
    delegua_arc_liberar(t);
    SEM_VAZAMENTO(antes);
}

int main(void) {
    testar_primitivas();
    testar_vetor();
    testar_texto();
    testar_dicionario();
    testar_json();
    testar_csv();
    printf("vivas=%lld falhas=%d\n", (long long)delegua_arc_alocacoes_vivas(), falhas);
    return falhas == 0 ? 0 : 1;
}
