#pragma once
#include "vetor.h"

double delegua_est_max(Vetor* vetor);
double delegua_est_min(Vetor* vetor);
double delegua_est_media(Vetor* vetor);
double delegua_est_mediana(Vetor* vetor);
double delegua_est_variancia(Vetor* vetor);
double delegua_est_covariancia(Vetor* v1, Vetor* v2);
// moda: retorna vetor de modas — adiado (Fase A.3+)
// Vetor* delegua_est_moda(Vetor* entrada);
