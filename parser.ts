import {parser} from "lezer-python";
import {TreeCursor} from "lezer-tree";
import { Stats } from "mocha";
import {BinOp, 
        UniOp, 
        Expr, 
        Literal, 
        IfStatement, 
        Stmt, 
        FuncDef,
        Program,
        FuncIdentity,
        Type, 
        toString,
        VarDeclr} from "./ast";
import { organizeProgram } from "./form";

export function traverseExpr(c : TreeCursor, s : string) : Expr {

  //console.log("CURRENT TYPE: "+c.type.name+" | TARGET: "+s);

  switch(c.type.name) {
    case "Number":        return {tag: "Number", value: BigInt(s.substring(c.from, c.to))};
    case "Boolean":       return {tag: "Boolean", value: Boolean(s.substring(c.from, c.to).toLowerCase())};
    case "VariableName":  return {tag: "id", name: s.substring(c.from, c.to)};
    case "None":          return {tag: "None"};
    case "UnaryExpression" : {
      //console.log(" ==> In UnaryExpression");

      c.firstChild();  //traverse the unary operator
      let unaryOp : string = s.substring(c.from, c.to);

      c.nextSibling(); //traverse to the target expression
      let targetExpr : Expr = traverseExpr(c, s);

      c.parent(); //go back to the parent node

      switch(unaryOp){
        case UniOp.Sub: return {tag: "uniexpr", op: UniOp.Sub, target: targetExpr};
        case UniOp.Not: return {tag: "uniexpr", op: UniOp.Not, target: targetExpr};
      }

      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
    }
    case "BinaryExpression" : {
      //console.log(" ==> In BinaryExpression");
      c.firstChild();  //traverses left expr
      //console.log("    * first child: "+c.type.name);
      let leftExpr : Expr = traverseExpr(c,s);
      //console.log("       ==> first child ACTUAL: "+leftExpr.tag);

      c.nextSibling(); //traveses the operator
      let opStr : string = s.substring(c.from, c.to);
      //console.log("   * next sibling: "+c.type.name+" | ISO: "+opStr);

      c.nextSibling(); //traverses the right expr
      //console.log("   * next next sibling: "+c.type.name);
      let rightExpr : Expr = traverseExpr(c,s);

      c.parent(); //traverse back to parent

      switch (opStr) {
        case BinOp.Add: return {tag: "bopexpr", op : BinOp.Add, left: leftExpr, right : rightExpr};
        case BinOp.Sub: return {tag: "bopexpr", op : BinOp.Sub, left: leftExpr, right : rightExpr};
        case BinOp.Mul: return {tag: "bopexpr", op : BinOp.Mul, left: leftExpr, right : rightExpr};
        case BinOp.Div: return {tag: "bopexpr", op : BinOp.Div, left: leftExpr, right : rightExpr};
        case BinOp.Mod: return {tag: "bopexpr", op : BinOp.Mod, left: leftExpr, right : rightExpr};
        case BinOp.Equal: return {tag: "bopexpr", op : BinOp.Equal, left: leftExpr, right : rightExpr};
        case BinOp.NEqual: return {tag: "bopexpr", op : BinOp.NEqual, left: leftExpr, right : rightExpr};
        case BinOp.LEqual: return {tag: "bopexpr", op : BinOp.LEqual, left: leftExpr, right : rightExpr};
        case BinOp.GEqual: return {tag: "bopexpr", op : BinOp.GEqual, left: leftExpr, right : rightExpr};
        case BinOp.Less: return {tag: "bopexpr", op : BinOp.Less, left: leftExpr, right : rightExpr};
        case BinOp.Great: return {tag: "bopexpr", op : BinOp.Great, left: leftExpr, right : rightExpr};
        case BinOp.Is: return {tag: "bopexpr", op : BinOp.Is, left: leftExpr, right : rightExpr};
      }

      throw new Error("Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to));
    }
    case "ParenthesizedExpression":{
      c.firstChild(); //goes into ParenthesizedExpression, landing on "("
      c.nextSibling(); //skip "("

      let nestedExpr : Expr = traverseExpr(c, s);

      c.parent();
      return { tag: "nestedexpr", nested : nestedExpr};
    }
    case "CallExpression": {
      console.log(" ==> In CallExpression");
      c.firstChild();
      console.log("    * first child: "+c.type.name);

      let callName : string = s.substring(c.from, c.to);
      c.nextSibling(); // go to arglist
      //console.log("    * next sib: "+c.type.name);

      c.firstChild(); // go into arglist - the '('  token'
      //console.log("    * next sib fc: "+c.type.name);

      let callArgs : Array<Expr> = new Array;

      let unknownIfArg : string = s.substring(c.from, c.to);
      //console.log("  **unknownifArg: "+unknownIfArg);

      /*
       * Iterate through arglist until the concluding
       * ")" is found - signifying the end of arguments
       */
      while (unknownIfArg !== ")") {
        //console.log(" FUNC CALL: "+unknownIfArg+" | "+callArgs);

        /*
         Becareful not to parse commas and the opening parenthesis!
         */
        if(unknownIfArg !== "," && unknownIfArg !== "(" ){
          callArgs.push(traverseExpr(c,s));
        }

        c.nextSibling();
        unknownIfArg = s.substring(c.from, c.to);
      }

      
      //callArgs.forEach(element => {
      //  console.log("----ARG: "+toString(element));
      //});
      

      c.parent(); // pop arglist
      c.parent(); // pop CallExpression

      return {tag: "funccall", name : callName, args: callArgs}; 
    }
    default:
      //DEV NOTE: This is problematic but fixes a lot of problems
      throw new Error("f Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to)+" | "+c.type.name);
  }
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt {

  console.log("cur state?: "+c.node.type.name);

  switch(c.node.type.name) {
    case "AssignStatement": {
      console.log("**** ASSIGN? "+s.substring(c.from, c.to));

      c.firstChild(); //goes into AssignStatement, landing on the variable name
      let varName: string = s.substring(c.from, c.to);

      c.nextSibling(); //maybe a TypeDef or AssignOp
      let localVarType : Type = undefined;
      if(c.node.type.name as string === "TypeDef"){
        //this is a local variable declaration.
        c.firstChild(); //goes into TypeDef and lands on ":"

        c.nextSibling(); //goes to type name
        const lvarTypeName = s.substring(c.from, c.to);
        switch(lvarTypeName){
          case Type.Int : {localVarType = Type.Int; break;}
          case Type.Bool : {localVarType = Type.Bool; break;}
          default: throw new Error("Unknown type '"+lvarTypeName+"'");
        }

        c.parent();
        c.nextSibling();

        console.log("      -> is local var dec: "+c.node.type.name);
      }

      c.nextSibling(); //value of the variable 
      let lvarValue : Expr = traverseExpr(c,s);
      c.parent();
      console.log("******END OF VAR '"+varName+"'");

      if(localVarType === undefined){
        return {tag: "assign", name: varName, value : lvarValue};
      }
      else{
        return {tag: "vardec", name: varName, info: {varType: localVarType, value: lvarValue}};
      }
    }
    case "FunctionDefinition" : {
      c.firstChild();  //enters func def. and lands on "def" keyword

      c.nextSibling();  //goes to the function's name
      let funcName : string = s.substring(c.from, c.to);

      c.nextSibling(); //go into ParamList

      c.firstChild(); //go into ParamList, landing on "("
      c.nextSibling(); //skips over "("
      let params : Map<string, Type> = new Map();
      let tempParamName : string = undefined;
      let expectName : boolean = true;
      //we're gonna parse parameters in a linear fashion.
      //We'll use a boolean flag that tells us whether the next totken is a param's name or type

      while (s.substring(c.from, c.to) !== ")") {
        //keep going through the ParamList until we hit ")"
        if(s.substring(c.from, c.to) !== ","){
          console.log(" --- PARAM FOR: '"+funcName+"' : "+s.substring(c.from, c.to)+" ? "+expectName);
          if(expectName){
            tempParamName = s.substring(c.from, c.to);

            if(params.has(tempParamName)){
              throw new Error("Already has a parameter '"+tempParamName+"'");
            }

            expectName = false;
          }
          else{
            c.firstChild(); //goes into the TypeDef, landing on ":"
            c.nextSibling(); //goes into the type name
            let tempParamType: string = s.substring(c.from, c.to);
            expectName = true;

            switch(tempParamType){
              case Type.Int : {params.set(tempParamName, Type.Int); break;}
              case Type.Bool : {params.set(tempParamName, Type.Bool); break;}
              default: throw new Error("Unknown type '"+tempParamType+"'");
            }

            c.parent();
          }
        }
        c.nextSibling();
      }
      c.parent();  //go back to parent, from ParamList

      c.nextSibling(); //next node should either be a TypeDef or Body
      let returnType : Type = Type.None;
      if(c.node.type.name as string === "TypeDef"){
        c.firstChild(); //lands on arrow
        c.nextSibling(); //goes to actual type

        let rawReturnType: string = s.substring(c.from, c.to);
        switch(rawReturnType){
          case Type.Int : {returnType = Type.Int; break;}
          case Type.Bool : {returnType = Type.Bool; break;}
          default: throw new Error("Unknown type '"+rawReturnType+"'");
        }
        c.parent();
        c.nextSibling(); //goes to function body
      }

      console.log("----FUNC POST PARAM: "+c.node.type.name);

      c.firstChild(); //enters function body, lands on colon
      console.log("----FUNC POST PARAM After: "+c.node.type.name);

      let funcLocalVars : Map<string, VarDeclr> = new Map();
      let funcStates : Array<Stmt> = new Array;

      //local vars must be declared before any other statement

      while (c.nextSibling()) {
        console.log("---FUNC STATEMENT: "+c.node.type.name);
        
        switch(c.node.type.name as string){
          case "AssignStatement":{
            console.log("**** ASSIGN? "+s.substring(c.from, c.to));

            c.firstChild(); //goes into AssignStatement, landing on the variable name
            let varName: string = s.substring(c.from, c.to);

            c.nextSibling(); //maybe a TypeDef or AssignOp
            let localVarType : Type = undefined;
            if(c.node.type.name as string === "TypeDef"){
              //this is a local variable declaration.
              c.firstChild(); //goes into TypeDef and lands on ":"

              c.nextSibling(); //goes to type name
              const lvarTypeName = s.substring(c.from, c.to);
              switch(lvarTypeName){
                case Type.Int : {localVarType = Type.Int; break;}
                case Type.Bool : {localVarType = Type.Bool; break;}
                default: throw new Error("Unknown type '"+lvarTypeName+"'");
              }

              c.parent();
              c.nextSibling();

              console.log("      -> is local var dec: "+c.node.type.name);
            }

            c.nextSibling(); //value of the variable 
            let lvarValue : Expr = traverseExpr(c,s);

            if(localVarType === undefined){
              funcStates.push({tag: "assign", name: varName, value : lvarValue});
            }
            else{
              if(funcLocalVars.has(varName) || params.has(varName)){
                throw new Error("Already has a local variable '"+varName+"'");
              }
              funcLocalVars.set(varName, {varType: localVarType, value: lvarValue});
            }

            c.parent();
            console.log("******END OF VAR '"+varName+"'");
            break;
          }
          default:{
            funcStates.push(traverseStmt(c, s));
            break;
          }
        }
        
      }
      c.parent();

      c.parent();

      return {tag: "funcdef", 
              def: {identity: {name: funcName, 
                               paramType: Array.from(params.values()),  
                               returnType: returnType}, 
                    params: params, 
                    varDefs: funcLocalVars, 
                    bodyStms: funcStates}};
    }
    case "WhileStatement": {
      c.firstChild(); //goes to "if" keyword
      console.log("!!!!WHILE STATEMENT!!!!-------"+s.substring(c.from, c.to));

      c.nextSibling(); //goes to condition expression
      console.log("WHILE COND:    |"+s.substring(c.from, c.to));
      let whileCond : Expr = traverseExpr(c, s);
      
      c.nextSibling(); //goes to the body
      
      c.firstChild(); //goes to the starting colon of the body
      let whileBody : Array<Stmt> = new Array;
      while (c.nextSibling()) {
        console.log("--WHILE STATE BODY: "+s.substring(c.from, c.to)+" type: "+c.node.type.name);
        whileBody.push(traverseStmt(c, s));
      }
      c.parent(); //go back to parent if-statement

      c.parent();

      return {tag: "whileloop", cond : whileCond, body: whileBody};
    }
    case "IfStatement": {
      c.firstChild(); //goes to "if" keyword
      console.log("!!!!IF STATEMENT!!!!-------"+s.substring(c.from, c.to));

      c.nextSibling(); //goes to condition expression
      console.log("COND:    |"+s.substring(c.from, c.to));
      let firstIfCond : Expr = traverseExpr(c, s);
      
      c.nextSibling(); //goes to the body
      
      c.firstChild(); //goes to the starting colon of the body
      let firstIfBody : Array<Stmt> = new Array;
      while (c.nextSibling()) {
        console.log("--IF STATE BODY: "+s.substring(c.from, c.to)+" type: "+c.node.type.name);
        firstIfBody.push(traverseStmt(c, s));
      }
      c.parent(); //go back to parent if-statement

      let alternates : Array<IfStatement> = new Array;
      while(c.nextSibling()){
        console.log("***IF TOP LEVEL: "+c.node.type.name);
        /*
         For some reason, if I don't cast it to "Any",
         I get a type error from TypeScript ):
         */
        switch(c.node.type.name as string){  
          case "elif": {
            console.log("  --CONFIRMED: "+s.substring(c.from, c.to));

            c.nextSibling(); //go to conditional expression
            let elifCondition : Expr = traverseExpr(c, s);
            console.log("   ---elif next sibling: "+s.substring(c.from, c.to));

            c.nextSibling(); //go to body
            console.log("   ---elif next next sibling: "+s.substring(c.from, c.to));

            c.firstChild(); //get first statement in body
            c.nextSibling(); //skip over colon
            console.log("   ---elif first child: "+s.substring(c.from, c.to));

            let elifBody : Array<Stmt> = [traverseStmt(c,s)];
            while (c.nextSibling()) {
              console.log("    ***ELIF STATEMENT:  "+s.substring(c.from, c.to));
              elifBody.push(traverseStmt(c,s));
            }

            c.parent();

            alternates.push({condition: elifCondition, body: elifBody, alters: new Array});
            break;
          }
          case "else": {
            console.log("  --CONFIRMED: "+s.substring(c.from, c.to));

            c.nextSibling(); //go to body
            console.log("   ---else next sibling: "+s.substring(c.from, c.to));

            c.firstChild(); //get first statement in body
            c.nextSibling(); //skip over colon
            console.log("   ---else first child: "+s.substring(c.from, c.to));

            let elifBody : Array<Stmt> = [traverseStmt(c,s)];
            while (c.nextSibling()) {
              console.log("    ***ELSE STATEMENT:  "+s.substring(c.from, c.to));
              elifBody.push(traverseStmt(c,s));
            }

            c.parent();

            alternates.push({condition: undefined, body: elifBody, alters: new Array});
            break;
          }       
        }
        //console.log("PROCEED COND: "+s.substring(c.from, c.to)+" type: "+c.node.type.name);
      }
      //console.log("ELIF?    |"+s.substring(c.from, c.to));

      c.parent(); //go back to parent
      return {tag: "cond", 
              ifStatement: {condition : firstIfCond, 
                            body : firstIfBody, 
                            alters : alternates}};
    }
    case "ReturnStatement": {
      c.firstChild();  //enter node and land on the return keyword
      c.nextSibling(); //jump to the target expression

      let targetExpr : Expr = traverseExpr(c, s);
      c.parent();

      return {tag: "ret", expr: targetExpr};
    }
    case "PassStatement": {
      return {tag: "pass"};
    }
    case "ExpressionStatement": {
      c.firstChild();
      const expr = traverseExpr(c, s);
      c.parent(); // pop going into stmt
      return { tag: "expr", expr: expr };
    }
    default:
      throw new Error("TYPE: "+c.node.type.name+" Could not parse stmt at " + c.node.from + " " + c.node.to + ": " + s.substring(c.from, c.to));
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
  let stmts:Array<Stmt> = traverse(t.cursor(), source);

  //DEV NOTE: This line should be in compiler.ts. But we put it here to test parser
  let builtins: Map<string, FuncIdentity> = new Map;
  builtins.set("print(object,)", {name: "print", paramType: [Type.Object], returnType: Type.None});
  builtins.set("abs(int,)", {name: "abs", paramType: [Type.Int], returnType: Type.Int});
  builtins.set("max(int,int,)", {name: "max", paramType: [Type.Int, Type.Int], returnType: Type.Int});
  builtins.set("min(int,int,)", {name: "min", paramType: [Type.Int, Type.Int], returnType: Type.Int});
  builtins.set("pow(int,int,)", {name: "pow", paramType: [Type.Int, Type.Int], returnType: Type.Int});

  let program: Program = organizeProgram(stmts, builtins);

  return stmts;
}
