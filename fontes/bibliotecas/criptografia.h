#pragma once

// Sub-fase F.1a — cifras clássicas, sem dependências externas.
// Sub-fase F.1b — hashes, HMAC, aleatório, UUID, PBKDF2 (requer OpenSSL -lcrypto).

char* delegua_cript_cifrar_xor            (char* texto, char* chave);
char* delegua_cript_decifrar_xor          (char* hex,   char* chave);
char* delegua_cript_rot13                 (char* texto);
char* delegua_cript_rot_n                 (char* texto, int n);
char* delegua_cript_decifrar_rot_n        (char* texto, int n);
char* delegua_cript_base64_codificar      (char* texto);
char* delegua_cript_base64_decodificar    (char* b64);
char* delegua_cript_menino_do_acre_cif    (char* texto);
char* delegua_cript_menino_do_acre_dec    (char* texto);

// F.1b — requer OpenSSL (-lcrypto). Implementado em criptografia-hashes.c.
char* delegua_cript_md5                   (char* texto);
char* delegua_cript_sha1                  (char* texto);
char* delegua_cript_sha256                (char* texto);
char* delegua_cript_sha512                (char* texto);
char* delegua_cript_hmac_sha256           (char* texto, char* chave);
char* delegua_cript_hmac_sha512           (char* texto, char* chave);
char* delegua_cript_bytes_aleatorios      (int n);
char* delegua_cript_texto_aleatorio       (int n);
char* delegua_cript_uuid                  (void);
char* delegua_cript_pbkdf2                (char* senha, char* sal, int iter, int tam);
