export function initialize(size, value) {
    return { size: size, values: value.toString(2).split("").map(x => x == "1" ? true : false) };
}
export function toBigInt(bigint) {
    let sum = 0n;
    let exp = bigint.size - 1;
    for (let x of bigint.values) {
        sum += (x ? 1n : 0n) * (2n ** BigInt(exp));
        exp--;
    }
    return sum;
}
let sample = 15;
let encoded = initialize(64, BigInt(sample));
console.log(toBigInt(encoded));
