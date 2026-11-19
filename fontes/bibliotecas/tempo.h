#pragma once
#include <stdint.h>

// Segundos desde 1970-01-01T00:00:00Z (mesmo nome e significado do delegua-tempo em Node.js).
int64_t delegua_tempo_carimbo_unix(void);
// Milissegundos desde 1970-01-01T00:00:00Z.
int64_t delegua_tempo_carimbo_unix_milissegundos(void);
// Relógio monotônico em milissegundos (para medir intervalos e tempos limite; não volta no tempo).
int64_t delegua_tempo_monotonico_milissegundos(void);
// Suspende a execução por `milissegundos`.
void    delegua_tempo_dormir(int milissegundos);
