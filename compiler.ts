import {BinOp, 
  UniOp, 
  Expr, 
  Literal, 
  Stmt, 
  FuncDef,
  FuncIdentity,
  Program,
  Type, 
  toString,
  VarDeclr,
  typeToString,
  identityToFSig,
  ClassDef,
  identityToLabel} from "./ast";
import { BinaryInteger, concat, initialize, toBigInt } from "./binary";
import { organizeProgram } from "./tc";
import { parse } from "./parser";
import { ProgramStore } from "./repl";
import { stringInput } from "lezer-tree";

/*
// Numbers are offsets into global memory
export type GlobalEnv = {
  globals: Map<string, number>;
  funcLabels: Map<string, string>;
  offset: number;
}

export const emptyEnv = { globals: new Map(), offset: 0 };

// https://learnxinyminutes.com/docs/wasm/

export type CompileResult = {
  wasmSource: string,
  globalIndices: GlobalEnv
};
*/

function convertLastStatement(stmts: Array<Stmt>){
  if(stmts.length > 0){
    const exprStmt = stmts[stmts.length - 1];
    if(exprStmt.tag === "expr"){
      stmts[stmts.length - 1] = {tag: "ret", expr: exprStmt.expr}
    }
    else if(exprStmt.tag === "ifstatement"){
      convertLastStatement(exprStmt.trueBranch);
      convertLastStatement(exprStmt.falseBranch);
    }
  }
}

export function compile(program: Program, store: ProgramStore) : Array<string> {
  let instrs : Array<string> = new Array;

  //compile classes
  for(let cdef of program.fileClasses.values()){
    instrs = instrs.concat(codeGenClass(cdef, store));
  }

  //compile functions
  for(let func of program.fileFunctions.values()){
    instrs = instrs.concat(codeGenFunction(func, store));
  }

  //compile top-level statements and put them in exported_func
  instrs.push(`(func $exported_func (export "exported_func") (result i32)`);

  //before we actually compile statments, we're gonna "convert"
  //the last exprstatement into a return statement
  convertLastStatement(program.topLevelStmts);

  for(let stmt of program.topLevelStmts){
    instrs = instrs.concat(codeGenStmt(stmt, new Array, store));
  }
  instrs.push(")");

  return instrs;
}

function codeGenClass(classDef: ClassDef, store: ProgramStore) : Array<string>{
  let instrs : Array<string> = new Array;

  for(let method of classDef.methods.values()){
    //translate parameters to wasm
    let paramHeader = "";
    for(let [name, _] of Array.from(method.params.entries())){
      paramHeader += `(param $${name} i32)`;
    }

    //add function return type, if it's not None
    const returnType = method.identity.returnType.tag !== "none" ? "(result i32)" : "";

    const funcLabel = `${classDef.name}_${identityToLabel(method.identity)}`;

    //now put it all together
    let funcHeader : string = `(func $${funcLabel} (export "${funcLabel}") ${paramHeader} ${returnType}`;
    instrs.push(funcHeader);

    //compile local variables
    let localVars: Set<string> = new Set(method.params.keys());
    //first add parameters to localVars

    for(let [name, info] of Array.from(method.varDefs.entries())){
      const valueInstr = codeGenExpr(info.value, [localVars], store);
      instrs = instrs.concat(valueInstr);

      instrs.push(`(local $${name} i32)`);
      instrs.push(`(set_local $${name})`);
    }

    //compile statements
    for(let fStmt of method.bodyStms){
      console.log("FOR FUNC: "+identityToFSig(method.identity)+"******");
      instrs = instrs.concat(codeGenStmt(fStmt, [localVars], store));
    }

    instrs.push(")");  //add concluding paranthesis
  }

  return instrs;
}

