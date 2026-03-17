#include "fisica.h"

// Cinemática

double delegua_fis_velocidade_media(double intervalo_deslocamento, double intervalo_tempo) {
    return intervalo_deslocamento / intervalo_tempo;
}

double delegua_fis_delta_s(double s0, double s) {
    return s - s0;
}

double delegua_fis_delta_t(double t0, double t) {
    return t - t0;
}

double delegua_fis_aceleracao(double velocidade_final, double velocidade_inicial, double tempo_final, double tempo_inicial) {
    return (velocidade_final - velocidade_inicial) / (tempo_final - tempo_inicial);
}
