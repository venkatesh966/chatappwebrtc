import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import './PeerChat.css';

const PEER_ID_KEY = 'peerjs_id';
const PEER_ID_TIMESTAMP_KEY = 'peerjs_id_timestamp';
const PEER_ID_TTL = 30 * 60 * 1000; // 30 minutes in ms

function getOrCreatePeerId() {
  const now = Date.now();
  const savedId = localStorage.getItem(PEER_ID_KEY);
  const savedTimestamp = localStorage.getItem(PEER_ID_TIMESTAMP_KEY);

  if (
    savedId &&
    savedTimestamp &&
    now - parseInt(savedTimestamp, 10) < PEER_ID_TTL
  ) {
    return savedId;
  }

  // Generate a new random ID
  // Peer.generateId() is not a public API, so use random string
  const newId = Math.random().toString(36).substr(2, 16);
  localStorage.setItem(PEER_ID_KEY, newId);
  localStorage.setItem(PEER_ID_TIMESTAMP_KEY, now.toString());
  return newId;
}

const PeerChat = () => {
  const [myId, setMyId] = useState<string>('...');
  const [messages, setMessages] = useState<Array<{ text: string; type: 'peer' | 'self' | 'status' }>>([]);
  const [targetId, setTargetId] = useState<string>('');
  const [messageInput, setMessageInput] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Heartbeat state and ref
  const [lastPing, setLastPing] = useState(Date.now());
  const heartbeatIntervalRef = useRef<number | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<import('peerjs').DataConnection | null>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaConnectionRef = useRef<import('peerjs').MediaConnection | null>(null);

  useEffect(() => {
    // Use a constant ID for 30 minutes
    const id = getOrCreatePeerId();
    setMyId(id);

    const peer = new Peer(id);
    peerRef.current = peer;

    peer.on('open', (id) => {
      setMyId(id);
    });

    peer.on('connection', (incomingConn) => {
      // Clear any previous heartbeat interval
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

      connRef.current = incomingConn;
      setIsConnected(true);
      setLastPing(Date.now());
      addMessage('Connected to peer', 'status');

      // Heartbeat sender for this connection
      heartbeatIntervalRef.current = window.setInterval(() => {
        if (incomingConn.open) {
          incomingConn.send('__ping__');
        }
      }, 5000);

      incomingConn.on('data', (data: unknown) => {
        if (data === '__ping__') {
          setLastPing(Date.now());
          return;
        }
        setLastPing(Date.now());
        addMessage(String(data), 'peer');
      });

      incomingConn.on('close', () => {
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        setIsConnected(false);
        addMessage('Connection closed', 'status');
      });
    });

    // Handle incoming calls
    peer.on('call', async (call) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaConnectionRef.current = call;

        if (localAudioRef.current) {
          localAudioRef.current.srcObject = stream;
        }

        call.answer(stream);
        setIsCallActive(true);
        addMessage('Incoming call answered', 'status');

        call.on('stream', (remoteStream) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
          }
        });

        call.on('close', () => {
          endCall();
        });
      } catch (err) {
        console.error('Failed to get local stream:', err);
        addMessage('Failed to start audio call', 'status');
      }
    });

    // Cleanup on component unmount
    return () => {
      peer.destroy();
      endCall();
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, []);

  // Heartbeat timeout checker
  useEffect(() => {
    if (!isConnected) return;
    const timeoutCheck = window.setInterval(() => {
      if (isConnected && Date.now() - lastPing > 15000) {
        setIsConnected(false);
        addMessage('Peer disconnected (timeout)', 'status');
        if (connRef.current) connRef.current.close();
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      }
    }, 5000);
    return () => clearInterval(timeoutCheck);
  }, [isConnected, lastPing]);

  const addMessage = (text: string, type: 'peer' | 'self' | 'status') => {
    setMessages(prev => [...prev, { text, type }]);
    setTimeout(() => {
      if (chatBoxRef.current) {
        chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
      }
    }, 100);
  };

  const connectToPeer = () => {
    if (!peerRef.current || !targetId) return;

    // Clear any previous heartbeat interval
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

    const conn = peerRef.current.connect(targetId);
    connRef.current = conn;

    conn.on('open', () => {
      setIsConnected(true);
      setLastPing(Date.now());
      addMessage(`Connected to ${targetId}`, 'status');

      // Heartbeat sender for this connection
      heartbeatIntervalRef.current = window.setInterval(() => {
        if (conn.open) {
          conn.send('__ping__');
        }
      }, 5000);

      conn.on('data', (data: unknown) => {
        if (data === '__ping__') {
          setLastPing(Date.now());
          return;
        }
        setLastPing(Date.now());
        addMessage(String(data), 'peer');
      });
    });

    conn.on('close', () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      setIsConnected(false);
      addMessage('Connection closed', 'status');
    });
  };

  const startCall = async () => {
    if (!peerRef.current || !targetId || isCallActive) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const call = peerRef.current.call(targetId, stream);
      mediaConnectionRef.current = call;

      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }

      call.on('stream', (remoteStream) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
        }
      });

      call.on('close', () => {
        endCall();
      });

      setIsCallActive(true);
      addMessage('Call started', 'status');
    } catch (err) {
      console.error('Failed to get local stream:', err);
      addMessage('Failed to start audio call', 'status');
    }
  };

  const endCall = () => {
    if (mediaConnectionRef.current) {
      mediaConnectionRef.current.close();
      mediaConnectionRef.current = null;
    }

    if (localAudioRef.current?.srcObject) {
      const stream = localAudioRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      localAudioRef.current.srcObject = null;
    }

    if (remoteAudioRef.current?.srcObject) {
      const stream = remoteAudioRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      remoteAudioRef.current.srcObject = null;
    }

    setIsCallActive(false);
    addMessage('Call ended', 'status');
  };

  const toggleMute = () => {
    if (localAudioRef.current?.srcObject) {
      const stream = localAudioRef.current.srcObject as MediaStream;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const sendMessage = () => {
    if (!connRef.current?.open || !messageInput) return;

    connRef.current.send(messageInput);
    addMessage(messageInput, 'self');
    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="peer-chat">
      <h2>PeerJS Chat</h2>
      <div className="peer-id">
        <strong>Your ID:</strong> <span>{myId}</span>
      </div>

      <input
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        placeholder="Enter peer ID to connect"
        disabled={isConnected}
      />
      <button 
        onClick={connectToPeer}
        disabled={isConnected || !targetId}
      >
        {isConnected ? 'Connected' : 'Connect'}
      </button>

      <div className="call-controls">
        <button 
          onClick={startCall}
          disabled={!isConnected || isCallActive}
          className="call-button"
        >
          Start Call
        </button>
        <button 
          onClick={endCall}
          disabled={!isCallActive}
          className="end-call-button"
        >
          End Call
        </button>
        <button 
          onClick={toggleMute}
          disabled={!isCallActive}
          className={`mute-button ${isMuted ? 'muted' : ''}`}
        >
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
      </div>

      <input
        value={messageInput}
        onChange={(e) => setMessageInput(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Type your message..."
        disabled={!isConnected}
      />
      <button 
        onClick={sendMessage}
        disabled={!isConnected || !messageInput}
      >
        Send Message
      </button>

      <div className="chat-box" ref={chatBoxRef}>
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`message ${msg.type === 'status' ? 'connection-status' : msg.type}`}
          >
            {msg.type === 'self' ? `You: ${msg.text}` : msg.text}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PeerChat;