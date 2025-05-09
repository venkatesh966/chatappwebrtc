import { useState, useEffect, useRef } from 'react';
import WebRTCService from '../services/WebRTCService';
import './Chat.css';

const Chat = () => {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [peerId, setPeerId] = useState('');
  const [myId, setMyId] = useState('');
  const endRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // initialize PeerJS (static ID in localStorage)
    WebRTCService.initialize();
    setMyId(localStorage.getItem('peerjs_id'));

    WebRTCService.setOnMessageCallback((data) => {
      setMessages(prev => [...prev, { text: data, sender: 'peer' }]);
    });

    return () => {
      WebRTCService.disconnect();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleConnect = async () => {
    const id = peerId.trim();
    if (!id) {
      setError('Please enter a peer ID');
      return;
    }
    
    try {
      setError('');
      await WebRTCService.connectToPeer(id);
      setConnected(true);
    } catch (err) {
      setError('Failed to connect: ' + (err.message || 'Unknown error'));
      console.error('Connection error:', err);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text) return;
    setMessages(prev => [...prev, { text, sender: 'me' }]);
    WebRTCService.sendMessage(peerId, text);
    setInputMessage('');
  };

  const handleEndSession = () => {
    WebRTCService.disconnect();
    setConnected(false);
    setPeerId('');
    setMessages([]);

    // Re-init (reuses the same ID)
    WebRTCService.initialize();
    setMyId(localStorage.getItem('peerjs_id'));
  };

  return (
    <div className="chat-card">
      <div className="chat-body">
        <div className="my-id-ui">
          Your ID: <b>{myId}</b>
        </div>

        {error && (
          <div className="error-message" style={{ color: 'red', margin: '10px 0' }}>
            {error}
          </div>
        )}

        {!connected ? (
          <div className="peer-connect-ui">
            <input
              type="text"
              value={peerId}
              onChange={e => setPeerId(e.target.value)}
              placeholder="Enter peer ID to connect"
            />
            <button onClick={handleConnect}>Connect</button>
          </div>
        ) : (
          <>
            <div className="messages-container-ui">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`message-ui ${
                    m.sender === 'me' ? 'sent-ui' : 'received-ui'
                  }`}
                >
                  {m.text}
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <form onSubmit={handleSendMessage} className="message-input-ui">
              <input
                type="text"
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                placeholder="Type your message here..."
              />
              <button type="submit" className="send-btn-ui">
                ➤
              </button>
            </form>

            <button className="end-session-btn-ui" onClick={handleEndSession}>
              End Session
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Chat;
