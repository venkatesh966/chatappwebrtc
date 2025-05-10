import { useState, useEffect, useRef } from 'react';
import WebRTCService from '../services/WebRTCService';
import { Box, Stack, Alert, Collapse, Button } from '@mui/material';
import CallEndIcon from '@mui/icons-material/CallEnd';
import ChatHeader from './ChatHeader';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';

const INITIAL_HEIGHT = 340;
const CHAT_HEIGHT = 540;
const CARD_WIDTH = 750;

const Chat = () => {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [peerId, setPeerId] = useState('');
  const [myId, setMyId] = useState('');
  const endRef = useRef(null);
  const [error, setError] = useState('');
  const [peerEmoji] = useState('🧑');
  const [peerDisconnected, setPeerDisconnected] = useState(false);

  // Always get the latest peer ID from localStorage
  const updateMyId = () => setMyId(localStorage.getItem('peerjs_id') || '');

  useEffect(() => {
    WebRTCService.initialize();
    updateMyId();

    WebRTCService.setOnMessageCallback((data) => {
      if (data === '__DISCONNECT__') {
        setPeerDisconnected(true);
        setConnected(false);
        setPeerId('');
        return;
      }
      setMessages((prev) => [
        ...prev,
        { text: data, sender: 'peer', timestamp: new Date().toISOString() }
      ]);
    });

    WebRTCService.setOnPeerConnectedCallback((peerId) => {
      setPeerId(peerId);
      setConnected(true);
    });

    WebRTCService.setOnPeerDisconnectedCallback(() => {
      setPeerDisconnected(true);
      setConnected(false);
      setPeerId('');
    });

    // Notify peer on browser/tab close
    const handleBeforeUnload = () => {
      if (connected && peerId) {
        WebRTCService.sendMessage(peerId, '__DISCONNECT__');
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      WebRTCService.disconnect();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
    // eslint-disable-next-line
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
    }
  };

  const handleSendMessage = (text) => {
    if (!text.trim()) return;
    const timestamp = new Date().toISOString();
    setMessages((prev) => [...prev, { text, sender: 'me', timestamp }]);
    WebRTCService.sendMessage(peerId, text);
  };

  const handleEndSession = () => {
    if (peerId) {
      WebRTCService.sendMessage(peerId, '__DISCONNECT__');
    }
    setConnected(false);
    setPeerId('');
    setMessages([]);
    setPeerDisconnected(false);
    WebRTCService.disconnect();
    WebRTCService.initialize();
    updateMyId();
  };

  return (
    <Box
      sx={{
        maxWidth: CARD_WIDTH,
        minWidth: 480,
        minHeight: connected ? CHAT_HEIGHT : INITIAL_HEIGHT,
        transition: 'min-height 0.4s cubic-bezier(.4,2,.6,1)',
        mx: 'auto',
        mt: 8,
        borderRadius: 4,
        boxShadow: 8,
        bgcolor: 'background.paper',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ChatHeader myId={myId} />
      <Box sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {peerDisconnected && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Peer has disconnected.
          </Alert>
        )}
        {!connected ? (
          <Stack direction="row" spacing={1} mb={2} mt={6}>
            <ChatInput
              value={peerId}
              onChange={setPeerId}
              onSend={handleConnect}
              connectMode={true}
            />
          </Stack>
        ) : (
          <>
            <Collapse in={connected}>
              <ChatMessages
                messages={messages}
                peerEmoji={peerEmoji}
                endRef={endRef}
              />
            </Collapse>
            <ChatInput
              value={inputMessage}
              onChange={setInputMessage}
              onSend={() => {
                handleSendMessage(inputMessage);
                setInputMessage('');
              }}
            />
            <Button
              variant="outlined"
              color="error"
              startIcon={<CallEndIcon />}
              fullWidth
              onClick={handleEndSession}
              sx={{
                fontSize: 15,
                fontWeight: 600,
                py: 1,
                borderRadius: 2,
                mt: 2,
              }}
            >
              End Session
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
};

export default Chat;
