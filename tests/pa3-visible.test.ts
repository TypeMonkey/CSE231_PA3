import { PyInt, PyBool, PyNone, NUM, CLASS } from "../utils";
import { assert, asserts, assertPrint, assertTCFail, assertTC, assertFail } from "./utils.test";

describe("PA3 visible tests", () => {
  // 1
  assert("literal-int", `100`, PyInt(100));

  // 2
  assert("literal-bool-True", `True`, PyBool(true));

  // 3
  assert("literal-bool-False", `False`, PyBool(false));

  //4
  assert("literal-int-negation", `-100`, PyInt(-100));

  //5
  assert("literal-bool-negation", `not True`,  PyBool(false));

  //6
  assert("literal-bool-negation", `not False`,  PyBool(true));

  //7
  assert("literal-bool-negation", `not 10 != 20`,  PyBool(false));

  //8
  assert("literal-bool-negation", `x:bool = False \n not x`,  PyBool(true));

  //9
  assert("literal-bool-negation", 
      `x : int = 0 \n 
       x           \n
       if True: \n
         x = 5  \n
       else:    \n
         x = 3  \n`,  PyNone());

  //10
  assert("if-else", 
      ` 
       x:int = 0
       if True: \n
         x = 5  \n
       else:    \n
         x = 3  \n`, PyNone());

  assert("sample", 
     `  100 + 20 + 3 \n
        True         \n
        print(0)     \n
        print(False) \n
        x : int = 0  \n
        x            \n`, 
     PyInt(0));
});
