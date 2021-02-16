import { isIfStatement } from "typescript";
import {BinOp, 
    UniOp, 
    Expr, 
    Literal, 
    Stmt, 
    FuncDef,
    Program,
    Type,
    FuncIdentity,
    toString,
    identityToFSig,
    funcCallToFSig,
    VarDeclr,
    NativeTypes,
    typeToString,
    ClassDef,
    toStringStmt} from "./ast";
import { traverseExpr, traverseStmt } from "./parser";

/**
 * Organizes a list of statements into a 
 * navigable Program, as well as checks
 * for cohency errors (missing variables/functions, etc)
 */

 /**
  * Houses file variables, functions and classes
  */
export type GlobalTable = {
    funcMap: Map<string, FuncIdentity>,
    classMap: Map<string, ClassDef>,
    varMap: Map<string, Type>
}

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

function isAssignable(destType: Type, sourceType: Type) : boolean{
    if(destType.tag === "none"){
        return sourceType.tag === "none";
    }

    if(destType.tag === "class"){
        return (destType.name === "object") || 
               (sourceType.tag === "none") || 
               (sourceType.tag === "class" && sourceType.name === destType.name)
    }
    else{
        return destType.tag === sourceType.tag;
    }
}

/**
 * Looks up a vairable's type from a list of variable maps.
 * If the varibale cannot be found, undefined is returned
 */
function flookup(fname: string, fpTypes: Array<Type>,
                 funcMap: Map<string, FuncIdentity>) : FuncIdentity {
    let fsig = funcCallToFSig(fname, fpTypes);

    if(funcMap.has(fsig)){
        return funcMap.get(fsig);
    }
    else{
        //account for None and object types
        const ofSameName = Array.from(
                             funcMap.entries()).filter(
                                 x => x[1].name == fname && 
                                      x[1].paramType.length == fpTypes.length);
        
        for(let [ x , iden] of ofSameName){
            console.log("candidate: "+x);
            let incompatabilityFound = false;

            for(let i = 0; i < iden.paramType.length; i++){
                const declaredType = iden.paramType[i];
                const receivedType = fpTypes[i];

                if( (declaredType.tag === "class" && 
                    ( ( (receivedType.tag === "none") || 
                       (receivedType.tag === "class" && receivedType.name === declaredType.name) ) || 
                     (declaredType.name === "object") ) ) || 

                    (declaredType.tag === receivedType.tag)){
                    continue;
                }
                else{
                    incompatabilityFound = true;
                    break;
                }
            }

            if(!incompatabilityFound){
                return iden;
            }
        }

        return undefined;
    }
} 

function checkReturn(body: Array<Stmt>, expectedReturnType: Type) : boolean {
    if(body.length >= 1){
        const lastStatemnt = body[body.length - 1];
        if(lastStatemnt.tag === "ret"){
            console.log(`----checking return: `+typeToString(expectedReturnType)+" | "+typeToString(lastStatemnt.expr.type));
            return isAssignable(expectedReturnType, lastStatemnt.expr.type);
        }
        else if(lastStatemnt.tag === "ifstatement"){
            return checkReturn(lastStatemnt.trueBranch, expectedReturnType) && 
                   checkReturn(lastStatemnt.falseBranch, expectedReturnType);
        }
    }
    return false;
}

