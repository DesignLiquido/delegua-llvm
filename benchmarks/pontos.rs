struct Ponto { x: i32, y: i32 }

impl Ponto {
    fn distancia_manhattan(&self) -> i32 {
        self.x.abs() + self.y.abs()
    }
}

fn main() {
    let mut total: i32 = 0;
    for i in 0..1_000_000i32 {
        let p = Ponto { x: (i * 7 + 3) % 1000 - 500, y: (i * 13 + 7) % 1000 - 500 };
        total += p.distancia_manhattan();
    }
    println!("{}", total);
}
