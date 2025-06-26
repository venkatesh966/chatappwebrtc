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

    this.peer = new Peer(userId);

    this.peer.on('open', (id) => {});

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

    this.peer.on('error', (err) => {});

    this.peer.on('disconnected', () => {});

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

        const conn = this.peer.connect(peerId);
        
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
            case 'peer-unavailable': callErrorMessage = `Call failed: Peer ${peerId} is unavailable. Ask them to connect to you instead.`; break;
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
          return 'Cannot share screen: The other person is unavailable. Ask them to connect to you instead.';
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
}

export default new WebRTCService();