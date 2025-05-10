// src/services/WebRTCService.js
import Peer from 'peerjs';

const ID_KEY = 'webrtc_user_id';

function generateId() {
  return 'user_' + Math.random().toString(36).substr(2, 9);
}

function getOrCreateUserId() {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

class WebRTCService {
  constructor() {
    this.peer = null;
    this.connections = new Map();
    this.onMessageCallback = null;
    this.onPeerConnectedCallback = null;
    this.onPeerDisconnectedCallback = null;
    this.onError = null;

    // Heartbeat state
    this.alivePeers = new Map();
    this.pingInterval = null;
    this.checkInterval = null;

    // Promise that resolves when Peer is open
    this.ready = null;
  }

  initialize() {
    const userId = getOrCreateUserId();
    this.peer = new Peer(userId);

    this.peer.on('open', (id) => {
      console.log('🟢 Peer open. My ID:', id);
    });

    this.peer.on('connection', (conn) => {
      this._handleConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      if (this.onError) this.onError(err);
    });

    this.peer.on('disconnected', () => {
      console.warn('⚠️ Peer disconnected, reconnecting…');
      this.peer.reconnect();
    });

    this.peer.on('close', () => {
      console.log('🛑 Peer closed');
      this.connections.clear();
      this.alivePeers.clear();
    });

    // start heartbeat ping/pong
    this._startHeartbeat();
  }

  _startHeartbeat() {
    // send PING every 5s
    this.pingInterval = setInterval(() => {
      for (const conn of this.connections.values()) {
        if (conn.open) conn.send('__PING__');
      }
    }, 5000);

    // check for stale peers every 5s (>15s no PONG)
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
      this.connections.set(conn.peer, conn);
      this.alivePeers.set(conn.peer, Date.now());
      if (this.onPeerConnectedCallback) {
        this.onPeerConnectedCallback(conn.peer);
      }
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

    conn.on('error', err => {
      console.error('Connection error:', err);
      if (this.onError) this.onError(err);
    });
  }

  _cleanupPeer(peerId) {
    if (this.connections.has(peerId)) {
      this.connections.get(peerId).close();
      this.connections.delete(peerId);
      this.alivePeers.delete(peerId);
      if (this.onPeerDisconnectedCallback) {
        this.onPeerDisconnectedCallback(peerId);
      }
    }
  }

  connectToPeer(peerId) {
    return new Promise((resolve, reject) => {
      try {
        const conn = this.peer.connect(peerId);
        if (!conn) {
          reject(new Error('Could not create connection. Peer may be offline or unavailable.'));
          return;
        }
        conn.on('open', () => {
          this.connections.set(conn.peer, conn);
          resolve(conn);
        });
        conn.on('error', (err) => {
          reject(err);
        });
        this._handleConnection(conn);
      } catch (err) {
        reject(err);
      }
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

  setOnMessageCallback(cb) {
    this.onMessageCallback = cb;
  }

  setOnPeerConnectedCallback(cb) {
    this.onPeerConnectedCallback = cb;
  }

  setOnPeerDisconnectedCallback(cb) {
    this.onPeerDisconnectedCallback = cb;
  }

  setOnErrorCallback(cb) {
    this.onError = cb;
  }

  disconnect() {
    clearInterval(this.pingInterval);
    clearInterval(this.checkInterval);
    if (this.peer) {
      this.peer.destroy();
      this.connections.clear();
      this.alivePeers.clear();
    }
  }
}

export default new WebRTCService();
