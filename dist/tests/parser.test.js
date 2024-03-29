import { expect } from 'chai';
import { parser } from 'lezer-python';
import { traverseExpr, traverseStmt, parse } from '../parser';
import { BinOp, UniOp } from '../ast';
// We write tests for each function in parser.ts here. Each function gets its 
// own describe statement. Each it statement represents a single test. You
// should write enough unit tests for each function until you are confident
// the parser works as expected. 
describe('traverseExpr(c, s) function', () => {
    it('parses a number in the beginning', () => {
        const source = "987";
        const cursor = parser.parse(source).cursor();
        // go to statement
        cursor.firstChild();
        // go to expression
        cursor.firstChild();
        const parsedExpr = traverseExpr(cursor, source);
        // Note: we have to use deep equality when comparing objects
        expect(parsedExpr).to.deep.equal({ tag: "Number", value: 987 });
    });
    it('parses a number in a function call', () => {
        const source = "func(10+90*2,-15,20)";
        const cursor = parser.parse(source).cursor();
        // go to statement
        cursor.firstChild();
        // go to expression
        cursor.firstChild();
        const parsedExpr = traverseExpr(cursor, source);
        // Note: we have to use deep equality when comparing objects
        let expected = [{
                tag: "bopexpr", op: BinOp.Add,
                left: { tag: "Number", value: 10 },
                right: {
                    tag: "bopexpr", op: BinOp.Mul,
                    left: { tag: "Number", value: 90 },
                    right: { tag: "Number", value: 2 }
                }
            },
            { tag: "uniexpr", op: UniOp.Sub, target: { tag: "Number", value: 15 } },
            { tag: "Number", value: 20 }];
        expect(parsedExpr).to.deep.equal({ tag: "funccall", name: "func", args: expected });
    });
    // TODO: add additional tests here to ensure traverseExpr works as expected
});
describe('traverseStmt(c, s) function', () => {
    // TODO: add tests here to ensure traverseStmt works as expected
    it("parses an if statement", () => {
        let source = "if x == 0: \n" +
            " x         \n" +
            " pass     \n" +
            "elif x < 0:\n" +
            " z     \n" +
            " pass  \n" +
            "else: \n" +
            " y    \n" +
            " j    \n";
        const cursor = parser.parse(source).cursor();
        cursor.firstChild();
        const result = traverseStmt(cursor, source);
        console.log("--------------------STATEMENTS!!");
    });
    it("parses a while statement", () => {
        let source = "while i < 10: \n" +
            " i = i + 1 \n" +
            " if i == 0: \n" +
            "   10       \n";
        const cursor = parser.parse(source).cursor();
        cursor.firstChild();
        const result = traverseStmt(cursor, source);
        console.log("--------------------STATEMENTS!!");
    });
    it("parses a function definition", () => {
        let source = "def f(x : int , y:int) -> int\n" +
            " z:int = 10 \n" +
            " y = y + 1 \n" +
            " return x + y \n";
        const cursor = parser.parse(source).cursor();
        cursor.firstChild();
        const result = traverseStmt(cursor, source);
        console.log("--------------------STATEMENTS!!");
    });
});
describe('traverse(c, s) function', () => {
    // TODO: add tests here to ensure traverse works as expected
});
describe('parse(source) function', () => {
    it('parse a number', () => {
        const parsed = parse("987");
        expect(parsed).to.deep.equal([{ tag: "expr", expr: { tag: "Number", value: 987 } }]);
    });
    it("parses a source file", () => {
        let source = "g:int = 0 \n" +
            "def f(x : int , y:int) -> int:\n" +
            " z:int = 10 \n" +
            " y = y + 1 \n" +
            " if y == 0: \n" +
            "    return f(1,0) \n" +
            " elif y > 0:  \n" +
            "    return 50 \n" +
            " else:           \n" +
            "    return print(g + 2)      \n" +
            " g  \n";
        const parsed = parse(source);
        console.log("--------------------STATEMENTS!!");
    });
    // TODO: add additional tests here to ensure parse works as expected
});
