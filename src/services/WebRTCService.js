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
    
    // Screen sharing properties
    this.screenStream = null;
    this.screenCall = null;
    this.isScreenSharing = false;
    this.onScreenShareStatusCallback = null;
    this.screenShareType = null; // 'sending' | 'receiving' | null
    this.screenShareQuality = 'medium'; // 'low' | 'medium' | 'high'
  }

  initialize() {
    let userId = localStorage.getItem('peerjs_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('peerjs_id', userId);
    }

    // Configure ICE servers for better connectivity
    const peerConfig = {
      config: {
        iceServers: [
          // Google's public STUN servers (multiple for redundancy)
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
          
          // Additional reliable STUN servers
          { urls: 'stun:stun.stunprotocol.org:3478' },
          { urls: 'stun:stun.voiparound.com' },
          { urls: 'stun:stun.voipbuster.com' },
          
          // TURN servers using port 80 (HTTP) - works through most firewalls
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          
          // TURN servers using port 443 (HTTPS) - works through strictest firewalls  
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject', 
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          
          // Additional TURN servers for institutional networks
          {
            urls: 'turn:relay.backups.cz',
            username: 'webrtc',
            credential: 'webrtc'
          },
          {
            urls: 'turn:relay.backups.cz:443',
            username: 'webrtc', 
            credential: 'webrtc'
          },
          
          // Twilio's STUN (reliable for enterprise)
          { urls: 'stun:global.stun.twilio.com:3478' },
          
          // More free TURN servers that work with restrictive networks
          {
            urls: 'turn:turn.bistri.com:80',
            username: 'homeo',
            credential: 'homeo'
          },
          {
            urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
            username: 'webrtc',
            credential: 'webrtc'  
          }
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all'
      },
      debug: process.env.NODE_ENV === 'development' ? 3 : 0
    };

    this.peer = new Peer(userId, peerConfig);

    this.peer.on('open', (id) => {
      console.log('PeerJS connected with ID:', id);
    });

    this.peer.on('connection', (conn) => {
      if (this.connections.size > 0) {
        conn.on('open', () => {
          conn.send({ type: 'session_full', message: 'The peer is already in a session.' });
          setTimeout(() => conn.close(), 100); 
        });
        return;
      }
      this._handleConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('PeerJS Error:', err);
      
      // Handle specific error types
      switch (err.type) {
        case 'network':
          console.error('Network error - check internet connection');
          break;
        case 'peer-unavailable':
          console.error('Peer unavailable - they may be offline or using a different ID');
          break;
        case 'browser-incompatible':
          console.error('Browser incompatible - WebRTC not supported');
          break;
        case 'disconnected':
          console.error('Disconnected from PeerJS server - attempting reconnect');
          this._attemptReconnect();
          break;
        case 'invalid-id':
          console.error('Invalid peer ID format');
          break;
        case 'ssl-unavailable':
          console.error('SSL not available - HTTPS required for WebRTC');
          break;
        default:
          console.error('Unknown PeerJS error:', err);
      }
    });

    this.peer.on('disconnected', () => {
      console.warn('PeerJS disconnected - attempting reconnect');
      this._attemptReconnect();
    });

    this.peer.on('close', () => {
      this.peer = null;
    });

    this.peer.on('call', (call) => {
      const connToCaller = this.connections.get(call.peer);
      if (connToCaller && connToCaller.open) {
        connToCaller.send({ type: 'call_ringing_ack' });
      } else {}

      // Check if this is a screen share call
      if (call.metadata && call.metadata.type === 'screen-share') {
        if (this.onScreenShareStatusCallback) {
          this.onScreenShareStatusCallback('incoming', call);
        }
      } else {
        // Regular audio call
        if (this.onCallStatusCallback) {
          this.onCallStatusCallback('incoming', call);
        }
      }
    });

    window.addEventListener('beforeunload', this._handleBrowserClose.bind(this));
  }

  _handleConnection(conn) {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      if (this.onPeerConnectedCallback) {
        this.onPeerConnectedCallback(conn.peer);
      }
    });

    conn.on('data', (data) => {
      if (this.onMessageCallback) this.onMessageCallback(data);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
    });
  }

  connectToPeer(peerId) {
    return new Promise((resolve, reject) => {
      try {
        if (!this.peer) {
          this.initialize();
        }

        // Check if peer is ready
        if (!this.peer.id || this.peer.destroyed) {
          reject(new Error('PeerJS not ready. Please wait and try again.'));
          return;
        }

        // Check for valid peer ID
        if (!peerId || peerId.trim() === '' || peerId === this.peer.id) {
          reject(new Error('Invalid peer ID or attempting to connect to self'));
          return;
        }

        console.log(`Attempting to connect to peer: ${peerId}`);
        const conn = this.peer.connect(peerId, {
          reliable: true,
          serialization: 'json'
        });

        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
          console.error('Connection timeout - peer may be unreachable');
          conn.close();
          reject(new Error('Connection timeout. The peer may be offline or unreachable.'));
        }, 15000); // 15 second timeout
        
        conn.on('open', () => {
          clearTimeout(connectionTimeout);
          console.log(`Successfully connected to peer: ${peerId}`);
          this.connections.set(conn.peer, conn);
          resolve(conn);
        });

        conn.on('error', (err) => {
          clearTimeout(connectionTimeout);
          console.error('Connection error:', err);
          reject(err);
        });

        conn.on('close', () => {
          clearTimeout(connectionTimeout);
          console.log(`Connection closed with peer: ${peerId}`);
        });

        this._handleConnection(conn);
      } catch (err) {
        console.error('Error in connectToPeer:', err);
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
    } else {}
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
      throw new Error('No open connection to peer');
    }

    if (!file || !(file instanceof File)) {
      throw new Error('Invalid file object');
    }

    if (file.size === 0) {
      throw new Error('Cannot send empty file');
    }

    const MAX_FILE_SIZE_INDIVIDUAL = 1024 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE_INDIVIDUAL) {
      const limitInMB = MAX_FILE_SIZE_INDIVIDUAL / (1024 * 1024);
      throw new Error(`File size exceeds the individual limit of ${limitInMB}MB.`);
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const buffer = e.target.result;
        
        let chunkSize;
        if (file.type === 'application/pdf') {
          chunkSize = Math.min(1024 * 64, Math.max(1024 * 16, Math.floor(file.size / 1000)));
        } else if (file.type.startsWith('image/')) {
          chunkSize = Math.min(1024 * 16, Math.max(1024 * 4, Math.floor(file.size / 2000)));
        } else {
          chunkSize = Math.min(1024 * 32, Math.max(1024 * 8, Math.floor(file.size / 1000)));
        }

        const chunks = Math.ceil(buffer.byteLength / chunkSize);
        const fileId = `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

        await new Promise(r => setTimeout(r, 100));

        for (let i = 0; i < chunks; i++) {
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, buffer.byteLength);
          const chunk = buffer.slice(start, end);
          
          const chunkData = {
            type: 'fileChunk',
            fileName: file.name,
            fileId: fileId,
            index: i,
            chunk: chunk,
            totalChunks: chunks,
            timestamp: Date.now()
          };

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
              await new Promise(r => setTimeout(r, 100 * retryCount));
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
    this.connections.forEach((conn, peerId) => {
      if (conn && conn.open) {
        conn.send({ 
          type: 'disconnect', 
          message: 'Peer has ended the session.',
          reason: 'user_disconnect'
        });
      }
    });

    // Clean up screen sharing
    this.endScreenShare();

    window.removeEventListener('beforeunload', this._handleBrowserClose.bind(this));

    if (this.peer) {
      this.peer.destroy();
      this.connections.clear();
      this.peer = null;
    }
  }

  async startCall(peerId) {
    if (!this.peer || !this.peer.id || this.peer.destroyed || (typeof this.peer.disconnected === 'boolean' && this.peer.disconnected)) {
      if (this.onCallStatusCallback) {
        this.onCallStatusCallback('error', null, 'WebRTC service is not ready or peer is disconnected. Please check connection.');
      }
      return false;
    }

    if (!peerId) {
        if (this.onCallStatusCallback) {
            this.onCallStatusCallback('error', null, 'Cannot start call: Target peer ID is missing.');
        }
        return false;
    }

    if (this.peer && this.peer.id === peerId) {
      if (this.onCallStatusCallback) {
        this.onCallStatusCallback('error', null, 'Cannot initiate a call with yourself.');
      }
      return false;
    }

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (!this.peer || typeof this.peer.call !== 'function' || this.peer.destroyed || (typeof this.peer.disconnected === 'boolean' && this.peer.disconnected)) {
        if (this.onCallStatusCallback) {
          this.onCallStatusCallback('error', null, 'Failed to initiate call: WebRTC peer object became invalid before calling.');
        }
        if (this.localStream) {
          this.localStream.getTracks().forEach(track => track.stop()); this.localStream = null;
        }
        return false;
      }
      
      this.call = this.peer.call(peerId, this.localStream);
      
      if (!this.call) {
        if (this.onCallStatusCallback) {
          this.onCallStatusCallback('error', null, 'Failed to initiate call with PeerJS.');
        }
        if (this.localStream) {
          this.localStream.getTracks().forEach(track => track.stop()); this.localStream = null;
        }
        return false;
      }

      this.call.on('stream', (remoteStream) => {
        if (this.onCallStatusCallback) {
          this.onCallStatusCallback('active', remoteStream);
        }
      });

      this.call.on('close', () => {
        this.endCall(); 
      });

      this.call.on('error', (err) => {
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
      return true;
    } catch (error) {
      let errorMessage = 'Failed to start call.';
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = 'Failed to start call: No microphone found or permission denied.';
      } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Failed to start call: Microphone permission was denied.';
      } else if (error.message) {
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
      }
      return false;
    }
  }

  async answerCall(call) {
    try {
      this.call = call;
      
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.call.answer(this.localStream);
      
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
      if (this.onCallStatusCallback) {
        this.onCallStatusCallback('error', null, error.message);
      }
      return false;
    }
  }

  endCall() {
    let callWasActive = false;
    if (this.call) {
      this.call.close();
      this.call = null;
      callWasActive = true;
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.onCallStatusCallback && callWasActive) {
      this.onCallStatusCallback('ended');
    } else if (this.onCallStatusCallback && !callWasActive) {}
  }

  rejectCall(callObject) {
    if (callObject) {
      callObject.close();
      if (this.call && this.call.peer === callObject.peer) {
          this.call = null;
      }
    }
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

  // Screen sharing methods
  async startScreenShare(peerId, options = {}) {
    if (!this.peer || !this.peer.id || this.peer.destroyed || (typeof this.peer.disconnected === 'boolean' && this.peer.disconnected)) {
      if (this.onScreenShareStatusCallback) {
        this.onScreenShareStatusCallback('error', null, 'WebRTC service is not ready or peer is disconnected. Please check connection.');
      }
      return false;
    }

    if (!peerId) {
      if (this.onScreenShareStatusCallback) {
        this.onScreenShareStatusCallback('error', null, 'Cannot start screen share: Target peer ID is missing.');
      }
      return false;
    }

    if (this.peer && this.peer.id === peerId) {
      if (this.onScreenShareStatusCallback) {
        this.onScreenShareStatusCallback('error', null, 'Cannot share screen with yourself.');
      }
      return false;
    }

    // Check if already sharing
    if (this.isScreenSharing) {
      if (this.onScreenShareStatusCallback) {
        this.onScreenShareStatusCallback('error', null, 'Already sharing screen. Stop current session first.');
      }
      return false;
    }

    try {
      // Define screen share constraints based on quality
      const constraints = this._getScreenShareConstraints(options.quality || this.screenShareQuality);
      
      // Request screen sharing permission
      this.screenStream = await navigator.mediaDevices.getDisplayMedia(constraints);
      
      if (!this.peer || typeof this.peer.call !== 'function' || this.peer.destroyed || (typeof this.peer.disconnected === 'boolean' && this.peer.disconnected)) {
        if (this.onScreenShareStatusCallback) {
          this.onScreenShareStatusCallback('error', null, 'Failed to initiate screen share: WebRTC peer object became invalid.');
        }
        if (this.screenStream) {
          this.screenStream.getTracks().forEach(track => track.stop());
          this.screenStream = null;
        }
        return false;
      }

      // Create screen share call
      this.screenCall = this.peer.call(peerId, this.screenStream, { metadata: { type: 'screen-share' } });
      
      if (!this.screenCall) {
        if (this.onScreenShareStatusCallback) {
          this.onScreenShareStatusCallback('error', null, 'Failed to initiate screen share with PeerJS.');
        }
        if (this.screenStream) {
          this.screenStream.getTracks().forEach(track => track.stop());
          this.screenStream = null;
        }
        return false;
      }

      // Set up screen share call event handlers
      this.screenCall.on('stream', (remoteStream) => {
        // This event is for receiving streams, not relevant for sender
        console.log('Unexpected stream event on sender side');
      });

      this.screenCall.on('close', () => {
        this.endScreenShare();
      });

      this.screenCall.on('error', (err) => {
        const errorMessage = this._mapScreenShareError(err);
        if (this.onScreenShareStatusCallback) {
          this.onScreenShareStatusCallback('error', null, errorMessage);
        }
      });

      // Handle screen share end when user stops sharing via browser UI
      this.screenStream.getVideoTracks()[0].addEventListener('ended', () => {
        this.endScreenShare();
      });

      this.isScreenSharing = true;
      this.screenShareType = 'sending';

      // For sender, immediately set to active since we have the screen stream
      if (this.onScreenShareStatusCallback) {
        this.onScreenShareStatusCallback('active', this.screenStream, null, 'sending');
      }

      return true;
    } catch (error) {
      const errorMessage = this._mapScreenShareError(error);
      if (this.onScreenShareStatusCallback) {
        this.onScreenShareStatusCallback('error', null, errorMessage);
      }
      if (this.screenStream) {
        this.screenStream.getTracks().forEach(track => track.stop());
        this.screenStream = null;
      }
      return false;
    }
  }

  async answerScreenShare(screenCall) {
    try {
      this.screenCall = screenCall;
      this.screenShareType = 'receiving';
      
      // Answer the screen share call
      this.screenCall.answer();
      
      this.screenCall.on('stream', (remoteStream) => {
        if (this.onScreenShareStatusCallback) {
          this.onScreenShareStatusCallback('active', remoteStream, null, 'receiving');
        }
      });

      this.screenCall.on('close', () => {
        this.endScreenShare();
      });

      this.screenCall.on('error', (err) => {
        const errorMessage = this._mapScreenShareError(err);
        if (this.onScreenShareStatusCallback) {
          this.onScreenShareStatusCallback('error', null, errorMessage);
        }
      });

      if (this.onScreenShareStatusCallback) {
        this.onScreenShareStatusCallback('connecting', null, null, 'receiving');
      }

      return true;
    } catch (error) {
      const errorMessage = this._mapScreenShareError(error);
      if (this.onScreenShareStatusCallback) {
        this.onScreenShareStatusCallback('error', null, errorMessage);
      }
      return false;
    }
  }

  endScreenShare() {
    let screenShareWasActive = false;
    
    if (this.screenCall) {
      this.screenCall.close();
      this.screenCall = null;
      screenShareWasActive = true;
    }
    
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }

    this.isScreenSharing = false;
    this.screenShareType = null;

    if (this.onScreenShareStatusCallback && screenShareWasActive) {
      this.onScreenShareStatusCallback('ended');
    }
  }

  rejectScreenShare(screenCallObject) {
    if (screenCallObject) {
      screenCallObject.close();
      if (this.screenCall && this.screenCall.peer === screenCallObject.peer) {
        this.screenCall = null;
      }
    }
  }

  setOnScreenShareStatusCallback(callback) {
    this.onScreenShareStatusCallback = callback;
  }

  _getScreenShareConstraints(quality = 'medium') {
    const constraints = {
      video: {
        mediaSource: 'screen'
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      }
    };

    switch (quality) {
      case 'low':
        constraints.video.width = { ideal: 1280, max: 1280 };
        constraints.video.height = { ideal: 720, max: 720 };
        constraints.video.frameRate = { ideal: 15, max: 15 };
        break;
      case 'high':
        constraints.video.width = { ideal: 1920, max: 1920 };
        constraints.video.height = { ideal: 1080, max: 1080 };
        constraints.video.frameRate = { ideal: 30, max: 30 };
        break;
      case 'medium':
      default:
        constraints.video.width = { ideal: 1920, max: 1920 };
        constraints.video.height = { ideal: 1080, max: 1080 };
        constraints.video.frameRate = { ideal: 15, max: 15 };
        break;
    }

    return constraints;
  }

  _mapScreenShareError(error) {
    if (!error) return 'An unknown screen sharing error occurred.';

    const errorName = error.name || '';
    const errorMessage = error.message || '';

    switch (errorName) {
      case 'NotAllowedError':
        return 'Screen sharing permission was denied. Please allow screen sharing and try again.';
      case 'NotFoundError':
        return 'No screen sources found. Please ensure you have windows or screens available to share.';
      case 'NotSupportedError':
        return 'Screen sharing is not supported in your browser. Please use a modern browser like Chrome, Firefox, or Edge.';
      case 'AbortError':
        return 'Screen sharing was cancelled by the user.';
      case 'NotReadableError':
        return 'Cannot access screen due to hardware or system restrictions.';
      case 'OverconstrainedError':
        return 'Screen sharing failed due to technical constraints. Try adjusting quality settings.';
      case 'SecurityError':
        return 'Screen sharing blocked due to security restrictions.';
      case 'TypeError':
        return 'Screen sharing failed due to a technical error. Please try again.';
      default:
        if (errorMessage.includes('peer-unavailable')) {
          return 'Cannot share screen: The other person is unavailable.';
        }
        if (errorMessage.includes('connection-error')) {
          return 'Screen sharing failed due to a connection error.';
        }
        if (errorMessage.includes('network')) {
          return 'Screen sharing failed due to a network problem.';
        }
        return `Screen sharing error: ${errorMessage || 'Please try again.'}`;
    }
  }

  // Add reconnection logic
  _attemptReconnect() {
    if (this.peer && !this.peer.destroyed) {
      try {
        this.peer.reconnect();
      } catch (err) {
        console.error('Reconnection failed:', err);
        // Reinitialize if reconnect fails
        setTimeout(() => {
          this.initialize();
        }, 2000);
      }
    }
  }

  // Add connection diagnostics
  getDiagnosticInfo() {
    return {
      peerId: this.peer?.id || 'Not connected',
      isDestroyed: this.peer?.destroyed || false,
      isDisconnected: this.peer?.disconnected || false,
      connections: this.connections.size,
      activeConnections: Array.from(this.connections.keys())
    };
  }

  // Detect if we're on a restrictive network (college/corporate)
  async detectRestrictiveNetwork() {
    try {
      // Test if we can reach STUN servers
      const stunTest = await this.testStunConnectivity();
      
      // Test if direct P2P is possible
      const p2pTest = await this.testP2PConnectivity();
      
      return {
        isRestrictive: !stunTest.success || !p2pTest.success,
        stunBlocked: !stunTest.success,
        p2pBlocked: !p2pTest.success,
        recommendTurnOnly: !stunTest.success && !p2pTest.success
      };
    } catch (error) {
      console.error('Network detection failed:', error);
      // Conservative fallback - don't recommend TURN-only if detection fails
      return { 
        isRestrictive: false, 
        recommendTurnOnly: false, 
        error: error.message 
      };
    }
  }

  async testStunConnectivity() {
    try {
      return new Promise((resolve) => {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        const timeout = setTimeout(() => {
          try {
            pc.close();
          } catch (e) {
            // Ignore close errors
          }
          resolve({ success: false, reason: 'timeout' });
        }, 5000);

        pc.onicecandidate = (event) => {
          try {
            if (event.candidate && event.candidate.candidate.includes('srflx')) {
              clearTimeout(timeout);
              pc.close();
              resolve({ 
                success: true, 
                publicIP: event.candidate.candidate.split(' ')[4] 
              });
            }
          } catch (e) {
            console.warn('Error processing ICE candidate:', e);
            clearTimeout(timeout);
            pc.close();
            resolve({ success: false, reason: 'processing_error' });
          }
        };

        pc.onerror = (error) => {
          console.warn('RTCPeerConnection error in STUN test:', error);
          clearTimeout(timeout);
          try {
            pc.close();
          } catch (e) {
            // Ignore close errors
          }
          resolve({ success: false, reason: 'connection_error' });
        };

        try {
          pc.createDataChannel('test');
          pc.createOffer().then(offer => pc.setLocalDescription(offer))
            .catch(error => {
              console.warn('Error creating offer:', error);
              clearTimeout(timeout);
              pc.close();
              resolve({ success: false, reason: 'offer_error' });
            });
        } catch (error) {
          console.warn('Error in STUN test setup:', error);
          clearTimeout(timeout);
          pc.close();
          resolve({ success: false, reason: 'setup_error' });
        }
      });
    } catch (error) {
      console.warn('STUN connectivity test failed:', error);
      return { success: false, reason: 'test_failed', error: error.message };
    }
  }

  async testP2PConnectivity() {
    try {
      // Simple heuristic: check if we're behind symmetric NAT
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      const isLikelyCorporate = (typeof window !== 'undefined' && window.location) ? 
                              (window.location.hostname.includes('edu') || 
                               window.location.hostname.includes('corp') ||
                               (connection && connection.effectiveType === 'slow-2g')) : false;
      
      return {
        success: !isLikelyCorporate,
        reason: isLikelyCorporate ? 'corporate_network_detected' : 'ok'
      };
    } catch (error) {
      console.warn('P2P connectivity test failed:', error);
      // Conservative fallback - assume P2P is possible if test fails
      return { success: true, reason: 'test_failed_assume_ok' };
    }
  }

  // Create restrictive network configuration (TURN-only)
  getRestrictiveNetworkConfig(userId) {
    return {
      config: {
        iceServers: [
          // Only use TURN servers with standard ports for restrictive networks
          {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          },
          {
            urls: 'turn:relay.backups.cz:443',
            username: 'webrtc',
            credential: 'webrtc'
          },
          {
            urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
            username: 'webrtc',
            credential: 'webrtc'
          }
        ],
        iceCandidatePoolSize: 15,
        iceTransportPolicy: 'relay' // FORCE TURN-only for restrictive networks
      },
      debug: 3 // More debugging for restrictive networks
    };
  }

  // Enhanced connection method for restrictive networks
  async connectToPeerWithFallback(peerId) {
    // Environment flag to disable enhanced connection (for maximum backward compatibility)
    const DISABLE_ENHANCED_CONNECTION = localStorage.getItem('disable_enhanced_connection') === 'true';
    
    if (DISABLE_ENHANCED_CONNECTION) {
      console.log('Enhanced connection disabled, using standard method only');
      return await this.connectToPeer(peerId);
    }
    
    console.log('Attempting connection with network detection...');
    
    // First, try the original connection method (100% backward compatible)
    try {
      console.log('Trying standard connection method...');
      return await this.connectToPeer(peerId);
    } catch (error) {
      console.log('Standard connection failed:', error.message);
      
      // Only try advanced detection if the basic method fails
      try {
        console.log('Attempting network restriction detection...');
        
        // Detect if we're on a restrictive network
        const networkInfo = await this.detectRestrictiveNetwork();
        
        if (networkInfo && networkInfo.recommendTurnOnly) {
          console.log('Restrictive network detected, trying TURN-only mode...');
          return await this.connectWithTurnOnly(peerId);
        } else {
          console.log('Network detection inconclusive, using original error');
          // If network detection doesn't recommend TURN-only, throw original error
          throw error;
        }
      } catch (detectionError) {
        console.warn('Network detection failed:', detectionError.message);
        // If detection itself fails, just throw the original connection error
        throw error;
      }
    }
  }

  async connectWithTurnOnly(peerId) {
    console.log('Connecting with TURN-only configuration for restrictive networks...');
    
    // Safety check - don't proceed if we don't have a valid peer ID
    if (!peerId || typeof peerId !== 'string' || peerId.trim() === '') {
      throw new Error('Invalid peer ID for TURN-only connection');
    }
    
    // Store original peer for restoration if needed
    const originalPeer = this.peer;
    let newPeer = null;
    
    try {
      // Create new TURN-only peer without affecting the original
      const userId = localStorage.getItem('peerjs_id');
      if (!userId) {
        throw new Error('No user ID available for TURN-only connection');
      }
      
      const restrictiveConfig = this.getRestrictiveNetworkConfig(userId);
      
      // Create new peer instance for TURN-only
      newPeer = new Peer(userId + '_turn', restrictiveConfig);
      
      return new Promise((resolve, reject) => {
        let isResolved = false;
        
        const cleanup = () => {
          if (newPeer && !newPeer.destroyed) {
            try {
              newPeer.destroy();
            } catch (e) {
              console.warn('Error cleaning up TURN-only peer:', e);
            }
          }
        };
        
        // Set timeout for TURN connection
        const turnTimeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            cleanup();
            reject(new Error('TURN-only connection timeout. Network may be completely blocking P2P.'));
          }
        }, 30000); // 30 second timeout for TURN connections
        
        newPeer.on('open', () => {
          if (isResolved) return;
          
          console.log('TURN-only peer initialized, attempting connection...');
          
          const conn = newPeer.connect(peerId, {
            reliable: true,
            serialization: 'json'
          });
          
          conn.on('open', () => {
            if (isResolved) return;
            isResolved = true;
            clearTimeout(turnTimeout);
            
            console.log('TURN-only connection successful!');
            
            // Replace the original peer with the TURN-only peer
            if (originalPeer && !originalPeer.destroyed) {
              try {
                originalPeer.destroy();
              } catch (e) {
                console.warn('Error destroying original peer:', e);
              }
            }
            
            this.peer = newPeer;
            this.connections.set(conn.peer, conn);
            this._handleConnection(conn);
            resolve(conn);
          });

          conn.on('error', (err) => {
            if (isResolved) return;
            isResolved = true;
            clearTimeout(turnTimeout);
            
            console.error('TURN-only connection error:', err);
            cleanup();
            reject(err);
          });

          conn.on('close', () => {
            console.log('TURN-only connection closed');
          });
        });

        newPeer.on('error', (err) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(turnTimeout);
          
          console.error('TURN-only peer error:', err);
          cleanup();
          reject(err);
        });
      });
    } catch (error) {
      console.error('Error setting up TURN-only connection:', error);
      
      // Clean up on error
      if (newPeer && !newPeer.destroyed) {
        try {
          newPeer.destroy();
        } catch (e) {
          console.warn('Error cleaning up failed TURN-only peer:', e);
        }
      }
      
      throw error;
    }
  }
}

export default new WebRTCService();