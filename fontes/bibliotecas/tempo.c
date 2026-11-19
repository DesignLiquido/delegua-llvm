#include "tempo.h"

#ifdef _WIN32
    #include <windows.h>
#else
    #include <errno.h>
    #include <time.h>
#endif

int64_t delegua_tempo_carimbo_unix_milissegundos(void) {
#ifdef _WIN32
    FILETIME arquivo;
    GetSystemTimeAsFileTime(&arquivo);
    // FILETIME: intervalos de 100 ns desde 1601-01-01.
    int64_t intervalos = ((int64_t)arquivo.dwHighDateTime << 32) | arquivo.dwLowDateTime;
    return (intervalos - 116444736000000000LL) / 10000;
#else
    struct timespec instante;
    clock_gettime(CLOCK_REALTIME, &instante);
    return (int64_t)instante.tv_sec * 1000 + instante.tv_nsec / 1000000;
#endif
}

int64_t delegua_tempo_carimbo_unix(void) {
    return delegua_tempo_carimbo_unix_milissegundos() / 1000;
}

int64_t delegua_tempo_monotonico_milissegundos(void) {
#ifdef _WIN32
    return (int64_t)GetTickCount64();
#else
    struct timespec instante;
    clock_gettime(CLOCK_MONOTONIC, &instante);
    return (int64_t)instante.tv_sec * 1000 + instante.tv_nsec / 1000000;
#endif
}

void delegua_tempo_dormir(int milissegundos) {
    if (milissegundos <= 0) return;
#ifdef _WIN32
    Sleep((DWORD)milissegundos);
#else
    struct timespec pedido = {milissegundos / 1000, (long)(milissegundos % 1000) * 1000000L};
    struct timespec restante;
    while (nanosleep(&pedido, &restante) != 0 && errno == EINTR) {
        pedido = restante;
    }
#endif
}
