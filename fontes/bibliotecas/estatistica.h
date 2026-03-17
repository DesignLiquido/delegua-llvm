#pragma once

// Estrutura Vetor deve coincidir com %Vetor = type { ptr, i32 } do IR LLVM gerado.
typedef struct {
    void* elementos;
    int tamanho;
} Vetor;

double delegua_est_max(Vetor* vetor);
double delegua_est_min(Vetor* vetor);
double delegua_est_media(Vetor* vetor);
double delegua_est_mediana(Vetor* vetor);
double delegua_est_variancia(Vetor* vetor);
double delegua_est_covariancia(Vetor* v1, Vetor* v2);
// moda: retorna vetor de modas via out-param — adiado (Fase A.3+)
// void delegua_est_moda(Vetor* entrada, Vetor* saida);
