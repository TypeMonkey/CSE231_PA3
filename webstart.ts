import {BasicREPL} from './repl';
import {emptyEnv, GlobalEnv} from './compiler';
import { output } from './webpack.config';


function webStart() {
  document.addEventListener("DOMContentLoaded", function() {

    var importObject = {
      imports: {
        imported_func: (arg : any) => {
          console.log("Logging from WASM: ", arg);
          const elt = document.createElement("pre");
          document.getElementById("output").appendChild(elt);
          elt.innerText = arg;
        },

        print_global_func: (pos: number, value: number) => {
          var name = importObject.nameMap[pos];
          var msg = name + " = " + value;
          renderResult(msg);
        }
      },
    
      nameMap: new Array<string>(),
    
      updateNameMap : (env : GlobalEnv) => {
        env.globals.forEach((pos, name) => {
          importObject.nameMap[pos] = name;
        })
      }
    };
    const env = emptyEnv;
    var repl = new BasicREPL();

    function renderResult(result : any) : void {
      if(result === undefined) { console.log("skip"); return; }
      const elt = document.createElement("pre");
      document.getElementById("output").appendChild(elt);
      elt.innerText = String(result);
    }

    function renderError(result : any) : void {
      const elt = document.createElement("pre");
      document.getElementById("output").appendChild(elt);
      elt.setAttribute("style", "color: red");
      elt.innerText = String(result);
    }

    function setupRepl() {
      document.getElementById("output").innerHTML = "hello world"; //remove hello world

      const replCodeElement = document.getElementById("next-code") as HTMLInputElement;
      
      replCodeElement.addEventListener("keypress", (e) => {
        if(e.key === "Enter") {
          const output = document.createElement("div");
          const prompt = document.createElement("span");
          prompt.innerText = "»";
          output.appendChild(prompt);
          const elt = document.createElement("input");
          elt.type = "text";
          elt.disabled = true;
          elt.className = "repl-code";
          output.appendChild(elt);
          document.getElementById("output").appendChild(output);
          const source = replCodeElement.value;
          elt.value = source;
          replCodeElement.value = "";

          try {
            let res = repl.execRawState(source);
            console.log(" ---> entry statement resulted in: "+res);
          } catch (error) {
            console.log("--ERROR: "+error);
            renderError(error);
          }
          //repl.run(source).then((r) => { renderResult(r); console.log ("run finished") })
           //   .catch((e) => { renderError(e); console.log("run failed", e) });;
        }
      });
    }


    document.getElementById("run").addEventListener("click", function(e) {
      //repl = new BasicREPL(importObject);
      const source : string = (document.getElementById("user-code") as HTMLTextAreaElement).value;

      setupRepl();
      //let res = repl.compile(source);
      let res = repl.compile(source);

      //check if error occured during compilation
      if(res.err == undefined){
        console.log("------running------");
        repl.init(res.program);
        try {
          const x = repl.run(res.program);
          renderResult(x);
        } catch (error) {
          console.log("---run failed! ", error);
          renderError(error);
        }
      }
      else{
        renderError(res.err);
        console.log("compiled failed", res.err.stack);
      }


      /*
      repl.run(source).then((r) => 
         { renderResult(r); console.log ("run finished") })
          .catch((e) => { renderError(e); console.log("run failed", e) });;
          */
    });
  });
}

webStart();
