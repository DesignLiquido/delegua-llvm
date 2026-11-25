#include "rede.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
    #include <winsock2.h>
    #include <ws2tcpip.h>
    typedef SOCKET soquete_t;
    #define SOQUETE_INVALIDO INVALID_SOCKET
    #define fechar_soquete closesocket
    #define FLAGS_ENVIO 0
#else
    #include <errno.h>
    #include <fcntl.h>
    #include <netdb.h>
    #include <poll.h>
    #include <sys/socket.h>
    #include <sys/types.h>
    #include <time.h>
    #include <unistd.h>
    #include <netinet/in.h>
    typedef int soquete_t;
    #define SOQUETE_INVALIDO (-1)
    #define fechar_soquete close
    // Escrever em conexão fechada não deve encerrar o programa com SIGPIPE.
    #ifdef MSG_NOSIGNAL
        #define FLAGS_ENVIO MSG_NOSIGNAL
    #else
        #define FLAGS_ENVIO 0
    #endif
#endif

struct SoqueteDelegua {
    soquete_t descritor;
    // Bytes já recebidos e ainda não entregues (ex.: o corpo que chegou junto com os
    // cabeçalhos HTTP lidos por lerAte). A próxima leitura começa por eles.
    char* restante;
    int tamanhoRestante;
};

static char ultimo_erro[256] = "";

static void definir_erro(const char* mensagem) {
    snprintf(ultimo_erro, sizeof(ultimo_erro), "%s", mensagem);
}

static void definir_erro_sistema(const char* contexto) {
#ifdef _WIN32
    snprintf(ultimo_erro, sizeof(ultimo_erro), "%s (erro %d)", contexto, WSAGetLastError());
#else
    snprintf(ultimo_erro, sizeof(ultimo_erro), "%s: %s", contexto, strerror(errno));
#endif
}

char* delegua_rede_ultimo_erro(void) {
    return strdup(ultimo_erro);
}

static int inicializar(void) {
#ifdef _WIN32
    static int inicializado = 0;
    if (!inicializado) {
        WSADATA dados;
        if (WSAStartup(MAKEWORD(2, 2), &dados) != 0) {
            definir_erro("falha ao inicializar Winsock");
            return 0;
        }
        inicializado = 1;
    }
#endif
    return 1;
}

static SoqueteDelegua* embrulhar(soquete_t descritor) {
    SoqueteDelegua* soquete = (SoqueteDelegua*)malloc(sizeof(SoqueteDelegua));
    if (!soquete) {
        fechar_soquete(descritor);
        definir_erro("sem memória");
        return NULL;
    }
    soquete->descritor = descritor;
    soquete->restante = NULL;
    soquete->tamanhoRestante = 0;
#if defined(__APPLE__) && defined(SO_NOSIGPIPE)
    int um = 1;
    setsockopt(descritor, SOL_SOCKET, SO_NOSIGPIPE, &um, sizeof(um));
#endif
    return soquete;
}

// Espera o soquete ficar pronto para leitura (escrita = 0) ou escrita (escrita = 1).
// 1: pronto; 0: tempo esgotado; -1: erro.
static int esperar(soquete_t descritor, int escrita, int tempoLimiteMs) {
#ifdef _WIN32
    fd_set conjunto, erros;
    FD_ZERO(&conjunto);
    FD_ZERO(&erros);
    FD_SET(descritor, &conjunto);
    FD_SET(descritor, &erros);
    struct timeval limite;
    limite.tv_sec = tempoLimiteMs / 1000;
    limite.tv_usec = (tempoLimiteMs % 1000) * 1000;
    // Uma conexão recusada aparece no conjunto de erros (exceptfds) no Winsock.
    int resultado = select(0, escrita ? NULL : &conjunto, escrita ? &conjunto : NULL, &erros,
                           tempoLimiteMs < 0 ? NULL : &limite);
    if (resultado < 0) return -1;
    if (resultado == 0) return 0;
    return FD_ISSET(descritor, &conjunto) ? 1 : -1;
#else
    struct pollfd item;
    item.fd = descritor;
    item.events = escrita ? POLLOUT : POLLIN;
    item.revents = 0;
    int resultado;
    do {
        resultado = poll(&item, 1, tempoLimiteMs < 0 ? -1 : tempoLimiteMs);
    } while (resultado < 0 && errno == EINTR);
    if (resultado < 0) return -1;
    if (resultado == 0) return 0;
    // POLLHUP/POLLERR na leitura: recv informa o fim/erro.
    return 1;
#endif
}

static int definir_nao_bloqueante(soquete_t descritor, int naoBloqueante) {
#ifdef _WIN32
    u_long modo = naoBloqueante ? 1 : 0;
    return ioctlsocket(descritor, FIONBIO, &modo) == 0;
#else
    int flags = fcntl(descritor, F_GETFL, 0);
    if (flags < 0) return 0;
    flags = naoBloqueante ? (flags | O_NONBLOCK) : (flags & ~O_NONBLOCK);
    return fcntl(descritor, F_SETFL, flags) == 0;
#endif
}

