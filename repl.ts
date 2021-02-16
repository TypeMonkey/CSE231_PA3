import {run} from "./runner";
import {compile} from "./compiler";
import fs from 'fs';
import { Program, Stmt, FuncIdentity, Type, FuncDef, Value, VarDeclr, ClassDef, identityToLabel, identityToFSig } from "./ast";
import { parse } from "./parser";
import { checkStatement, GlobalTable, organizeProgram } from "./tc";
import { importObject } from "./tests/import-object.test";
import { Runner } from "mocha";
import { PyBool, PyInt, PyObj } from "./utils";

//for DEV PURPOSES
const curSource: Array<string> = new Array;
let curInstr: Array<string> = new Array;

/*
 Stores heap data and information, as well as global variables and functions
 */
export type ProgramStore = {
  typeStore : GlobalTable,
  memStore: MemoryStore,
}

export type MemoryStore = {
  curFileVarIndex: number,

  fileVariables: Array<{varName: string, declrType: Type, val: Value}>
  fileVarIndex: Map<string, number>

  /*
   Maps function signatures (as string) to their assembly labels
   */
  fileFunctionLabels: Map<string, string>,

  /*
   Maps typecodes to their class names
   */
  fileTypes: Map<number, string>

  heap: Array<Instance>,
  heapIndex: number
}

/*
 Represents a runtime instance of a class
 */
export type Instance = {
  typeName: string,
  attributes: Array<Value>
}

function instanciate(typecode: number, store: ProgramStore) : number{
  const heapAddress = store.memStore.heapIndex;

  const className = store.memStore.fileTypes.get(typecode);
  const classDef = store.typeStore.classMap.get(className);

  console.log("-----------> instantiating!!! "+className);

  const attrs : Array<Value> = new Array(classDef.classVars.size);
  for(let {index, varDec} of Array.from(classDef.classVars.values())){
    if(varDec.value.tag === "value"){
      switch(varDec.value.value.tag){
        case "None" : {attrs[index] = {tag: "none"}; break;}
        case "Boolean" : {attrs[index] = {tag: "bool", value: varDec.value.value.value}; break;}
        case "Number" : {attrs[index] = {tag: "num", value: Number(varDec.value.value.value)}; break;}
      }
    }
  }

  store.memStore.heap.push({typeName: className, attributes: attrs});

  store.memStore.heapIndex++;
  return heapAddress;
}

function objRetr(address: number, attrIndex: number, store: ProgramStore) : number{
  const heapObject = store.memStore.heap[address];
  
  if(heapObject.typeName === "none"){
    throw new Error("Heap object at index "+address+" is None!");
  }

  const attrValue = heapObject.attributes[attrIndex];
  switch(attrValue.tag){
    case "bool": {return attrValue.value ? 1 : 0}
    case "none": {return 0}
    case "num": {return attrValue.value}
    case "object": {return attrValue.address}
  }
}

function objMut(address: number, attrIndex: number, newValue: number, store: ProgramStore) {
  const attrValue = store.memStore.heap[address];

  //console.log("------ATTRIBUTE MUTATION!!! "+attrValue.typeName);
  
  if(attrValue.typeName === "none"){
    throw new Error("Heap object at index "+address+" is None!");
  }

  if(attrValue.attributes[attrIndex].tag === "num"){
    attrValue.attributes[attrIndex] = {tag: "num", value: newValue};
  }
  else if(attrValue.attributes[attrIndex].tag === "bool"){
    attrValue.attributes[attrIndex] = {tag: "bool", value: newValue === 0? false : true};
  }
  else{
    const heapObject = store.memStore.heap[newValue];
    attrValue.attributes[attrIndex] = {tag: "object", name: heapObject.typeName, address: newValue};
  }
}

