#include <stdio.h>

int somaDigitos(int n) {
    int soma = 0;
    while (n > 0) {
        soma += n % 10;
        n /= 10;
    }
    return soma;
}

int main() {
    int total = 0;
    for (int i = 1; i <= 10000000; i++) {
        total += somaDigitos(i);
    }
    printf("%d\n", total);
    return 0;
}
