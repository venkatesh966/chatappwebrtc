import Peer from 'peerjs';

class WebRTCService {
  constructor() {
    this.peer = null;
    this.connections = new Map();
    this.onMessageCallback = null;
    this.onPeerConnectedCallback = null;
    this.onFileProgressCallback = null;
    this.onCallStatusCallback = null;
    this.localStream = null;
    this.call = null;
    this.isMuted = false;
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

    this.peer.on('call', (call) => {
      // Send acknowledgment that the call is ringing to the caller
      const connToCaller = this.connections.get(call.peer);
      if (connToCaller && connToCaller.open) {
        connToCaller.send({ type: 'call_ringing_ack' });
      } else {
        console.warn("No open data connection to caller to send call_ringing_ack, peer:", call.peer);
        // Proceeding with incoming call status anyway, caller might not get ringing feedback.
      }

      if (this.onCallStatusCallback) {
        this.onCallStatusCallback('incoming', call);
      }
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

    // Validate file
    if (!file || !(file instanceof File)) {
      throw new Error('Invalid file object');
    }

    if (file.size === 0) {
      throw new Error('Cannot send empty file');
    }

    // Adjust file size limits based on file type
    const MAX_FILE_SIZE = {
      'application/pdf': 500 * 1024 * 1024, // 500MB for PDFs
      'image/': 500 * 1024 * 1024, // 500MB for images
      'default': 500 * 1024 * 1024 // 500MB default
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
        
        // Adjust chunk size based on file type and size
        let chunkSize;
        if (file.type === 'application/pdf') {
          chunkSize = Math.min(1024 * 64, Math.max(1024 * 16, Math.floor(file.size / 1000))); // 16KB-64KB for PDFs
        } else if (file.type.startsWith('image/')) {
          chunkSize = Math.min(1024 * 16, Math.max(1024 * 4, Math.floor(file.size / 2000))); // 4KB-16KB for images
        } else {
          chunkSize = Math.min(1024 * 32, Math.max(1024 * 8, Math.floor(file.size / 1000))); // 8KB-32KB for others
        }

        const chunks = Math.ceil(buffer.byteLength / chunkSize);
        const fileId = `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Send metadata first
        conn.send({
          type: 'file',
          name: file.name,
          size: file.size,
          mimeType: file.type,
          totalChunks: chunks,
          chunkSize: chunkSize,
          fileId: fileId,
          timestamp: Date.now()
        });

        // Wait a bit after sending metadata
        await new Promise(r => setTimeout(r, 100));

        // Then send each chunk with metadata
        for (let i = 0; i < chunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, buffer.byteLength);
          const chunk = buffer.slice(start, end);
          
          // Send chunk with metadata
          const chunkData = {
            type: 'fileChunk',
            fileName: file.name,
            fileId: fileId,
            index: i,
            chunk: chunk,
            totalChunks: chunks,
            timestamp: Date.now()
          };

          // Retry mechanism for chunk sending
          let retryCount = 0;
          const maxRetries = 3;
          let success = false;

          while (!success && retryCount < maxRetries) {
            try {
              conn.send(chunkData);
              success = true;
            } catch (err) {
              retryCount++;
              if (retryCount === maxRetries) {
                throw new Error(`Failed to send chunk ${i + 1} after ${maxRetries} attempts`);
              }
              await new Promise(r => setTimeout(r, 100 * retryCount)); // Exponential backoff
            }
          }
          
          // Add a small delay between chunks to prevent overwhelming the connection
          const delay = file.type.startsWith('image/') ? 10 : 20;
          await new Promise(r => setTimeout(r, delay));

          if (this.onFileProgressCallback) {
            this.onFileProgressCallback({
              fileName: file.name,
              progress: ((i + 1) / chunks) * 100,
              fileId: fileId
            });
          }
        }

        // Send completion message
        conn.send({
          type: 'fileComplete',
          fileName: file.name,
          fileId: fileId,
          timestamp: Date.now()
        });
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

  // Audio Call Methods
  async startCall(peerId) {
    try {
      // Request audio permissions and get local stream
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create a call to the peer
      this.call = this.peer.call(peerId, this.localStream);
      
      // Set up call event handlers
      this.call.on('stream', (remoteStream) => {
        // Handle incoming stream
        if (this.onCallStatusCallback) {
          this.onCallStatusCallback('active', remoteStream);
        }
      });

      this.call.on('close', () => {
        this.endCall();
      });

      if (this.onCallStatusCallback) {
        this.onCallStatusCallback('connecting');
      }

      return true;
    } catch (error) {
      console.error('Error starting call:', error);
      if (this.onCallStatusCallback) {
        this.onCallStatusCallback('error', null, error.message);
      }
      return false;
    }
  }

  async answerCall(call) {
    try {
      this.call = call;
      
      // Request audio permissions and get local stream
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Answer the call with local stream
      this.call.answer(this.localStream);
      
      // Set up call event handlers
      this.call.on('stream', (remoteStream) => {
        if (this.onCallStatusCallback) {
          this.onCallStatusCallback('active', remoteStream);
        }
      });

      this.call.on('close', () => {
        this.endCall();
      });

      if (this.onCallStatusCallback) {
        this.onCallStatusCallback('connecting');
      }

      return true;
    } catch (error) {
      console.error('Error answering call:', error);
      if (this.onCallStatusCallback) {
        this.onCallStatusCallback('error', null, error.message);
      }
      return false;
    }
  }

  endCall() {
    if (this.call) {
      this.call.close();
      this.call = null;
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.onCallStatusCallback) {
      this.onCallStatusCallback('ended');
    }
  }

  rejectCall(callObject) {
    if (callObject) {
      callObject.close();
      console.log("Call rejected by peerId:", callObject.peer);
      // If this was the active call, nullify it.
      // This helps prevent issues if endCall() is called later for a call that was already rejected.
      if (this.call && this.call.peer === callObject.peer) {
          this.call = null;
      }
      // Note: We don't stop localStream here as it might be in use or wanted for a new call.
      // The UI/logic in useChatLogic handles stopping sounds and stream if user confirms rejection.
    }
    // No specific status callback here, useChatLogic handles UI changes upon rejection.
  }

  toggleMute() {
    if (this.localStream) {
      this.isMuted = !this.isMuted;
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted;
      });
      return this.isMuted;
    }
    return false;
  }

  setOnCallStatusCallback(callback) {
    this.onCallStatusCallback = callback;
  }
}

export default new WebRTCService();