#pragma once

typedef struct {
    int   codigo_status;
    char* mensagem_status;
    char* dados;          // corpo da resposta (texto, alocado)
} RespostaHttp;

typedef struct {
    char*  url_base;
    long   tempo_maximo_ms;
    char** cabecalhos;
    int    num_cabecalhos;
} ClienteHttp;

// Cria um novo ClienteHttp*. tempo_ms ≤ 0 usa padrão 30 000 ms.
ClienteHttp*  delegua_http_novo_cliente  (char* url_base, int tempo_ms);

// Adiciona um cabeçalho HTTP ao cliente (ex. "Authorization: Bearer token").
void          delegua_http_add_cabecalho (ClienteHttp* cliente, char* cabecalho);

// Métodos HTTP — retornam RespostaHttp* (NULL em falha de rede).
RespostaHttp* delegua_http_get           (ClienteHttp* cliente, char* sufixo);
RespostaHttp* delegua_http_post          (ClienteHttp* cliente, char* sufixo, char* corpo);
RespostaHttp* delegua_http_put           (ClienteHttp* cliente, char* sufixo, char* corpo);
RespostaHttp* delegua_http_delete        (ClienteHttp* cliente, char* sufixo);
RespostaHttp* delegua_http_patch         (ClienteHttp* cliente, char* sufixo, char* corpo);

// Acessores sobre RespostaHttp*.
int           delegua_http_codigo_status  (RespostaHttp* resp);
char*         delegua_http_dados          (RespostaHttp* resp);
char*         delegua_http_mensagem       (RespostaHttp* resp);

// Libera memória.
void          delegua_http_liberar_resp   (RespostaHttp* resp);
void          delegua_http_liberar_cliente(ClienteHttp* cliente);
