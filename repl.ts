import {Callable, executeExpr, executeProgram, executeStmt, ProgramStore} from "./runner";
import {compile, CompileResult, emptyEnv, GlobalEnv} from "./compiler";
import { Program, Stmt, FuncIdentity, Type, FuncDef, funcSig, VarDeclr } from "./ast";
import { parse } from "./parser";
import { checkStatement, organizeProgram } from "./form";

//iden: {name: "print", paramType: [Type.Object], returnType: Type.None},

const builtins : Map<string, Callable> = new Map;
builtins.set("print(object,)", 
 {tag: "built-in", 
  iden: {name: "print", paramType: [Type.Object], returnType: Type.None},
  func: (o: object) => {
    console.log(String(o));
    return 0n;
}});

builtins.set("abs(int,)", 
{tag: "built-in", 
iden: {name: "abs", paramType: [Type.Int], returnType: Type.Int},
func: (o: bigint) => {
  return o < 0 ? -o : o;
}});

builtins.set("max(int,int,)", {tag: "built-in", 
iden: {name: "max", paramType: [Type.Int, Type.Int], returnType: Type.Int},
func: (a: bigint, b: bigint) => {
  return a <= b ? b : a;
}});

builtins.set("min(int,int,)", {tag: "built-in", 
iden: {name: "max", paramType: [Type.Int, Type.Int], returnType: Type.Int},
func: (a: bigint, b: bigint) => {
  return a >= b ? b : a;
}});

builtins.set("pow(int,int,)", {tag: "built-in", 
iden: {name: "max", paramType: [Type.Int, Type.Int], returnType: Type.Int},
func: (a: bigint, b: bigint) => {
  return a ** b;
}});

export class BasicREPL {
  currentStore: ProgramStore;
  currentEnv: { curGlobalVars: Map<string, Type>, curFuncs: Map<string, FuncIdentity>};
  //importObject: any
  //memory: any

  
  constructor() {
    this.currentStore = {globalVars: new Map, functions: new Map(builtins)};
    this.currentEnv = {curGlobalVars: new Map, curFuncs: new Map};
  }

  init(program: Program){

    for(let [name, val] of Array.from(program.fileVars.entries())){
      this.currentStore.globalVars.set(name, executeExpr(val.value, 
                                                       this.currentStore, 
                                                       [this.currentStore.globalVars]));
      this.currentEnv.curGlobalVars.set(name, val.varType);
    }

    for(let [sig, def] of Array.from(program.fileFuncs.entries())){
      this.currentStore.functions.set(sig, {tag: "source", code: def});
      this.currentEnv.curFuncs.set(sig, def.identity);
    }
  }

  addFunction(fdef: FuncDef){
    const sig = funcSig(fdef.identity);
    if(this.currentStore.functions.has(sig)){
      throw new Error("There's already a function '"+sig+"'");
    }

    this.currentStore.functions.set(sig, {tag: "source", code: fdef});
    this.currentEnv.curFuncs.set(sig, fdef.identity);
  }

  addGlobal(varName: string, typeValue: VarDeclr) : bigint{
    if(this.currentStore.globalVars.has(varName)){
      throw new Error("There's already a global variable '"+varName+"'");
    }

    this.currentStore.globalVars.set(varName, executeExpr(typeValue.value, 
                                                        this.currentStore, 
                                                        [this.currentStore.globalVars]));
    this.currentEnv.curGlobalVars.set(varName, typeValue.varType);
    return this.currentStore.globalVars.get(varName);
  }

  execState(stmt: Stmt) : bigint{
    //console.log("GIVEN: "+Array.from(this.currentEnv.curFuncs.keys()).join());
    checkStatement(stmt, [this.currentEnv.curGlobalVars], this.currentEnv.curFuncs);
    if(stmt.tag === "funcdef"){
      this.addFunction(stmt.def);
      return undefined;
    }
    else if(stmt.tag === "vardec"){
      return this.addGlobal(stmt.name, stmt.info);
    }
    else{
      return executeStmt(stmt, this.currentStore, [this.currentStore.globalVars]).value;
    }
  }

  execRawState(source: string) : bigint{
    //console.log("parsing!!!!  "+source);
    let rawStates = parse(source);
    //console.log("----------GIVEN STATES: "+rawStates.join());

    let latest : bigint = undefined;
    for(let s of rawStates){
      //console.log("----------------------STATE EX");
      latest = this.execState(s);
    }

    return latest;
  }

  compile(source : string) : {program: Program, err: Error}{
    /*
    console.log("WANTING TO RUN "+source);

    try{
      let result: CompileResult = compile(source);
      return {compileResult: result, err: undefined};
    }
    catch(error){
      return {compileResult: undefined, err : error};
    }
    */

    let builtDefs : Map<string, FuncIdentity> = new Map;
    for(let [name, callable] of Array.from(builtins.entries())){
      if(callable.tag === "built-in"){
        builtDefs.set(name, callable.iden);
      }
      else if(callable.tag === "source"){
        builtDefs.set(name, callable.code.identity);
      }
    }

    console.log("WANTING TO RUN "+source);
    try {
      let rawStmts : Array<Stmt> = parse(source);
      let program: Program = organizeProgram(rawStmts, builtDefs);
      return {program: program, err: undefined}
    } catch (error) {
      return {program: undefined, err: error}
    }
  }

  run(program: Program) : bigint{
    return executeProgram(program, this.currentStore);
  }

  /*
  async run(source : string) : Promise<any> {
    this.importObject.updateNameMap(this.currentEnv); // is this the right place for updating the object's env?
    //const [result, newEnv] = await run(source, {importObject: this.importObject, env: this.currentEnv});
    //this.currentEnv = newEnv;
    return undefined;
  }
  */
}

var repl = new BasicREPL();
