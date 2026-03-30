#include <stdio.h>

#define N 300000

int valores[N];
int esquerda[N];
int direita[N];
int tamanho = 0;

void inserir(int val) {
    if (tamanho == 0) {
        valores[0] = val;
        esquerda[0] = -1;
        direita[0] = -1;
        tamanho = 1;
        return;
    }
    int atual = 0;
    while (1) {
        if (val < valores[atual]) {
            if (esquerda[atual] == -1) {
                esquerda[atual] = tamanho;
                valores[tamanho] = val;
                esquerda[tamanho] = -1;
                direita[tamanho] = -1;
                tamanho++;
                return;
            }
            atual = esquerda[atual];
        } else if (val > valores[atual]) {
            if (direita[atual] == -1) {
                direita[atual] = tamanho;
                valores[tamanho] = val;
                esquerda[tamanho] = -1;
                direita[tamanho] = -1;
                tamanho++;
                return;
            }
            atual = direita[atual];
        } else {
            return;
        }
    }
}

int buscar(int val) {
    int atual = 0;
    while (atual != -1) {
        if (val == valores[atual]) return 1;
        atual = val < valores[atual] ? esquerda[atual] : direita[atual];
    }
    return 0;
}

int main() {
    for (int i = 0; i < N; i++) {
        int val = (i * 7141 + 54773) % 1000000;
        if (val < 0) val = -val;
        inserir(val);
    }

    int encontrados = 0;
    for (int i = 0; i < N; i++) {
        encontrados += buscar(i);
    }

    printf("%d\n", encontrados);
    return 0;
}
