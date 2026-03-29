const N: usize = 1_000_000;

fn main() {
    let mut crivo = vec![1i32; N + 1];
    crivo[0] = 0;
    crivo[1] = 0;

    let mut i = 2;
    while i * i <= N {
        if crivo[i] == 1 {
            let mut j = i * i;
            while j <= N {
                crivo[j] = 0;
                j += i;
            }
        }
        i += 1;
    }

    let mut contagem = 0i32;
    for k in 2..=N {
        contagem += crivo[k];
    }

    println!("{}", contagem);
}
