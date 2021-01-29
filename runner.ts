// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import {FuncDef, FuncIdentity, funcSig, Stmt, Expr, UniOp, Program, BinOp} from "./ast"
//import wabt from 'wabt';
//import * as compiler from './compiler';
//import {parse} from './parser';

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

export type ProgramStore = {
  globalVars: Map<string, bigint>,
  functions: Map<string, Callable>
}

export type Callable = 
    {tag: "source", code: FuncDef}
  | {tag: "built-in", iden: FuncIdentity, func: any}

export function executeProgram(program: Program, progStore: ProgramStore) : bigint {
  //execute top level statements
  let recentResult : bigint = undefined;
  for(let tl of program.topLevelStmts){
    recentResult = executeStmt(tl, progStore, [progStore.globalVars]).value;
  }

  return recentResult;
}

export function executeStmt(stmt: Stmt, 
                            progStore: ProgramStore, 
                            varMap: Array<Map<string, bigint>>) : {value: bigint, isReturn: boolean}{
  switch(stmt.tag){
    case "assign":{
      const newVal = executeExpr(stmt.value, progStore, varMap);
      let oldVal = change(stmt.name, newVal, varMap);
      if(oldVal === undefined){
        //this is a global variable
        oldVal = progStore.globalVars.get(stmt.name);
        progStore.globalVars.set(stmt.name, newVal);
      }
      
      return {value: oldVal, isReturn: false};
    }
    case "vardec":{
      //shouldn't be triggered
      return {value: undefined, isReturn: false};
    }
    case "cond":{
      return {value: undefined, isReturn: false};
    }
    case "whileloop":{
      let cond = executeExpr(stmt.cond, progStore, varMap);

      //keep looping until condition is false
      while(cond !== 0n){
        //execute statements
        for(let loopStmt of stmt.body){
          let exec = executeStmt(stmt, progStore, varMap);
          if(exec.isReturn){
            return exec;
          }
        }

        cond = executeExpr(stmt.cond, progStore, varMap);
      }

      return {value: undefined, isReturn: false};
    }
    case "pass": return {value: undefined, isReturn: false};
    case "ret" : return {value: executeExpr(stmt.expr, progStore, varMap), isReturn: true}
    case "expr" : return {value: executeExpr(stmt.expr, progStore, varMap), isReturn: false}
    case "funcdef" : return {value: undefined, isReturn: false};;
  }
}

export function executeFunct(func: Callable, 
                             args: Array<bigint>,
                             progStore: ProgramStore, 
                             varMap: Array<Map<string, bigint>>) : bigint{
  switch(func.tag){
    case "built-in": return func.func(args);
    case "source": {
      let localMap: Map<string, bigint> = new Map;

      //assign parameters
      let pIndex = 0;
      for(let name of Array.from(func.code.params.keys())){
        localMap.set(name, args[pIndex]);
        pIndex++;
      }

      //map local variables
      for(let [name, valExpr] of Array.from(func.code.varDefs)){
        localMap.set(name, executeExpr(valExpr.value, progStore, [localMap].concat(varMap)));
      }

      //execute statements
      for(let stmt of func.code.bodyStms){
        let exec = executeStmt(stmt, progStore, [localMap].concat(varMap));
        if(exec.isReturn){
          return exec.value;
        }
      }

      //return "None" or null internally
      return null;
    }
  }
}

