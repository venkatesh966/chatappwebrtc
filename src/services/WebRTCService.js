import Peer from 'peerjs';

class WebRTCService {
  constructor() {
    this.peer = null;
    this.connections = new Map();
    this.onMessageCallback = null;
  }

  initialize(userId) {
    this.peer = new Peer(userId);
    
    this.peer.on('open', (id) => {
      console.log('My peer ID is: ' + id);
    });

    this.peer.on('connection', (conn) => {
      this.handleConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('PeerJS error:', err);
    });
  }

  handleConnection(conn) {
    conn.on('open', () => {
      console.log('Connected to peer:', conn.peer);
      this.connections.set(conn.peer, conn);
    });

    conn.on('data', (data) => {
      if (this.onMessageCallback) {
        this.onMessageCallback(data);
      }
    });

    conn.on('close', () => {
      console.log('Connection closed with peer:', conn.peer);
      this.connections.delete(conn.peer);
    });
  }

  connectToPeer(peerId) {
    const conn = this.peer.connect(peerId);
    this.handleConnection(conn);
    return conn;
  }

  sendMessage(peerId, message) {
    const conn = this.connections.get(peerId);
    if (conn) {
      conn.send(message);
    } else {
      console.error('No connection found for peer:', peerId);
    }
  }

  setOnMessageCallback(callback) {
    this.onMessageCallback = callback;
  }

  disconnect() {
    if (this.peer) {
      this.peer.destroy();
    }
  }
}

export default new WebRTCService(); 