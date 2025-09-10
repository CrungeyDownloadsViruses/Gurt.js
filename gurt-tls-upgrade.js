// gurt-tls-upgrade.js
const tls = require("tls");
const { EventEmitter } = require("events");

class GURTTLSUpgrade extends EventEmitter {
  constructor(tlsOptions) {
    super();
    this.tlsOptions = tlsOptions;
  }

  /**
   * Upgrade a raw TCP socket to TLS in-place.
   * @param {net.Socket} socket
   */
  upgrade(socket) {
    // Pause the socket to prevent reading before wrapping
    socket.pause();

    // Wrap in TLS
    const secureSocket = new tls.TLSSocket(socket, {
      ...this.tlsOptions,
      isServer: true,
    });

    // Emit secureConnect when handshake completes
    secureSocket.once("secureConnect", () => {
      this.emit("secureConnect", secureSocket);
      // Resume reading from socket
      secureSocket.resume();
    });

    secureSocket.on("data", (data) => {
      this.emit("data", secureSocket, data);
    });

    secureSocket.on("error", (err) => {
      this.emit("error", secureSocket, err);
    });

    secureSocket.on("end", () => {
      this.emit("end", secureSocket);
    });

    secureSocket.on("close", () => {
      this.emit("close", secureSocket);
    });

    // Resume to allow TLS handshake to start
    secureSocket.resume();

    return secureSocket;
  }
}

module.exports = GURTTLSUpgrade;
