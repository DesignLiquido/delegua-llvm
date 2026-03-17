#pragma once

// Sub-fase F.1a — cifras clássicas, sem dependências externas.

char* delegua_cript_cifrar_xor            (char* texto, char* chave);
char* delegua_cript_decifrar_xor          (char* hex,   char* chave);
char* delegua_cript_rot13                 (char* texto);
char* delegua_cript_rot_n                 (char* texto, int n);
char* delegua_cript_decifrar_rot_n        (char* texto, int n);
char* delegua_cript_base64_codificar      (char* texto);
char* delegua_cript_base64_decodificar    (char* b64);
char* delegua_cript_menino_do_acre_cif    (char* texto);
char* delegua_cript_menino_do_acre_dec    (char* texto);