export function executeExpr(expr: Expr, 
                            progStore: ProgramStore, 
                            varMap: Array<Map<string, bigint>>) : bigint{
  switch(expr.tag){
    case "None" : return null;
    case "Boolean" : return expr.value ? 1n : 0n;
    case "Number" : return expr.value;
    case "id" : return lookup(expr.name, varMap);
    case "uniexpr": {
      const value = executeExpr(expr.target, progStore, varMap);
      switch(expr.op){
        case UniOp.Sub : return -value;
        case UniOp.Not : return value === 0n ? 1n : 0n;
      }
    }
    case "bopexpr" :{
      const left = executeExpr(expr.left, progStore, varMap);
      const right = executeExpr(expr.right, progStore, varMap);

      switch(expr.op){
        case BinOp.Add: return left + right;
        case BinOp.Sub: return left - right;
        case BinOp.Mul: return left * right;
        case BinOp.Div: return left / right;
        case BinOp.Mod: return left % right;

        case BinOp.Equal: return left == right ? 1n : 0n;
        case BinOp.NEqual: return left != right ? 1n : 0n;
        case BinOp.LEqual: return left <= right ? 1n : 0n;
        case BinOp.GEqual: return left >= right ? 1n : 0n;
        case BinOp.Less: return left < right ? 1n : 0n;
        case BinOp.Great: return left > right ? 1n : 0n;
        case BinOp.Is: return left == right ? 1n : 0n;
      }
    }
    case "funccall" : {

      let args: Array<bigint> = [];
      for(let arg of expr.args){
        args.push(executeExpr(arg, progStore, varMap));
      }

      //console.log(" ---- func target: "+(funcSig(expr.target)));

      return executeFunct(progStore.functions.get(funcSig(expr.target)), args, progStore, varMap);
    }
    case "nestedexpr" : return executeExpr(expr.nested, progStore, varMap);
  }
}

/**
 * Looks up a vairable's type from a list of variable maps.
 * If the varibale cannot be found, undefined is returned
 */
function lookup(targetVar: string,
                varMaps: Array<Map<string, bigint>>) : bigint {
  for (let vmap of varMaps) {
    if(vmap.has(targetVar)){
      return vmap.get(targetVar);
    }
  }
  return undefined;
}

/**
 * Looks up a vairable's type from a list of variable maps.
 * If the variable cannot be found, undefined is returned
 */
function change(targetVar: string,
                newValue: bigint,
                varMaps: Array<Map<string, bigint>>) : bigint {
  for (let vmap of varMaps) {
    if(vmap.has(targetVar)){
      const old = vmap.get(targetVar);
      vmap.set(targetVar, newValue);
      return old;
    }
  }
  return undefined;
}
/*
export async function runWASMSource(wasmSource: string, config: any) : Promise<number>{
  const wabtInterface = await wabt();
  const importObject = config.importObject;
  wasmSource = `(module
    (func $print (import "imports" "print") (param i32) (result i32))
    (func $abs   (import "imports" "abs") (param i32) (result i32))
    (func $max (import "imports" "max") (param i32) (param i32) (result i32))
    (func $min (import "imports" "min") (param i32) (param i32) (result i32))
    (func $pow (import "imports" "pow") (param i32) (param i32) (result i32))
    ${wasmSource}
  )`; 

  const myModule = wabtInterface.parseWat("test.wat", wasmSource);
  var asBinary = myModule.toBinary({});
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, importObject);
  const result = (wasmModule.instance.exports.exported_func as any)();
  return undefined;
}
*/
/*
export async function run(source : string, config: any) : Promise<number> {
  const wabtInterface = await wabt();
  const parsed = parse(source);
  var returnType = "";
  var returnExpr = "";
  const lastExpr = parsed[parsed.length - 1]
  if(lastExpr.tag === "expr") {
    returnType = "(result i32)";
    returnExpr = "(local.get $$last)"
  }
  const compiled = compiler.compile(source);
  const importObject = config.importObject;
  const wasmSource = `(module
    (func $print (import "imports" "print") (param i32) (result i32))
    (func $abs   (import "imports" "abs") (param i32) (result i32))
    (func $max (import "imports" "max") (param i32) (param i32) (result i32))
    (func $min (import "imports" "min") (param i32) (param i32) (result i32))
    (func $pow (import "imports" "pow") (param i32) (param i32) (result i32))
    (func (export "exported_func") ${returnType}
      ${compiled.wasmSource}
      ${returnExpr}
    )
  )`;

  const myModule = wabtInterface.parseWat("test.wat", wasmSource);
  var asBinary = myModule.toBinary({});
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, importObject);
  const result = (wasmModule.instance.exports.exported_func as any)();
  return result;
}
*/
