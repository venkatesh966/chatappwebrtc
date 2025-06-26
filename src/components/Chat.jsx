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
import CallInterface from "./CallInterface";
import ScreenShareViewer from "./ScreenShareViewer";
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
    incomingRingtoneAudioRef,
    outgoingRingingAudioRef,
    
    // Screen sharing states
    isScreenSharing,
    screenShareStatus,
    screenShareType,
    screenShareDuration,
    screenShareQuality,
    viewingScreenShare,
    screenShareStream,
    incomingScreenShare,
    
    // Call states
    incomingCall,
    
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
    isPeerTyping,
    notifyTypingState,
    
    // Screen sharing handlers
    handleStartScreenShare,
    handleStopScreenShare,
    handleAnswerScreenShare,
    handleRejectScreenShare,
    handleScreenShareQualityChange,
    
    // Call handlers
    handleAnswerCall,
    handleRejectCall,
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
            transform: translateY(10px) scale(0.9);
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
    const files = event.target.files;
    if (files.length === 0) return;

    if (files.length > 7) {
      setError("You can select a maximum of 7 files at a time.");
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
      }
      return;
    }

    let totalSize = 0;
    for (const file of files) {
      totalSize += file.size;
    }

    const ONE_GB = 1024 * 1024 * 1024;
    if (totalSize > ONE_GB) {
      setError("The total size of selected files cannot exceed 1GB.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setError(""); 
    for (const file of files) {
      if (!connectedPeerId || error) {
        break; 
      }
      await hookHandleFileSelect(file, connectedPeerId);
    }

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
        minHeight: { xs: "80vh", sm: 560, md: 580 },
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
            gap: 0.8,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box 
              sx={{
                width: 10, 
                height: 10, 
                borderRadius: '50%',
                bgcolor: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mr: 0.7,
                boxShadow: '0 0 2px rgba(0,0,0,0.2)', 
              }}
            >
              <Box 
                component="span"
                sx={{
                  width: 6, 
                  height: 6, 
                  borderRadius: '50%',
                  bgcolor: myId ? 'success.main' : 'grey.400',
                  display: 'block', 
                }}
              />
            </Box>
            Your ID:
          </Box>
          <b style={{ color: "#fff", fontWeight: 600 }}>
            {myId}
          </b>
          <Tooltip title={copied ? "Copied!" : "Copy"} placement="top" arrow>
            <IconButton
              size="small"
              onClick={handleCopyId}
              sx={{
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
      <Box
        sx={{
          p: 2,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          bgcolor: "#fafbfc",
          pb: 0,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 1 }}
            onClose={() => setError("")}
          >
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
            isPeerTyping={isPeerTyping}
            onNotifyTypingState={notifyTypingState}
            connectedPeerIdForTyping={connectedPeerId}
            myId={myId}
          />
        )}
      </Box>
      {connected && (
        <CallInterface
          // Audio call props
          isCallActive={isCallActive}
          onStartCall={() => handleStartCall(connectedPeerId)}
          onEndCall={handleEndCall}
          onMuteToggle={handleMuteToggle}
          isMuted={isMuted}
          callStatus={callStatus}
          callDuration={callDuration}
          incomingCall={incomingCall}
          onAnswerCall={handleAnswerCall}
          onRejectCall={handleRejectCall}
          
          // Screen sharing props
          isScreenSharing={isScreenSharing}
          screenShareStatus={screenShareStatus}
          screenShareType={screenShareType}
          screenShareDuration={screenShareDuration}
          screenShareQuality={screenShareQuality}
          onStartScreenShare={(options) => handleStartScreenShare(connectedPeerId, options)}
          onStopScreenShare={handleStopScreenShare}
          onScreenShareQualityChange={handleScreenShareQualityChange}
          incomingScreenShare={incomingScreenShare}
          onAnswerScreenShare={handleAnswerScreenShare}
          onRejectScreenShare={handleRejectScreenShare}
        />
      )}
      
      {/* Screen Share Viewer */}
      {viewingScreenShare && screenShareStream && (
        <ScreenShareViewer
          stream={screenShareStream}
          isVisible={viewingScreenShare}
          onClose={handleStopScreenShare}
          screenShareType={screenShareType}
          quality={screenShareQuality}
          duration={screenShareDuration}
        />
      )}
      
      <audio ref={audioRef} autoPlay />
      <audio ref={incomingRingtoneAudioRef} src="/sounds/incoming_ringtone.mp3" loop />
      <audio ref={outgoingRingingAudioRef} src="/sounds/outgoing_ringing.mp3" loop />
    </Paper>
  );
};

export default Chat;
