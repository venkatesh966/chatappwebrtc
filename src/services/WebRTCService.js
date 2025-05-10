import Peer from 'peerjs';

class WebRTCService {
  constructor() {
    this.peer = null;
    this.connections = new Map();
    this.onMessageCallback = null;
    this.onPeerConnectedCallback = null;
  }

  initialize() {
    // 1) Grab or create a persistent ID
    let userId = localStorage.getItem('peerjs_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('peerjs_id', userId);
    }

    // 2) Use the default PeerJS cloud server
    this.peer = new Peer(userId);

    this.peer.on('open', (id) => {
      console.log('🟢 Peer open. My ID:', id);
    });

    this.peer.on('connection', (conn) => {
      this._handleConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('PeerJS error:', err);
    });

    // Add browser close event listener
    window.addEventListener('beforeunload', this._handleBrowserClose.bind(this));
  }

  _handleConnection(conn) {
    conn.on('open', () => {
      console.log('➡️ Connected to', conn.peer);
      this.connections.set(conn.peer, conn);
      if (this.onPeerConnectedCallback) {
        this.onPeerConnectedCallback(conn.peer);
      }
    });

    conn.on('data', (data) => {
      if (this.onMessageCallback) this.onMessageCallback(data);
    });

    conn.on('close', () => {
      console.log('❌ Connection closed with', conn.peer);
      this.connections.delete(conn.peer);
    });
  }

  connectToPeer(peerId) {
    return new Promise((resolve, reject) => {
      try {
        const conn = this.peer.connect(peerId);
        
        conn.on('open', () => {
          console.log('➡️ Connected to', conn.peer);
          this.connections.set(conn.peer, conn);
          resolve(conn);
        });

        conn.on('error', (err) => {
          console.error('Connection error:', err);
          reject(err);
        });

        this._handleConnection(conn);
      } catch (err) {
        console.error('Failed to connect:', err);
        reject(err);
      }
    });
  }

  sendMessage(peerId, message) {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      // If message is a string, wrap it in an object with type 'message'
      const messageObj = typeof message === 'string' 
        ? { type: 'message', content: message }
        : message;
      conn.send(messageObj);
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

  _handleBrowserClose() {
    // Notify all connected peers before browser closes
    this.connections.forEach((conn, peerId) => {
      if (conn && conn.open) {
        conn.send({ 
          type: 'disconnect', 
          message: 'Peer has disconnected unexpectedly',
          reason: 'browser_close'
        });
      }
    });
  }

  disconnect() {
    // Notify all connected peers before disconnecting
    this.connections.forEach((conn, peerId) => {
      if (conn && conn.open) {
        conn.send({ 
          type: 'disconnect', 
          message: 'Peer has ended the session',
          reason: 'user_disconnect'
        });
      }
    });

    // Remove browser close event listener
    window.removeEventListener('beforeunload', this._handleBrowserClose.bind(this));

    if (this.peer) {
      this.peer.destroy();
      this.connections.clear();
    }
  }
}

export default new WebRTCService();