#include <stdbool.h>
#include <stdint.h>
#include <string.h>

/* Mesma estrutura declarada em sondagem.delegua: tamanhos e alinhamentos mistos. */
typedef struct {
    uint8_t marca;
    int64_t valor;
    bool ativo;
    double fator;
    const char* nome;
    uint8_t id[3];
    int32_t contagem;
} Registro;

int sondagem_tamanho_registro(void) { return (int)sizeof(Registro); }

int64_t sondagem_somar(Registro* r) {
    return r->valor + r->marca + r->contagem + (int64_t)strlen(r->nome) + (r->ativo ? 1 : 0) + (int64_t)(r->fator * 10);
}

int sondagem_aplicar(int (*operacao)(int), int valor) { return operacao(valor); }
