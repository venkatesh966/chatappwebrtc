import { useRef, useEffect, useState } from "react";
import WebRTCService from "../services/WebRTCService";
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
  Tooltip,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import AudioCall from "./AudioCall";
import CallIcon from "@mui/icons-material/Call";
import { alpha } from "@mui/material/styles";
import useChatLogic from "../hooks/useChatLogic";
import ChatConnection from "./ChatConnection";
import ChatInterface from "./ChatInterface";

const Chat = ({ boxWidth = 420 }) => {
  const {
    connected,
    messages,
    inputMessage,
    setInputMessage,
    myId,
    disconnectReason,
    isConnecting,
    error,
    setError,
    copied,
    fileProgress,
    receivingFileProgress,
    isCallActive,
    callStatus,
    isMuted,
    callDuration,
    audioRef,
    handleConnect,
    handleSendMessage: hookHandleSendMessage,
    handleEndSession,
    handleCopyId,
    handleFileSelect: hookHandleFileSelect,
    handleStartCall,
    handleEndCall,
    handleMuteToggle,
    formatTime,
    connectedPeerId,
  } = useChatLogic();

  const [peerIdToConnect, setPeerIdToConnect] = useState("");

  const endRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const styleId = "chat-animation-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        .message-bubble-anim {
          animation: fadeSlideIn 0.45s cubic-bezier(0.23, 1, 0.32, 1);
        }
        @keyframes fadeSlideIn {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const handleLocalConnect = () => {
    handleConnect(peerIdToConnect);
  };

  const handleLocalSendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      hookHandleSendMessage(connectedPeerId, inputMessage);
      setInputMessage("");
    }
  };

  const handleLocalFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    await hookHandleFileSelect(file, connectedPeerId);
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handlePeerIdInputChange = (e) => {
    setPeerIdToConnect(e.target.value);
    if (error) {
        setError("");
    }
  };

  return (
    <Paper
      elevation={8}
      sx={{
        width: { xs: "98vw", sm: boxWidth, md: boxWidth },
        minHeight: { xs: "80vh", sm: 480, md: 520 },
        maxHeight: { xs: "98vh", sm: 600, md: 650 },
        mx: "auto",
        borderRadius: 4,
        p: { xs: 0.5, sm: 1.5, md: 2 },
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        justifyContent: "flex-start",
        boxShadow: "0 4px 24px 0 rgba(31, 38, 135, 0.10)",
        background: `linear-gradient(120deg, ${alpha(
          "#fff",
          0.97
        )} 70%, ${alpha("#e0f7fa", 0.8)} 100%)`,
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.18)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          background: "linear-gradient(90deg, #4f8cff 0%, #3ff57a 100%)",
          py: 1,
          px: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
          minHeight: 56,
        }}
      >
        <Avatar
          sx={{
            bgcolor: "white",
            color: "#7c4dff",
            width: 36,
            height: 36,
            fontSize: 24,
            border: "1.5px solid #3b6be0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px 0 rgba(60,60,60,0.06)",
          }}
        >
          <img
            src="/icon128.png"
            alt="Icon"
            style={{ width: 24, height: 24 }}
          />
        </Avatar>
        <Typography
          variant="h6"
          sx={{
            color: "#fff",
            fontWeight: 700,
            fontSize: 17,
            userSelect: "all",
            letterSpacing: 0.3,
            ml: 0.5,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
          }}
        >
          Your ID:{" "}
          <b style={{ color: "#fff", marginLeft: 4, fontWeight: 600 }}>
            {myId}
          </b>
          <Tooltip title={copied ? "Copied!" : "Copy"} placement="top" arrow>
            <IconButton
              size="small"
              onClick={handleCopyId}
              sx={{
                ml: 0.5,
                color: "#fff",
                bgcolor: "rgba(0,0,0,0.08)",
                "&:hover": { bgcolor: "rgba(0,0,0,0.18)" },
                p: 0.5,
              }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Typography>
        <Box sx={{ flex: 1 }} />
      </Box>
      {/* Chat Area */}
      <Box
        sx={{
          p: 2,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          bgcolor: "#fafbfc",
          pb: 0,
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
        {!connected ? (
          <ChatConnection
            isConnecting={isConnecting}
            peerIdToConnect={peerIdToConnect}
            onPeerIdChange={handlePeerIdInputChange}
            onConnect={handleLocalConnect}
            error={error}
            disconnectReason={disconnectReason}
          />
        ) : (
          <ChatInterface
            messages={messages}
            inputMessage={inputMessage}
            setInputMessage={setInputMessage}
            onSendMessage={handleLocalSendMessage}
            fileInputRef={fileInputRef}
            onFileSelect={handleLocalFileSelect}
            connectedPeerId={connectedPeerId}
            onEndSession={handleEndSession}
            fileProgress={fileProgress}
            receivingFileProgress={receivingFileProgress}
            isCallActive={isCallActive}
            onStartCall={() => handleStartCall(connectedPeerId)}
            formatTime={formatTime}
            endRef={endRef}
          />
        )}
      </Box>
      {/* Audio Call Component */}
      {connected && (
        <AudioCall
          isCallActive={isCallActive}
          onStartCall={() => handleStartCall(connectedPeerId)}
          onEndCall={handleEndCall}
          onMuteToggle={handleMuteToggle}
          isMuted={isMuted}
          callStatus={callStatus}
          callDuration={callDuration}
        />
      )}
      <audio ref={audioRef} autoPlay />
    </Paper>
  );
};

export default Chat;