static struct addrinfo* resolver(const char* host, int porta, int passivo) {
    char textoPorta[16];
    snprintf(textoPorta, sizeof(textoPorta), "%d", porta);
    struct addrinfo dicas;
    memset(&dicas, 0, sizeof(dicas));
    dicas.ai_family = AF_UNSPEC;
    dicas.ai_socktype = SOCK_STREAM;
    dicas.ai_protocol = IPPROTO_TCP;
    if (passivo) dicas.ai_flags = AI_PASSIVE;
    struct addrinfo* resultado = NULL;
    int erro = getaddrinfo((host && *host) ? host : NULL, textoPorta, &dicas, &resultado);
    if (erro != 0) {
        snprintf(ultimo_erro, sizeof(ultimo_erro), "endereço inválido '%s': %s", host ? host : "",
                 gai_strerror(erro));
        return NULL;
    }
    return resultado;
}

SoqueteDelegua* delegua_rede_escutar(char* endereco, int porta) {
    if (!inicializar()) return NULL;
    if (porta < 0 || porta > 65535) {
        definir_erro("porta inválida");
        return NULL;
    }
    struct addrinfo* enderecos = resolver(endereco, porta, 1);
    if (!enderecos) return NULL;

    soquete_t descritor = SOQUETE_INVALIDO;
    for (struct addrinfo* atual = enderecos; atual; atual = atual->ai_next) {
        descritor = socket(atual->ai_family, atual->ai_socktype, atual->ai_protocol);
        if (descritor == SOQUETE_INVALIDO) continue;
#ifndef _WIN32
        // No Windows, SO_REUSEADDR permitiria outro processo ocupar a mesma porta.
        int um = 1;
        setsockopt(descritor, SOL_SOCKET, SO_REUSEADDR, &um, sizeof(um));
#endif
        if (bind(descritor, atual->ai_addr, (int)atual->ai_addrlen) == 0 && listen(descritor, 16) == 0) break;
        definir_erro_sistema("falha ao escutar");
        fechar_soquete(descritor);
        descritor = SOQUETE_INVALIDO;
    }
    freeaddrinfo(enderecos);
    if (descritor == SOQUETE_INVALIDO) return NULL;
    return embrulhar(descritor);
}

int delegua_rede_porta_local(SoqueteDelegua* soquete) {
    if (!soquete) return -1;
    struct sockaddr_storage endereco;
    socklen_t tamanho = sizeof(endereco);
    if (getsockname(soquete->descritor, (struct sockaddr*)&endereco, &tamanho) != 0) {
        definir_erro_sistema("falha ao obter a porta");
        return -1;
    }
    if (endereco.ss_family == AF_INET) return ntohs(((struct sockaddr_in*)&endereco)->sin_port);
    if (endereco.ss_family == AF_INET6) return ntohs(((struct sockaddr_in6*)&endereco)->sin6_port);
    return -1;
}

SoqueteDelegua* delegua_rede_aceitar(SoqueteDelegua* servidor, int tempoLimiteMs) {
    if (!servidor) {
        definir_erro("soquete inválido");
        return NULL;
    }
    int pronto = esperar(servidor->descritor, 0, tempoLimiteMs);
    if (pronto == 0) {
        definir_erro("tempo esgotado");
        return NULL;
    }
    if (pronto < 0) {
        definir_erro_sistema("falha ao aguardar conexão");
        return NULL;
    }
    soquete_t descritor = accept(servidor->descritor, NULL, NULL);
    if (descritor == SOQUETE_INVALIDO) {
        definir_erro_sistema("falha ao aceitar conexão");
        return NULL;
    }
    return embrulhar(descritor);
}

static int conexao_com_erro(soquete_t descritor) {
    int erro = 0;
    socklen_t tamanho = sizeof(erro);
    if (getsockopt(descritor, SOL_SOCKET, SO_ERROR, (char*)&erro, &tamanho) != 0) return 1;
    return erro != 0;
}

