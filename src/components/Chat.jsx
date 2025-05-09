import { useState, useEffect, useRef } from 'react';
import WebRTCService from '../services/WebRTCService';
import './Chat.css';

const Chat = () => {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [peerId, setPeerId] = useState('');
  const [myId, setMyId] = useState('');
  const messagesEndRef = useRef(null);

  // initialize once, using the persisted peer ID
  useEffect(() => {
    WebRTCService.initialize();
    setMyId(localStorage.getItem('peerjs_id'));

    WebRTCService.setOnMessageCallback((data) => {
      setMessages(prev => [...prev, { text: data, sender: 'peer' }]);
    });

    return () => {
      WebRTCService.disconnect();
    };
  }, []);

  // auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleConnect = () => {
    const id = peerId.trim();
    if (!id) return;
    WebRTCService.connectToPeer(id);
    setConnected(true);
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

    // re-initialize (will reuse same ID)
    WebRTCService.initialize();
    setMyId(localStorage.getItem('peerjs_id'));
  };

  return (
    <div className="chat-card">
      <div className="chat-body">
        <div className="my-id-ui">
          Your ID: <b>{myId}</b>
        </div>

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
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`message-ui ${msg.sender === 'me' ? 'sent-ui' : 'received-ui'}`}
                >
                  {msg.text}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="message-input-ui">
              <input
                type="text"
                value={inputMessage}
                onChange={e => setInputMessage(e.target.value)}
                placeholder="Type your message here..."
              />
              <button type="submit" className="send-btn-ui">➤</button>
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
