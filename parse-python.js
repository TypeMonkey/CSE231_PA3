const python = require('lezer-python');

/*
const input = "if x == 0: \n"+
              " x         \n"+
              " pass     \n"+
              "elif x < 0:\n"+
              " z     \n"+
              "else:     \n"+
              " y        \n";
*/

/*
const input = "while i < 10: \n"+
              " i = i + 1 \n";
*/

//const input = "return 10";

/*
const input = "def f(x : int, y:int) -> int : \n"+
              " z:int = 10 \n"+
              " y = y + 1 \n"+
              " return x + y \n";
*/

const input = "(10 * f(10, 2 * x))"

const tree = python.parser.parse(input);

const cursor = tree.cursor();

do {
//  console.log(cursor.node);
  console.log(cursor.node.type.name);
  console.log(input.substring(cursor.node.from, cursor.node.to));
} while(cursor.next());

