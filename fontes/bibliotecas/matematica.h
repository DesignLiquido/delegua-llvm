#pragma once

// Funções algébricas
double delegua_mat_exp(double x);
double delegua_mat_logaritmo(double x);
double delegua_mat_potencia(double base, double expoente);
double delegua_mat_raiz_quadrada(double x);
double delegua_mat_arredondar_para_baixo(double x);
double delegua_mat_aprox(double x, int casas_decimais);

// Trigonometria
double delegua_mat_pi(void);
double delegua_mat_seno(double angulo);
double delegua_mat_cosseno(double angulo);
double delegua_mat_tangente(double angulo);
double delegua_mat_arco_seno(double x);
double delegua_mat_arco_cosseno(double x);
double delegua_mat_arco_tangente(double x);
double delegua_mat_graus(double radianos);
double delegua_mat_radiano(double graus);

// Cálculo e limites
double delegua_mat_limite(double valor, double minimo, double maximo);

// Financeira
double delegua_mat_juros_simples(double capital, double taxa, double tempo);
double delegua_mat_juros_compostos(double capital, double taxa, double tempo);

// Geometria plana
double delegua_mat_area_circulo(double raio);
double delegua_mat_area_quadrado(double lado);
double delegua_mat_area_retangulo(double ladoX, double ladoY);
double delegua_mat_area_losango(double diagonal_maior, double diagonal_menor);
double delegua_mat_area_trapezio(double base_maior, double base_menor, double altura);
double delegua_mat_area_triangulo(double base, double altura);
double delegua_mat_distancia_dois_pontos(double x1, double x2, double y1, double y2);

// Funções de grau (raízes e vértice)
double delegua_mat_fun1r(double a, double b);
double delegua_mat_x_vertice(double a, double b, double c);
double delegua_mat_y_vertice(double a, double b, double c);
