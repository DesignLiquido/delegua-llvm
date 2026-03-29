#include <stdio.h>

int ehPrimo(int n) {
    if (n <= 1) return 0;
    if (n <= 3) return 1;
    if (n % 2 == 0) return 0;
    for (int i = 3; i * i <= n; i += 2) {
        if (n % i == 0) return 0;
    }
    return 1;
}

int main() {
    int contagem = 0;
    for (int j = 2; j < 1000000; j++) {
        contagem += ehPrimo(j);
    }
    printf("%d\n", contagem);
    return 0;
}
