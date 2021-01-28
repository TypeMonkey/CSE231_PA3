
export type Program = {
  /*
   Maps file variable names to their
   respective variable declarations
   */
  fileVars: Map<string, VarDeclr>,

  /*
   Maps functions using their signature to their original
   function definitions.

   A function's signature is defined as the following string:
   <func name>'(' <a function's parameter types, comma seperated> ')'

   OR

   <func name>'( )' //if the function has no parameters
   */
  fileFuncs: Map<string, FuncDef>,
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

export type VarDeclr = {
  varType : Type,
  value : Expr
}

export type FuncIdentity = {
  name: string,
  paramType: Array<Type>,
  returnType?: Type;
}

export enum Type{
  Int = "int",
  Bool = "bool",
  Object = "object", //a.k.a "any" . Used internally by our compiler
  None = "None" //Largely used internally by the compiler to
                //show that a function has no declared return type
}

export type Stmt =
  | { tag: "assign", name: string, value: Expr }
  | { tag: "vardec", name: string, info: VarDeclr}
  | { tag: "cond", ifStatement: IfStatement}
  | { tag: "whileloop", cond: Expr, body: Array<Stmt>}
  | { tag: "pass" }
  | { tag: "ret", expr: Expr }
  | { tag: "expr", expr: Expr }
  | { tag: "funcdef", def: FuncDef}

export type IfStatement = 
{
  condition? : Expr, //if condition expression is missing, 
                     //this is an "else" block
  body: Array<Stmt>,
  alters: Array<IfStatement>
}

export type Expr =
    Literal
  | { tag: "id", name: string }
  | { tag: "uniexpr", op: UniOp, target: Expr }
  | { tag: "bopexpr", op : BinOp, left: Expr, right: Expr}
  | { tag: "funccall", name: string, args: Array<Expr> , target?: FuncIdentity}
  | { tag: "nestedexpr", nested: Expr}

export type Literal = 
    { tag: "None" }
  | { tag: "Boolean", value: boolean }
  | { tag: "Number", value: bigint}

/**
 * Returns the signature of a function
 * @param func - the function whose signature is to generate
 */
export function funcSig(func : FuncIdentity) : string{
  let sig : string = func.name+"(";

  Array.from(func.paramType.values()).forEach(value => sig += value+",");

  return sig+")";
}

/**
 * Returns the signature of the function a function invocation is calling
 * @param func - the signature of the function a function invocation is calling
 */
export function generateFuncSig(name: string, argTypes:Array<Type>) : string{
  let sig : string = name+"(";

  argTypes.forEach(value => sig += value+",");

  return sig+")";
}

/**
 * Returns the proper string representation of
 * an Expr for debugging purposes
 * @param params - an Expr
 */
export function toString(param : Expr) : string {
  switch(param.tag){
    case "None": {
      return "None";
    }
    case "Boolean" : {
      return `${param.value}`;
    }
    case "Number" : {
      return param.value.toString();
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


