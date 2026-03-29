#include <stdio.h>

typedef struct { int x; int y; } Ponto;

int distanciaManhattan(Ponto* p) {
    int dx = p->x < 0 ? -p->x : p->x;
    int dy = p->y < 0 ? -p->y : p->y;
    return dx + dy;
}

int main() {
    int total = 0;
    for (int i = 0; i < 1000000; i++) {
        Ponto p = { .x = (i * 7 + 3) % 1000 - 500, .y = (i * 13 + 7) % 1000 - 500 };
        total += distanciaManhattan(&p);
    }
    printf("%d\n", total);
    return 0;
}