function globalStore(varIndex: number, newValue: number, store: ProgramStore) {
  const varInfo = store.memStore.fileVariables[varIndex];

  //console.log("------GLOBAL VAR MUTATION!!! "+varIndex+" | "+varInfo.varName);

  if(varInfo === undefined){
    throw new Error(`unknown global STORE? caller: ${varIndex} | ${store.memStore.fileVariables.length} | ${store.memStore.curFileVarIndex} PROGS: 
       ${curSource.join("\n")}
        INSTRS: 
        ${curInstr.join("\n")}`);
  }

  if(varInfo.declrType.tag === "number"){
    store.memStore.fileVariables[varIndex].val =  {tag: "num", value: newValue};
  }
  else if(varInfo.declrType.tag === "bool"){
    store.memStore.fileVariables[varIndex].val = {tag: "bool", value: newValue === 0? false : true};
  }
  else{
    if(newValue === 0){
      console.log("------- gvar is nulled!");
      store.memStore.heap[varIndex] = {typeName: "none", attributes: undefined};
    }
    else{
      const heapObject = store.memStore.heap[newValue];
      console.log("------- still gvar mut "+(heapObject === undefined)+" | "+newValue)
      store.memStore.fileVariables[varIndex].val = {tag: "object", name: heapObject.typeName, address: newValue};
    }
  }
}

function globalRetr(varIndex: number, store: ProgramStore) : number {
  const varInfo = store.memStore.fileVariables[varIndex];

  if(varInfo === undefined){
    throw new Error(`unknown global? caller: ${varIndex} | ${store.memStore.fileVariables.length} | ${store.memStore.curFileVarIndex} PROGS: 
       ${curSource.join("\n")}
        INSTRS: 
        ${curInstr.join("\n")}`);
  }

  switch(varInfo.val.tag){
    case "bool": {return varInfo.val.value ? 1 : 0}
    case "none": {return 0}
    case "num": {return varInfo.val.value}
    case "object": {return varInfo.val.address}
  }
}


export class BasicREPL {

  importObject: any;
  store: ProgramStore;

  constructor(importObject : any) {  
    this.importObject = importObject;

    //built-in function map
    const builtins: Map<string, FuncIdentity> = new Map;
    builtins.set("abs(number)", {name: "abs", paramType: [{tag: "number"}], returnType: {tag:"number"}});
    builtins.set("min(number,number,)", {name: "min", paramType: [{tag: "number"}, {tag: "number"}], returnType: {tag:"number"}});
    builtins.set("max(number,number,)", {name: "max", paramType: [{tag: "number"}, {tag: "number"}], returnType: {tag:"number"}});
    builtins.set("pow(number,number,)", {name: "pow", paramType: [{tag: "number"}, {tag: "number"}], returnType: {tag:"number"}});
    builtins.set("print(object,)", {name: "print", paramType: [{tag: "class", name: "object"}], returnType: {tag: "class", name: "object"}});
    builtins.set("print(number,)", {name: "print", paramType: [{tag: "number"}], returnType: {tag: "number"}});
    builtins.set("print(bool,)", {name: "print", paramType: [{tag: "bool"}], returnType: {tag: "bool"}});

    //built-in function label map
    const builtinsLabel: Map<string, string> = new Map;
    builtinsLabel.set("abs(number)", "abs");
    builtinsLabel.set("min(number,number,)", "min");
    builtinsLabel.set("max(number,number,)", "max");
    builtinsLabel.set("pow(number,number,)", "pow");
    builtinsLabel.set("print(object,)", "print");
    builtinsLabel.set("print(number,)", "print_num");
    builtinsLabel.set("print(bool,)", "print_bool");


    //initialize program store
    this.store = {
      typeStore: {
                    classMap: new Map,
                    funcMap: builtins,
                    varMap: new Map,
                 },
      memStore:  {
                    curFileVarIndex: 0,
                    fileVariables: new Array,
                    fileVarIndex: new Map,
                    fileFunctionLabels: builtinsLabel,
                    fileTypes: new Map,
                    heap: [undefined],
                    heapIndex: 1
                 }
    };

    //add the attribute and method functions
    const samp : any = importObject;
    samp["built"] = {
      instanciate: (typeCode: number) => {return instanciate(typeCode, this.store)},
      attrretr: (target: number, index: number) => {return objRetr(target, index, this.store)},
      attrmut: (target: number, index: number, newVal: number) => objMut(target, index, newVal, this.store),
      globalRet: (index: number) => {return globalRetr(index, this.store)},
      globalMut: (index: number, newVal: number) => globalStore(index, newVal, this.store),
    }; 
  }   

