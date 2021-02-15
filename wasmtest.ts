import wabt from 'wabt';

export const importObject = {
    imports: {
      // we typically define print to mean logging to the console. To make testing
      // the compiler easier, we define print so it logs to a string object.
      //  We can then examine output to see what would have been printed in the
      //  console.
      print: (arg: any) => console.log(arg),
      print_num: (arg: number) => console.log(arg),
      print_bool: (arg: number) => console.log(arg),
      print_none: (arg: number) => console.log(arg),
      abs: Math.abs,
      min: Math.min,
      max: Math.max,
      pow: Math.pow,
    },

    built : {
      testerWester: (arg: any) => console.log("hello testerwester")
    },
  
    output: "",
  };

export async function run(config: any){
    const wabtInterface = await wabt();

    const wasmSource = `(module
      (func $print (import "imports" "print") (param i32) (result i32))
      (func $tester (import "built" "testerWester") (param i32) (result i32))
      (func $exported_func (export "exported_func") (result i32)
      (call $tester (i32.const 10))
      (drop)
      (if (result i32) (i32.lt_s (i32.const 100) (i32.const 200))
        (then (i32.const 10))
        (else (i32.const 10))
      )
      )
  )`;
    const myModule = wabtInterface.parseWat("test.wat", wasmSource);
    var asBinary = myModule.toBinary({});
    var wasmModule = await WebAssembly.instantiate(asBinary.buffer, config);
    const result = (wasmModule.instance.exports.exported_func as any)();
    console.log("END REDULT: "+result);
}

var samp : any = importObject.imports;
samp["test1"] = (arg: number) => console.log("IN TEST1!!!"+arg); 

run(importObject);