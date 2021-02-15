
export type Program = {
  /*
   Maps file variable names to their
   respective variable declarations
   */
  fileVars: Map<string, VarDeclr>,

  /**
   * Maps functions to their
   * function signatures
   */
  fileFunctions: Map<string, FuncDef>

  fileClasses: Map<string, ClassDef>
  topLevelStmts: Array<Stmt>
}

export type FuncDef = {
  identity : FuncIdentity,

  /*
  Maps parameters - using their names as keys - to their
  respective TypeVariable.

  We'll be using JavaScript's Map object
  as it retains insertion order
  */
  params : Map<string, Type>,

  /* 
  Maps local variables - using their names as keys - to their
  respective VarDeclr.

  We'll be using JavaScript's Map object
  as it retains insertion order
  */
  varDefs : Map<string, VarDeclr>
  bodyStms : Array<Stmt>
}

export type ClassDef = {
  name: string,
  typeCode?: number,
  classVars: Map<string, {index: number, varDec: VarDeclr}>,
  methods: Map<string, FuncDef>
}

export type VarDeclr = {
  varType : Type,
  value : Expr
}

export type FuncIdentity = {
  name: string,
  paramType: Array<Type>,
  returnType: Type
}

export type Stmt =
  | { tag: "assign", name: string, value: Expr }
  | { tag: "attrassign", target: Expr, attr: string, value: Expr}
  | { tag: "vardec", name: string, info: VarDeclr}
  | { tag: "ifstatement", cond: Expr, trueBranch: Array<Stmt>, falseBranch: Array<Stmt>}
  | { tag: "pass" }
  | { tag: "ret", expr: Expr }
  | { tag: "expr", expr: Expr }
  | { tag: "funcdef", def: FuncDef}
  | { tag: "classdef", def: ClassDef}

export type Expr =
  | { type?: Type, tag: "value", value: Literal}
  | { type?: Type, tag: "id", name: string }
  | { type?: Type, tag: "uniexpr", op: UniOp, target: Expr }
  | { type?: Type, tag: "bopexpr", op : BinOp, left: Expr, right: Expr}
  | { type?: Type, tag: "funccall", name: string, args: Array<Expr> , callee?: FuncIdentity, isConstructor?: boolean}
  | { type?: Type, tag: "attrderef", target: Expr, attrName: string}
  | { type?: Type, tag: "methodderef", target: Expr, name: string, args: Array<Expr>, callee?: FuncIdentity}
  | { type?: Type, tag: "nestedexpr", nested: Expr}

export type Literal = 
    { tag: "None" }
  | { tag: "Boolean", value: boolean }
  | { tag: "Number", value: bigint}

export type Type =
  | {tag: "number"}
  | {tag: "bool"}
  | {tag: "none"}
  | {tag: "class", name: string}

export type Value =
    { tag: "none" }
  | { tag: "bool", value: boolean }
  | { tag: "num", value: number }
  | { tag: "object", name: string, address: number}

export enum BinOp{
  Add = "+", 
  Sub = "-",
  Mul = "*",
  Div = "//",
  Mod = "%",
  Equal = "==",
  NEqual = "!=",
  LEqual = "<=",
  GEqual = ">=",
  Less = "<",
  Great = ">",
  Is = "is"
} 
  
export enum UniOp{
  Sub = "-",
  Not = "not"
}
  
export enum NativeTypes{
  Int = "int",
  Bool = "bool",
  Object = "object", //a.k.a "any" . Used internally by our compiler
  None = "None" //Largely used internally by the compiler to
                //show that a function has no declared return type
}

/**
 * Returns the signature of a function
 * @param func - the function whose signature is to generate
 */
export function identityToFSig(func : FuncIdentity) : string {
  let sig : string = func.name+"(";

  Array.from(func.paramType.values()).forEach(value => sig += typeToString(value)+",");

  return sig+")";
}

/**
 * Returns the signature of the function a function invocation is calling
 * @param func - the signature of the function a function invocation is calling
 */
export function funcCallToFSig(name: string, argTypes:Array<Type>) : string {
  let sig : string = name+"(";

  argTypes.forEach(value => sig += typeToString(value)+",");

  return sig+")";
}

/**
 * Returns a label for a function that reflects that function uniquely. 
 * @param func - the function whose label is to generate
 */
export function identityToLabel(func: FuncIdentity) : string {
  let sig : string = func.name+"_";

  Array.from(func.paramType.values()).forEach(value => sig += typeToString(value)+"_");

  return sig;
}

export function typeToString(typ: Type) : string{
  return typ.tag === "class" ? typ.name : typ.tag;
}

/**
 * Returns the proper string representation of
 * an Expr for debugging purposes
 * @param params - an Expr
 */
export function toString(param : Expr) : string {
  switch(param.tag){
    case "value": {
      switch(param.value.tag){
        case "None": {
          return "None";
        }
        case "Boolean" : {
          return `${param.value}`;
        }
        case "Number" : {
          return param.value.toString();
        }
      }
    }
    case "id" : {
      return param.name;
    }
    case "uniexpr" : {
      return param.op+" "+toString(param.target);
    }
    case "bopexpr" : {
      return "( "+toString(param.left)+" "+param.op+" "+toString(param.right)+" )";
    }
    case "attrderef": {
      return toString(param.target)+" -> "+param.attrName;
    }
    case "methodderef": {
      return toString(param.target) + " -> "+toString({tag : "funccall", args: param.args, name: param.name});
    }
    case "funccall" : {
      let argRep : string = "";

      param.args.forEach(element => {
        argRep += toString(element)+" ,";
      });

      if(param.args.length > 0){
        argRep = argRep.substring(0, argRep.length - 1);
      }

      return param.name+"("+argRep+")";
    }
  }
}

