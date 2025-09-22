
# GURTJS

This is a Node.js module designed to run a web server similar to **Express**, for FaceDev’s **[GURTED protocol](https://www.gurted.com/)** via JavaScript.  

This module is **independent** from [MD1125/gurted](https://github.com/MD1125/gurted) and allows for a more customizable server with broader documentation.

📦 **NPM Package**: `gurtjs`  
📖 **GitHub**: [CrungeyDownloadsViruses/Gurt.js](https://github.com/CrungeyDownloadsViruses/Gurt.js)  

---

## Example Usage

    // example.js
    
    const  fs  =  require("fs");
    
    const  GURTServer  =  require("gurtjs/server");
    
      
    
    const  server  =  new  GURTServer({
    
    tls: {
    
    key:  fs.readFileSync("gurt-server.key"),
    
    cert:  fs.readFileSync("gurt-server.crt"),
    
    },
    
    });
    
      
    
    // GET route
    
    server.get("/", ({ socket }) => {
    
    const  body  =  "<body><p>Hello World</p></body>";
    
    socket.write(
    
    `GURT/1.0.0 200 OK\r\ncontent-type: text/plain\r\ncontent-length: ${Buffer.byteLength(
    
    body
    
    )}\r\nserver: GURT/1.0.0\r\n\r\n${body}`
    
    );
    
    });
    
      
    
    server.get("/url", ({ socket, url }) => {
    
    console.log("[GET url]", url);
    
    const  body  =  "<body><p>Hello World</p></body>";
    
    socket.write(
    
    `GURT/1.0.0 200 OK\r\ncontent-type: text/plain\r\ncontent-length: ${Buffer.byteLength(
    
    body
    
    )}\r\nserver: GURT/1.0.0\r\n\r\n${body}`
    
    );
    
    });
    
      
    
    // POST route
    
    server.post("/submit", ({ socket, body }) => {
    
    console.log("[POST body]", body.trim());
    
    const  resBody  =  "POST received";
    
    socket.write(
    
    `GURT/1.0.0 200 OK\r\ncontent-type: text/plain\r\ncontent-length: ${Buffer.byteLength(
    
    resBody
    
    )}\r\nserver: GURT/1.0.0\r\n\r\n${resBody}`
    
    );
    
    });
    
      
    
    // PATCH route
    
    server.patch("/update", ({ socket, body }) => {
    
    console.log("[PATCH body]", body.trim());
    
    const  resBody  =  "PATCH received";
    
    socket.write(
    
    `GURT/1.0.0 200 OK\r\ncontent-type: text/plain\r\ncontent-length: ${Buffer.byteLength(
    
    resBody
    
    )}\r\nserver: GURT/1.0.0\r\n\r\n${resBody}`
    
    );
    
    });
    
      
    
    // OPTIONS route
    
    server.options("/", ({ socket }) => {
    
    const  resBody  =  "";
    
    const  response  =
    
    `GURT/1.0.0 204 No Content\r\n`  +
    
    "allow: GET, POST, PATCH, OPTIONS, HEAD\r\n"  +
    
    "server: GURT/1.0.0\r\n\r\n"  +
    
    resBody;
    
    socket.write(response);
    
    });
    
      
    
    // HEAD route
    
    server.head("/", ({ socket }) => {
    
    const  resBody  =  "";
    
    const  response  =
    
    `GURT/1.0.0 200 OK\r\n`  +
    
    "content-type: text/plain\r\n"  +
    
    `content-length: 11\r\n`  +  // matches "Hello GET World"
    
    "server: GURT/1.0.0\r\n\r\n"  +
    
    resBody;
    
    socket.write(response);
    
    });
    
      
    
    // Start the server
    
    server.listen(4878, () => {
    
    console.log("GURT server listening on port 4878");
    
    });

