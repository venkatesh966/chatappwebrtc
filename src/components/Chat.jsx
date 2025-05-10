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
  const [error, setError] = useState('');
  const [peerDisconnected, setPeerDisconnected] = useState(false);

  const endRef = useRef(null);

  // refs to keep latest values for unload handler
  const connectedRef = useRef(false);
  const peerIdRef   = useRef('');

  // Sync refs whenever state updates
  useEffect(() => { connectedRef.current = connected; }, [connected]);
  useEffect(() => { peerIdRef.current   = peerId;   }, [peerId]);

  // 1) Initialize once
  useEffect(() => {
    WebRTCService.initialize();

    WebRTCService.ready
      .then((id) => setMyId(id))
      .catch((err) => setError('Init error: ' + err.message));

    WebRTCService.setOnMessageCallback((data) => {
      if (data === '__DISCONNECT__') {
        setPeerDisconnected(true);
        setConnected(false);
        setPeerId('');
      } else {
        setMessages((prev) => [
          ...prev,
          { text: data, sender: 'peer', timestamp: new Date().toISOString() },
        ]);
      }
    });

    WebRTCService.setOnPeerConnectedCallback((id) => {
      setPeerId(id);
      setConnected(true);
      setPeerDisconnected(false);
    });

    WebRTCService.setOnPeerDisconnectedCallback(() => {
      setPeerDisconnected(true);
      setConnected(false);
      setPeerId('');
    });

    WebRTCService.setOnErrorCallback((err) => {
      setError('Peer error: ' + err.message);
    });

    // unload notifier
    const handleBeforeUnload = () => {
      if (connectedRef.current && peerIdRef.current) {
        WebRTCService.sendMessage(peerIdRef.current, '__DISCONNECT__');
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      WebRTCService.disconnect();
    };
  }, []); // <-- only once

  // auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // connect button
  const handleConnect = async () => {
    if (!peerId.trim()) {
      setError('Please enter a peer ID');
      return;
    }
    try {
      setError('');
      await WebRTCService.connectToPeer(peerId.trim());
      // no need to manually setConnected — it's done in the callback
    } catch (err) {
      setError('Failed to connect: ' + err.message);
    }
  };

  // send chat
  const handleSendMessage = (text) => {
    if (!text.trim()) return;
    const timestamp = new Date().toISOString();
    setMessages((prev) => [...prev, { text, sender: 'me', timestamp }]);
    WebRTCService.sendMessage(peerId, text);
  };

  // end session
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
    WebRTCService.ready.then((id) => setMyId(id));
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
                peerEmoji="🧑"
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
