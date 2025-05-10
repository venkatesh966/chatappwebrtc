import Peer from 'peerjs';

class WebRTCService {
  constructor() {
    this.peer = null;
    this.connections = new Map();
    this.onMessageCallback = null;
    this.onPeerConnectedCallback = null;
    this.onFileProgressCallback = null;
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
        // If peer is destroyed, reinitialize it
        if (!this.peer) {
          this.initialize();
        }

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

  setOnFileProgressCallback(cb) {
    this.onFileProgressCallback = cb;
  }

  async sendFile(peerId, file) {
    const conn = this.connections.get(peerId);
    if (!conn || !conn.open) {
      console.error('No open connection to', peerId);
      throw new Error('No open connection to peer');
    }

    // Adjust file size limits based on file type
    const MAX_FILE_SIZE = {
      'application/pdf': 200 * 1024 * 1024, // 200MB for PDFs
      'image/': 50 * 1024 * 1024, // 50MB for images
      'default': 100 * 1024 * 1024 // 100MB default
    };

    // Determine the appropriate size limit
    let sizeLimit = MAX_FILE_SIZE.default;
    if (file.type === 'application/pdf') {
      sizeLimit = MAX_FILE_SIZE['application/pdf'];
    } else if (file.type.startsWith('image/')) {
      sizeLimit = MAX_FILE_SIZE['image/'];
    }

    if (file.size > sizeLimit) {
      const limitInMB = sizeLimit / (1024 * 1024);
      throw new Error(`File size exceeds limit of ${limitInMB}MB for ${file.type} files`);
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const buffer = e.target.result;
        
        // Adjust chunk size based on file type
        let chunkSize;
        if (file.type === 'application/pdf') {
          chunkSize = 1024 * 64; // 64KB chunks for PDFs
        } else if (file.type.startsWith('image/')) {
          chunkSize = 1024 * 8; // 8KB chunks for images to prevent corruption
        } else {
          chunkSize = 1024 * 32; // 32KB chunks for other files
        }

        const chunks = Math.ceil(buffer.byteLength / chunkSize);

        // Send metadata first
        conn.send({
          type: 'file',
          name: file.name,
          size: file.size,
          mimeType: file.type,
          totalChunks: chunks,
          chunkSize: chunkSize
        });

        // Then send each chunk with metadata
        for (let i = 0; i < chunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, buffer.byteLength);
          const chunk = buffer.slice(start, end);
          
          // Send chunk with metadata
          conn.send({
            type: 'fileChunk',
            fileName: file.name,
            index: i,
            chunk: chunk,
            totalChunks: chunks,
            isLastChunk: i === chunks - 1
          });
          
          // Add a small delay between chunks to prevent overwhelming the connection
          // Use shorter delay for images to improve transfer speed
          const delay = file.type.startsWith('image/') ? 5 : 20;
          await new Promise(r => setTimeout(r, delay));

          if (this.onFileProgressCallback) {
            this.onFileProgressCallback({
              fileName: file.name,
              progress: ((i + 1) / chunks) * 100
            });
          }
        }
      };

      reader.onerror = () => {
        throw new Error('Error reading file');
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error('Error sending file:', err);
      throw err;
    }
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
      this.peer = null; // Clear the peer instance
    }
  }
}

export default new WebRTCService();