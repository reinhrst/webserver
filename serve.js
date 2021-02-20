const http = require("http");
const fs = require('fs').promises;
const fsevents = require('fsevents');

function escapeHTML(s) { 
    return s.replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
}

let args = process.argv.slice(2);
console.assert(args.length == 1)
let dir = args[0]

let contentTypeMapper  = {
    "html": "text/html",
    "css": "text/css",
    "js": "application/javascript",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "svg": "image/svg+xml",
}


var waiters = []
const eventswatcher = fsevents.watch(dir, (path, flags, id) => {
    console.log("event, alerting " + waiters.length + " waiters")
    for (const w of waiters) {
        w.res.setHeader("Content-Type", "application/json")
        w.res.writeHead(200)
        w.res.end(JSON.stringify({"event": "change"}));
    }
    waiters = []
});

const host = 'localhost';
const port = 8000;

const requestListener = function (req, res) {
    if (req.url.startsWith("/parentframe")) {
        fs.readFile(__dirname + "/parentframe.html", "utf-8")
        .then(contents => {
            res.setHeader("Content-Type", "text/html")
            res.writeHead(200);
            res.end(contents.replace(
                "##ROOTFILE##", req.url.replace("/parentframe", "")))
        })
        return
    }
    if (req.url == "/waitchange") {
        console.log("Waiter nr " + waiters.length + " in " + eventswatcher)
        waiters.push({res: res})
        return
    }
    let filename = dir + req.url
    console.log("Requesting " + filename)
    fs.readFile(filename)
    .then(contents => {
        let extension = filename.split(".").slice(-1)[0]
        let contentType = contentTypeMapper[extension]
        if (!contentType) {
            res.writeHead(500);
            res.end("Unknown content type for " + escapeHTML(extension));
            console.error("Unknown content type for " + extension)
        } else {
            res.setHeader("Content-Type", contentType)
            res.writeHead(200);
            res.end(contents);
        }
    })
    .catch(reason => {
        if (reason.code == "ENOENT") {
            res.writeHead(404);
            res.end("404 no such file " + escapeHTML(reason.path))
            console.log("404 no such file " + reason.path)
        } else {
            res.writeHead(500);
            res.end("500 internal error on " + escapeHTML(req.url))
            console.log("500 internal error")
            console.error(reason)
        }
    })

};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});
