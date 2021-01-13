
export type Stmt =
  | { tag: "define", name: string, value: Expr }
  | { tag: "expr", expr: Expr }

export type Expr =
    { tag: "num", value: number }
  | { tag: "id", name: string }
  | { tag: "bopexpr", op : BinOp, left: Expr, right: Expr}
  | { tag: "builtin1", name: string, arg0: Expr }
  | { tag: "builtin2", name: string, arg0: Expr, arg1: Expr }

export enum BinOp{
  Add = "+", 
  Sub = "-",
  Mul = "*"
} 

export enum BuiltIn1{
  Print = "print",
  Abs = "abs"
}

export enum BuiltIn2{
  Max = "max",
  Min = "min",
  Pow = "pow"
}
