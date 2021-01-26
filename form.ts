import { isIfStatement } from "typescript";
import {BinOp, 
    UniOp, 
    Expr, 
    Literal, 
    IfStatement, 
    Stmt, 
    FuncDef,
    Program,
    Type,
    toString,
    funcSig,
    generateFuncSig,
    VarDeclr} from "./ast";
import { traverseExpr, traverseStmt } from "./parser";

/**
 * Organizes a list of statements into a 
 * navigable Program, as well as checks
 * for cohency errors (missing variables/functions, etc)
 */


 /**
 * Looks up a vairable's type from a list of variable maps.
 * If the varibale cannot be found, undefined is returned
 */
function lookup(targetVar: string,
                varMaps: Array<Map<string, Type>>) : Type {
    for (let vmap of varMaps) {
        if(vmap.has(targetVar)){
            return vmap.get(targetVar);
        }
    }
    return undefined;
} 

export function checkExpr(expr: Expr,
    varMaps: Array<Map<string, Type>>,
    funcMap: Map<string, Type>) : Type {
    
    switch(expr.tag){
        case "None" : return Type.None;
        case "Boolean" : return Type.Bool;
        case "Number" : return Type.Int;
        case "id": return lookup(expr.name, varMaps);
        case "uniexpr": {
            let targetType : Type = checkExpr(expr.target, varMaps, funcMap);
            switch(expr.op){
                case UniOp.Sub: {
                    if(targetType !== Type.Int){
                        throw new Error("'"+UniOp.Sub+"' can only be applied on ints.");
                    }
                    return Type.Int;
                }
                case UniOp.Not: {
                    if(targetType !== Type.Bool){
                        throw new Error("'"+UniOp.Not+"' can only be applied on bools.");
                    }
                    return Type.Bool;
                }
            }
        }
        case "bopexpr": {
            let leftType : Type = checkExpr(expr.left, varMaps, funcMap);
            let rightType : Type = checkExpr(expr.right, varMaps, funcMap);

            const equalityOps = new Set([BinOp.Equal, BinOp.NEqual]);
            const relational = new Set([BinOp.LEqual, BinOp.Less, BinOp.GEqual, BinOp.Great]);
            const arithOps = new Set([BinOp.Add, BinOp.Sub, BinOp.Mul, BinOp.Div, BinOp.Mul]);

            if(equalityOps.has(expr.op)){
               if(leftType !== rightType){
                  throw new Error("Both operands must be of the same time when using '"+expr.op+"'");
               }
               return Type.Bool;
            }
            else if((relational.has(expr.op) || arithOps.has(expr.op))){
                if(leftType !== Type.Int || rightType !== Type.Int){
                    throw new Error("Both operands must be ints when using '"+expr.op+"'");
                }
                
                if(relational.has(expr.op)){
                    return Type.Bool;
                }
                return Type.Int;
            }

            //this shouldn't throw, but it makes TypeScript happy
            throw new Error("Unknown operand? '"+expr.op+"'!");
        }
        case "funccall": {
            //get the types of all arguments
            let argTypes : Array<Type> = new Array;
            for(let x of expr.args){
                argTypes.push(checkExpr(x, varMaps, funcMap));
            }

            //now, create the function signature
            const fSig = generateFuncSig(expr.name, argTypes);

            //see if this signature exists within the function map
            if(funcMap.has(fSig)){
                return funcMap.get(fSig);
            }

            throw new Error("Unfound function with signature "+fSig);
        }
        case "nestedexpr": {
            return checkExpr(expr.nested, varMaps, funcMap);
        }
    }
}

export function checkStatement(stmt: Stmt,
                               varMaps: Array<Map<string, Type>>,
                               funcMap: Map<string, Type>,
                               expectedType?: Type) : 
                               {isElse: boolean, resType: Type} {
    switch(stmt.tag){
        case "vardec": {
            //this shouldn't be triggered as variable declarations
            //should be processed when checking the function itself
            return {isElse: false, resType: Type.None};
        }
        case "funcdef":{
            //this shouldn't be triggered as function definitions
            //are top level.
            return {isElse: false, resType: Type.None};
        }
        case "assign": {
            let varType : Type = lookup(stmt.name, varMaps);
            if(varType === undefined){
                throw new Error("Unfound variable '"+stmt.name+"'.");
            }

            let valueType : Type = checkExpr(stmt.value, varMaps, funcMap);
            if(varType !== valueType){
                throw new Error("Mismatched type in assigning '"+stmt.name+"' with the value "+toString(stmt.value));
            }

            return {isElse: false, resType: valueType};
        }
        case "pass": {return {isElse: false, resType: Type.None}}
        case "cond": {
            //Check the type of the conditional

            if(stmt.ifStatement.condition !== undefined && 
               checkExpr(stmt.ifStatement.condition, varMaps, funcMap) !== Type.Bool){
                /*
                "cond" is used to represent if, elif and else
                else has no condition so only check if and elif for their conditions
                 */
                throw new Error("Type of condition for if/elif statements must be bool.");
            }

            //Check the statements of the body
            let latestType = Type.None;
            for(let s of stmt.ifStatement.body){
                const temp = checkStatement(s, varMaps, funcMap).resType;

                if(temp == expectedType){
                    latestType = temp;
                }
            }

            /*
            if(expectedType !== undefined &&
               latestType !== expectedType){
                throw new Error("Must return a value of '"+expectedType+"' in all paths");
            }

            if(stmt.ifStatement.alters.length == 0){
                return latestType;
            }
            */

            let isElse = false;
            //now check proceeding elifs, if any
            for(let elif of stmt.ifStatement.alters){
                const temp = checkStatement({tag: "cond", ifStatement: elif}, varMaps, funcMap).resType;
                console.log("else? "+elif.condition+" | "+latestType);

                /*
                if(expectedType !== undefined &&
                    latestType !== expectedType){
                     throw new Error("Must return a value of '"+expectedType+"' in all paths");
                 }
                 */
                isElse = elif.condition === undefined;
                if(temp == expectedType){
                    latestType = temp;
                }
            }

            return {isElse: isElse, resType: latestType};
        }
        case "whileloop":{
            let condType : Type = checkExpr(stmt.cond, varMaps, funcMap);
            if(condType !== Type.Bool){
                throw new Error("Type of condition for while-statements must be bool.");
            }
            
            //Check the statements of the body
            let latestType = Type.None;
            for(let s of stmt.body){
                latestType = checkStatement(s, varMaps, funcMap).resType;
            }

            return {isElse: false, resType: latestType};
        }
        case "ret":{
            let exprType : Type = checkExpr(stmt.expr, varMaps, funcMap);
            return {isElse: false, resType: exprType};
        }
        case "expr":{
            checkExpr(stmt.expr, varMaps, funcMap)
            return {isElse: false, resType: Type.None};
        }
    }
}

