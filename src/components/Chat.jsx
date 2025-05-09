import { useState, useEffect, useRef } from 'react';
import WebRTCService from '../services/WebRTCService';
import './Chat.css';

const Chat = () => {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Welcome to our store! Whether you have a specific question or need assistance, we're here for you. What would you like to know? 😉", sender: 'bot' },
    { text: "Don't spend hours searching for the right product. We'll help you find exactly what you need in no-time! Also, feel free to check our items on sale now. 💥", sender: 'bot' },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [peerId, setPeerId] = useState('');
  const [myId, setMyId] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const userId = 'user_' + Math.random().toString(36).substr(2, 9);
    WebRTCService.initialize(userId);
    setMyId(userId);
    WebRTCService.setOnMessageCallback((data) => {
      setMessages((prevMessages) => [...prevMessages, { text: data, sender: 'peer' }]);
    });
    return () => {
      WebRTCService.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleConnect = () => {
    if (peerId) {
      WebRTCService.connectToPeer(peerId);
      setConnected(true);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      const message = inputMessage.trim();
      setMessages((prev) => [...prev, { text: message, sender: 'me' }]);
      WebRTCService.sendMessage(peerId, message);
      setInputMessage('');
    }
  };

  const handleEndSession = () => {
    WebRTCService.disconnect();
    setConnected(false);
    setPeerId('');
    setMessages([
      { text: "Welcome to our store! Whether you have a specific question or need assistance, we're here for you. What would you like to know? 😉", sender: 'bot' },
      { text: "Don't spend hours searching for the right product. We'll help you find exactly what you need in no-time! Also, feel free to check our items on sale now. 💥", sender: 'bot' },
    ]);
    // Re-initialize peer for new session
    const userId = 'user_' + Math.random().toString(36).substr(2, 9);
    WebRTCService.initialize(userId);
    setMyId(userId);
  };

  return (
    <div className="chat-card">
      <div className="chat-body">
        <div className="my-id-ui" style={{ marginBottom: 16, textAlign: 'center' }}>
          Your ID: <b>{myId}</b>
        </div>
        {!connected ? (
          <div className="peer-connect-ui" style={{ justifyContent: 'center' }}>
            <input
              type="text"
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
              placeholder="Enter peer ID to connect"
              style={{ flex: 2 }}
            />
            <button onClick={handleConnect} style={{ flex: 1 }}>Connect</button>
          </div>
        ) : (
          <>
            <div className="messages-container-ui">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`message-ui ${message.sender === 'me' ? 'sent-ui' : message.sender === 'bot' ? 'bot-ui' : 'received-ui'}`}
                >
                  {message.text}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="message-input-ui">
              <span className="emoji-icon-ui">😊</span>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type your message here..."
              />
              <button type="submit" className="send-btn-ui">
                ➤
              </button>
            </form>
            <button className="end-session-btn-ui" onClick={handleEndSession} style={{marginTop: 8, width: '100%'}}>End Session</button>
          </>
        )}
      </div>
    </div>
  );
};

export default Chat; 