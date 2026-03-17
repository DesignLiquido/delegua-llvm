#include "matematica.h"
#include <math.h>

// Funções algébricas

double delegua_mat_exp(double x) {
    return exp(x);
}

double delegua_mat_logaritmo(double x) {
    return log(x);
}

double delegua_mat_potencia(double base, double expoente) {
    return pow(base, expoente);
}

double delegua_mat_raiz_quadrada(double x) {
    return sqrt(x);
}

double delegua_mat_arredondar_para_baixo(double x) {
    return floor(x);
}

double delegua_mat_aprox(double x, int casas_decimais) {
    double fator = pow(10.0, (double)casas_decimais);
    return round(x * fator) / fator;
}

// Trigonometria

double delegua_mat_pi(void) {
    return acos(-1.0);
}

double delegua_mat_seno(double angulo) {
    return sin(angulo);
}

double delegua_mat_cosseno(double angulo) {
    return cos(angulo);
}

double delegua_mat_tangente(double angulo) {
    return tan(angulo);
}

double delegua_mat_arco_seno(double x) {
    return asin(x);
}

double delegua_mat_arco_cosseno(double x) {
    return acos(x);
}

double delegua_mat_arco_tangente(double x) {
    return atan(x);
}

double delegua_mat_graus(double radianos) {
    return radianos * 180.0 / acos(-1.0);
}

double delegua_mat_radiano(double graus) {
    return graus * acos(-1.0) / 180.0;
}

// Cálculo e limites

double delegua_mat_limite(double valor, double minimo, double maximo) {
    if (valor < minimo) return minimo;
    if (valor > maximo) return maximo;
    return valor;
}

// Financeira

double delegua_mat_juros_simples(double capital, double taxa, double tempo) {
    return capital * taxa * tempo;
}

double delegua_mat_juros_compostos(double capital, double taxa, double tempo) {
    return capital * pow(1.0 + taxa, tempo);
}

// Geometria plana

double delegua_mat_area_circulo(double raio) {
    return acos(-1.0) * raio * raio;
}

double delegua_mat_area_quadrado(double lado) {
    return lado * lado;
}

double delegua_mat_area_retangulo(double ladoX, double ladoY) {
    return ladoX * ladoY;
}

double delegua_mat_area_losango(double diagonal_maior, double diagonal_menor) {
    return (diagonal_maior * diagonal_menor) / 2.0;
}

double delegua_mat_area_trapezio(double base_maior, double base_menor, double altura) {
    return ((base_maior + base_menor) * altura) / 2.0;
}

double delegua_mat_area_triangulo(double base, double altura) {
    return (base * altura) / 2.0;
}

double delegua_mat_distancia_dois_pontos(double x1, double x2, double y1, double y2) {
    double dx = x2 - x1;
    double dy = y2 - y1;
    return sqrt(dx * dx + dy * dy);
}

// Funções de grau (raízes e vértice)

double delegua_mat_fun1r(double a, double b) {
    return -b / a;
}

double delegua_mat_x_vertice(double a, double b, double c) {
    return -b / (2.0 * a);
}

double delegua_mat_y_vertice(double a, double b, double c) {
    return -(b * b - 4.0 * a * c) / (4.0 * a);
}