export function checkFunctionDef(funcDef: FuncDef,
    varMaps: Array<Map<string, Type>>,
    funcMap: Map<string, Type>) {
    
    //create a new variable map for this function.
    //Initialize it with function parameters
    let localScope : Map<string, Type> = new Map;
    
    for(let [name, type] of Array.from(funcDef.params.entries())){
        localScope.set(name, type);
    }

    //then, add on local vars and type check their values
    for(let [name, val] of Array.from(funcDef.varDefs.entries())){
        let valueType = checkExpr(val.value, [localScope].concat(varMaps), funcMap);
        if(valueType !== val.varType){
            throw new Error("'"+name+"' is of type "+val.varType+" but is being assigned a "+valueType);
        }

        localScope.set(name, val.varType);
    }

    //we'll now use a new varMaps with the localscope at the start
    const newVarMaps = [localScope].concat(varMaps);

    //a return statement may have been encountered already.
    //if so, there's no need to check other paths
    let returnType = Type.None;  //if function returns None, no need to check return

    let elseEncoutnered = false;

    //check function body
    for(let funcState of funcDef.bodyStms){
        switch(funcState.tag){
            /*
            case "whileloop": {
                returnType = checkStatement(funcState, newVarMaps, funcMap, funcDef.retType);
                break;
            }
            case "cond": {
                returnType = checkStatement(funcState, newVarMaps, funcMap, funcDef.retType);
                break;
            }
            */
            case "ret":{
                returnType = checkStatement(funcState, newVarMaps, funcMap, funcDef.retType).resType;
            }
            default: {
                const result = checkStatement(funcState, newVarMaps, funcMap, funcDef.retType);
                elseEncoutnered = result.isElse;
                if(elseEncoutnered && result.resType == funcDef.retType){
                    returnType = result.resType;
                }

                console.log("eval return type: "+returnType+" | stmt type: "+funcState.tag);
                break;
            }
        }
    }

    if(returnType !== funcDef.retType){
        throw new Error("The function '"+funcSig(funcDef)+"' must have a return of '"+funcDef.retType+"' on all paths");
    }
}

export function organizeProgram(stmts: Array<Stmt>) : Program {
    //organize functions and global variables
    let globalVars : Map<string, VarDeclr> = new Map;
    let globalFuncs : Map<string, FuncDef> = new Map;
    let topLevelStmts : Array<Stmt> = new Array;

    //these maps are for type checking
    let fileFuncs : Map<string, Type> = new Map;

    //now, organize the top level statements
    for (let stmt of stmts) {
        switch(stmt.tag){
            case "funcdef": {
                let sig : string = funcSig(stmt.def);

                //check if function already exists
                if(globalFuncs.has(sig)){
                    throw new Error("Already has function '"+sig+"'");
                }
                else{
                    globalFuncs.set(sig, stmt.def);
                    fileFuncs.set(sig, stmt.def.retType);
                }
                break;
            }
            case "vardec": {
                //check if variable already exists
                if(globalVars.has(stmt.name)){
                    throw new Error("Already has global variable '"+stmt.name+"'");
                }
                else{
                    globalVars.set(stmt.name, stmt.info);
                }
                break;
            }
            default: {
                topLevelStmts.push(stmt);
                break;
            }
        }
    }

    //now, check functions and variables

    //check global variables
    let fileVars : Map<string, Type> = new Map;

    for(let [name, val] of Array.from(globalVars.entries())){
        let valueType = checkExpr(val.value, [fileVars], fileFuncs);
        if(valueType !== val.varType){
            throw new Error("'"+name+"' is of type "+val.varType+" but is being assigned a "+valueType);
        }

        fileVars.set(name, valueType);
    }

    //check file functions
    for(let fdef of Array.from(globalFuncs.values())){
        checkFunctionDef(fdef, [fileVars], fileFuncs);
    }

    return {fileVars : globalVars, fileFuncs: globalFuncs, topLevelStmts: topLevelStmts};
}