export function checkExpr(expr: Expr,
    varMaps: Array<Map<string, Type>>,
    globalTable: GlobalTable) : Type {
    
    switch(expr.tag){
        case "value": {
            switch(expr.value.tag){
                case "None" : {expr.type = {tag: "none"}; return expr.type};
                case "Boolean" : {expr.type = {tag: "bool"}; return expr.type};
                case "Number" : {expr.type = {tag: "number"}; return expr.type};
            }
        }
        case "id": {
            const idType = lookup(expr.name, varMaps);

            console.log("---------ID TYPECHECK: "+typeToString(idType)+" of "+expr.name);

            if(idType === undefined){
                throw new Error(`Unfound variable ${expr.name}.`);
            }

            expr.type = idType;
            return expr.type;
        }
        case "uniexpr": {
            let targetType : Type = checkExpr(expr.target, varMaps, globalTable);
            switch(expr.op){
                case UniOp.Sub: {
                    if(targetType.tag !== "number"){
                        throw new Error("'"+UniOp.Sub+"' can only be applied on ints.");
                    }
                    break;
                }
                case UniOp.Not: {
                    if(targetType.tag !== "bool"){
                        throw new Error("'"+UniOp.Not+"' can only be applied on bools.");
                    }
                    break;
                }
            }

            expr.type = expr.target.type;

            return expr.type;
        }
        case "bopexpr": {
            let leftType : Type = checkExpr(expr.left, varMaps, globalTable);
            let rightType : Type = checkExpr(expr.right, varMaps, globalTable);

            const equalityOps = new Set([BinOp.Equal, BinOp.NEqual]);
            const relational = new Set([BinOp.LEqual, BinOp.Less, BinOp.GEqual, BinOp.Great]);
            const arithOps = new Set([BinOp.Add, BinOp.Sub, BinOp.Mul, BinOp.Div, BinOp.Mul]);

            if(expr.op === BinOp.Is){
                if(leftType.tag === "bool" || leftType.tag === "number" || 
                   rightType.tag === "bool" || rightType.tag === "number"){
                    throw new Error("'is' operator can only be used on class instances!");
                }

                return {tag: "bool"};
            }
            else if(equalityOps.has(expr.op)){
               if(leftType !== rightType){
                  throw new Error("Both operands must be of the same time when using '"+expr.op+"'");
               }

               expr.type = {tag: "bool"}
               return expr.type;
            }
            else if((relational.has(expr.op) || arithOps.has(expr.op))){
                if(leftType.tag !== "number" || rightType.tag !== "number"){
                    throw new Error("Both operands must be ints when using '"+expr.op+"'");
                }
                
                if(relational.has(expr.op)){
                    expr.type = {tag: "bool"}
                    return expr.type;
                }

                expr.type = {tag: "number"}
                return expr.type;
            }

            //this shouldn't throw, but it makes TypeScript happy
            throw new Error("Unknown operand? '"+expr.op+"'!");
        }
        case "funccall": {
            //get the types of all arguments
            let argTypes : Array<Type> = new Array;
            for(let x of expr.args){
                argTypes.push(checkExpr(x, varMaps, globalTable));
            }

            console.log("funccall!!! "+toString(expr)+" | "+Array.from(globalTable.funcMap.keys()).join());

            //now, create the function signature
            const target = flookup(expr.name, argTypes, globalTable.funcMap);           

            //see if this signature exists within the function map
            if(target !== undefined){
                expr.callee = target;
                expr.type = target.returnType;
                expr.isConstructor = false;
                return expr.type;
            }
            else{
                //if function is not found, check if function call is to constructor
                if(globalTable.classMap.has(expr.name)){
                    //contructor call!
                    expr.callee = {name: expr.name, paramType: new Array, returnType: {tag: "class", name: expr.name}};
                    expr.type = {tag: "class", name: expr.name};
                    expr.isConstructor = true;
                    return expr.type;
                }
            }

            throw new Error("Unfound function with signature "+funcCallToFSig(expr.name, argTypes));
        }
        case "attrderef": {
            const targetType = checkExpr(expr.target, varMaps, globalTable);
            const targetTypeStr = typeToString(targetType);

            if(targetType.tag === "class" && targetTypeStr !== "object"){
                const targetClass = globalTable.classMap.get(targetType.name);
                if(targetClass === undefined){
                    throw new Error(`Cannot find the type ${targetTypeStr}`);
                }

                const attrType = targetClass.classVars.get(expr.attrName);
                if(attrType === undefined){
                    throw new Error(`Cannot find the attribute ${expr.attrName} on instance of ${targetTypeStr}`);
                }

                expr.type = attrType.varDec.varType;
                return expr.type;
            }
            
            throw new Error(`The type ${typeToString(targetType)} has no attributes! ${toString(expr)}`);
        }
        case "methodderef" : {
            const targetType = checkExpr(expr.target, varMaps, globalTable);
            const targetTypeStr = typeToString(targetType);

            if(targetType.tag === "class" && targetTypeStr !== "object"){
                const targetClass = globalTable.classMap.get(targetType.name);
                if(targetClass === undefined){
                    throw new Error(`Cannot find the type ${targetTypeStr}`);
                }

                //this first argument is the "self" argument for methods
                const argTypes : Array<Type> = [{tag: "class", name: targetClass.name}];
                for(let x of expr.args){
                    argTypes.push(checkExpr(x, varMaps, globalTable));
                }

                const instanceMethodMap : Map<string, FuncIdentity> = new Map;
                console.log(`-----FOR CLASS ${targetClass.name}, method count ${targetClass.methods.size}`);
                for(let [sig, def] of Array.from(targetClass.methods.entries())){
                    console.log("----loading class method: "+sig);
                    instanceMethodMap.set(sig, def.identity);
                }

                const callIdentity: FuncIdentity = {name: expr.name, paramType: argTypes, returnType: undefined};
                const target = flookup(expr.name, argTypes, instanceMethodMap);
                if(target === undefined){
                    throw new Error(`Cannot find method ${identityToFSig(callIdentity)} on instance of ${targetTypeStr}`);
                }

                expr.callee = target; //set callee for compilation purposes
                expr.type = target.returnType;

                return expr.type;
            }
            
            throw new Error(`The type ${typeToString(targetType)} has no methods!`);
        }
        case "nestedexpr": {
            return checkExpr(expr.nested, varMaps, globalTable);
        }
    }
}

