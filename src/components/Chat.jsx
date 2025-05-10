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
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import Tooltip from '@mui/material/Tooltip';

const Chat = () => {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [peerId, setPeerId] = useState('');
  const [myId, setMyId] = useState('');
  const [disconnectReason, setDisconnectReason] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const endRef = useRef(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    WebRTCService.initialize();
    setMyId(localStorage.getItem('peerjs_id'));

    WebRTCService.setOnMessageCallback((data) => {
      if (typeof data === 'object') {
        switch (data.type) {
          case 'message':
            setMessages((prev) => [...prev, { text: data.content, sender: 'peer', time: new Date() }]);
            break;
          case 'disconnect':
            setMessages((prev) => [...prev, { 
              text: data.message, 
              sender: 'system',
              isSystem: true,
              time: new Date()
            }]);
            setDisconnectReason(data.reason);
            setConnected(false);
            setIsConnecting(false);
            break;
          default:
            console.warn('Unknown message type:', data.type);
        }
      } else {
        setMessages((prev) => [...prev, { text: data, sender: 'peer', time: new Date() }]);
      }
    });

    WebRTCService.setOnPeerConnectedCallback((peerId) => {
      setPeerId(peerId);
      setConnected(true);
      setDisconnectReason(null);
      setMessages((prev) => [...prev, { 
        text: 'Connected to peer!', 
        sender: 'system',
        isSystem: true,
        time: new Date()
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
      setIsConnecting(true);
      
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 10000); // 10 second timeout
      });

      // Race between connection and timeout
      await Promise.race([
        WebRTCService.connectToPeer(id),
        timeoutPromise
      ]);

      setConnected(true);
      setDisconnectReason(null);
    } catch (err) {
      setError('Failed to connect: ' + (err.message || 'Unknown error'));
      console.error('Connection error:', err);
      // Force reinitialize the service on error
      WebRTCService.disconnect();
      WebRTCService.initialize();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { text, sender: 'me', time: new Date() }]);
    WebRTCService.sendMessage(peerId, text);
    setInputMessage('');
  };

  const handleEndSession = () => {
    setIsConnecting(false); // Ensure loading state is cleared
    WebRTCService.disconnect();
    setDisconnectReason('user_disconnect');
    setConnected(false);
    // Clear messages after a short delay to allow disconnect message to be sent
    setTimeout(() => {
      setMessages([]);
    }, 1000);
  };

  // Add cleanup on component unmount
  useEffect(() => {
    return () => {
      setIsConnecting(false); // Ensure loading state is cleared
      WebRTCService.disconnect();
    };
  }, []);

  // Helper to format time
  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper to check if message is today
  const isToday = (date) => {
    const d = new Date(date);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(myId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <Box
      sx={{
        maxWidth: 500,
        minWidth: 340,
        minHeight: 520,
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
      {/* Header */}
      <Box
        sx={{
          background: 'linear-gradient(90deg, #4f8cff 0%, #3ff57a 100%)',
          py: 1.5,
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
            color: '#fbc02d',
            width: 44,
            height: 44,
            fontSize: 28,
            border: '2px solid #3b6be0',
          }}
        >
          <span role="img" aria-label="emoji">😃</span>
        </Avatar>
        <Typography
          variant="h6"
          sx={{
            color: '#fff',
            fontWeight: 700,
            fontSize: 20,
            userSelect: 'all',
            letterSpacing: 0.5,
            ml: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          Your ID: <b style={{ color: '#fff', marginLeft: 6 }}>{myId}</b>
          <Tooltip title={copied ? 'Copied!' : 'Copy'} placement="top" arrow>
            <IconButton
              size="small"
              onClick={handleCopyId}
              sx={{ ml: 1, color: '#fff', bgcolor: 'rgba(0,0,0,0.08)', '&:hover': { bgcolor: 'rgba(0,0,0,0.18)' } }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Typography>
      </Box>
      {/* Chat Area */}
      <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', bgcolor: '#fafbfc' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
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
            <Stack direction="row" spacing={2} mb={2} mt={6} alignItems="center" justifyContent="center">
              <TextField
                placeholder="Enter peer ID"
                variant="outlined"
                size="small"
                value={peerId}
                onChange={(e) => setPeerId(e.target.value)}
                fullWidth
                InputProps={{
                  style: {
                    fontSize: 14,
                    padding: '6px 10px',
                    borderRadius: 12,
                    height: 36,
                    background: '#fff',
                  },
                }}
                disabled={isConnecting}
                sx={{
                  maxWidth: 260,
                  minWidth: 180,
                  bgcolor: '#fff',
                  borderRadius: 2,
                  boxShadow: 0,
                }}
              />
              <Button
                variant="contained"
                onClick={handleConnect}
                disabled={isConnecting}
                sx={{
                  minWidth: 80,
                  height: 36,
                  borderRadius: 2,
                  fontWeight: 600,
                  fontSize: 14,
                  bgcolor: '#4f8cff',
                  color: '#fff',
                  boxShadow: 2,
                  '&:hover': { bgcolor: '#3b6be0' },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  px: 2,
                }}
                size="small"
              >
                {isConnecting ? (
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      border: '3px solid #fff',
                      borderTop: '3px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' },
                      },
                    }}
                  />
                ) : (
                  'CONNECT'
                )}
              </Button>
            </Stack>
          </>
        ) : (
          <>
            {/* Date Divider */}
            {messages.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box sx={{ flex: 1, height: 1, bgcolor: '#e0e0e0' }} />
                <Typography sx={{ mx: 2, color: '#888', fontWeight: 500, fontSize: 14 }}>
                  Today
                </Typography>
                <Box sx={{ flex: 1, height: 1, bgcolor: '#e0e0e0' }} />
              </Box>
            )}
            <Box
              sx={{
                minHeight: 180,
                maxHeight: 260,
                overflowY: 'auto',
                mb: 2,
                bgcolor: 'white',
                borderRadius: 2,
                p: 1,
                border: '1px solid #e3e8f0',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                fontSize: 14,
                boxShadow: '0 2px 8px 0 rgba(60,60,60,0.04)',
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
                m.isSystem ? (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      mb: 1,
                    }}
                  >
                    <Box
                      sx={{
                        bgcolor: 'warning.light',
                        color: 'warning.contrastText',
                        px: 2,
                        py: 0.5,
                        borderRadius: 2,
                        maxWidth: '75%',
                        fontSize: 13,
                        wordBreak: 'break-word',
                        fontStyle: 'italic',
                      }}
                    >
                      {m.text}
                    </Box>
                  </Box>
                ) : (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: m.sender === 'me' ? 'flex-end' : 'flex-start',
                      mb: 1.2,
                    }}
                  >
                    {m.sender === 'me' && (
                      <Box
                        sx={{
                          fontSize: 10,
                          color: '#4f8cff',
                          fontWeight: 700,
                          mb: 0.2,
                          mr: 2,
                        }}
                      >
                        You
                      </Box>
                    )}
                    <Box
                      sx={{
                        bgcolor: m.sender === 'me' ? '#4f8cff' : '#f5f5f5',
                        color: m.sender === 'me' ? '#fff' : '#333',
                        px: 1.5,
                        py: 0.7,
                        borderRadius: 2,
                        fontSize: 14,
                        fontWeight: 500,
                        boxShadow: m.sender === 'me' ? 1 : 0,
                        display: 'inline-block',
                        maxWidth: 320,
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.text}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#888',
                        mt: 0.2,
                        ml: m.sender === 'me' ? 'auto' : 0,
                        mr: m.sender === 'me' ? 0 : 'auto',
                        fontSize: 11,
                        fontWeight: 400,
                      }}
                    >
                      {formatTime(m.time)}
                    </Typography>
                  </Box>
                )
              ))}
              <div ref={endRef} />
            </Box>
            {/* Input Area */}
            <form onSubmit={handleSendMessage} style={{ width: '100%' }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <TextField
                  placeholder="Type your message..."
                  variant="outlined"
                  size="small"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  fullWidth
                  InputProps={{
                    style: {
                      fontSize: 14,
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: '#fff',
                      height: 36,
                    },
                  }}
                />
                <IconButton
                  type="submit"
                  color="primary"
                  disabled={!inputMessage.trim()}
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    width: 36,
                    height: 36,
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
                mt: 1.5,
                border: '2px solid #f44336',
                color: '#f44336',
                letterSpacing: 0.5,
                background: '#fff',
                '&:hover': {
                  bgcolor: '#ffeaea',
                  borderColor: '#d32f2f',
                },
              }}
            >
              END SESSION
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
};

export default Chat;