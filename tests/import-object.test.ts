import { Type, typeToString } from "../ast";
import { NUM, BOOL, NONE } from "../utils";

function stringify(typ: Type, arg: any): string {
  switch (typ.tag) {
    case "number":
      return (arg as number).toString();
    case "bool":
      return (arg as boolean) ? "True" : "False";
    case "none":
      return "None";
    case "class":
      return typ.name;
  }
}

function print(typ: Type, arg: any): any {
  importObject.output += stringify(typ, arg);
  importObject.output += "\n";
  console.log("outtie "+stringify(typ, arg)+"  type: "+typeToString(typ));  //DEV_NOTE: Mainly for debug purposes
  return arg;
}



export const importObject = {
  imports: {
    // we typically define print to mean logging to the console. To make testing
    // the compiler easier, we define print so it logs to a string object.
    //  We can then examine output to see what would have been printed in the
    //  console.
    print: (arg: any) => print(NUM, arg),
    print_num: (arg: number) => print(NUM, arg),
    print_bool: (arg: number) => print(BOOL, arg),
    print_none: (arg: number) => print(NONE, arg),
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
  },

  //log: (arg: any) =>  process.stdout.write(String(arg)+"\n"),

  output: "",
};