export function checkStatement(stmt: Stmt,
                               varMaps: Array<Map<string, Type>>,
                               globalTable: GlobalTable) : Type {
    switch(stmt.tag){
        case "vardec": {
            //this shouldn't be triggered as variable declarations
            //should be processed when checking the function itself
            return {tag: "none"};
        }
        case "funcdef":{
            //this shouldn't be triggered as function definitions
            //are top level.
            return {tag: "none"};
        }
        case "assign": {
            let varType : Type = lookup(stmt.name, varMaps);
            if(varType === undefined){
                throw new Error("Unfound variable '"+stmt.name+"'. "+toString(stmt.value));
            }

            let valueType : Type = checkExpr(stmt.value, varMaps, globalTable);
            if(!isAssignable(varType, valueType)){
                throw new Error("Mismatched type in assigning '"+stmt.name+"' with the value "+toString(stmt.value));
            }

            return {tag: "none"};
        }
        case "attrassign" : {       
            const targetType = checkExpr(stmt.target, varMaps, globalTable);
            const targetTypeStr = typeToString(targetType);

            if(targetType.tag === "class" && targetTypeStr !== "object"){
                const targetClass = globalTable.classMap.get(targetType.name);
                if(targetClass === undefined){
                    throw new Error(`Cannot find the type ${targetTypeStr}`);
                }

                const attrType = targetClass.classVars.get(stmt.attr);
                if(attrType === undefined){
                    throw new Error(`Cannot find the attribute ${stmt.attr} on instance of ${targetTypeStr}`);
                }

                const newValue = checkExpr(stmt.value, varMaps, globalTable);
                if(!isAssignable(attrType.varDec.varType, newValue)){
                    throw new Error("Mismatched type in assigning attribute '"+stmt.attr+"' of "+targetTypeStr+"with the value "+toString(stmt.value));
                }

                return {tag: "none"};
            }
            
            throw new Error(`The type ${typeToString(targetType)} has no attributes!`);
        }
        case "pass": return {tag: "none"};
        case "ifstatement": {
            //Check the type of the conditional

            if(checkExpr(stmt.cond, varMaps, globalTable).tag !== "bool"){
                /*
                "cond" is used to represent if, elif and else
                else has no condition so only check if and elif for their conditions
                 */
                throw new Error("Type of condition for if statements must be bool.");
            }

            //Check the statements of the true branch
            for(let s of stmt.trueBranch){
                checkStatement(s, varMaps, globalTable);   
            }

            //check the false branch
            for(let s of stmt.falseBranch){
                checkStatement(s, varMaps, globalTable);
            }

            return {tag: "none"};
        }
        case "ret":{
            const exprType : Type = checkExpr(stmt.expr, varMaps, globalTable);
            return exprType;
        }
        case "expr":{
            const exprType = checkExpr(stmt.expr, varMaps, globalTable)
            return exprType;
        }
    }
}

