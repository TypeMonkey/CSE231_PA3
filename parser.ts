import {parser} from "lezer-python";
import {TreeCursor} from "lezer-tree";
import {BinOp, BuiltIn1, BuiltIn2, Expr, Stmt} from "./ast";

export function traverseExpr(c : TreeCursor, s : string) : Expr {

  console.log("CURRENT TYPE: "+c.type.name+" | TARGET: "+s);

  switch(c.type.name) {
    case "Number":          return {tag: "num", value: Number(s.substring(c.from, c.to))};
    case "VariableName":    return {tag: "id", name: s.substring(c.from, c.to)};
    case "BinaryExpression" : {
      console.log(" ==> In BinaryExpression");
      c.firstChild();  //traverses left expr
      console.log("    * first child: "+c.type.name);
      let leftExpr : Expr = traverseExpr(c,s);
      console.log("       ==> first child ACTUAL: "+leftExpr.tag);

      c.nextSibling(); //traveses the operator
      let opStr : string = s.substring(c.from, c.to);
      console.log("   * next sibling: "+c.type.name+" | ISO: "+opStr);

      c.nextSibling(); //traverses the right expr
      console.log("   * next next sibling: "+c.type.name);
      let rightExpr : Expr = traverseExpr(c,s);

      c.parent(); //traverse back to parent

      switch (opStr) {
        case BinOp.Add: return {tag: "bopexpr", op : BinOp.Add, left: leftExpr, right : rightExpr};
        case BinOp.Sub: return {tag: "bopexpr", op : BinOp.Sub, left: leftExpr, right : rightExpr};
        case BinOp.Mul: return {tag: "bopexpr", op : BinOp.Mul, left: leftExpr, right : rightExpr};
      }

      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
    }
    case "CallExpression":
      console.log(" ==> In CallExpression");
      c.firstChild();
      console.log("    * first child: "+c.type.name);

      const callName = s.substring(c.from, c.to);
      c.nextSibling(); // go to arglist
      console.log("    * next sib: "+c.type.name);

      c.firstChild(); // go into arglist - the '('  token'
      console.log("    * next sib fc: "+c.type.name);

      c.nextSibling(); // find single argument in arglist
      console.log("    * next sib fc nb: "+c.type.name);

      let firstArg : Expr = traverseExpr(c, s);

      c.nextSibling(); // This is either a comma or ')'. If comma, there's a second argument
      let unknownIfArg : string = s.substring(c.from, c.to);
      console.log("    * UNKNONW "+unknownIfArg);

      let secondArg : Expr = null;
      if(unknownIfArg === ","){
        //two arg function call. (this is builtin1)
        c.nextSibling(); //parse 2nd argument
        secondArg = traverseExpr(c, s);
        console.log("SECOND ARG: "+unknownIfArg+" | "+secondArg);
        c.nextSibling(); //skips ending ')'
      }

      //c.parent(); // pop arglist
      //c.parent(); // pop CallExpression

      //check if function name is in builtin1. If so, we expect only one arg
      switch (callName) {
        case BuiltIn1.Print:  return {tag: "builtin1", name: BuiltIn1.Print, arg0: firstArg};
        case BuiltIn1.Abs:  return {tag: "builtin1", name: BuiltIn1.Abs, arg0: firstArg};
        default: {
          //function being called isn't in builtin1.
          if(secondArg !== null){
            //there's a second argument. Now check if function is in builtin2
            switch(callName){
              case BuiltIn2.Max:  return {tag: "builtin2", name: BuiltIn2.Max, arg0: firstArg, arg1: secondArg};
              case BuiltIn2.Min:  return {tag: "builtin2", name: BuiltIn2.Min, arg0: firstArg, arg1: secondArg};
              case BuiltIn2.Pow:  return {tag: "builtin2", name: BuiltIn2.Pow, arg0: firstArg, arg1: secondArg};
              default: {
                console.log(`One arg function call to func ${callName}. Not in builtin2`);
                throw new Error("g Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
              }
            }
          }
          else{
            console.log(`One arg function call to func ${callName}. Not in builtin1`);
            throw new Error("e Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to)+" | "+callName);
          }
        }
      }   

    default:
      //DEV NOTE: This is problematic but fixes a lot of problems
      throw new Error("f Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to)+" | "+c.type.name);
  }
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt {
  switch(c.node.type.name) {
    case "AssignStatement":
      c.firstChild(); // go to name
      const name = s.substring(c.from, c.to);
      c.nextSibling(); // go to equals
      c.nextSibling(); // go to value
      const value = traverseExpr(c, s);
      c.parent();
      return {
        tag: "define",
        name: name,
        value: value
      }
    case "ExpressionStatement":
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return { tag: "expr", expr: expr }
    default:
      throw new Error("Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
  }
}

export function traverse(c : TreeCursor, s : string) : Array<Stmt> {
  switch(c.node.type.name) {
    case "Script":
      const stmts = [];
      c.firstChild();
      do {
        stmts.push(traverseStmt(c, s));
      } while(c.nextSibling())
      console.log("traversed " + stmts.length + " statements ", stmts, "stopped at " , c.node);
      return stmts;
    default:
      throw new Error("Could not parse program at " + c.node.from + " " + c.node.to);
  }
}
export function parse(source : string) : Array<Stmt> {
  const t = parser.parse(source);
  return traverse(t.cursor(), source);
}