function codeGenFunction(funcDef: FuncDef, 
                         store: ProgramStore) : Array<string>{
  let instrs : Array<string> = new Array;

  //translate parameters to wasm
  let paramHeader : string = "";
  for(let [name, _] of Array.from(funcDef.params.entries())){
    paramHeader += `(param $${name} i32)`;
  }

  //add function return type, if it's not None
  let returnType : string = funcDef.identity.returnType.tag !== "none" ? "(result i32)" : "";

  //now put it all together
  let funcHeader : string = `(func $${store.memStore.fileFunctionLabels.get(identityToFSig(funcDef.identity))} 
                             (export "${store.memStore.fileFunctionLabels.get(identityToFSig(funcDef.identity))}") 
                             ${paramHeader} ${returnType}`;
  instrs.push(funcHeader);

  //compile local variables
  let localVars: Set<string> =  new Set(funcDef.params.keys());;
  for(let [name, info] of Array.from(funcDef.varDefs.entries())){
    const valueInstr = codeGenExpr(info.value, [localVars], store);
    instrs = instrs.concat(valueInstr);
    localVars.add(name);

    instrs.push(`(local $${name} i32)`);
    instrs.push(`(set_local $${name})`);
  }

  //compile statements
  for(let fStmt of funcDef.bodyStms){
    console.log("FOR FUNC: "+identityToFSig(funcDef.identity)+"******");
    instrs = instrs.concat(codeGenStmt(fStmt, [localVars], store));
  }

  instrs.push(")");  //add concluding paranthesis
  return instrs;
}

export function codeGenStmt(stmt: Stmt, 
                            localVars: Array<Set<string>>,
                            store: ProgramStore) : Array<string> {
  switch(stmt.tag){
    case "funcdef":{
      //this shouldn't trigger as functions are toplevel
      break;
    }
    case "vardec" :{
      //this shouldn't trigger as vardecs are toplevel
      break;
    }
    case "classdef" :{
      //this shouldn't trigger as classdefs are toplevel
      break;
    }
    case "ret":{
      return [codeGenExpr(stmt.expr, localVars, store)];
    }
    case "ifstatement":{
      const condInstr = codeGenExpr(stmt.cond, localVars, store);
      let instrs = [`(if (result i32) ${condInstr} `];

      instrs.push("(then");
      for(let thenStmt of stmt.trueBranch){
        instrs = instrs.concat(codeGenStmt(thenStmt, localVars, store));
      }
      instrs.push(")");

      instrs.push("(else");
      for(let elseStmt of stmt.falseBranch){
        instrs = instrs.concat(codeGenStmt(elseStmt, localVars, store));
      }
      instrs.push(")");

      instrs.push(")");
      return instrs;
    }
    case "attrassign": {
      const attrAccess = codeGenExpr(stmt.target, localVars, store);

      console.log("  ===> comp attraassign "+typeToString(stmt.target.type));

      const attrClassDef = store.typeStore.classMap.get(typeToString(stmt.target.type));
      const attrIndex = attrClassDef.classVars.get(stmt.attr).index;
      const newValue = codeGenExpr(stmt.value, localVars, store);

      return [`(call $3mute ${attrAccess} (i32.const ${attrIndex}) ${newValue})`];
    }
    case "assign": {
      const valueInstrs = codeGenExpr(stmt.value, localVars, store);

      if(isLocalVar(localVars, stmt.name)){
        return [`(local.set $${stmt.name} ${valueInstrs})`];
      }
      else{
        const fileVarIndex = store.memStore.fileVarIndex.get(stmt.name);
        return [`(call $5globst (i32.const ${fileVarIndex}) ${valueInstrs})`]
      }
    }
    case "ret":{
      return [codeGenExpr(stmt.expr, localVars, store)];
    }
    case "expr": {
      return [codeGenExpr(stmt.expr, localVars, store)].concat("(drop)");
    }
  }                     
            
  throw new Error("Unexpected stmt? "+stmt.tag);
}

