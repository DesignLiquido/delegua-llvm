const N: usize = 300_000;

struct Arvore {
    valores: Vec<i32>,
    esquerda: Vec<i32>,
    direita: Vec<i32>,
    tamanho: usize,
}

impl Arvore {
    fn nova() -> Self {
        Arvore {
            valores: vec![0; N],
            esquerda: vec![-1; N],
            direita: vec![-1; N],
            tamanho: 0,
        }
    }

    fn inserir(&mut self, val: i32) {
        if self.tamanho == 0 {
            self.valores[0] = val;
            self.esquerda[0] = -1;
            self.direita[0] = -1;
            self.tamanho = 1;
            return;
        }
        let mut atual: i32 = 0;
        loop {
            let idx = atual as usize;
            if val < self.valores[idx] {
                if self.esquerda[idx] == -1 {
                    self.esquerda[idx] = self.tamanho as i32;
                    self.valores[self.tamanho] = val;
                    self.esquerda[self.tamanho] = -1;
                    self.direita[self.tamanho] = -1;
                    self.tamanho += 1;
                    return;
                }
                atual = self.esquerda[idx];
            } else if val > self.valores[idx] {
                if self.direita[idx] == -1 {
                    self.direita[idx] = self.tamanho as i32;
                    self.valores[self.tamanho] = val;
                    self.esquerda[self.tamanho] = -1;
                    self.direita[self.tamanho] = -1;
                    self.tamanho += 1;
                    return;
                }
                atual = self.direita[idx];
            } else {
                return;
            }
        }
    }

    fn buscar(&self, val: i32) -> i32 {
        let mut atual: i32 = 0;
        while atual != -1 {
            let idx = atual as usize;
            if val == self.valores[idx] { return 1; }
            atual = if val < self.valores[idx] { self.esquerda[idx] } else { self.direita[idx] };
        }
        0
    }
}

fn main() {
    let mut arv = Arvore::nova();

    for i in 0..N as i32 {
        let mut val = (i * 7141 + 54773) % 1000000;
        if val < 0 { val = -val; }
        arv.inserir(val);
    }

    let mut encontrados = 0;
    for i in 0..N as i32 {
        encontrados += arv.buscar(i);
    }

    println!("{}", encontrados);
}
