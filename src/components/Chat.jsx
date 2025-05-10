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
  LinearProgress,
  Paper,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CallEndIcon from '@mui/icons-material/CallEnd';
import PersonIcon from '@mui/icons-material/Person';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AttachFileIcon from '@mui/icons-material/AttachFile';
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
  const [fileProgress, setFileProgress] = useState(null);
  const [receivingFileProgress, setReceivingFileProgress] = useState(null);
  const [receivedFiles, setReceivedFiles] = useState(new Map());
  const fileTimeouts = useRef(new Map());
  const fileInputRef = useRef(null);

  // For file receiving (outside useState, inside Chat component)
  let currentReceivingFile = null;
  let currentReceivingChunks = [];
  let currentReceivingCount = 0;

  // Cleanup function for file transfers
  const cleanupFileTransfer = (fileId) => {
    if (fileTimeouts.current.has(fileId)) {
      clearTimeout(fileTimeouts.current.get(fileId));
      fileTimeouts.current.delete(fileId);
    }
  };

  useEffect(() => {
    WebRTCService.initialize();
    setMyId(localStorage.getItem('peerjs_id'));

    WebRTCService.setOnMessageCallback((data) => {
      // Handle file metadata
      if (typeof data === 'object' && data.type === 'file') {
        // Validate metadata
        if (!data.name || !data.size || !data.mimeType || !data.totalChunks || !data.fileId) {
          console.error('Invalid file metadata received:', data);
          return;
        }

        // Check for duplicate file transfer
        if (receivedFiles.has(data.fileId)) {
          console.warn('Duplicate file transfer detected:', data.fileId);
          return;
        }

        // Set timeout for file transfer (5 minutes)
        const timeout = setTimeout(() => {
          setMessages(prev => [...prev, {
            text: `File transfer timeout: ${data.name}`,
            sender: 'system',
            isSystem: true,
            time: new Date()
          }]);
          setReceivedFiles(prev => {
            const newFiles = new Map(prev);
            newFiles.delete(data.fileId);
            return newFiles;
          });
          setReceivingFileProgress(null);
        }, 5 * 60 * 1000);

        fileTimeouts.current.set(data.fileId, timeout);

        setReceivedFiles(prev => new Map(prev).set(data.fileId, {
          name: data.name,
          size: data.size,
          mimeType: data.mimeType,
          chunks: new Array(data.totalChunks),
          receivedChunks: 0,
          totalChunks: data.totalChunks,
          chunkSize: data.chunkSize,
          startTime: Date.now(),
          lastChunkTime: Date.now()
        }));
        
        setReceivingFileProgress({
          fileName: data.name,
          progress: 0,
          fileId: data.fileId
        });
        
        setMessages((prev) => [...prev, {
          text: `Receiving file: ${data.name}`,
          sender: 'system',
          isSystem: true,
          time: new Date()
        }]);
        return;
      }

      // Handle file chunks
      if (typeof data === 'object' && data.type === 'fileChunk') {
        // Validate chunk data
        if (!data.fileId || typeof data.index !== 'number' || !data.chunk) {
          console.error('Invalid chunk data received:', data);
          return;
        }

        setReceivedFiles(prev => {
          const newFiles = new Map(prev);
          const file = newFiles.get(data.fileId);
          
          if (file) {
            // Update last chunk time
            file.lastChunkTime = Date.now();

            // Validate chunk index
            if (data.index < 0 || data.index >= file.totalChunks) {
              console.error('Invalid chunk index:', data.index);
              return newFiles;
            }

            // Store the chunk
            file.chunks[data.index] = data.chunk;
            file.receivedChunks++;
            
            // Update receiving progress
            const progress = (file.receivedChunks / file.totalChunks) * 100;
            setReceivingFileProgress({
              fileName: file.name,
              progress: progress,
              fileId: data.fileId
            });

            // Check for timeout (30 seconds without new chunks)
            if (fileTimeouts.current.has(data.fileId)) {
              clearTimeout(fileTimeouts.current.get(data.fileId));
              const timeout = setTimeout(() => {
                setMessages(prev => [...prev, {
                  text: `File transfer timeout: ${file.name}`,
                  sender: 'system',
                  isSystem: true,
                  time: new Date()
                }]);
                setReceivedFiles(prev => {
                  const newFiles = new Map(prev);
                  newFiles.delete(data.fileId);
                  return newFiles;
                });
                setReceivingFileProgress(null);
              }, 30000);
              fileTimeouts.current.set(data.fileId, timeout);
            }
          }
          return newFiles;
        });
        return;
      }

      // Handle file completion
      if (typeof data === 'object' && data.type === 'fileComplete') {
        // Validate completion data
        if (!data.fileId) {
          console.error('Invalid file completion data:', data);
          return;
        }

        setReceivedFiles(prev => {
          const newFiles = new Map(prev);
          const file = newFiles.get(data.fileId);
          
          if (file) {
            try {
              // Cleanup timeout
              cleanupFileTransfer(data.fileId);

              // Check if we have all chunks
              const validChunks = file.chunks.filter(chunk => chunk !== undefined);
              if (validChunks.length !== file.totalChunks) {
                const missingChunks = file.totalChunks - validChunks.length;
                throw new Error(`Missing ${missingChunks} chunks out of ${file.totalChunks}`);
              }

              // Verify chunk order
              for (let i = 0; i < file.chunks.length; i++) {
                if (file.chunks[i] === undefined) {
                  throw new Error(`Missing chunk at index ${i}`);
                }
              }

              const blob = new Blob(validChunks, { type: file.mimeType });
              
              // Verify blob size matches original file size
              if (blob.size !== file.size) {
                throw new Error(`File size mismatch: received ${blob.size} bytes, expected ${file.size} bytes`);
              }

              // Verify MIME type
              if (!blob.type.startsWith(file.mimeType.split('/')[0])) {
                throw new Error(`File type mismatch: received ${blob.type}, expected ${file.mimeType}`);
              }

              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = file.name;
              a.click();
              URL.revokeObjectURL(url);
              
              // Calculate transfer time and speed
              const transferTime = ((Date.now() - file.startTime) / 1000).toFixed(1);
              const speed = (file.size / (1024 * 1024) / (transferTime / 60)).toFixed(2); // MB/min
              
              // Add file received message
              setMessages(prev => [...prev, {
                text: `Received file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB in ${transferTime}s, ${speed}MB/min)`,
                sender: 'system',
                isSystem: true,
                time: new Date()
              }]);
              
              // Clear receiving progress
              setReceivingFileProgress(null);
            } catch (err) {
              console.error('Error creating file:', err);
              setMessages(prev => [...prev, {
                text: `Error receiving file: ${file.name} - ${err.message}`,
                sender: 'system',
                isSystem: true,
                time: new Date()
              }]);
            }
            
            // Remove from received files
            newFiles.delete(data.fileId);
          }
          return newFiles;
        });
        return;
      }

      // Handle other message types
      if (typeof data === 'object') {
        switch (data.type) {
          case 'message':
            setMessages((prev) => [...prev, { text: data.content, sender: 'peer', time: new Date() }]);
            break;
          case 'disconnect':
            // Cleanup all file transfers
            fileTimeouts.current.forEach((timeout, fileId) => {
              clearTimeout(timeout);
            });
            fileTimeouts.current.clear();

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

    WebRTCService.setOnFileProgressCallback(({ fileName, progress }) => {
      setFileProgress({ fileName, progress });
      if (progress === 100) {
        setTimeout(() => setFileProgress(null), 1000);
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

    // Cleanup on unmount
    return () => {
      fileTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      fileTimeouts.current.clear();
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

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      await WebRTCService.sendFile(peerId, file);
      setMessages(prev => [...prev, {
        text: `Sending file: ${file.name}`,
        sender: 'system',
        isSystem: true,
        time: new Date()
      }]);
    } catch (err) {
      let errorMessage = 'Failed to send file: ';
      if (err.message.includes('exceeds limit')) {
        errorMessage = err.message;
      } else if (err.message.includes('No open connection')) {
        errorMessage = 'Connection lost. Please reconnect to send files.';
      } else {
        errorMessage += err.message;
      }
      setError(errorMessage);
      setMessages(prev => [...prev, {
        text: `Failed to send file: ${file.name}`,
        sender: 'system',
        isSystem: true,
        time: new Date()
      }]);
    }
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
      <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', bgcolor: '#fafbfc', pb: 0 }}>
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
            {/* Date Divider and CLOSE button */}
            {messages.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, position: 'relative' }}>
                <Box sx={{ flex: 1, height: 1, bgcolor: '#e0e0e0' }} />
                <Typography sx={{ mx: 2, color: '#888', fontWeight: 500, fontSize: 14, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
                  Today
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleEndSession}
                  sx={{
                    fontSize: 11,
                    fontWeight: 600,
                    py: 0.3,
                    px: 1.5,
                    borderRadius: 2,
                    border: '1.5px solid #f44336',
                    color: '#f44336',
                    letterSpacing: 0.5,
                    background: '#fff',
                    minHeight: 24,
                    minWidth: 0,
                    boxShadow: 'none',
                    position: 'absolute',
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    '&:hover': {
                      bgcolor: '#ffeaea',
                      borderColor: '#d32f2f',
                    },
                  }}
                >
                  CLOSE
                </Button>
              </Box>
            )}
            {/* File Progress */}
            {(fileProgress || receivingFileProgress) && (
              <Paper sx={{ p: 2, mb: 2, bgcolor: '#e3f2fd' }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {fileProgress ? 'Sending' : 'Receiving'} {fileProgress?.fileName || receivingFileProgress?.fileName}
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={fileProgress?.progress || receivingFileProgress?.progress} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Paper>
            )}
            <Box
              sx={{
                minHeight: 260,
                maxHeight: 340,
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
                        bgcolor: '#f3f4f6',
                        color: '#888',
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
            <Box
              component="form"
              onSubmit={handleSendMessage}
              sx={{
                mt: 'auto',
                p: 2,
                bgcolor: 'background.paper',
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <IconButton
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!connected}
                  sx={{ color: 'primary.main' }}
                >
                  <AttachFileIcon />
                </IconButton>
                <TextField
                  fullWidth
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type a message..."
                  disabled={!connected}
                  size="medium"
                  sx={{
                    fontSize: 16,
                    borderRadius: 2,
                    bgcolor: '#fff',
                    '.MuiInputBase-input': {
                      py: 2,
                    },
                  }}
                />
                <IconButton
                  type="submit"
                  disabled={!connected || !inputMessage.trim()}
                  sx={{ color: 'primary.main', fontSize: 24 }}
                >
                  <SendIcon />
                </IconButton>
              </Stack>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default Chat;