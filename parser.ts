import {parser} from "lezer-python";
import {stringInput, TreeCursor} from "lezer-tree";
import { Stats } from "mocha";
import {BinOp, 
        UniOp, 
        Expr, 
        Literal, 
        Stmt, 
        FuncDef,
        Program,
        FuncIdentity,
        NativeTypes, 
        toString,
        VarDeclr,
        Type,
        identityToFSig} from "./ast";
import { organizeProgram } from "./tc";

export function traverseExpr(c : TreeCursor, s : string) : Expr {

  //console.log("CURRENT TYPE: "+c.type.name+" | TARGET: "+s);

  switch(c.type.name) {
    case "Number":        return {tag: "value", value: {tag: "Number", value: BigInt(s.substring(c.from, c.to))}};
    case "Boolean":       return {tag: "value", value: {tag: "Boolean", value: Boolean(s.substring(c.from, c.to).toLocaleLowerCase())}};
    case "VariableName":  return {tag: "id", name: s.substring(c.from, c.to)};
    case "None":          return {tag: "value", value: {tag: "None"}};
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
    case "MemberExpression":{
      c.firstChild(); //goes into dereferemce, starting at the target of the dereference

      let targetExpr : Expr = traverseExpr(c, s); //parse the target

      c.nextSibling(); //skip over the dot "."
      c.nextSibling(); //goes to the name of the attribute

      let attrName : string = s.substring(c.to, c.from);

      c.parent(); //goes back to parent
      return {tag: "attrderef", target: targetExpr, attrName: attrName};
    }
    case "CallExpression": {
      console.log(" ==> In CallExpression");
      c.firstChild();
      console.log("    * first child: "+c.type.name);

      let callTarget : Expr = traverseExpr(c, s);
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

      if(callTarget.tag === "attrderef"){
        return {tag: "methodderef", target: callTarget.target, name: callTarget.attrName, args: callArgs};
      }
      else if(callTarget.tag === "id"){
        return {tag: "funccall", name : callTarget.name, args: callArgs}; 
      }

      throw new Error("Unknown target of call: "+callTarget.tag);
    }
    default:
      //DEV NOTE: This is problematic but fixes a lot of problems
      throw new Error("f Could not parse expr at " + c.from + " " + c.to + ": " + s.substring(c.from, c.to)+" | "+c.type.name);
  }
}

