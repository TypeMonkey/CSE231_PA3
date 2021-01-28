import {BinOp, 
  UniOp, 
  Expr, 
  Literal, 
  IfStatement, 
  Stmt, 
  FuncDef,
  Program,
  Type, 
  toString,
  VarDeclr,
  funcSig} from "./ast";
import { BinaryInteger, concat, initialize, toBigInt } from "./binary";
import { organizeProgram } from "./form";
import { parse } from "./parser";

// https://learnxinyminutes.com/docs/wasm/

type CompileResult = {
  wasmSource: string,
};

export function compile(source: string) : CompileResult {
  let builtins: Map<string, Type> = new Map;
  builtins.set("print(int,)", Type.Int);
  builtins.set("print(bool,)", Type.Bool);
  builtins.set("abs(int,)", Type.Int);
  builtins.set("max(int,int,)", Type.Int);
  builtins.set("min(int,int,)", Type.Int);
  builtins.set("pow(int,int,)", Type.Int);

  let stmts: Array<Stmt> = parse(source);
  let program: Program = organizeProgram(stmts, builtins);

  //map functions to their unqiue function names in wasm
  //as well as global variables to their indices
  let funcLabels: Map<string, string> = new Map;
  let globalVars: Map<string, number> = new Map;

  //wasm function name scheme we'll use:
  // - just their function name, if unique
  // - their function name + the number of times this function name has been seen
  let funcLabelNum: Map<string, number> = new Map;

  for(let [sig, def] of Array.from(program.fileFuncs.entries())){
    let fname = def.identity.name;
    let id = 0; //to append to the end of function names

    if(funcLabelNum.has(fname)){
      id = funcLabelNum.get(fname) + 1;
      funcLabelNum.set(fname, id);
    }
    else{
      funcLabelNum.set(fname, 0);
    }

    //set functio  name. If id is 0, don't event append it
    funcLabels.set(sig, fname+(id === 0 ? "" : id));
  }

  //map global variables to indices
  let index = 0;
  Array.from(program.fileVars.keys()).forEach(e => {
    globalVars.set(e, index);
    index += 4;  //since we're 32 bits
  });

  /*
  const definedVars = new Set();
  ast.forEach(s => {
    switch(s.tag) {
      case "define":
        definedVars.add(s.name);
        break;
    }
  }); 
  const scratchVar : string = `(local $$last i32)`;
  const localDefines = [scratchVar];
  definedVars.forEach(v => {
    localDefines.push(`(local $${v} i32)`);
  })
  
  const commandGroups = ast.map((stmt) => codeGen(stmt));
  const commands = localDefines.concat([].concat.apply([], commandGroups));
  console.log("Generated: ", commands.join("\n"));
  return {
    wasmSource: commands.join("\n"),
  };
  */
}

function codeGenFunction(funcDef: FuncDef, 
                         funcLabels: Map<string, string>, 
                         vars: Array<Map<string, number>>) : Array<string>{
  let instrs : Array<string> = new Array;

  //translate parameters to wasm
  let paramHeader : string = "";
  for(let [name, _] of Array.from(funcDef.params.entries())){
    paramHeader += `(param $${name} i32)`;
  }

  //add function return type, if it's not None
  let returnType : string = funcDef.identity.returnType !== Type.None ? "(result i32)" : "";

  //now put it all together
  let funcHeader : string = `(func $${funcLabels.get(funcSig(funcDef.identity))} ${paramHeader} ${returnType}`;
  instrs.push(funcHeader);

  //compile local variables
  for(let [name, info] of Array.from(funcDef.varDefs.entries())){
    const valueInstr = codeGenExpr(info.value, funcLabels, vars);
    instrs = instrs.concat(valueInstr);

    instrs.push(`(local $${name} i32)`);
    instrs.push(`(set_local $${name})`);
  }

  //compile statements
  for(let fStmt of funcDef.bodyStms){
    instrs = instrs.concat(codeGenStmt(fStmt, funcLabels, vars));
  }

  instrs.push(")");  //add concluding paranthesis
  return instrs;
}

export function codeGenStmt(stmt: Stmt, 
                     funcLabels: Map<string, string>, 
                     vars: Array<Map<string, number>>) : Array<string> {
  switch(stmt.tag) {
    case "funcdef":
      //this shouldn't trigger as functions are toplevel
      break;
    case "vardec":
      //this shouldn't trigger as vardecs are toplevel
      break;
    case "cond": {
      let condInstr = codeGenExpr(stmt.ifStatement.condition, funcLabels, vars);

      break;
    }
    case "assign": {
      const valueInstrs = codeGenExpr(stmt.value, funcLabels, vars);

      let found : number = lookup(stmt.name, vars);
      let store = found === -1 ? [`(local.set $${stmt.name})`] ? [`(store ${found})`];

      return valueInstrs.concat(store);
    }
    case "expr":
      return codeGenExpr(stmt.expr, funcLabels, vars);
      //return exprStmts.concat([`(local.set $$last)`]);
  }

  return [];
}

