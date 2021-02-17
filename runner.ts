// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import wabt from 'wabt';
import { Value } from './ast';
import * as compiler from './compiler';
import {parse} from './parser';
import { NUM, PyValue } from './utils';

// NOTE(joe): This is a hack to get the CLI Repl to run. WABT registers a global
// uncaught exn handler, and this is not allowed when running the REPL
// (https://nodejs.org/api/repl.html#repl_global_uncaught_exceptions). No reason
// is given for this in the docs page, and I haven't spent time on the domain
// module to figure out what's going on here. It doesn't seem critical for WABT
// to have this support, so we patch it away.
if(typeof process !== "undefined") {
  const oldProcessOn = process.on;
  process.on = (...args : any) : any => {
    if(args[0] === "uncaughtException") { return; }
    else { return oldProcessOn.apply(process, args); }
  };
}

export async function run(wasmsource : string, config: any) : Promise<number> {
  const wabtInterface = await wabt();

  //const importObject = config.importObject;

  /*
  const wasmSource = `(module
    (func $print (import "imports" "print") (param i32))
    ${wasmsource}
    )`; 
  */

  const wasmSource = `(module
    (func $abs (import "imports" "abs") (param i32) (result i32))
    (func $min (import "imports" "min") (param i32) (param i32) (result i32))
    (func $max (import "imports" "max") (param i32) (param i32) (result i32))
    (func $pow (import "imports" "pow") (param i32) (param i32) (result i32))
    (func $print (import "imports" "print") (param i32) (result i32))
    (func $print_num (import "imports" "print_num") (param i32) (result i32))
    (func $print_bool (import "imports" "print_bool") (param i32) (result i32))

    (func $1nstanciate (import "built" "instanciate") (param i32) (result i32))
    (func $2retr (import "built" "attrretr") (param i32) (param i32) (result i32))
    (func $3mute (import "built" "attrmut") (param i32) (param i32) (param i32))
    (func $4globret (import "built" "globalRet") (param i32) (result i32))
    (func $5globst (import "built" "globalMut") (param i32) (param i32))
    ${wasmsource}
    )`;

  //console.log("=====> AT RUNNER> FINAL SOURCE: \n"+wasmSource);

  const myModule = wabtInterface.parseWat("test.wat", wasmSource);
  var asBinary = myModule.toBinary({});
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, config);
  const result = (wasmModule.instance.exports.exported_func as any)();
  return result;

  /*
  try {
    var wasmModule = await WebAssembly.instantiate(asBinary.buffer, config);

    const result = (wasmModule.instance.exports.exported_func as any)();

    return result;
  } catch (error) {
    throw new Error(`--WASM ERROR: ${error.message} \n ${wasmSource}`);
  }
  */
}