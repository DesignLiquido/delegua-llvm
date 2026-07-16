#pragma once

// Retorna a quantidade de argumentos de linha de comando informados ao
// executável, sem contar o caminho do próprio executável (argv[0]).
int delegua_arg_quantidade_argumentos(void);

// Retorna o argumento de linha de comando de índice `indice` (0-based,
// já excluindo argv[0], o caminho do executável). Retorna texto vazio
// se `indice` estiver fora do intervalo.
char* delegua_arg_argumento(int indice);
