const N: usize = 10000;

fn main() {
    let mut lista: Vec<i32> = (0..N).map(|i| (N - i) as i32).collect();

    for i in 0..N - 1 {
        for j in 0..N - 1 - i {
            if lista[j] > lista[j + 1] {
                lista.swap(j, j + 1);
            }
        }
    }

    println!("{}", lista[0]);
}
