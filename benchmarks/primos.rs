fn eh_primo(n: i32) -> i32 {
    if n <= 1 { return 0; }
    if n <= 3 { return 1; }
    if n % 2 == 0 { return 0; }
    let mut i = 3;
    while i * i <= n {
        if n % i == 0 { return 0; }
        i += 2;
    }
    1
}

fn main() {
    let mut contagem = 0;
    for j in 2..1000000 {
        contagem += eh_primo(j);
    }
    println!("{}", contagem);
}
