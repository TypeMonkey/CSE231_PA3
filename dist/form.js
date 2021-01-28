import { BinOp, UniOp, Type, toString, funcSig, generateFuncSig } from "./ast";
/**
 * Organizes a list of statements into a
 * navigable Program, as well as checks
 * for cohency errors (missing variables/functions, etc)
 */
/**
* Looks up a vairable's type from a list of variable maps.
* If the varibale cannot be found, undefined is returned
*/
function lookup(targetVar, varMaps) {
    for (let vmap of varMaps) {
        if (vmap.has(targetVar)) {
            return vmap.get(targetVar);
        }
    }
    return undefined;
}
/**
 * Looks up a vairable's type from a list of variable maps.
 * If the varibale cannot be found, undefined is returned
 */
function flookup(fname, fpTypes, funcMap) {
    let fsig = generateFuncSig(fname, fpTypes);
    if (funcMap.has(fsig)) {
        return funcMap.get(fsig);
    }
    else {
        //account for None and object types
        const ofSameName = Array.from(funcMap.entries()).filter(x => x[1].name == fname &&
            x[1].paramType.length == fpTypes.length);
        for (let [_, iden] of ofSameName) {
            let incompatabilityFound = false;
            for (let i = 0; i < iden.paramType.length; i++) {
                const declaredType = iden.paramType[i];
                const receivedType = fpTypes[i];
                if (declaredType != Type.Object && declaredType != receivedType) {
                    incompatabilityFound = true;
                    break;
                }
            }
            if (!incompatabilityFound) {
                return iden;
            }
        }
        return undefined;
    }
}
export function checkExpr(expr, varMaps, funcMap) {
    switch (expr.tag) {
        case "None": return Type.None;
        case "Boolean": return Type.Bool;
        case "Number": return Type.Int;
        case "id": return lookup(expr.name, varMaps);
        case "uniexpr": {
            let targetType = checkExpr(expr.target, varMaps, funcMap);
            switch (expr.op) {
                case UniOp.Sub: {
                    if (targetType !== Type.Int) {
                        throw new Error("'" + UniOp.Sub + "' can only be applied on ints.");
                    }
                    return Type.Int;
                }
                case UniOp.Not: {
                    if (targetType !== Type.Bool) {
                        throw new Error("'" + UniOp.Not + "' can only be applied on bools.");
                    }
                    return Type.Bool;
                }
            }
        }
        case "bopexpr": {
            let leftType = checkExpr(expr.left, varMaps, funcMap);
            let rightType = checkExpr(expr.right, varMaps, funcMap);
            const equalityOps = new Set([BinOp.Equal, BinOp.NEqual]);
            const relational = new Set([BinOp.LEqual, BinOp.Less, BinOp.GEqual, BinOp.Great]);
            const arithOps = new Set([BinOp.Add, BinOp.Sub, BinOp.Mul, BinOp.Div, BinOp.Mul]);
            if (equalityOps.has(expr.op)) {
                if (leftType !== rightType) {
                    throw new Error("Both operands must be of the same time when using '" + expr.op + "'");
                }
                return Type.Bool;
            }
            else if ((relational.has(expr.op) || arithOps.has(expr.op))) {
                if (leftType !== Type.Int || rightType !== Type.Int) {
                    throw new Error("Both operands must be ints when using '" + expr.op + "'");
                }
                if (relational.has(expr.op)) {
                    return Type.Bool;
                }
                return Type.Int;
            }
            //this shouldn't throw, but it makes TypeScript happy
            throw new Error("Unknown operand? '" + expr.op + "'!");
        }
        case "funccall": {
            //get the types of all arguments
            let argTypes = new Array;
            for (let x of expr.args) {
                argTypes.push(checkExpr(x, varMaps, funcMap));
            }
            //now, create the function signature
            const target = flookup(expr.name, argTypes, funcMap);
            //see if this signature exists within the function map
            if (target !== undefined) {
                return target.returnType;
            }
            throw new Error("Unfound function with signature " + generateFuncSig(expr.name, argTypes));
        }
        case "nestedexpr": {
            return checkExpr(expr.nested, varMaps, funcMap);
        }
    }
}
export function checkStatement(stmt, varMaps, funcMap, expectedType) {
    switch (stmt.tag) {
        case "vardec": {
            //this shouldn't be triggered as variable declarations
            //should be processed when checking the function itself
            return { isElse: false, resType: Type.None };
        }
        case "funcdef": {
            //this shouldn't be triggered as function definitions
            //are top level.
            return { isElse: false, resType: Type.None };
        }
        case "assign": {
            let varType = lookup(stmt.name, varMaps);
            if (varType === undefined) {
                throw new Error("Unfound variable '" + stmt.name + "'.");
            }
            let valueType = checkExpr(stmt.value, varMaps, funcMap);
            if (varType !== valueType) {
                throw new Error("Mismatched type in assigning '" + stmt.name + "' with the value " + toString(stmt.value));
            }
            return { isElse: false, resType: valueType };
        }
        case "pass": {
            return { isElse: false, resType: Type.None };
        }
        case "cond": {
            //Check the type of the conditional
            if (stmt.ifStatement.condition !== undefined &&
                checkExpr(stmt.ifStatement.condition, varMaps, funcMap) !== Type.Bool) {
                /*
                "cond" is used to represent if, elif and else
                else has no condition so only check if and elif for their conditions
                 */
                throw new Error("Type of condition for if/elif statements must be bool.");
            }
            //Check the statements of the body
            let latestType = Type.None;
            for (let s of stmt.ifStatement.body) {
                const temp = checkStatement(s, varMaps, funcMap).resType;
                if (temp == expectedType) {
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
            for (let elif of stmt.ifStatement.alters) {
                const temp = checkStatement({ tag: "cond", ifStatement: elif }, varMaps, funcMap).resType;
                console.log("else? " + elif.condition + " | " + latestType);
                /*
                if(expectedType !== undefined &&
                    latestType !== expectedType){
                     throw new Error("Must return a value of '"+expectedType+"' in all paths");
                 }
                 */
                isElse = elif.condition === undefined;
                if (temp == expectedType) {
                    latestType = temp;
                }
            }
            return { isElse: isElse, resType: latestType };
        }
        case "whileloop": {
            let condType = checkExpr(stmt.cond, varMaps, funcMap);
            if (condType !== Type.Bool) {
                throw new Error("Type of condition for while-statements must be bool.");
            }
            //Check the statements of the body
            let latestType = Type.None;
            for (let s of stmt.body) {
                latestType = checkStatement(s, varMaps, funcMap).resType;
            }
            return { isElse: false, resType: latestType };
        }
        case "ret": {
            let exprType = checkExpr(stmt.expr, varMaps, funcMap);
            return { isElse: false, resType: exprType };
        }
        case "expr": {
            checkExpr(stmt.expr, varMaps, funcMap);
            return { isElse: false, resType: Type.None };
        }
    }
}
export function checkFunctionDef(funcDef, varMaps, funcMap) {
    //create a new variable map for this function.
    //Initialize it with function parameters
    let localScope = new Map;
    for (let [name, type] of Array.from(funcDef.params.entries())) {
        localScope.set(name, type);
    }
    //then, add on local vars and type check their values
    for (let [name, val] of Array.from(funcDef.varDefs.entries())) {
        let valueType = checkExpr(val.value, [localScope].concat(varMaps), funcMap);
        if (valueType !== val.varType) {
            throw new Error("'" + name + "' is of type " + val.varType + " but is being assigned a " + valueType);
        }
        localScope.set(name, val.varType);
    }
    //we'll now use a new varMaps with the localscope at the start
    const newVarMaps = [localScope].concat(varMaps);
    //a return statement may have been encountered already.
    //if so, there's no need to check other paths
    let returnType = Type.None; //if function returns None, no need to check return
    let elseEncoutnered = false;
    //check function body
    for (let funcState of funcDef.bodyStms) {
        switch (funcState.tag) {
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
            case "ret": {
                returnType = checkStatement(funcState, newVarMaps, funcMap, funcDef.identity.returnType).resType;
            }
            default: {
                const result = checkStatement(funcState, newVarMaps, funcMap, funcDef.identity.returnType);
                elseEncoutnered = result.isElse;
                if (elseEncoutnered && result.resType == funcDef.identity.returnType) {
                    returnType = result.resType;
                }
                console.log("eval return type: " + returnType + " | stmt type: " + funcState.tag);
                break;
            }
        }
    }
    if (returnType !== funcDef.identity.returnType) {
        throw new Error("The function '" + funcSig(funcDef.identity) + "' must have a return of '" + funcDef.identity.returnType + "' on all paths");
    }
}
export function organizeProgram(stmts, builtins) {
    //organize functions and global variables
    let globalVars = new Map;
    let globalFuncs = new Map;
    let topLevelStmts = new Array;
    //these maps are for type checking
    //we override builtin functions if a similar signature was declared
    let fileFuncs = new Map(builtins);
    //now, organize the top level statements
    for (let stmt of stmts) {
        switch (stmt.tag) {
            case "funcdef": {
                let sig = funcSig(stmt.def.identity);
                //check if function already exists
                if (globalFuncs.has(sig)) {
                    throw new Error("Already has function '" + sig + "'");
                }
                else {
                    globalFuncs.set(sig, stmt.def);
                    fileFuncs.set(sig, stmt.def.identity);
                }
                break;
            }
            case "vardec": {
                //check if variable already exists
                if (globalVars.has(stmt.name)) {
                    throw new Error("Already has global variable '" + stmt.name + "'");
                }
                else {
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
    let fileVars = new Map;
    for (let [name, val] of Array.from(globalVars.entries())) {
        let valueType = checkExpr(val.value, [fileVars], fileFuncs);
        if (valueType !== val.varType) {
            throw new Error("'" + name + "' is of type " + val.varType + " but is being assigned a " + valueType);
        }
        fileVars.set(name, valueType);
    }
    //check file functions
    for (let fdef of Array.from(globalFuncs.values())) {
        checkFunctionDef(fdef, [fileVars], fileFuncs);
    }
    return { fileVars: globalVars, fileFuncs: globalFuncs, topLevelStmts: topLevelStmts };
}
