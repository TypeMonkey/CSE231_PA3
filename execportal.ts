import fs from 'fs';
import { compile } from './compiler';
import { organizeProgram } from './form';
import { BasicREPL } from './repl';

console.log("hello world!");

const source = fs.readFileSync('sample.txt','ascii');
const replt = new BasicREPL();

const result = replt.compile(source);
if(result.err !== undefined){
    console.log("ERROR: ", result.err);
}
else{
    const program = result.program;
    replt.init(program);

    console.log("--------------EXEC-------------");
    const firstRes = replt.run(program);    
    console.log("====== "+String(firstRes));

    var stdin = process.openStdin();

    stdin.addListener("data", function(d) {
        // note:  d is an object, and when converted to a string it will
        // end with a linefeed.  so we (rather crudely) account for that  
        // with toString() and then trim() 
        console.log("you entered: ["+d.toString().trim()+"]");
        const res = replt.execRawState(d.toString().trim());
        console.log("result: "+res.toString());
    });
}