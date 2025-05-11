import React, { useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Stack,
  LinearProgress,
  Paper,
  Tooltip,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CallIcon from "@mui/icons-material/Call";
import Avatar from '@mui/material/Avatar';
import DownloadIcon from '@mui/icons-material/Download';

const ChatInterface = ({
  messages,
  inputMessage,
  setInputMessage,
  onSendMessage,
  fileInputRef,
  onFileSelect,
  connectedPeerId,
  onEndSession,
  fileProgress,
  receivingFileProgress,
  isCallActive,
  onStartCall, // This will be () => handleStartCall(connectedPeerId)
  formatTime,
  endRef,
  // Typing indicator props
  isPeerTyping,
  onNotifyTypingState,
  connectedPeerIdForTyping, // Renamed to avoid conflict if connectedPeerId prop has other uses
  myId, // Added myId for avatars
}) => {
  const typingTimeoutRef = useRef(null);

  const handleManualDownload = (blob, fileName) => {
    if (!blob || !fileName) {
      console.error("Manual download failed: blob or fileName missing");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a); // Safari might require the link to be in the body
    a.click();
    document.body.removeChild(a); // Clean up
    URL.revokeObjectURL(url);
  };

  const handleInputChange = (e) => {
    const message = e.target.value;
    setInputMessage(message);

    if (!connectedPeerIdForTyping) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (message.trim().length > 0) {
      onNotifyTypingState(connectedPeerIdForTyping, true); // Send typing_started
      typingTimeoutRef.current = setTimeout(() => {
        onNotifyTypingState(connectedPeerIdForTyping, false); // Send typing_stopped after delay
      }, 2000); // 2 seconds delay
    } else {
      // If message is empty (e.g., cleared), immediately send typing_stopped
      onNotifyTypingState(connectedPeerIdForTyping, false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim() && connectedPeerIdForTyping) {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      onNotifyTypingState(connectedPeerIdForTyping, false); // Ensure typing_stopped is sent before message
      onSendMessage(e); // This will also call setInputMessage("") which will trigger handleInputChange again if not careful
    }
  };

  return (
    <>
      {/* Date Divider and CLOSE button */}
      {messages.length > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            mb: 1,
            position: "relative",
            minHeight: 36,
          }}
        >
          {/* Call Controls */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              mr: 0.5,
              minWidth: 32,
              justifyContent: "flex-start",
              height: "100%",
            }}
          >
            {!isCallActive && connectedPeerId && (
              <Tooltip title="Start Call">
                <IconButton
                  onClick={onStartCall}
                  disabled={isCallActive || fileProgress.size > 0 || receivingFileProgress.size > 0}
                  size="small"
                  sx={{
                    bgcolor: "#43d672",
                    color: "#fff",
                    "&:hover": { bgcolor: "#2eb85c" },
                    boxShadow: 1,
                    ml: 0.2,
                    width: 26,
                    height: 26,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 0.5,
                  }}
                >
                  <CallIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              height: "100%",
            }}
          >
            <Typography
              sx={{
                color: "#888",
                fontWeight: 500,
                fontSize: 12,
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                whiteSpace: "nowrap",
              }}
            >
              {`Today (${new Date().toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })})`}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="error"
            onClick={onEndSession}
            disabled={fileProgress.size > 0 || receivingFileProgress.size > 0}
            sx={{
              fontSize: 10,
              fontWeight: 600,
              py: 0.2,
              px: 1,
              borderRadius: 1.5,
              border: "1px solid #f44336",
              color: "#f44336",
              letterSpacing: 0.3,
              background: "#fff",
              minHeight: 20,
              minWidth: 0,
              boxShadow: "none",
              ml: 0.5,
              mr: 0.2,
              display: "flex",
              alignItems: "center",
              "&:hover": {
                bgcolor: "#ffeaea",
                borderColor: "#d32f2f",
              },
            }}
          >
            CLOSE
          </Button>
        </Box>
      )}
      {/* File Progress */}
      {/* Sending Files Progress */}
      {Array.from(fileProgress.entries()).map(([fileId, progressData]) => (
        <Paper key={fileId} sx={{ p: 1, mb: 1, bgcolor: "#e3f2fd", borderRadius: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5, fontSize: 12 }}>
            Sending: {progressData.fileName}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progressData.progress}
            sx={{
              height: 6, 
              borderRadius: 2,
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#26A69A', // Dimmed green/teal color
              },
            }}
          />
        </Paper>
      ))}
      {/* Receiving Files Progress */}
      {Array.from(receivingFileProgress.entries()).map(([fileId, progressData]) => (
        <Paper key={fileId} sx={{ p: 1, mb: 1, bgcolor: "#e3f2fd", borderRadius: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5, fontSize: 12 }}>
            Receiving: {progressData.fileName}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progressData.progress}
            sx={{
              height: 6, 
              borderRadius: 2,
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#26A69A', // Dimmed green/teal color
              },
            }}
          />
        </Paper>
      ))}

      {/* NEW WRAPPER for Middle Section (Messages + Typing Indicator) */}
      <Box
        sx={{
          position: 'relative',
          flex: 1, // This wrapper takes up the available vertical space
          display: 'flex',
          flexDirection: 'column',
          '&::before': { // The fixed gradient strip
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '3px',
            background: 'linear-gradient(to bottom, #4f8cff, #3ff57a)',
            borderTopLeftRadius: (theme) => theme.spacing(1.5), // Match message box rounding (e.g., 6px)
            borderBottomLeftRadius: (theme) => theme.spacing(1.5), // Match message box rounding
          }
        }}
      >
        {/* Message Display Area (Scrollable) */}
        <Box
          sx={{
            minHeight: 180,
            // maxHeight: 260,
            overflowY: "auto",
            mb: 0.5, // Margin between messages and typing indicator
            bgcolor: "white",
            borderRadius: 1.5, // Applies to all corners initially
            borderTopLeftRadius: 0, // Flatten top-left to meet gradient
            borderBottomLeftRadius: 0, // Flatten bottom-left to meet gradient
            p: 0.5,
            border: "1px solid #e3e8f0",
            borderLeft: 'none', // Gradient acts as the visual left border
            flex: 1, // Allows this box to grow and scroll within the new wrapper
            display: "flex",
            flexDirection: "column",
            fontSize: 13,
            boxShadow: "0 1px 4px 0 rgba(60,60,60,0.03)",
            marginLeft: '3px', // Make space for the gradient from the wrapper
            // Removed position: 'relative' and '&::before' from here
          }}
        >
          {messages.length === 0 && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                textAlign: "center",
                mt: 2,
                opacity: 0.7,
                fontSize: 13,
              }}
            >
              Say hello to your peer!
            </Typography>
          )}
          {messages.map((m, i) => {
            if (m.isSystem) {
              // Check for and hide consecutive duplicate "File ready" system messages
              if (
                m.fileData && // Current message is a file download offer
                i > 0 && // There is a previous message
                messages[i-1].isSystem && // Previous message is also a system message
                messages[i-1].fileData && // Previous message also offered a file download
                messages[i-1].fileData.name === m.fileData.name // Both are for the same file name
              ) {
                // This is a consecutive duplicate file download message, so don't render it.
                // Log for debugging, can be removed later.
                console.log('[ChatInterface] Hiding duplicate file download message for:', m.fileData.name);
                return null; 
              }
              // Render non-duplicate system message (or system messages without fileData)
              return (
                <Box
                  key={i}
                  className="message-bubble-anim"
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    mb: 0.5,
                    width: '100%',
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: "#f3f4f6",
                      color: "#888",
                      px: 1.2,
                      py: 0.3,
                      borderRadius: 1,
                      maxWidth: "85%",
                      fontSize: 12,
                      wordBreak: "break-word",
                      fontStyle: "italic",
                      transition: "all 0.3s",
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                    }}
                  >
                    {m.text}
                    {m.fileData && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={() => handleManualDownload(m.fileData.blob, m.fileData.name)}
                        sx={{ mt: 0.5, fontSize: 10, py: 0.2, px: 0.8, textTransform: 'none' }}
                      >
                        Download
                      </Button>
                    )}
                  </Box>
                </Box>
              );
            } else {
              // Render user/peer messages (existing logic with avatars)
              return (
                <Box
                  key={i}
                  className="message-bubble-anim"
                  sx={{
                    display: "flex",
                    flexDirection: m.sender === "me" ? "row-reverse" : "row",
                    alignItems: "center",
                    mb: 0.7,
                    gap: 0.8,
                  }}
                >
                  {/* Avatar */}
                  <Avatar 
                    sx={{ width: 24, height: 24 }} // Reduced size, removed mb
                    src={`https://api.dicebear.com/8.x/bottts/svg?seed=${m.sender === 'me' ? myId : connectedPeerIdForTyping}`}
                  />

                  {/* Message Content Wrapper */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: m.sender === 'me' ? 'flex-end' : 'flex-start' }}>
                    {m.sender === "me" && (
                      <Box
                        sx={{
                          fontSize: 9,
                          color: "#4f8cff",
                          fontWeight: 700,
                          mb: 0.1,
                          mr: m.sender === "me" ? 1 : 0, // Keep original margin if needed for alignment
                          ml: m.sender === "peer" ? 1: 0,
                        }}
                      >
                        You
                      </Box>
                    )}
                    {m.sender === "peer" && (
                      <Box
                        sx={{
                          fontSize: 9,
                          color: "#888",
                          fontWeight: 700,
                          mb: 0.1,
                          ml: m.sender === "peer" ? 1 : 0, // Keep original margin
                          mr: m.sender === "me" ? 1 : 0,
                        }}
                      >
                        Peer
                      </Box>
                    )}
                    <Box
                      sx={{
                        bgcolor: m.sender === "me" ? "#4f8cff" : "#f5f5f5",
                        color: m.sender === "me" ? "#fff" : "#333",
                        px: 1.1,
                        py: 0.5,
                        borderRadius: 1.2,
                        fontSize: 13,
                        fontWeight: 500,
                        boxShadow: m.sender === "me" ? 1 : 0,
                        display: "inline-block",
                        maxWidth: 260,
                        wordBreak: "break-word",
                        transition: "all 0.3s",
                      }}
                    >
                      {m.text}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#888",
                        mt: 0.1,
                        ml: m.sender === "me" ? "auto" : 0,
                        mr: m.sender === "me" ? 0 : "auto",
                        fontSize: 10,
                        fontWeight: 400,
                      }}
                    >
                      {formatTime(m.time)}
                    </Typography>
                  </Box>
                </Box>
              );
            }
          })}
          <div ref={endRef} />
        </Box> {/* End of Message Display Area */}

        {/* Typing Indicator */}
        <Box sx={{ 
          height: '10px', 
          display: 'flex', 
          alignItems: 'center', 
          mb: 0.5, 
          ml: 0.5, // Original left margin for text padding
          marginLeft: '3px', // Additional margin to account for the gradient strip
          paddingLeft: '0.5px' // Align text with message box content which has p:0.5
        }}>
          {isPeerTyping && (
            <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
              Peer is typing...
            </Typography>
          )}
        </Box> {/* End of Typing Indicator */}
      </Box> {/* End of NEW WRAPPER for Middle Section */}

      {/* Input Area */}
      <Box
        component="form"
        onSubmit={handleSendMessage} // Changed to use the new handleSendMessage
        sx={{
          p: 1,
          bgcolor: "background.paper",
          borderTop: "1px solid",
          borderColor: "divider",
          borderRadius: 1.5,
        }}
      >
        <Stack direction="row" spacing={0.5} alignItems="center">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={onFileSelect}
            multiple
          />
          <Tooltip title="Attach files (max 330MB, max 3 files at a time)" arrow>
            <span>
              <IconButton
                onClick={() => fileInputRef.current?.click()}
                disabled={!connectedPeerId || fileProgress.size > 0 || receivingFileProgress.size > 0}
                sx={{ color: "primary.main", p: 0.7 }}
              >
                <AttachFileIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <TextField
            fullWidth
            value={inputMessage}
            onChange={handleInputChange} // Changed to use the new handleInputChange
            placeholder="Type a message..."
            disabled={!connectedPeerId || fileProgress.size > 0 || receivingFileProgress.size > 0}
            size="small"
            multiline
            minRows={1}
            maxRows={4}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                // The main submit is now handled by handleSendMessage via the form's onSubmit
                // We can directly call it here if the form submission isn't triggered by Enter alone
                if (inputMessage.trim()) handleSendMessage(e);
              }
            }}
            sx={{
              fontSize: 13,
              borderRadius: 1.2,
              bgcolor: "#fff",
              ".MuiInputBase-input": {
                py: 1.2,
              },
            }}
          />
          <IconButton
            type="submit"
            disabled={!connectedPeerId || !inputMessage.trim() || fileProgress.size > 0 || receivingFileProgress.size > 0}
            sx={{ color: "primary.main", fontSize: 20, p: 0.7 }}
          >
            <SendIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Stack>
      </Box>
    </>
  );
};

export default ChatInterface; 