import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Collapse,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  NetworkCheck as NetworkIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import WebRTCService from '../services/WebRTCService';

const NetworkDiagnostics = ({ isOpen, onClose }) => {
  const [diagnostics, setDiagnostics] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [stunResults, setStunResults] = useState([]);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setDiagnostics(null);
    setStunResults([]);

    try {
      // Get basic WebRTC info
      const basicInfo = WebRTCService.getDiagnosticInfo();
      
      // Test STUN servers
      const stunTests = await testStunServers();
      
      // Check WebRTC support
      const webrtcSupport = checkWebRTCSupport();
      
      // Get network info
      const networkInfo = await getNetworkInfo();

      setDiagnostics({
        basicInfo,
        webrtcSupport,
        networkInfo,
        timestamp: new Date().toISOString()
      });
      
      setStunResults(stunTests);
    } catch (error) {
      console.error('Diagnostics failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const testStunServers = async () => {
    const stunServers = [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun.stunprotocol.org:3478'
    ];

    const results = [];
    
    for (const server of stunServers) {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: server }]
        });

        const result = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve({ server, status: 'timeout', ip: null });
          }, 5000);

          pc.onicecandidate = (event) => {
            if (event.candidate && event.candidate.candidate.includes('srflx')) {
              clearTimeout(timeout);
              const ip = event.candidate.candidate.split(' ')[4];
              resolve({ server, status: 'success', ip });
            }
          };

          pc.createDataChannel('test');
          pc.createOffer().then(offer => pc.setLocalDescription(offer));
        });

        pc.close();
        results.push(result);
      } catch (error) {
        results.push({ server, status: 'error', error: error.message });
      }
    }

    return results;
  };

  const checkWebRTCSupport = () => {
    return {
      RTCPeerConnection: !!window.RTCPeerConnection,
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      getDisplayMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
      RTCDataChannel: !!window.RTCDataChannel,
      isSecureContext: window.isSecureContext
    };
  };

  const getNetworkInfo = async () => {
    try {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return {
        effectiveType: connection?.effectiveType || 'unknown',
        downlink: connection?.downlink || 'unknown',
        rtt: connection?.rtt || 'unknown',
        saveData: connection?.saveData || false
      };
    } catch (error) {
      return { error: 'Network info not available' };
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckIcon color="success" />;
      case 'error': return <ErrorIcon color="error" />;
      case 'timeout': return <WarningIcon color="warning" />;
      default: return <InfoIcon color="info" />;
    }
  };

  const getRecommendations = () => {
    if (!diagnostics) return [];

    const recommendations = [];

    // Check WebRTC support
    if (!diagnostics.webrtcSupport.RTCPeerConnection) {
      recommendations.push({
        type: 'error',
        message: 'Your browser does not support WebRTC. Please use Chrome, Firefox, or Edge.'
      });
    }

    if (!diagnostics.webrtcSupport.isSecureContext) {
      recommendations.push({
        type: 'error',
        message: 'WebRTC requires HTTPS. Please access the site using https://'
      });
    }

    // Detect college/institutional networks
    const isLikelyInstitutional = window.location.hostname.includes('edu') || 
                                 window.location.hostname.includes('corp') ||
                                 window.location.hostname.includes('school') ||
                                 diagnostics.networkInfo.effectiveType === 'slow-2g';

    // Check STUN results
    const successfulStun = stunResults.filter(r => r.status === 'success').length;
    if (successfulStun === 0) {
      if (isLikelyInstitutional) {
        recommendations.push({
          type: 'error',
          message: '🏫 College/Corporate Network Detected: Your network blocks peer-to-peer connections. Solutions: 1) Use mobile hotspot, 2) Ask the other person to connect to you, 3) Try from a different network.'
        });
      } else {
        recommendations.push({
          type: 'error',
          message: 'Cannot reach any STUN servers. Check your firewall settings or try a different network.'
        });
      }
    } else if (successfulStun < 2) {
      if (isLikelyInstitutional) {
        recommendations.push({
          type: 'warning',
          message: '🏫 Institutional Network: Limited connectivity detected. You may experience connection issues. Try switching to mobile data if connections fail.'
        });
      } else {
        recommendations.push({
          type: 'warning',
          message: 'Limited STUN server connectivity. You may experience connection issues.'
        });
      }
    }

    // Network-specific advice
    if (isLikelyInstitutional && successfulStun > 0) {
      recommendations.push({
        type: 'info',
        message: '💡 Institutional Network Tips: If connections fail, the app will automatically try TURN servers. For best results, consider using mobile hotspot or asking the other person to initiate the connection.'
      });
    }

    // Check network connection
    if (diagnostics.networkInfo.effectiveType === 'slow-2g' || diagnostics.networkInfo.effectiveType === '2g') {
      recommendations.push({
        type: 'warning',
        message: 'Slow network detected. Consider using lower quality settings or switching to a faster connection.'
      });
    }

    // Enhanced advice based on network type
    if (navigator.connection) {
      const conn = navigator.connection;
      if (conn.saveData) {
        recommendations.push({
          type: 'info',
          message: 'Data saver mode detected. This may affect real-time features like calls and screen sharing.'
        });
      }
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: 'success',
        message: '✅ Your connection looks good! The app will automatically optimize for your network. If you still have issues, the other person may have network restrictions.'
      });
    }

    return recommendations;
  };

  if (!isOpen) return null;

  return (
    <Card sx={{ 
      maxWidth: 600, 
      margin: 2, 
      zIndex: 9998, // Ensure it appears above most components but below dialogs
      position: 'relative' // Ensure z-index takes effect
    }}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <NetworkIcon sx={{ mr: 1 }} />
          <Typography variant="h6">Network Diagnostics</Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={onClose}>Close</Button>
        </Box>

        <Box mb={2}>
          <Button
            variant="contained"
            onClick={runDiagnostics}
            disabled={isRunning}
            startIcon={isRunning ? <CircularProgress size={16} /> : <NetworkIcon />}
          >
            {isRunning ? 'Running Tests...' : 'Run Diagnostics'}
          </Button>
        </Box>

        {diagnostics && (
          <>
            <Typography variant="subtitle1" gutterBottom>
              Connection Status
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText
                  primary="Peer ID"
                  secondary={diagnostics.basicInfo.peerId}
                />
              </ListItem>
              <ListItem>
                <ListItemText
                  primary="Active Connections"
                  secondary={`${diagnostics.basicInfo.connections} connections`}
                />
              </ListItem>
            </List>

            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              STUN Server Tests
            </Typography>
            <List dense>
              {stunResults.map((result, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    {getStatusIcon(result.status)}
                  </ListItemIcon>
                  <ListItemText
                    primary={result.server}
                    secondary={
                      result.status === 'success' 
                        ? `Public IP: ${result.ip}`
                        : result.status
                    }
                  />
                </ListItem>
              ))}
            </List>

            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Recommendations
            </Typography>
            {getRecommendations().map((rec, index) => (
              <Alert key={index} severity={rec.type} sx={{ mb: 1 }}>
                {rec.message}
              </Alert>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default NetworkDiagnostics; 