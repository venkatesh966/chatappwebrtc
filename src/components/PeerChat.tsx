import { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import './PeerChat.css';

const PeerChat = () => {
  const [myId, setMyId] = useState<string>('...');
  const [messages, setMessages] = useState<Array<{ text: string; type: 'peer' | 'self' | 'status' }>>([]);
  const [targetId, setTargetId] = useState<string>('');
  const [messageInput, setMessageInput] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<import('peerjs').DataConnection | null>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaConnectionRef = useRef<import('peerjs').MediaConnection | null>(null);

  useEffect(() => {
    // Initialize PeerJS
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      setMyId(id);
    });

    peer.on('connection', (incomingConn) => {
      connRef.current = incomingConn;
      setIsConnected(true);
      addMessage('Connected to peer', 'status');
      
      incomingConn.on('data', (data: unknown) => {
        addMessage(String(data), 'peer');
      });

      incomingConn.on('close', () => {
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
    };
  }, []);

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

    const conn = peerRef.current.connect(targetId);
    connRef.current = conn;

    conn.on('open', () => {
      setIsConnected(true);
      addMessage(`Connected to ${targetId}`, 'status');
      conn.on('data', (data: unknown) => {
        addMessage(String(data), 'peer');
      });
    });

    conn.on('close', () => {
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
            {msg.type === 'status' ? msg.text : 
              msg.type === 'peer' ? `Peer: ${msg.text}` : `You: ${msg.text}`}
          </div>
        ))}
      </div>

      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
};

export default PeerChat; 