SoqueteDelegua* delegua_rede_conectar(char* host, int porta, int tempoLimiteMs) {
    if (!inicializar()) return NULL;
    if (!host || !*host || porta <= 0 || porta > 65535) {
        definir_erro("host ou porta inválidos");
        return NULL;
    }
    struct addrinfo* enderecos = resolver(host, porta, 0);
    if (!enderecos) return NULL;

    soquete_t descritor = SOQUETE_INVALIDO;
    for (struct addrinfo* atual = enderecos; atual; atual = atual->ai_next) {
        descritor = socket(atual->ai_family, atual->ai_socktype, atual->ai_protocol);
        if (descritor == SOQUETE_INVALIDO) continue;
        // Conexão não bloqueante + espera, para respeitar o tempo limite.
        definir_nao_bloqueante(descritor, 1);
        int resultado = connect(descritor, atual->ai_addr, (int)atual->ai_addrlen);
        int conectado = resultado == 0;
        if (!conectado) {
#ifdef _WIN32
            int emAndamento = WSAGetLastError() == WSAEWOULDBLOCK;
#else
            int emAndamento = errno == EINPROGRESS;
#endif
            if (emAndamento) {
                int pronto = esperar(descritor, 1, tempoLimiteMs);
                if (pronto == 0) definir_erro("tempo esgotado");
                conectado = pronto == 1 && !conexao_com_erro(descritor);
                if (pronto != 0 && !conectado) definir_erro("conexão recusada ou inalcançável");
            } else {
                definir_erro_sistema("falha ao conectar");
            }
        }
        if (conectado) {
            definir_nao_bloqueante(descritor, 0);
            break;
        }
        fechar_soquete(descritor);
        descritor = SOQUETE_INVALIDO;
    }
    freeaddrinfo(enderecos);
    if (descritor == SOQUETE_INVALIDO) return NULL;
    return embrulhar(descritor);
}

// Move até `quantidade` bytes do início de `restante` para `destino`. Retorna quantos moveu.
static int retirar_restante(SoqueteDelegua* conexao, char* destino, int quantidade) {
    int movidos = conexao->tamanhoRestante < quantidade ? conexao->tamanhoRestante : quantidade;
    if (movidos <= 0) return 0;
    memcpy(destino, conexao->restante, (size_t)movidos);
    conexao->tamanhoRestante -= movidos;
    if (conexao->tamanhoRestante > 0) {
        memmove(conexao->restante, conexao->restante + movidos, (size_t)conexao->tamanhoRestante);
    } else {
        free(conexao->restante);
        conexao->restante = NULL;
    }
    return movidos;
}

// Guarda `quantidade` bytes no início de `restante` (antes dos que já estiverem lá).
static int devolver_restante(SoqueteDelegua* conexao, const char* origem, int quantidade) {
    if (quantidade <= 0) return 1;
    char* novo = (char*)malloc((size_t)(quantidade + conexao->tamanhoRestante));
    if (!novo) return 0;
    memcpy(novo, origem, (size_t)quantidade);
    if (conexao->tamanhoRestante > 0) memcpy(novo + quantidade, conexao->restante, (size_t)conexao->tamanhoRestante);
    free(conexao->restante);
    conexao->restante = novo;
    conexao->tamanhoRestante += quantidade;
    return 1;
}

// Posição de `agulha` nos primeiros `tamanho` bytes de `palheiro`, ou -1.
static int procurar(const char* palheiro, int tamanho, const char* agulha) {
    int tamanhoAgulha = (int)strlen(agulha);
    for (int i = 0; i + tamanhoAgulha <= tamanho; i++) {
        if (memcmp(palheiro + i, agulha, (size_t)tamanhoAgulha) == 0) return i;
    }
    return -1;
}

char* delegua_rede_ler(SoqueteDelegua* conexao, int maxBytes, int tempoLimiteMs) {
    if (!conexao || maxBytes <= 0) {
        definir_erro("argumentos inválidos");
        return NULL;
    }
    // Bytes guardados por um lerAte anterior: entregues sem esperar pela rede.
    if (conexao->tamanhoRestante > 0) {
        char* guardados = (char*)malloc((size_t)maxBytes + 1);
        if (!guardados) {
            definir_erro("sem memória");
            return NULL;
        }
        int movidos = retirar_restante(conexao, guardados, maxBytes);
        guardados[movidos] = '\0';
        return guardados;
    }
    int pronto = esperar(conexao->descritor, 0, tempoLimiteMs);
    if (pronto == 0) {
        definir_erro("tempo esgotado");
        return NULL;
    }
    if (pronto < 0) {
        definir_erro_sistema("falha ao aguardar dados");
        return NULL;
    }
    char* buffer = (char*)malloc((size_t)maxBytes + 1);
    if (!buffer) {
        definir_erro("sem memória");
        return NULL;
    }
    int lidos = (int)recv(conexao->descritor, buffer, maxBytes, 0);
    if (lidos < 0) {
        definir_erro_sistema("falha ao ler");
        free(buffer);
        return NULL;
    }
    buffer[lidos] = '\0';
    return buffer;
}

// Relógio monotônico em milissegundos (definido em tempo.c, mas repetido aqui para que
// o módulo rede não dependa do módulo tempo).
static long long agora_ms(void) {
#ifdef _WIN32
    return (long long)GetTickCount64();
#else
    struct timespec instante;
    clock_gettime(CLOCK_MONOTONIC, &instante);
    return (long long)instante.tv_sec * 1000 + instante.tv_nsec / 1000000;
#endif
}

