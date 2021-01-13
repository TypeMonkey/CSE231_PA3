import { Stmt, Expr, BinOp } from "./ast";
import { parse } from "./parser";

// https://learnxinyminutes.com/docs/wasm/

type LocalEnv = Map<string, boolean>;

type CompileResult = {
  wasmSource: string,
};

export function compile(source: string) : CompileResult {
  const ast = parse(source);
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
}

function codeGen(stmt: Stmt) : Array<string> {
  switch(stmt.tag) {
    case "define":
      var valStmts = codeGenExpr(stmt.value);
      return valStmts.concat([`(local.set $${stmt.name})`]);
    case "expr":
      var exprStmts = codeGenExpr(stmt.expr);
      return exprStmts.concat([`(local.set $$last)`]);
  }
}

function codeGenExpr(expr : Expr) : Array<string> {
  switch(expr.tag) {
    case "builtin1": {
      const argStmts = codeGenExpr(expr.arg0);
      return argStmts.concat([`(call $${expr.name})`]);
    }
    case "builtin2": {
      const argStmts = codeGenExpr(expr.arg1);
      argStmts.concat(codeGenExpr(expr.arg0));
      return argStmts.concat([`(call $${expr.name})`]); 
    }
    case "bopexpr": {
      let leftInstr : Array<string> = codeGenExpr(expr.left);
      let rightInstr : Array<string> = codeGenExpr(expr.right);

      switch (expr.op) {
        case BinOp.Add: return leftInstr.concat(rightInstr, ["(i32.add)"]);
        case BinOp.Sub: return leftInstr.concat(rightInstr, ["(i32.sub)"]);
        case BinOp.Mul: return leftInstr.concat(rightInstr, ["(i32.mul)"]);
      }
    }
    case "num":
      return ["(i32.const " + expr.value + ")"];
    case "id":
      return [`(local.get $${expr.name})`];
  }
}
