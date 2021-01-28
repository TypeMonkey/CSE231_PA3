import { BinOp, Type, funcSig } from "./ast";
import { organizeProgram } from "./form";
import { parse } from "./parser";
export function compile(source) {
    let builtins = new Map;
    builtins.set("print(int,)", Type.Int);
    builtins.set("print(bool,)", Type.Bool);
    builtins.set("abs(int,)", Type.Int);
    builtins.set("max(int,int,)", Type.Int);
    builtins.set("min(int,int,)", Type.Int);
    builtins.set("pow(int,int,)", Type.Int);
    let stmts = parse(source);
    let program = organizeProgram(stmts, builtins);
    //map functions to their unqiue function names in wasm
    //as well as global variables to their indices
    let funcLabels = new Map;
    let globalVars = new Map;
    //wasm function name scheme we'll use:
    // - just their function name, if unique
    // - their function name + the number of times this function name has been seen
    let funcLabelNum = new Map;
    for (let [sig, def] of Array.from(program.fileFuncs.entries())) {
        let fname = def.identity.name;
        let id = 0; //to append to the end of function names
        if (funcLabelNum.has(fname)) {
            id = funcLabelNum.get(fname) + 1;
            funcLabelNum.set(fname, id);
        }
        else {
            funcLabelNum.set(fname, 0);
        }
        //set functio  name. If id is 0, don't event append it
        funcLabels.set(sig, fname + (id === 0 ? "" : id));
    }
    //map global variables to indices
    let index = 0;
    Array.from(program.fileVars.keys()).forEach(e => {
        globalVars.set(e, index);
        index += 4; //since we're 32 bits
    });
    /*
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
    */
}
function codeGenFunction(funcDef, funcLabels, vars) {
    let instrs = new Array;
    //translate parameters to wasm
    let paramHeader = "";
    for (let [name, _] of Array.from(funcDef.params.entries())) {
        paramHeader += `(param $${name} i32)`;
    }
    //add function return type, if it's not None
    let returnType = funcDef.identity.returnType !== Type.None ? "(result i32)" : "";
    //now put it all together
    let funcHeader = `(func $${funcLabels.get(funcSig(funcDef.identity))} ${paramHeader} ${returnType}`;
    instrs.push(funcHeader);
    //compile local variables
    for (let [name, info] of Array.from(funcDef.varDefs.entries())) {
        const valueInstr = codeGenExpr(info.value, funcLabels, vars);
        instrs = instrs.concat(valueInstr);
        instrs.push(`(local $${name} i32)`);
        instrs.push(`(set_local $${name})`);
    }
    //compile statements
    for (let fStmt of funcDef.bodyStms) {
        instrs = instrs.concat(codeGen(fStmt));
    }
    instrs.push(")"); //add concluding paranthesis
    return instrs;
}
function codeGen(stmt) {
    switch (stmt.tag) {
        case "define":
            var valStmts = codeGenExpr(stmt.value);
            return valStmts.concat([`(local.set $${stmt.name})`]);
        case "expr":
            var exprStmts = codeGenExpr(stmt.expr);
            return exprStmts.concat([`(local.set $$last)`]);
    }
}
function codeGenExpr(expr, funcLabels, vars) {
    switch (expr.tag) {
        case "uniexpr": {
            let targetInstr = codeGenExpr(expr.target, funcLabels, vars);
            break;
        }
        case "bopexpr": {
            let leftInstr = codeGenExpr(expr.left, funcLabels, vars);
            let rightInstr = codeGenExpr(expr.right, funcLabels, vars);
            switch (expr.op) {
                case BinOp.Add: return leftInstr.concat(rightInstr, ["(i32.add)"]);
                case BinOp.Sub: return leftInstr.concat(rightInstr, ["(i32.sub)"]);
                case BinOp.Mul: return leftInstr.concat(rightInstr, ["(i32.mul)"]);
                case BinOp.Div: return leftInstr.concat(rightInstr, ["(i32.div_s)"]);
                case BinOp.Mod: return leftInstr.concat(rightInstr, ["(i32.rem_s)"]);
                case BinOp.Equal: return leftInstr.concat(rightInstr, ["(i32.eq)"]);
                case BinOp.NEqual: return leftInstr.concat(rightInstr, ["(i32.ne)"]);
                case BinOp.LEqual: return leftInstr.concat(rightInstr, ["(i32.le)"]);
                case BinOp.GEqual: return leftInstr.concat(rightInstr, ["(i32.ge)"]);
                case BinOp.Less: return leftInstr.concat(rightInstr, ["(i32.lt)"]);
                case BinOp.Great: return leftInstr.concat(rightInstr, ["(i32.gt)"]);
                //since we only have bools and ints, "is" works the same as "==" at the moment
                case BinOp.Is: return leftInstr.concat(rightInstr, ["(i32.eq)"]);
            }
        }
        case "Boolean": {
            break;
        }
        case "Number":
            return ["(i64.const " + ((expr.value >>> 31) + (1)) + ")"];
        case "id": {
            let found = lookup(expr.name, vars);
            return found === -1 ? [`(local.get $${expr.name})`] ? [`(load ${found})`] :  : ;
        }
    }
}
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
