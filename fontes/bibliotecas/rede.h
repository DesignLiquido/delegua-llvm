#pragma once

// Soquetes TCP (IPv4/IPv6) para servidores e clientes simples, com tempo limite.
// Os soquetes são ponteiros opacos; NULL indica falha (ver delegua_rede_ultimo_erro).
// tempoLimiteMs < 0: espera sem limite.

typedef struct SoqueteDelegua SoqueteDelegua;

// Escuta conexões em endereco:porta ("127.0.0.1", "::1", "0.0.0.0"...). Porta 0: o sistema escolhe.
SoqueteDelegua* delegua_rede_escutar(char* endereco, int porta);
// Porta local do soquete (útil após escutar na porta 0). -1 em caso de erro.
int             delegua_rede_porta_local(SoqueteDelegua* soquete);
// Espera uma conexão. NULL se o tempo esgotar ou houver erro.
SoqueteDelegua* delegua_rede_aceitar(SoqueteDelegua* servidor, int tempoLimiteMs);
// Conecta a host:porta. NULL se o tempo esgotar ou houver erro.
SoqueteDelegua* delegua_rede_conectar(char* host, int porta, int tempoLimiteMs);

// Lê até maxBytes bytes já disponíveis (espera por pelo menos um). "" quando a conexão
// foi fechada pelo outro lado; NULL se o tempo esgotar ou houver erro.
char*           delegua_rede_ler(SoqueteDelegua* conexao, int maxBytes, int tempoLimiteMs);
// Lê até encontrar `delimitador` (incluído no resultado), a conexão fechar ou maxBytes.
// O tempo limite vale para a leitura inteira. NULL se o tempo esgotar ou houver erro.
char*           delegua_rede_ler_ate(SoqueteDelegua* conexao, char* delimitador, int maxBytes, int tempoLimiteMs);
// Envia todo o texto. 1 em caso de sucesso.
int             delegua_rede_escrever(SoqueteDelegua* conexao, char* texto);
void            delegua_rede_fechar(SoqueteDelegua* soquete);

// Descrição do último erro de rede (ex.: "tempo esgotado").
char*           delegua_rede_ultimo_erro(void);

// Codificação percentual de componentes de URL (RFC 3986: mantém A-Z a-z 0-9 - _ . ~).
char*           delegua_rede_codificar_componente_url(char* texto);
// Decodifica %XX e '+' (como espaço, ao estilo de formulários/consultas).
char*           delegua_rede_decodificar_componente_url(char* texto);