char* delegua_rede_ler_ate(SoqueteDelegua* conexao, char* delimitador, int maxBytes, int tempoLimiteMs) {
    if (!conexao || maxBytes <= 0) {
        definir_erro("argumentos inválidos");
        return NULL;
    }
    const char* fim = (delimitador && *delimitador) ? delimitador : NULL;
    char* buffer = (char*)malloc((size_t)maxBytes + 1);
    if (!buffer) {
        definir_erro("sem memória");
        return NULL;
    }
    // Começa pelos bytes guardados de leituras anteriores.
    int total = retirar_restante(conexao, buffer, maxBytes);
    buffer[total] = '\0';
    long long limite = tempoLimiteMs < 0 ? -1 : agora_ms() + tempoLimiteMs;

    while (total < maxBytes) {
        if (fim) {
            int posicao = procurar(buffer, total, fim);
            if (posicao >= 0) {
                // Entrega até o delimitador (inclusive); o que veio depois fica para a
                // próxima leitura.
                int entregues = posicao + (int)strlen(fim);
                if (!devolver_restante(conexao, buffer + entregues, total - entregues)) {
                    definir_erro("sem memória");
                    free(buffer);
                    return NULL;
                }
                buffer[entregues] = '\0';
                return buffer;
            }
        }
        int restante = -1;
        if (limite >= 0) {
            long long faltam = limite - agora_ms();
            if (faltam <= 0) {
                definir_erro("tempo esgotado");
                free(buffer);
                return NULL;
            }
            restante = (int)faltam;
        }
        int pronto = esperar(conexao->descritor, 0, restante);
        if (pronto == 0) {
            definir_erro("tempo esgotado");
            free(buffer);
            return NULL;
        }
        if (pronto < 0) {
            definir_erro_sistema("falha ao aguardar dados");
            free(buffer);
            return NULL;
        }
        int lidos = (int)recv(conexao->descritor, buffer + total, maxBytes - total, 0);
        if (lidos < 0) {
            definir_erro_sistema("falha ao ler");
            free(buffer);
            return NULL;
        }
        if (lidos == 0) break;  // conexão fechada
        total += lidos;
        buffer[total] = '\0';
    }
    return buffer;
}

int delegua_rede_escrever(SoqueteDelegua* conexao, char* texto) {
    if (!conexao || !texto) {
        definir_erro("argumentos inválidos");
        return 0;
    }
    size_t tamanho = strlen(texto);
    size_t enviados = 0;
    while (enviados < tamanho) {
        int resultado = (int)send(conexao->descritor, texto + enviados, (int)(tamanho - enviados), FLAGS_ENVIO);
        if (resultado < 0) {
#ifndef _WIN32
            if (errno == EINTR) continue;
#endif
            definir_erro_sistema("falha ao escrever");
            return 0;
        }
        enviados += (size_t)resultado;
    }
    return 1;
}

void delegua_rede_fechar(SoqueteDelegua* soquete) {
    if (!soquete) return;
    fechar_soquete(soquete->descritor);
    free(soquete->restante);
    free(soquete);
}

// ── URL ─────────────────────────────────────────────────────────────────────

char* delegua_rede_codificar_componente_url(char* texto) {
    if (!texto) return NULL;
    static const char* hexadecimal = "0123456789ABCDEF";
    size_t tamanho = strlen(texto);
    char* resultado = (char*)malloc(tamanho * 3 + 1);
    if (!resultado) return NULL;
    size_t j = 0;
    for (size_t i = 0; i < tamanho; i++) {
        unsigned char c = (unsigned char)texto[i];
        if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_' ||
            c == '.' || c == '~') {
            resultado[j++] = (char)c;
        } else {
            resultado[j++] = '%';
            resultado[j++] = hexadecimal[c >> 4];
            resultado[j++] = hexadecimal[c & 15];
        }
    }
    resultado[j] = '\0';
    return resultado;
}

static int valor_hexadecimal(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

char* delegua_rede_decodificar_componente_url(char* texto) {
    if (!texto) return NULL;
    size_t tamanho = strlen(texto);
    char* resultado = (char*)malloc(tamanho + 1);
    if (!resultado) return NULL;
    size_t j = 0;
    for (size_t i = 0; i < tamanho; i++) {
        if (texto[i] == '%' && i + 2 < tamanho) {
            int alto = valor_hexadecimal(texto[i + 1]);
            int baixo = valor_hexadecimal(texto[i + 2]);
            if (alto >= 0 && baixo >= 0) {
                resultado[j++] = (char)(alto * 16 + baixo);
                i += 2;
                continue;
            }
        }
        resultado[j++] = texto[i] == '+' ? ' ' : texto[i];
    }
    resultado[j] = '\0';
    return resultado;
}
