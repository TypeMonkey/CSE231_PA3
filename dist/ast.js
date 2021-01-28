export var Type;
(function (Type) {
    Type["Int"] = "int";
    Type["Bool"] = "bool";
    Type["Object"] = "object";
    Type["None"] = "None"; //Largely used internally by the compiler to
    //show that a function has no declared return type
})(Type || (Type = {}));
/**
 * Returns the signature of a function
 * @param func - the function whose signature is to generate
 */
export function funcSig(func) {
    let sig = func.name + "(";
    Array.from(func.paramType.values()).forEach(value => sig += value + ",");
    return sig + ")";
}
/**
 * Returns the signature of the function a function invocation is calling
 * @param func - the signature of the function a function invocation is calling
 */
export function generateFuncSig(name, argTypes) {
    let sig = name + "(";
    argTypes.forEach(value => sig += value + ",");
    return sig + ")";
}
/**
 * Returns the proper string representation of
 * an Expr for debugging purposes
 * @param params - an Expr
 */
export function toString(param) {
    switch (param.tag) {
        case "None": {
            return "None";
        }
        case "Boolean": {
            return `${param.value}`;
        }
        case "Number": {
            return param.value.toString();
        }
        case "id": {
            return param.name;
        }
        case "uniexpr": {
            return param.op + " " + toString(param.target);
        }
        case "bopexpr": {
            return "( " + toString(param.left) + " " + param.op + " " + toString(param.right) + " )";
        }
        case "funccall": {
            let argRep = "";
            param.args.forEach(element => {
                argRep += toString(element) + " ,";
            });
            if (param.args.length > 0) {
                argRep = argRep.substring(0, argRep.length - 1);
            }
            return param.name + "(" + argRep + ")";
        }
    }
}
export var BinOp;
(function (BinOp) {
    BinOp["Add"] = "+";
    BinOp["Sub"] = "-";
    BinOp["Mul"] = "*";
    BinOp["Div"] = "//";
    BinOp["Mod"] = "%";
    BinOp["Equal"] = "==";
    BinOp["NEqual"] = "!=";
    BinOp["LEqual"] = "<=";
    BinOp["GEqual"] = ">=";
    BinOp["Less"] = "<";
    BinOp["Great"] = ">";
    BinOp["Is"] = "is";
})(BinOp || (BinOp = {}));
export var UniOp;
(function (UniOp) {
    UniOp["Sub"] = "-";
    UniOp["Not"] = "not";
})(UniOp || (UniOp = {}));
