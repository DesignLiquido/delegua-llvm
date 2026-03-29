#include <stdio.h>
#include <stdlib.h>

#define N 500000

int main() {
    int* crivo = (int*)malloc((N + 1) * sizeof(int));
    for (int i = 0; i <= N; i++) crivo[i] = 1;
    crivo[0] = 0;
    crivo[1] = 0;

    for (int i = 2; i * i <= N; i++) {
        if (crivo[i]) {
            for (int j = i * i; j <= N; j += i) {
                crivo[j] = 0;
            }
        }
    }

    int contagem = 0;
    for (int i = 2; i <= N; i++) {
        contagem += crivo[i];
    }

    printf("%d\n", contagem);
    free(crivo);
    return 0;
}
