#include <stdio.h>
#include <stdlib.h>

#define N 10000

int main() {
    int* lista = (int*)malloc(N * sizeof(int));
    for (int i = 0; i < N; i++) {
        lista[i] = N - i;
    }

    for (int i = 0; i < N - 1; i++) {
        for (int j = 0; j < N - 1 - i; j++) {
            if (lista[j] > lista[j + 1]) {
                int temp = lista[j];
                lista[j] = lista[j + 1];
                lista[j + 1] = temp;
            }
        }
    }

    printf("%d\n", lista[0]);
    free(lista);
    return 0;
}
