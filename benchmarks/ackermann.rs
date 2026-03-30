fn ack(m: i32, n: i32) -> i32 {
    if m == 0 { return n + 1; }
    if n == 0 { return ack(m - 1, 1); }
    ack(m - 1, ack(m, n - 1))
}

fn main() {
    println!("{}", ack(3, 11));
}
