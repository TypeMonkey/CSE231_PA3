const python = require('lezer-python');
import fs from 'fs';
//const input = "a : int = 0"

const input = fs.readFileSync("sample.txt","ascii");
const tree = python.parser.parse(input);
const cursor = tree.cursor();

function vizTree(cursor, s, depth) {
    console.log (Array(depth * 2 + 1).join(" ") + `> [${cursor.node.type.name}]: '${s.substring(cursor.from, cursor.to)}'`)
    if (!cursor.firstChild()) {
        return;
    }
    do {
        vizTree(cursor, s, depth * 2 + 1);
    } while (cursor.nextSibling());

    cursor.parent();
}

vizTree(cursor, input, 0);
