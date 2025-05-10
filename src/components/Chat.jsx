import { useState, useEffect, useRef } from 'react';
import WebRTCService from '../services/WebRTCService';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Stack,
  Alert,
  Avatar,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CallEndIcon from '@mui/icons-material/CallEnd';
import PersonIcon from '@mui/icons-material/Person';

const Chat = () => {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [peerId, setPeerId] = useState('');
  const [myId, setMyId] = useState('');
  const [disconnectReason, setDisconnectReason] = useState(null);
  const endRef = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    WebRTCService.initialize();
    setMyId(localStorage.getItem('peerjs_id'));

    WebRTCService.setOnMessageCallback((data) => {
      if (typeof data === 'object') {
        switch (data.type) {
          case 'message':
            setMessages((prev) => [...prev, { text: data.content, sender: 'peer' }]);
            break;
          case 'disconnect':
            setMessages((prev) => [...prev, { 
              text: data.message, 
              sender: 'system',
              isSystem: true 
            }]);
            setDisconnectReason(data.reason);
            setConnected(false);
            break;
          default:
            console.warn('Unknown message type:', data.type);
        }
      } else {
        setMessages((prev) => [...prev, { text: data, sender: 'peer' }]);
      }
    });

    WebRTCService.setOnPeerConnectedCallback((peerId) => {
      setPeerId(peerId);
      setConnected(true);
      setDisconnectReason(null);
      setMessages((prev) => [...prev, { 
        text: 'Connected to peer!', 
        sender: 'system',
        isSystem: true 
      }]);
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
    setMessages((prev) => [...prev, { text, sender: 'me' }]);
    WebRTCService.sendMessage(peerId, text);
    setInputMessage('');
  };

  const handleEndSession = () => {
    WebRTCService.disconnect();
    setDisconnectReason('user_disconnect');
    setConnected(false);
  };

  return (
    <Box
      sx={{
        maxWidth: 400,
        minWidth: 340,
        minHeight: 420,
        mx: 'auto',
        mt: 10,
        borderRadius: 4,
        boxShadow: 8,
        bgcolor: 'background.paper',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Minimal Header */}
      <Box
        sx={{
          background: 'linear-gradient(90deg, #4f8cff 0%, #3ff57a 100%)',
          py: 2,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}
      >
        <Avatar
          sx={{
            bgcolor: 'white',
            color: '#4f8cff',
            width: 44,
            height: 44,
            fontSize: 28,
            border: '2px solid #3b6be0',
          }}
        >
          <PersonIcon fontSize="inherit" />
        </Avatar>
        <Typography
          variant="subtitle1"
          sx={{
            color: '#fff',
            fontWeight: 600,
            fontSize: 18,
            userSelect: 'all',
            letterSpacing: 0.5,
          }}
        >
          Your ID: <b style={{ color: '#fff' }}>{myId}</b>
        </Typography>
      </Box>

      <Box sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!connected ? (
          <>
            {disconnectReason && (
              <Alert 
                severity={disconnectReason === 'browser_close' ? 'warning' : 'info'} 
                sx={{ mb: 2 }}
              >
                {disconnectReason === 'browser_close' 
                  ? 'Connection was lost unexpectedly'
                  : 'Session has been ended'}
              </Alert>
            )}
            <Stack direction="row" spacing={1} mb={2} mt={6}>
              <TextField
                placeholder="Enter peer ID"
                variant="outlined"
                size="small"
                value={peerId}
                onChange={(e) => setPeerId(e.target.value)}
                fullWidth
                InputProps={{ style: { fontSize: 15, padding: 8 } }}
              />
              <Button
                variant="contained"
                onClick={handleConnect}
                sx={{
                  minWidth: 90,
                  fontSize: 15,
                  fontWeight: 600,
                  py: 1,
                  px: 2,
                  borderRadius: 2,
                  boxShadow: 1,
                }}
                size="small"
              >
                CONNECT
              </Button>
            </Stack>
          </>
        ) : (
          <>
            <Box
              sx={{
                minHeight: 180,
                maxHeight: 220,
                overflowY: 'auto',
                mb: 2,
                bgcolor: 'grey.50',
                borderRadius: 2,
                p: 1,
                border: '1px solid #e3e8f0',
                flex: 1,
              }}
            >
              {messages.length === 0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: 'center', mt: 4, opacity: 0.7 }}
                >
                  Say hello to your peer!
                </Typography>
              )}
              {messages.map((m, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    justifyContent: m.sender === 'me' ? 'flex-end' : 'flex-start',
                    mb: 1,
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: m.isSystem 
                        ? 'warning.light'
                        : m.sender === 'me'
                          ? 'primary.main'
                          : 'grey.200',
                      color: m.isSystem 
                        ? 'warning.contrastText'
                        : m.sender === 'me'
                          ? 'primary.contrastText'
                          : 'text.primary',
                      px: 2,
                      py: 1,
                      borderRadius: 2,
                      maxWidth: '75%',
                      fontSize: 15,
                      wordBreak: 'break-word',
                      fontStyle: m.isSystem ? 'italic' : 'normal',
                    }}
                  >
                    {m.text}
                  </Box>
                </Box>
              ))}
              <div ref={endRef} />
            </Box>

            <form onSubmit={handleSendMessage}>
              <Stack direction="row" spacing={1}>
                <TextField
                  placeholder="Type your message..."
                  variant="outlined"
                  size="small"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  fullWidth
                  InputProps={{ style: { fontSize: 15, padding: 8 } }}
                />
                <IconButton
                  type="submit"
                  color="primary"
                  disabled={!inputMessage.trim()}
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    width: 38,
                    height: 38,
                    borderRadius: 2,
                    fontSize: 20,
                    '&:hover': { bgcolor: 'primary.dark' },
                  }}
                >
                  <SendIcon fontSize="inherit" />
                </IconButton>
              </Stack>
            </form>

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