  async run(source : string) : Promise<Value>  { 
    console.log("------ENTRANCE RUN: "+source+" | global vars: "+Array.from(this.store.typeStore.varMap.keys()).join("\n"));

    const rawStates = parse(source);

    const program = organizeProgram(rawStates, this.store.typeStore);

    this.updateStores(program);

    console.log("----TYPE CHECK COMPLETE!!");
    const instrs = compile(program, this.store);
    console.log("---- INSTRS!!!: \n "+instrs.join("\n"));

    //FOR DEV PURPOSES!
    curSource.push(source);
    curInstr = curInstr.concat(instrs);

    const value = await run(instrs.join("\n"), importObject);

    console.log("-------POST EXECUTE.  VALUE: "+value+" | "+program.topLevelStmts.length);

    if(program.topLevelStmts.length === 0){
      return {tag: "none"};
    }

    const lastScriptStatement = program.topLevelStmts[program.topLevelStmts.length - 1];
    if(lastScriptStatement.tag === "ret"){
      //why ret? in typecheck, we converted all last expression statements as ret
      switch(lastScriptStatement.expr.type.tag){
        case "bool": return {tag: "bool", value: value === 0 ? false : true};
        case "number": return {tag: "num", value: value};
        case "none": return {tag: "none"};
        case "class": return {tag: "object", name: this.store.memStore.heap[value].typeName, address: value};
      }
    }

    return {tag: "none"};
  }    

  updateStores(program: Program){
    const curTypeStore = this.store.typeStore;
    const curMemStore = this.store.memStore;

    //update function map for any new functions
    for(let [sig, iden] of Array.from(program.fileFunctions.entries())){
      curTypeStore.funcMap.set(sig, iden.identity);
      curMemStore.fileFunctionLabels.set(sig, identityToLabel(iden.identity));
    }

    //update var map for any new global variables
    for(let [name, decl] of Array.from(program.fileVars.entries())){
      if(curTypeStore.varMap.has(name)){
        throw new Error(`File variable '${name}' has already been declared!`);
      }

      curTypeStore.varMap.set(name, decl.varType);

      let value: Value = {tag: "none"};
      if(decl.value.tag === "value"){
        switch(decl.value.value.tag){
          case "None":    {value = {tag: "none"}; break;}
          case "Boolean": {value = {tag: "bool", value: decl.value.value.value}; break;}
          case "Number":  {value = {tag: "num", value: Number(decl.value.value.value)}; break;}
        }
      }

      curMemStore.fileVariables.push({varName : name, declrType: decl.varType, val: value})
      curMemStore.fileVarIndex.set(name, curMemStore.curFileVarIndex);
      curMemStore.curFileVarIndex++;
    }

    //update types
    for(let def of Array.from(program.fileClasses.values())){
      curMemStore.fileTypes.set(def.typeCode, def.name);
      curTypeStore.classMap.set(def.name, def);
    }
  }

  async tc(source : string) : Promise<Type> { 
    const rawStates = parse(source);
    const program = organizeProgram(rawStates, this.store.typeStore);
    
    if(program.topLevelStmts.length === 0){
      return {tag: "none"};
    }

    const lastScriptStatement = program.topLevelStmts[program.topLevelStmts.length - 1];
    if(lastScriptStatement.tag === "expr"){
      return lastScriptStatement.expr.type;
    }
    return {tag: "none"};
  }       
}


//sample code!


/*
async function main(){
  const repl = new BasicREPL(importObject);

  const input = fs.readFileSync("sample3.txt","ascii");
  let v = await repl.run(input);
  
  console.log("proceeding with repl!");

  
  var stdin = process.openStdin();
  stdin.addListener("data", async function(d) {
      // note:  d is an object, and when converted to a string it will
      // end with a linefeed.  so we (rather crudely) account for that  
      // with toString() and then substring() 
      const code = d.toString().trim();
      console.log("you entered: [" + code + "]");
      let v = await repl.run(code);
      console.log("       ===> result "+v.tag);
  });
  
 
}
*/

//main()


