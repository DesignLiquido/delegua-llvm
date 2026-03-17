#include "estatistica.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>

static double* elementos_double(Vetor* v) {
    return (double*)v->elementos;
}

double delegua_est_max(Vetor* vetor) {
    if (!vetor || vetor->tamanho == 0) return 0.0;
    double* elem = elementos_double(vetor);
    double maior = elem[0];
    for (int i = 1; i < vetor->tamanho; i++) {
        if (elem[i] > maior) maior = elem[i];
    }
    return maior;
}

double delegua_est_min(Vetor* vetor) {
    if (!vetor || vetor->tamanho == 0) return 0.0;
    double* elem = elementos_double(vetor);
    double menor = elem[0];
    for (int i = 1; i < vetor->tamanho; i++) {
        if (elem[i] < menor) menor = elem[i];
    }
    return menor;
}

double delegua_est_media(Vetor* vetor) {
    if (!vetor || vetor->tamanho == 0) return 0.0;
    double* elem = elementos_double(vetor);
    double soma = 0.0;
    for (int i = 0; i < vetor->tamanho; i++) {
        soma += elem[i];
    }
    return soma / (double)vetor->tamanho;
}

static int comparar_double(const void* a, const void* b) {
    double da = *(const double*)a;
    double db = *(const double*)b;
    return (da > db) - (da < db);
}

double delegua_est_mediana(Vetor* vetor) {
    if (!vetor || vetor->tamanho == 0) return 0.0;
    int n = vetor->tamanho;
    double* copia = (double*)malloc(n * sizeof(double));
    if (!copia) return 0.0;
    memcpy(copia, vetor->elementos, n * sizeof(double));
    qsort(copia, n, sizeof(double), comparar_double);
    double resultado;
    int meio = n / 2;
    if (n % 2 == 1) {
        resultado = copia[meio];
    } else {
        resultado = (copia[meio - 1] + copia[meio]) / 2.0;
    }
    free(copia);
    return resultado;
}

double delegua_est_variancia(Vetor* vetor) {
    if (!vetor || vetor->tamanho < 2) return 0.0;
    double media = delegua_est_media(vetor);
    double* elem = elementos_double(vetor);
    double soma_desvios = 0.0;
    for (int i = 0; i < vetor->tamanho; i++) {
        double desvio = elem[i] - media;
        soma_desvios += desvio * desvio;
    }
    return soma_desvios / (double)(vetor->tamanho - 1);
}

double delegua_est_covariancia(Vetor* v1, Vetor* v2) {
    if (!v1 || !v2 || v1->tamanho < 2 || v1->tamanho != v2->tamanho) return 0.0;
    double media1 = delegua_est_media(v1);
    double media2 = delegua_est_media(v2);
    double* elem1 = elementos_double(v1);
    double* elem2 = elementos_double(v2);
    double soma = 0.0;
    for (int i = 0; i < v1->tamanho; i++) {
        soma += (elem1[i] - media1) * (elem2[i] - media2);
    }
    return soma / (double)(v1->tamanho - 1);
}
