fn soma_digitos(mut n: i32) -> i32 {
    let mut soma = 0;
    while n > 0 {
        soma += n % 10;
        n /= 10;
    }
    soma
}

fn main() {
    let mut total: i32 = 0;
    for i in 1..=10_000_000 {
        total += soma_digitos(i);
    }
    println!("{}", total);
}
