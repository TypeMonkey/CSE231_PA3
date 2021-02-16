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

});