export function checkFunctionDef(funcDef: FuncDef, globalTable: GlobalTable) {
    
    //create a new variable map for this function.
    //Initialize it with function parameters
    let localScope : Map<string, Type> = new Map;
    
    for(let [name, type] of Array.from(funcDef.params.entries())){
        localScope.set(name, type);
    }

    //then, add on local vars and type check their values
    for(let [name, val] of Array.from(funcDef.varDefs.entries())){
        let valueType = checkExpr(val.value, [localScope].concat(globalTable.varMap), globalTable);
        if(!isAssignable(val.varType, valueType)){
            throw new Error(`'${name}' is of type ${typeToString(val.varType)} but is being assigned a ${typeToString(valueType)}`);
        }

        console.log("----ADDING LOCAL VAR TO FUNC MAP: "+name);
        localScope.set(name, val.varType);
    }

    //we'll now use a new varMaps with the localscope at the start
    const newVarMaps = [localScope].concat(globalTable.varMap);

    //a return statement may have been encountered already.
    //if so, there's no need to check other paths
    let returnType: Type = {tag: "none"};  //if function returns None, no need to check return

    //check function body
    for(let funcState of funcDef.bodyStms){
        checkStatement(funcState, newVarMaps, globalTable);
    }

    if(funcDef.identity.returnType.tag !== "none" && !checkReturn(funcDef.bodyStms, funcDef.identity.returnType)){
        console.log(" recent return type: "+funcDef.identity.returnType.tag);
        throw new Error("The function '"+identityToFSig(funcDef.identity)+"' must have a return of '"+typeToString(funcDef.identity.returnType)+"' on all paths");
    }
}

export function checkClassDef(classDef: ClassDef, globalTable: GlobalTable) {

    //check instance variables
    let classScope : Map<string, Type> = new Map;

    for(let [name, val] of Array.from(classDef.classVars)){
        const valType = checkExpr(val.varDec.value, [classScope], globalTable);
        if(!isAssignable(val.varDec.varType, valType)){
            throw new Error("Incompatible assignment to '"+typeToString(val.varDec.varType)+"' from '"+typeToString(valType)+"'");
        }

        classScope.set(name, val.varDec.varType);
    }

    //check instance methods
    for(let fdef of Array.from(classDef.methods.values())){
        if(fdef.params.has("self") && 
           typeToString(fdef.params.get("self")) === classDef.name){
           console.log("========TYPECHECKING INSTANCE METH: "+identityToFSig(fdef.identity));
           checkFunctionDef(fdef, globalTable);
        }
        else{
            throw new Error(`Instance method need a 'self' parameter for method `+identityToFSig(fdef.identity));
        }
    }
}

