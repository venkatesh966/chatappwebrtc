import Peer from 'peerjs';

class WebRTCService {
  constructor() {
    this.peer = null;
    this.connections = new Map();
    this.onMessageCallback = null;
    this.onPeerConnectedCallback = null;
    this.onPeerDisconnectedCallback = null;
    this.onError = null;

    // For heartbeat:
    this.alivePeers = new Map();
    this.pingInterval = null;
    this.checkInterval = null;

    // Expose a promise that resolves on peer open:
    this.ready = null;
  }

  initialize() {
    // generate a fresh per-session ID
    const userId = 'user_' + Math.random().toString(36).substr(2, 9);

    this.peer = new Peer(userId);

    // set up the ready promise
    this.ready = new Promise((resolve, reject) => {
      this.peer.once('open', (id) => {
        console.log('🟢 Peer open. My ID:', id);
        resolve(id);
      });
      this.peer.once('error', (err) => {
        console.error('PeerJS fatal error:', err);
        reject(err);
        if (this.onError) this.onError(err);
      });
    });

    // incoming connections
    this.peer.on('connection', (conn) => this._handleConnection(conn));

    // lifecycle
    this.peer.on('disconnected', () => {
      console.warn('⚠️ Peer disconnected, reconnecting…');
      this.peer.reconnect();
    });
    this.peer.on('close', () => {
      console.log('🛑 Peer closed');
      this.connections.clear();
      this.alivePeers.clear();
    });

    // start heartbeat
    this._startHeartbeat();
  }

  _startHeartbeat() {
    // every 5s send a PING to each peer
    this.pingInterval = setInterval(() => {
      for (const conn of this.connections.values()) {
        if (conn.open) conn.send('__PING__');
      }
    }, 5000);

    // every 5s check for stale peers (>15s no PONG)
    this.checkInterval = setInterval(() => {
      const now = Date.now();
      for (const [peerId] of this.connections) {
        const last = this.alivePeers.get(peerId) || 0;
        if (now - last > 15000) {
          console.warn('Heartbeat timeout:', peerId);
          this._cleanupPeer(peerId);
        }
      }
    }, 5000);
  }

  _handleConnection(conn) {
    conn.on('open', () => {
      console.log('➡️ Connected to', conn.peer);
      this.connections.set(conn.peer, conn);
      // mark alive immediately
      this.alivePeers.set(conn.peer, Date.now());
      if (this.onPeerConnectedCallback) this.onPeerConnectedCallback(conn.peer);
    });

    conn.on('data', (data) => {
      if (data === '__PING__') {
        conn.send('__PONG__');
      } else if (data === '__PONG__') {
        this.alivePeers.set(conn.peer, Date.now());
      } else if (data === '__DISCONNECT__') {
        this._cleanupPeer(conn.peer);
      } else if (this.onMessageCallback) {
        this.onMessageCallback(data);
      }
    });

    conn.on('close', () => {
      console.log('❌ Connection closed with', conn.peer);
      this._cleanupPeer(conn.peer);
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      if (this.onError) this.onError(err);
    });
  }

  _cleanupPeer(peerId) {
    if (this.connections.has(peerId)) {
      this.connections.get(peerId).close();
      this.connections.delete(peerId);
      this.alivePeers.delete(peerId);
      if (this.onPeerDisconnectedCallback) this.onPeerDisconnectedCallback(peerId);
    }
  }

  async connectToPeer(peerId) {
    await this.ready;
    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(peerId);

      conn.once('open', () => {
        resolve(conn);
      });
      conn.once('error', (err) => reject(err));

      // also handle data/close via the same handler
      this._handleConnection(conn);
    });
  }

  sendMessage(peerId, message) {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      conn.send(message);
    } else {
      console.error('No open connection to', peerId);
    }
  }

  setOnMessageCallback(cb)       { this.onMessageCallback = cb; }
  setOnPeerConnectedCallback(cb) { this.onPeerConnectedCallback = cb; }
  setOnPeerDisconnectedCallback(cb) { this.onPeerDisconnectedCallback = cb; }
  setOnErrorCallback(cb)         { this.onError = cb; }

  disconnect() {
    clearInterval(this.pingInterval);
    clearInterval(this.checkInterval);
    if (this.peer) this.peer.destroy();
    this.connections.clear();
    this.alivePeers.clear();
  }
}

export default new WebRTCService();
