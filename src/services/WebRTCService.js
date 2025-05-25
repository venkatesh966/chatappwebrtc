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
      // Check if already connected to someone
      if (this.connections.size > 0) {
        console.warn(`Already connected to a peer. Rejecting new connection from ${conn.peer}.`);
        conn.on('open', () => { // Need to wait for open to send, otherwise it might fail
          conn.send({ type: 'session_full', message: 'The peer is already in a session.' });
          // Close the connection after a short delay to ensure message is sent
          setTimeout(() => conn.close(), 100); 
        });
        // If 'open' never fires (e.g. network issue before full handshake), this connection won't be fully processed.
        // We might not even need to manually close if we don't add it to this.connections.
        // However, explicitly closing after sending message is safer.
        return; // Do not proceed to _handleConnection
      }
      this._handleConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('[WebRTCService] PeerJS instance ERROR event. Type:', err.type, 'Error:', err);
      // Optionally, you could try to inform the UI or re-initialize, but be cautious of loops.
      // For now, just logging is important for diagnosis.
      // if (this.onCallStatusCallback) {
      //   this.onCallStatusCallback('error', null, `PeerJS system error: ${err.type}`);
      // }
      // If the error is fatal, PeerJS might destroy the peer object internally.
    });

    this.peer.on('disconnected', () => {
      console.warn('[WebRTCService] PeerJS instance DISCONNECTED event. The peer has disconnected from the PeerServer.');
      // PeerJS will attempt to reconnect automatically. If it fails, an 'error' event might follow.
      // We might not need to nullify `this.peer` here yet, as PeerJS attempts to auto-reconnect.
      // However, if calls fail after this, it indicates reconnection failed.
    });

    this.peer.on('close', () => {
      // This event is when the peer is destroyed (e.g., by calling peer.destroy())
      console.warn('[WebRTCService] PeerJS instance CLOSE event. The peer has been destroyed and can no longer make or receive connections.');
      this.peer = null; // Ensure our reference is also nulled if PeerJS says it's closed.
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
      console.log("[WebRTCService] Received data:", JSON.stringify(data)); // Log all incoming data
      if (data && data.type === 'fileComplete') {
        console.log("[WebRTCService] Received fileComplete event for fileId:", data.fileId);
      }
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
    
      const messageObj = typeof message === 'string' 
        ? { type: 'message', content: message }
        : message;
      conn.send(messageObj);
    } else {
      console.error('No open connection to', peerId);
    }
  }

  setOnMessageCallback(cb) {
    console.log("[WebRTCService] setOnMessageCallback called. New callback being set."); 
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
    const MAX_FILE_SIZE_INDIVIDUAL = 1024 * 1024 * 1024; // 1GB per file

    if (file.size > MAX_FILE_SIZE_INDIVIDUAL) {
      const limitInMB = MAX_FILE_SIZE_INDIVIDUAL / (1024 * 1024);
      throw new Error(`File size exceeds the individual limit of ${limitInMB}MB.`);
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
          
        
          const delay = file.type.startsWith('image/') ? 10 : 20;
          await new Promise(r => setTimeout(r, delay));

          if (this.onFileProgressCallback) {
            this.onFileProgressCallback({
              fileName: file.name,
              fileSize: file.size,
              progress: ((i + 1) / chunks) * 100,
              fileId: fileId
            });
          }
        }

        // Send completion message
        console.log(`[WebRTCService - Sender] Sending fileComplete for fileId: ${fileId}, fileName: ${file.name}`); // Log before sending
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
   
    this.connections.forEach((conn, peerId) => {
      if (conn && conn.open) {
        conn.send({ 
          type: 'disconnect', 
          message: 'Peer has disconnected.', 
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
          message: 'Peer has ended the session.',
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
    console.log(`[WebRTCService] Attempting to start call with peer: ${peerId}. Current this.peer status - ID: ${this.peer ? this.peer.id : 'N/A'}, destroyed: ${this.peer ? this.peer.destroyed : 'N/A'}, disconnected: ${this.peer ? this.peer.disconnected : 'N/A'}, open: ${this.peer ? this.peer.open : 'N/A'}`);

    if (!this.peer || !this.peer.id || this.peer.destroyed || (typeof this.peer.disconnected === 'boolean' && this.peer.disconnected)) {
      console.error(`[WebRTCService] Pre-call check FAILED: Peer object invalid. ID: ${this.peer ? this.peer.id : 'N/A'}, Destroyed: ${this.peer ? this.peer.destroyed : 'N/A'}, Disconnected: ${this.peer ? this.peer.disconnected : 'N/A'}, Open: ${this.peer ? this.peer.open : 'N/A'}`);
      if (this.onCallStatusCallback) {
        this.onCallStatusCallback('error', null, 'WebRTC service is not ready or peer is disconnected. Please check connection.');
      }
      return false;
    }
    console.log(`[WebRTCService] Pre-call check PASSED. Peer status - ID: ${this.peer.id}, Destroyed: ${this.peer.destroyed}, Disconnected: ${this.peer.disconnected}, Open: ${this.peer.open}`);

    if (!peerId) {
        console.error('[WebRTCService] Cannot start call: No peerId provided.');
        if (this.onCallStatusCallback) {
            this.onCallStatusCallback('error', null, 'Cannot start call: Target peer ID is missing.');
        }
        return false;
    }

    if (this.peer && this.peer.id === peerId) {
      console.error('[WebRTCService] Cannot call self. Attempted to call own peer ID:', peerId);
      if (this.onCallStatusCallback) {
        this.onCallStatusCallback('error', null, 'Cannot initiate a call with yourself.');
      }
      return false;
    }

    try {
      console.log(`[WebRTCService] Requesting audio stream. Peer status before await: ID: ${this.peer.id}, Destroyed: ${this.peer.destroyed}, Disconnected: ${this.peer.disconnected}, Open: ${this.peer.open}`);
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log(`[WebRTCService] Acquired local audio stream. Peer status after await: ID: ${this.peer ? this.peer.id : 'N/A'}, Destroyed: ${this.peer ? this.peer.destroyed : 'N/A'}, Disconnected: ${this.peer ? this.peer.disconnected : 'N/A'}, Open: ${this.peer ? this.peer.open : 'N/A'}`);
      
      if (!this.peer || typeof this.peer.call !== 'function' || this.peer.destroyed || (typeof this.peer.disconnected === 'boolean' && this.peer.disconnected)) {
        console.error(`[WebRTCService] CRITICAL FAILURE: this.peer invalid before .call(). ID: ${this.peer ? this.peer.id : 'N/A'}, Destroyed: ${this.peer ? this.peer.destroyed : 'N/A'}, Disconnected: ${this.peer ? this.peer.disconnected : 'N/A'}, Open: ${this.peer ? this.peer.open : 'N/A'}, callIsFunction: ${!!(this.peer && typeof this.peer.call === 'function')}`);
        if (this.onCallStatusCallback) {
          this.onCallStatusCallback('error', null, 'Failed to initiate call: WebRTC peer object became invalid before calling.');
        }
        if (this.localStream) {
          this.localStream.getTracks().forEach(track => track.stop()); this.localStream = null;
          console.log('[WebRTCService] Cleaned up local stream due to invalid peer state before .call().');
        }
        return false;
      }
      
      console.log(`[WebRTCService] Calling peer: ${peerId}. Peer status before .call(): ID: ${this.peer.id}, Destroyed: ${this.peer.destroyed}, Disconnected: ${this.peer.disconnected}, Open: ${this.peer.open}. Proceeding.`);
      this.call = this.peer.call(peerId, this.localStream);
      
      if (!this.call) {
        console.error('[WebRTCService] Failed to create call object with PeerJS (this.peer.call returned null/undefined).');
        if (this.onCallStatusCallback) {
          this.onCallStatusCallback('error', null, 'Failed to initiate call with PeerJS.');
        }
        // Clean up local stream if acquired
        if (this.localStream) {
          this.localStream.getTracks().forEach(track => track.stop()); this.localStream = null;
          console.log('[WebRTCService] Cleaned up local stream after failing to create call object.');
        }
        return false;
      }
      console.log('[WebRTCService] PeerJS call object created:', this.call);

      this.call.on('stream', (remoteStream) => {
        console.log('[WebRTCService] Call stream received:', remoteStream);
        if (this.onCallStatusCallback) {
          this.onCallStatusCallback('active', remoteStream);
        }
      });

      this.call.on('close', () => {
        console.log('[WebRTCService] Call closed by peer or due to an error.');
        this.endCall(); 
      });

      this.call.on('error', (err) => {
        console.error('[WebRTCService] PeerJS call object error:', err);
        let callErrorMessage = 'Call failed';
        if (err && err.type) {
          switch (err.type) {
            case 'peer-unavailable': callErrorMessage = `Call failed: Peer ${peerId} is unavailable.`; break;
            case 'connection-error': callErrorMessage = 'Call failed due to a connection error.'; break;
            case 'network': callErrorMessage = 'Call failed due to a network error.'; break;
            case 'webrtc': callErrorMessage = 'Call failed due to a WebRTC error.'; break;
            default: callErrorMessage = `Call error: ${err.type}`;
          }
        } else if (err && err.message) {
          callErrorMessage = `Call error: ${err.message}`;
        } else if (typeof err === 'string') {
          callErrorMessage = `Call error: ${err}`;
        }
        if (this.onCallStatusCallback) {
          this.onCallStatusCallback('error', null, callErrorMessage);
        }
      });

      if (this.onCallStatusCallback) {
        this.onCallStatusCallback('connecting');
      }
      console.log('[WebRTCService] Call process initiated, status connecting.');
      return true;
    } catch (error) {
      console.error(`[WebRTCService] Error in startCall try-catch block. Message: ${error.message}. Peer state at catch: ID: ${this.peer ? this.peer.id : 'N/A'}, Destroyed: ${this.peer ? this.peer.destroyed : 'N/A'}, Disconnected: ${this.peer ? this.peer.disconnected : 'N/A'}, Open: ${this.peer ? this.peer.open : 'N/A'}`, error, 'Stack:', error.stack);
      let errorMessage = 'Failed to start call.';
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'Failed to start call: No microphone found or permission denied.';
      } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Failed to start call: Microphone permission was denied.';
      } else if (error.message) {
        // Use the specific error if it's "Cannot read properties of null (reading 'call')"
        if (error.message.includes("Cannot read properties of null (reading 'call')")) {
            errorMessage = "Failed to start call: Peer object became null unexpectedly.";
        } else {
            errorMessage = `Failed to start call: ${error.message}`;
        }
      }
      
      if (this.onCallStatusCallback) {
        this.onCallStatusCallback('error', null, errorMessage);
      }
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
        console.log('[WebRTCService] Cleaned up local stream after error in startCall catch block.');
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
    let callWasActive = false; // Flag to track if a call was truly active
    if (this.call) {
      this.call.close();
      this.call = null;
      callWasActive = true; // A call object existed
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
     
    }

   
    if (this.onCallStatusCallback && callWasActive) {
      this.onCallStatusCallback('ended');
    } else if (this.onCallStatusCallback && !callWasActive) {
     
      console.log("WebRTCService.endCall invoked, but no active call (this.call was null). Not sending 'ended' status.");
    }
  }

  rejectCall(callObject) {
    if (callObject) {
      callObject.close();
      console.log("Call rejected by peerId:", callObject.peer);
      if (this.call && this.call.peer === callObject.peer) {
          this.call = null;
      }
   
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