export function organizeProgram(stmts: Array<Stmt>, 
                                existingGlobals: GlobalTable) : Program {

    //organize functions and global variables
    let globalVars : Map<string, Type> = new Map(existingGlobals.varMap === undefined ? new Map : existingGlobals.varMap);
    let globalFuncs : Map<string, FuncIdentity> = new Map(existingGlobals.funcMap === undefined ? new Map : existingGlobals.funcMap);
    let globalClasses : Map<string, ClassDef> = new Map(existingGlobals.classMap === undefined ? new Map : existingGlobals.classMap);
    let topLevelStmts : Array<Stmt> = new Array;

    //these maps are for type checking
    //we override builtin functions if a similar signature was declared
    let fileFuncs : Map<string, FuncDef> = new Map;
    let fileVars : Map<string, VarDeclr> = new Map;

    let classTypeCode = 0;

    //now, organize the top level statements
    for (let stmt of stmts) {
        switch(stmt.tag){
            case "classdef": {
                const classDef = stmt.def;
                if(globalClasses.has(classDef.name)){
                    throw new Error("Already has class names '"+classDef.name+"'");
                }

                stmt.def.typeCode = classTypeCode;
                classTypeCode++;
                globalClasses.set(classDef.name, classDef);
                break;
            }
            case "funcdef": {
                //class methods are parsed as top-level functions.
                //we need to check each top-level function and check if:
                // - if they have a "self" parameter 
                // - if they have a "self" parameter, get the host class through the self's type annotation

                let sig : string = identityToFSig(stmt.def.identity);

                //check if function already exists
                if(fileFuncs.has(sig)){
                    throw new Error("Already has function '"+sig+"'");
                }
                else if(stmt.def.params.has("self")){
                    console.log(` -----TC METHOD ATTACH ${sig} hostDec? ${typeToString(stmt.def.params.get("self"))} ${Array.from(globalClasses.keys())}`);
                    const hostClass = globalClasses.get(typeToString(stmt.def.params.get("self")));
                    
                    if(hostClass.methods.has(sig)){
                        throw new Error(`The class ${hostClass.name} already has function ${sig}`);
                    }

                    hostClass.methods.set(sig, stmt.def);
                }
                else{
                    globalFuncs.set(sig, stmt.def.identity);
                    fileFuncs.set(sig, stmt.def);
                }
                break;
            }
            case "vardec": {
                //check if variable already exists
                if(globalVars.has(stmt.name)){
                    throw new Error("Already has global variable '"+stmt.name+"'");
                }
                else{
                    console.log(`----SETTING GLOBAL VAR ${stmt.name} with type ${typeToString(stmt.info.varType)}`);
                    globalVars.set(stmt.name, stmt.info.varType);
                    fileVars.set(stmt.name, stmt.info);
                }
                break;
            }
            default: {
                console.log("-----TOP LEVEL STATEMENTS: "+toStringStmt(stmt));
                topLevelStmts.push(stmt);
                break;
            }
        }
    }

    //now, check functions and variables
    const globalEnv : GlobalTable = {funcMap: globalFuncs, 
                                     varMap: new Map, 
                                     classMap: globalClasses};

    //check global variables
    for(let [name, val] of Array.from(fileVars.entries())){
        console.log(`====> CHECKING GVAR ${name}`);
        let valueType = checkExpr(val.value, [globalEnv.varMap], globalEnv);
        if(!isAssignable(val.varType, valueType)){
            throw new Error("'"+name+"' is of type "+typeToString(val.varType)+" but is being assigned a "+valueType);
        }

        globalEnv.varMap.set(name, val.varType);
    }

    //check file functions
    for(let fdef of Array.from(fileFuncs.values())){
        checkFunctionDef(fdef, globalEnv);
    }

    //check classes
    for(let cdef of Array.from(globalClasses.values())){
        checkClassDef(cdef, globalEnv);
    }

    //check script statements
    for(let stmt of topLevelStmts){
        console.log(" ----typechking statement with varmap: "+Array.from(globalEnv.varMap.keys())+" | stmt tag: "+stmt.tag);
        checkStatement(stmt, [globalEnv.varMap], globalEnv);
    }

    return {fileVars : fileVars, 
            fileFunctions: fileFuncs,
            fileClasses: globalClasses, 
            topLevelStmts: topLevelStmts};
}

