import React from 'react';
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
}) => {
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
            sx={{ height: 6, borderRadius: 2 }}
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
            sx={{ height: 6, borderRadius: 2 }}
          />
        </Paper>
      ))}
      <Box
        sx={{
          minHeight: 180,
          maxHeight: 260,
          overflowY: "auto",
          mb: 1,
          bgcolor: "white",
          borderRadius: 1.5,
          p: 0.5,
          border: "1px solid #e3e8f0",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          fontSize: 13,
          boxShadow: "0 1px 4px 0 rgba(60,60,60,0.03)",
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
        {messages.map((m, i) =>
          m.isSystem ? (
            <Box
              key={i}
              className="message-bubble-anim"
              sx={{
                display: "flex",
                justifyContent: "center",
                mb: 0.5,
              }}
            >
              <Box
                sx={{
                  bgcolor: "#f3f4f6",
                  color: "#888",
                  px: 1.2,
                  py: 0.3,
                  borderRadius: 1,
                  maxWidth: "75%",
                  fontSize: 12,
                  wordBreak: "break-word",
                  fontStyle: "italic",
                  transition: "all 0.3s",
                }}
              >
                {m.text}
              </Box>
            </Box>
          ) : (
            <Box
              key={i}
              className="message-bubble-anim"
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: m.sender === "me" ? "flex-end" : "flex-start",
                mb: 0.7,
              }}
            >
              {m.sender === "me" && (
                <Box
                  sx={{
                    fontSize: 9,
                    color: "#4f8cff",
                    fontWeight: 700,
                    mb: 0.1,
                    mr: 1,
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
                    ml: 1,
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
          )
        )}
        <div ref={endRef} />
      </Box>
      {/* Input Area */}
      <Box
        component="form"
        onSubmit={onSendMessage}
        sx={{
          mt: "auto",
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
          <IconButton
            onClick={() => fileInputRef.current?.click()}
            disabled={!connectedPeerId || fileProgress.size > 0 || receivingFileProgress.size > 0}
            sx={{ color: "primary.main", p: 0.7 }}
          >
            <AttachFileIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <TextField
            fullWidth
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message..."
            disabled={!connectedPeerId || fileProgress.size > 0 || receivingFileProgress.size > 0}
            size="small"
            multiline
            minRows={1}
            maxRows={4}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                if (inputMessage.trim()) onSendMessage(e);
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