// gurt-server.js
const net = require("net");
const tls = require("tls");
const fs = require("fs");
const EventEmitter = require("events");

class GURTServer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.tlsOptions = options.tls || {};
    this.isLocalCert = options.isLocalCert ?? false; 
    this.forceServername = options.forceServername || null; // 👈 new option
    this.routes = {};
  }

  // Route registration
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

  listen(port, host) {
    const server = net.createServer((socket) => this.handleConnection(socket));
    server.listen(port, host);
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

          // Inject SNI if configured
          const tlsOptions = {
            ...this.tlsOptions,
            isServer: true,
            requestCert: this.isLocalCert,
            rejectUnauthorized: !this.isLocalCert,
          };

          if (this.forceServername) {
            tlsOptions.servername = this.forceServername; // 👈 force certificate name
            console.log(`[TLS] Forcing servername SNI: ${this.forceServername}`);
          }

          const tlsSocket = new tls.TLSSocket(socket, tlsOptions);

          tlsSocket.on("secureConnect", () => {
            console.log(`[TLS] TLS handshake completed with ${addr}`);
          });

          tlsSocket.on("error", (err) => {
            console.error(`[TLS] Error code: ${err.code}`);
            console.error(`[TLS] Library: ${err.library}`);
            console.error(`[TLS] Reason: ${err.reason}`);
            console.error(`[TLS] Full stack:`, err);
            tlsSocket.destroy();
          });

          tlsSocket.on("data", (data) => {
  if (!data) return;
  const reqStr = data.toString("utf8");
  console.log(`[TLS] Received from ${addr}:\n${reqStr}`);

  // Parse request
  const [methodLine, ...headerLines] = reqStr.split("\r\n");
  const [method, rawPath] = methodLine.split(" ");

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

  // 👇 Separate path & query
  const [path, queryString] = rawPath.split("?");
  const host = headers["host"] || "localhost";

  // 👇 Full URL (with query string if present)
  const url = queryString ? `${host}${path}?${queryString}` : `${host}${path}`;

  // Store on socket for easy access
  tlsSocket.url = url;

  const routeKey = `${method.toUpperCase()} ${path}`; // only use base path for routing
  const handler = this.routes[routeKey];

  if (handler) {
    handler({
      socket: tlsSocket,
      addr,
      request: reqStr,
      headers,
      body,
      method,
      path,        // base path only
      queryString, // query part only
      url,         // full url with params
    });
  } else {
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
