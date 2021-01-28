import { run } from './runner';
function webStart() {
    document.addEventListener("DOMContentLoaded", function () {
        var importObject = {
            imports: {
                print: (arg) => {
                    console.log("Logging from WASM: ", arg);
                    const elt = document.createElement("pre");
                    document.getElementById("output").appendChild(elt);
                    elt.innerText = arg;
                    return arg;
                },
            },
        };
        function renderResult(result) {
            if (result === undefined) {
                console.log("skip");
                return;
            }
            const elt = document.createElement("pre");
            document.getElementById("output").appendChild(elt);
            elt.innerText = String(result);
        }
        function renderError(result) {
            const elt = document.createElement("pre");
            document.getElementById("output").appendChild(elt);
            elt.setAttribute("style", "color: red");
            elt.innerText = String(result);
        }
        document.getElementById("run").addEventListener("click", function (e) {
            const source = document.getElementById("user-code");
            const output = document.getElementById("output").innerHTML = "";
            run(source.value, { importObject }).then((r) => { renderResult(r); console.log("run finished"); })
                .catch((e) => { renderError(e); console.log("run failed", e); });
            ;
        });
    });
}
webStart();
