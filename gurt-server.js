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
    this.forceServername = options.forceServername || null;
    this.routes = {};
    this.server = null; // store server reference
    this.retryDelay = 3000; // delay before restart on crash
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

  listen(port, host = "0.0.0.0") {
    const startServer = () => {
      this.server = net.createServer((socket) => this.handleConnection(socket));

      this.server.on("error", (err) => {
        console.error(`[SERVER] Fatal error: ${err.code || err.message}`);
        this.server.close(() => {
          console.log("[SERVER] Attempting to restart...");
          setTimeout(() => startServer(), this.retryDelay);
        });
      });

      this.server.listen(port, host, () => {
        console.log(`[SERVER] Listening on ${host}:${port}`);
      });
    };

    startServer();
  }

  handleConnection(socket) {
    const addr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP] Client connected: ${addr}`);

    socket.on("error", (err) => {
      console.error(`[TCP] Socket error from ${addr}:`, err.message);
      socket.destroy();
    });

    socket.on("end", () => {
      console.log(`[TCP] Client disconnected: ${addr}`);
      socket.destroy();
    });

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

          const tlsOptions = {
            ...this.tlsOptions,
            isServer: true,
            requestCert: this.isLocalCert,
            rejectUnauthorized: !this.isLocalCert,
          };

          if (this.forceServername) {
            tlsOptions.servername = this.forceServername;
            console.log(`[TLS] Forcing servername SNI: ${this.forceServername}`);
          }

          const tlsSocket = new tls.TLSSocket(socket, tlsOptions);

          tlsSocket.on("secureConnect", () => {
            console.log(`[TLS] TLS handshake completed with ${addr}`);
          });

          tlsSocket.on("error", (err) => {
            console.error(`[TLS] Error from ${addr}: ${err.code} - ${err.message}`);
            tlsSocket.destroy();
          });

          tlsSocket.on("end", () => {
            console.log(`[TLS] Client TLS disconnected: ${addr}`);
            tlsSocket.destroy();
          });

          tlsSocket.on("data", (data) => {
            if (!data) return;
            const reqStr = data.toString("utf8");
            console.log(`[TLS] Received from ${addr}:\n${reqStr}`);

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

            let [path, queryString] = [];
            try {
              [path, queryString] = rawPath.split("?");
            } catch (err) {
              console.error(`[TLS] Error parsing URL: ${err}`);
              path = rawPath;
              queryString = "";
            }

            const host = headers["host"] || "localhost";
            const url = queryString ? `${host}${path}?${queryString}` : `${host}${path}`;

            tlsSocket.url = url;

            const routeKey = `${method.toUpperCase()} ${path}`;
            const handler = this.routes[routeKey];

            if (handler) {
              handler({
                socket: tlsSocket,
                addr,
                request: reqStr,
                headers,
                body,
                method,
                path,
                queryString,
                url,
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
  }
}

module.exports = GURTServer;