export function codeGenExpr(expr : Expr, 
                            localVars: Array<Set<string>>,
                            store: ProgramStore) : string {
  console.log("   -type: "+expr.tag);
  console.log("--- expr: "+toString(expr));
  switch(expr.tag) {
    case "id": {
      let found : number = store.memStore.fileVarIndex.get(expr.name);
      return isLocalVar(localVars, expr.name) ? 
                  `(local.get $${expr.name})` : 
                  `(call $4globret (i32.const ${found}))`;
    }
    case "nestedexpr": {
      return codeGenExpr(expr.nested, localVars, store);
    }
    case "uniexpr": {
      let targetInstr : string = codeGenExpr(expr.target, localVars, store);
      
      switch(expr.op){
        case UniOp.Not: {
          targetInstr = `(select (i32.const 0) (i32.const 1) ${targetInstr})`;
        }
        case UniOp.Sub:{
          targetInstr = `(i32.mul (i32.const -1) ${targetInstr})`;
        }
      }
      
      return targetInstr;
    }
    case "bopexpr": {
      let leftInstr : string = codeGenExpr(expr.left, localVars, store);
      //leftInstr.push("(i32.wrap_i64)");
      let rightInstr : string = codeGenExpr(expr.right, localVars, store);
      //leftInstr.push("(i32.wrap_i64)");


      switch (expr.op) {
        case BinOp.Add: return `(i32.add ${leftInstr} ${rightInstr})`;
        case BinOp.Sub: return `(i32.sub ${leftInstr} ${rightInstr})`;
        case BinOp.Mul: return `(i32.mul ${leftInstr} ${rightInstr})`;

        case BinOp.Div: return `(i32.div_s ${leftInstr} ${rightInstr})`;
        case BinOp.Mod: return `(i32.rem_s ${leftInstr} ${rightInstr})`;

        case BinOp.Equal: return `(i32.eq ${leftInstr} ${rightInstr})`;
        case BinOp.NEqual: return `(i32.ne ${leftInstr} ${rightInstr})`;

        case BinOp.LEqual: return `(i32.le_s ${leftInstr} ${rightInstr})`;
        case BinOp.GEqual: return `(i32.ge_s ${leftInstr} ${rightInstr})`;

        case BinOp.Less: return `(i32.lt_s ${leftInstr} ${rightInstr})`;
        case BinOp.Great: return `(i32.gt_s ${leftInstr} ${rightInstr})`;

        //since we only have bools and ints, "is" works the same as "==" at the moment
        case BinOp.Is: return `(i32.eq ${leftInstr} ${rightInstr})`;
      }

    }
    case "funccall":{
      console.log("----COMPILING FUNCCALL "+identityToFSig(expr.callee)+" | "+expr.isConstructor);

      if(expr.isConstructor){
        const targetClassDef = store.typeStore.classMap.get(expr.name);
        return `(call $1nstanciate (i32.const ${targetClassDef.typeCode}))`;
      }
      else{
        let argInstrs: string = "";

        for(let arg of expr.args){
          const argInstr = codeGenExpr(arg, localVars, store);
          argInstrs += argInstr;
        }
  
        const targetLabel = store.memStore.fileFunctionLabels.get(identityToFSig(expr.callee));
        argInstrs = `(call $${targetLabel} ${argInstrs})`;
  
        return argInstrs;
      }
    }
    case "methodderef": {
      const targetInstr = codeGenExpr(expr.target, localVars, store);
      const targetClassDef = store.typeStore.classMap.get(typeToString(expr.target.type));
      const calleeIdentity = targetClassDef.methods.get(identityToFSig(expr.callee));

      let argInstrs: string = "";

      for(let arg of expr.args){
        const argInstr = codeGenExpr(arg, localVars, store);
        argInstrs += argInstr;
      }

      return `(call $${targetClassDef.name+"_"+identityToLabel(expr.callee)} ${targetInstr} ${argInstrs})`;
    }
    case "attrderef": {
      const targetInstr = codeGenExpr(expr.target, localVars, store);
      const targetClassDef = store.typeStore.classMap.get(typeToString(expr.target.type));
      const attrIndex = targetClassDef.classVars.get(expr.attrName).index;

      return `(call $2retr ${targetInstr} (i32.const ${attrIndex}))`;
    }
    case "value":{
      switch(expr.value.tag){
        case "None": return "(i32.const 0)";
        case "Number": return `(i32.const ${expr.value.value})`
        case "Boolean": return `(i32.const ${expr.value.value ? 1 : 0})`
      }
    }
  }
}

function isLocalVar(varMaps: Array<Set<string>>, varName: string) : boolean{
  for(let m of varMaps){
    if(m.has(varName)){
      return true;
    }
  }
  return false;
}