export function traverseStmt(c : TreeCursor, s : string) : Stmt {

  console.log("stmt cur state?: "+c.node.type.name);

  switch(c.node.type.name) {
    case "ClassDefinition":{
      c.firstChild();

      c.nextSibling(); //skips over "class" keyword
      const className : string = s.substring(c.from, c.to);
      c.nextSibling(); //moves on from the class name to the arg list
      c.nextSibling(); //skips over the parent arg list. 

      c.firstChild(); //goes into the class body, landing at the colon ":"
      c.nextSibling(); //goes to the first class component 

      let methods : Map<string, FuncDef> = new Map;
      let variables : Map<string, {index: number, varDec: VarDeclr}> = new Map;

      console.log(`----PARSING CLASS ${className} , cur: ${c.node.type.name}`);

      let attrIndex = 0;

      do{
        let classComponent : Stmt = traverseStmt(c, s);

        console.log(`   ==> method or var ${classComponent.tag}`);

        if(classComponent.tag === "funcdef"){
          if(methods.has(identityToFSig(classComponent.def.identity))){
            throw new Error(`The class ${className} already has a function ${identityToFSig(classComponent.def.identity)}`);
          }
          methods.set(identityToFSig(classComponent.def.identity), classComponent.def);
        }
        else if(classComponent.tag === "vardec"){
          if(variables.has(classComponent.name)){
            throw new Error(`The class ${className} already has an attribute ${classComponent.name}`);
          }

          console.log(`----PARSING CLASS ${className} - var: ${classComponent.name}`);

          variables.set(classComponent.name, {index: attrIndex, varDec: classComponent.info});
          attrIndex++;
        }
      } while(c.nextSibling())

      c.parent();

      c.parent();

      return {tag: "classdef", def: {name: className, classVars: variables, methods: methods}};
    }
    case "AssignStatement": {
      console.log("**** ASSIGN? "+s.substring(c.from, c.to));

      c.firstChild(); //goes into AssignStatement, landing on the variable name
      if(c.node.type.name as string === "MemberExpression"){
        //this is an attribute change

        const leftHand = traverseExpr(c,s);
        c.nextSibling(); //skips over equal sign
        c.nextSibling();
        const rightHand = traverseExpr(c,s);
        c.parent();

        if(leftHand.tag !== "attrderef"){
          throw new Error("Unknown attribute assignment expression!");
        }

        return {tag: "attrassign", target: leftHand.target, attr: leftHand.attrName, value: rightHand};
      }
      else{
        let varName: string = s.substring(c.from, c.to);

        c.nextSibling(); //maybe a TypeDef or AssignOp
        let localVarType : Type = undefined;
        if(c.node.type.name as string === "TypeDef"){
          //this is a local variable declaration.
          c.firstChild(); //goes into TypeDef and lands on ":"

          c.nextSibling(); //goes to type name
          const lvarTypeName = s.substring(c.from, c.to);
          switch(lvarTypeName){
            case NativeTypes.Int : {localVarType = {tag: "number"}; break;}
            case NativeTypes.Bool : {localVarType = {tag: "bool"}; break;}
            default: {localVarType = {tag: "class", name: lvarTypeName}};
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
          if(lvarValue.tag !== "value"){
            throw new Error(`Variable declarations must be initialized with literals, for variable '${varName}'`);
          }

          return {tag: "vardec", name: varName, info: {varType: localVarType, value: lvarValue}};
        }
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
              case NativeTypes.Int : {params.set(tempParamName, {tag: "number"}); break;}
              case NativeTypes.Bool : {params.set(tempParamName, {tag: "bool"}); break;}
              default: {params.set(tempParamName, {tag: "class", name: tempParamType});};
            }

            c.parent();
          }
        }
        c.nextSibling();
      }
      c.parent();  //go back to parent, from ParamList

      c.nextSibling(); //next node should either be a TypeDef or Body
      let returnType : Type = {tag: "none"};
      if(c.node.type.name as string === "TypeDef"){
        c.firstChild(); //lands on arrow
        c.nextSibling(); //goes to actual type

        let rawReturnType: string = s.substring(c.from, c.to);
        switch(rawReturnType){
          case NativeTypes.Int : {returnType = {tag: "number"}; break;}
          case NativeTypes.Bool : {returnType = {tag: "bool"}; break;}
          default: {returnType = {tag: "class", name: rawReturnType}}
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
                case NativeTypes.Int : {localVarType = {tag: "number"}; break;}
                case NativeTypes.Bool : {localVarType = {tag: "bool"}; break;}
                default: {localVarType = {tag: "class", name: lvarTypeName}};
              }

              c.parent();
              c.nextSibling();

              console.log("      -> is local var dec: "+c.node.type.name);
            }

            c.nextSibling(); //value of the variable 
            let lvarValue : Expr =  traverseExpr(c,s);

            if(lvarValue.tag !== "value"){
              throw new Error(`Variable declarations must be initialized with literals, for variable '${varName}'`);
            }

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
    case "IfStatement": {
      c.firstChild(); //goes to "if" keyword

      c.nextSibling(); //goes to condition
      const condition = traverseExpr(c,s);

      c.nextSibling(); //goes to true branch's body
      c.firstChild();  //goes into true branch's body, starting at the semicolon
      const trueBranch: Array<Stmt> = new Array;
      while(c.nextSibling()){
        const trueBStmt = traverseStmt(c,s);
        trueBranch.push(trueBStmt);
      }
      c.parent(); //goes back to if-statement node

      c.nextSibling(); //goes to else statement
      console.log("----BACK TO ELSE: "+c.node.type.name);
      c.nextSibling(); //goes to false branch's body
      c.firstChild();  //goes into true branch's body, starting at the semicolon
      const falseBranch: Array<Stmt> = new Array;
      while(c.nextSibling()){
        const falseBStmt = traverseStmt(c,s);
        falseBranch.push(falseBStmt);
      }
      c.parent();


      c.parent();
      return {tag: "ifstatement", 
              cond: condition,
              trueBranch: trueBranch,
              falseBranch: falseBranch};
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
  return stmts;
}
