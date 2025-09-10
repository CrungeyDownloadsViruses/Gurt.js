const net = require("net");
const tls = require("tls");
const fs = require("fs");
const EventEmitter = require("events");

class GURTServer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.tlsOptions = options.tls || {};
    this.routes = {}; // { "GET /": handler, "POST /submit": handler }
  }

  // Generic route registration
  route(method, path, handler) {
    this.routes[`${method.toUpperCase()} ${path}`] = handler;
  }

  get(path, handler) { this.route("GET", path, handler); }
  post(path, handler) { this.route("POST", path, handler); }
  put(path, handler) { this.route("PUT", path, handler); }
  delete(path, handler) { this.route("DELETE", path, handler); }
  head(path, handler) { this.route("HEAD", path, handler); }
  options(path, handler) { this.route("OPTIONS", path, handler); }
  patch(path, handler) { this.route("PATCH", path, handler); }

  listen(port, callback) {
    const server = net.createServer((socket) => this.handleConnection(socket));
    server.listen(port, callback);
  }

  handleConnection(socket) {
    const addr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP] Client connected: ${addr}`);

    let buffer = "";
    socket.on("data", (data) => {
      buffer += data.toString("utf8");

      if (buffer.includes("\r\n\r\n")) {
        if (buffer.startsWith("HANDSHAKE / GURT/1.0.0")) {
          const response =
            "GURT/1.0.0 101 SWITCHING_PROTOCOLS\r\n" +
            "gurt-version: 1.0.0\r\n" +
            "encryption: TLS/1.3\r\n" +
            "alpn: GURT/1.0\r\n" +
            "server: GURT/1.0.0\r\n" +
            "date: " + new Date().toUTCString() + "\r\n\r\n";

          socket.write(response);
          console.log(`[TCP] Sent handshake response to ${addr}`);

          // Upgrade to TLS
          const tlsSocket = new tls.TLSSocket(socket, { ...this.tlsOptions, isServer: true });

          tlsSocket.on("secureConnect", () => {
            console.log(`[TLS] TLS handshake completed with ${addr}`);
          });

          tlsSocket.on("data", (data) => {
            if (!data) return;
            const reqStr = data.toString("utf8");
            console.log(`[TLS] Received from ${addr}:\n${reqStr}`);

            // Parse request
            const [methodLine, ...headerLines] = reqStr.split("\r\n");
            const [method, path] = methodLine.split(" ");

            const headers = {};
            let body = "";
            let isBody = false;

            headerLines.forEach((line) => {
              if (line === "") { isBody = true; return; }
              if (isBody) body += line + "\n";
              else {
                const [key, ...rest] = line.split(":");
                headers[key.toLowerCase()] = rest.join(":").trim();
              }
            });

            const routeKey = `${method.toUpperCase()} ${path}`;
            const handler = this.routes[routeKey];

            if (handler) handler({ socket: tlsSocket, addr, request: reqStr, headers, body, method, path });
            else {
              const resBody = "Not Found";
              const response =
                `GURT/1.0.0 404 Not Found\r\n` +
                "content-type: text/plain\r\n" +
                `content-length: ${Buffer.byteLength(resBody)}\r\n` +
                "server: GURT/1.0.0\r\n" +
                "date: " + new Date().toUTCString() + "\r\n\r\n" +
                resBody;

              tlsSocket.write(response);
            }
          });

          tlsSocket.on("error", (err) => {
            console.log(`[TLS] Error: ${err.message}`);
            tlsSocket.destroy();
          });

          buffer = "";
        } else {
          console.log(`[TCP] Invalid handshake from ${addr}`);
          socket.destroy();
        }
      }
    });

    socket.on("end", () => console.log(`[TCP] Client disconnected: ${addr}`));
  }
}

module.exports = GURTServer;
