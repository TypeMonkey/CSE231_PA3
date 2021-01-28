export type BinaryInteger = {
    size : number,
    values : boolean[];
}

export function initialize(size:number, value:bigint) : BinaryInteger {
    let rawData = value.toString(2).split("").map(x => x == "1" ? true : false);

    let pad : boolean [] = new Array(size - rawData.length);
    for(let i = 0; i < pad.length; i++){
        pad[i] = false;
    }

    return {size: size, values: pad.concat(rawData)};
}

export function toBigInt(bitint: BinaryInteger) : bigint{
    let sum : bigint = 0n;
    let exp : number = bitint.size - 1;

    for(let x of bitint.values){
        sum += (x ? 1n : 0n) * (2n ** BigInt(exp));
        exp--;
    }

    return sum;
}

export function shiftRight(bitint: BinaryInteger, amnt: number, toInsert: boolean = false){  
    for(let i = 0; i < amnt; i++){
        for(let i = bitint.values.length - 1; i >= 1; i--){
            bitint.values[i] = bitint.values[i - 1];
        }
    }
}

export function shiftLeft(bitint: BinaryInteger, amnt: number){  
    for(let i = 0; i < amnt; i++){
        for(let i = 0; i < bitint.values.length - 1; i++){
            bitint.values[i] = bitint.values[i + 1];
        }
    }
}

export function place(toInsert: BinaryInteger, target: BinaryInteger, startIndex: number) {
    const endIndex = startIndex + toInsert.values.length - 1;
    if(endIndex <= target.values.length - 1 && endIndex >= 0 && 
       startIndex >= 0 && startIndex <= target.values.length){
        //legal placement
        let targee = 0;
        for( ; startIndex <= endIndex; startIndex++){
            target.values[startIndex] = toInsert.values[targee];
            //console.log("asssigning: "+startIndex);
            targee++;
        }
    }
}

export function concat(front: BinaryInteger, back: BinaryInteger) : BinaryInteger{
    return {size: front.values.length + back.values.length, 
            values: front.values.concat(back.values)};
}


let sample = 8;
let encoded = initialize(8, BigInt(sample));
//console.log(encoded.values.length);
//console.log(toBigInt(encoded))
//console.log(sample)

shiftRight(encoded,2);
console.log(toBigInt(encoded))
shiftLeft(encoded,2);
console.log(toBigInt(encoded))
place(initialize(2,BigInt(3)), encoded, 2);
console.log(toBigInt(encoded).toString(10))
console.log(encoded.values);
