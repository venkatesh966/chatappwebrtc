import React from 'react';
import {
  TextField,
  Button,
  Paper,
  Box,
  Alert,
} from "@mui/material";

const ChatConnection = ({
  isConnecting,
  peerIdToConnect,
  onPeerIdChange,
  onConnect,
  error,
  disconnectReason,
}) => {
  return (
    <>
      {disconnectReason && (
        <Alert
          severity={disconnectReason === "browser_close" ? "warning" : "info"}
          sx={{ mb: 1 }}
        >
          {disconnectReason === "browser_close"
            ? "Connection was lost unexpectedly"
            : "Session has been ended"}
        </Alert>
      )}
      <Paper
        elevation={4}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 1.5,
          p: 2,
          mb: 2,
          mt: 4,
          borderRadius: 3,
          boxShadow: "0 4px 24px 0 rgba(31, 38, 135, 0.10)",
          border: "2px solid #4f8cff",
          background: "linear-gradient(120deg, #f8fbff 70%, #e0f7fa 100%)",
          minWidth: 320,
          maxWidth: 400,
          mx: "auto",
        }}
      >
        <TextField
          placeholder="Enter peer ID"
          variant="outlined"
          size="small"
          value={peerIdToConnect}
          onChange={onPeerIdChange}
          fullWidth
          InputProps={{
            style: {
              fontSize: 15,
              padding: "6px 10px",
              borderRadius: 10,
              height: 38,
              background: "#fff",
            },
          }}
          disabled={isConnecting}
          sx={{
            maxWidth: 180,
            minWidth: 120,
            bgcolor: "#fff",
            borderRadius: 2,
            boxShadow: 0,
            mr: 1.5,
          }}
        />
        <Button
          variant="contained"
          onClick={onConnect}
          disabled={isConnecting}
          sx={{
            minWidth: 90,
            height: 38,
            borderRadius: 2,
            fontWeight: 700,
            fontSize: 15,
            bgcolor: "#4f8cff",
            color: "#fff",
            boxShadow: 2,
            letterSpacing: 1,
            transition: "all 0.2s",
            "&:hover": {
              bgcolor: "#3b6be0",
              transform: "translateY(-2px) scale(1.04)",
            },
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: 2,
          }}
          size="medium"
        >
          {isConnecting ? (
            <Box
              sx={{
                width: 16,
                height: 16,
                border: "3px solid #fff",
                borderTop: "3px solid transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                "@keyframes spin": {
                  "0%": { transform: "rotate(0deg)" },
                  "100%": { transform: "rotate(360deg)" },
                },
              }}
            />
          ) : (
            "CONNECT"
          )}
        </Button>
      </Paper>
    </>
  );
};

export default ChatConnection; 