export function codeGenExpr(expr : Expr, 
                     funcLabels: Map<string, string>, 
                     vars: Array<Map<string, number>>) : Array<string> {
  switch(expr.tag) {
    case "id": {
      let found : number = lookup(expr.name, vars);
      return found === -1 ? [`(local.get $${expr.name})`] ? [`(load ${found})`];
    }
    case "nestedexpr": {
      return codeGenExpr(expr.nested, funcLabels, vars);
    }
    case "uniexpr": {
      let targetInstr : Array<string> = codeGenExpr(expr.target, funcLabels, vars);
      
      switch(expr.op){
        case UniOp.Not: {
          let prior = ["(i32.const 0)", "(i32.const 1)"];
          targetInstr = prior.concat(targetInstr).concat(["(i32.wrap_i64)", "(select)"]);
        };
        case UniOp.Sub:{
          targetInstr = ["(i32.const 0)"].concat(targetInstr).concat(["(i32.wrap_i64)", "(i32.sub)"]);
        }
      }
      
      return targetInstr;
    }
    case "bopexpr": {
      let leftInstr : Array<string> = codeGenExpr(expr.left, funcLabels, vars);
      leftInstr.push("(i32.wrap_i64)");
      let rightInstr : Array<string> = codeGenExpr(expr.right, funcLabels, vars);
      leftInstr.push("(i32.wrap_i64)");


      switch (expr.op) {
        case BinOp.Add: return leftInstr.concat(rightInstr, ["(i32.add)"]);
        case BinOp.Sub: return leftInstr.concat(rightInstr, ["(i32.sub)"]);
        case BinOp.Mul: return leftInstr.concat(rightInstr, ["(i32.mul)"]);

        case BinOp.Div: return leftInstr.concat(rightInstr, ["(i32.div_s)"]);
        case BinOp.Mod: return leftInstr.concat(rightInstr, ["(i32.rem_s)"]);

        case BinOp.Equal: return leftInstr.concat(rightInstr, ["(i32.eq)"]);
        case BinOp.NEqual: return leftInstr.concat(rightInstr, ["(i32.ne)"]);

        case BinOp.LEqual: return leftInstr.concat(rightInstr, ["(i32.le)"]);
        case BinOp.GEqual: return leftInstr.concat(rightInstr, ["(i32.ge)"]);

        case BinOp.Less: return leftInstr.concat(rightInstr, ["(i32.lt)"]);
        case BinOp.Great: return leftInstr.concat(rightInstr, ["(i32.gt)"]);

        //since we only have bools and ints, "is" works the same as "==" at the moment
        case BinOp.Is: return leftInstr.concat(rightInstr, ["(i32.eq)"]);
      }

    }
    case "funccall":{
      let argInstrs: Array<string> = [];

      for(let arg of expr.args){
        const argInstr = codeGenExpr(arg, funcLabels, vars);
        argInstrs.concat(argInstr)
      }

      const targetLabel = funcLabels.get(funcSig(expr.target));
      argInstrs = argInstrs.concat([`(call $${targetLabel})`]);

      return argInstrs;
    }
    case "Boolean":{
      let tagSection : BinaryInteger = initialize(31, BigInt(2));
      let metadata : BinaryInteger = initialize(1, BigInt(0));
      metadata = concat(tagSection, metadata);

      let booleanValue : BinaryInteger = initialize(32, expr.value ? 1n : 0n);
      let whole : BinaryInteger = concat(metadata, booleanValue);

      return ["(i64.const " + toBigInt(whole).toString(10) + ")"];
    }
    case "Number":{
      let tagSection : BinaryInteger = initialize(31, BigInt(1));
      let metadata : BinaryInteger = initialize(1, BigInt(0));
      metadata = concat(tagSection, metadata);

      let numericValue : BinaryInteger = initialize(32, expr.value);
      let whole : BinaryInteger = concat(metadata, numericValue);

      return ["(i64.const " + toBigInt(whole).toString(10) + ")"];
    }
    case "None":{
      let tagSection : BinaryInteger = initialize(31, BigInt(0));
      let metadata : BinaryInteger = initialize(1, BigInt(0));
      metadata = concat(tagSection, metadata);

      let noneValue : BinaryInteger = initialize(32, 0n);
      let whole : BinaryInteger = concat(metadata, noneValue);

      return ["(i64.const " + toBigInt(whole).toString(10) + ")"];
    }
  }
}

 /**
 * Looks up a vairable's type from a list of variable maps.
 * If the varibale cannot be found, undefined is returned
 */
function lookup(targetVar: string,
                varMaps: Array<Map<string, number>>) : number {
  for (let vmap of varMaps) {
    if(vmap.has(targetVar)){
      return vmap.get(targetVar);
    }
  }
  return undefined;
}
