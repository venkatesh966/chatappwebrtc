import { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';
import {
  Box,
  IconButton,
  Typography,
  Paper,
  Tooltip,
  CircularProgress,
  Menu,
  MenuItem,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
} from '@mui/material';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import CallIcon from '@mui/icons-material/Call';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { styled } from '@mui/material/styles';
import WebRTCService from '../services/WebRTCService';

const CallContainer = styled(Paper)(({ theme }) => ({
  position: 'fixed',
  bottom: '80px',
  right: '20px',
  padding: theme.spacing(2),
  borderRadius: '15px',
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(1),
  zIndex: 1000,
  transition: 'all 0.3s ease',
  minWidth: '200px',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 25px rgba(0, 0, 0, 0.2)',
  },
}));

const CallButton = styled(IconButton)(({ theme, color }) => ({
  width: '50px',
  height: '50px',
  backgroundColor: color === 'error' ? theme.palette.error.main : theme.palette.primary.main,
  color: 'white',
  '&:hover': {
    backgroundColor: color === 'error' ? theme.palette.error.dark : theme.palette.primary.dark,
  },
}));

const ControlButton = styled(IconButton)(({ theme }) => ({
  width: '40px',
  height: '40px',
  backgroundColor: theme.palette.grey[200],
  '&:hover': {
    backgroundColor: theme.palette.grey[300],
  },
}));

const ScreenShareButton = styled(IconButton)(({ theme, isActive }) => ({
  width: '40px',
  height: '40px',
  backgroundColor: isActive ? theme.palette.success.main : theme.palette.grey[200],
  color: isActive ? 'white' : theme.palette.text.primary,
  '&:hover': {
    backgroundColor: isActive ? theme.palette.success.dark : theme.palette.grey[300],
  },
}));

const CallInterface = ({ 
  // Audio call props
  isCallActive, 
  onStartCall, 
  onEndCall, 
  onMuteToggle, 
  isMuted,
  callStatus,
  callDuration,
  incomingCall,
  onAnswerCall,
  onRejectCall,
  
  // Screen sharing props
  isScreenSharing,
  screenShareStatus,
  screenShareType,
  screenShareDuration,
  screenShareQuality,
  onStartScreenShare,
  onStopScreenShare,
  onScreenShareQualityChange,
  incomingScreenShare,
  onAnswerScreenShare,
  onRejectScreenShare,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [showIncomingScreenShare, setShowIncomingScreenShare] = useState(false);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const nodeRef = useRef(null);

  useEffect(() => {
    const activeCallStatuses = ['dialing', 'opponent_ringing', 'incoming_ringing', 'active'];
    const activeScreenShareStatuses = ['connecting', 'active', 'incoming'];
    
    const shouldShow = activeCallStatuses.includes(callStatus) || 
                      activeScreenShareStatuses.includes(screenShareStatus) ||
                      isCallActive || isScreenSharing;
    
    if (shouldShow) {
      setIsVisible(true);
    } else if (isVisible) {
      const timer = setTimeout(() => setIsVisible(false), 800);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [callStatus, screenShareStatus, isCallActive, isScreenSharing, isVisible]);

  useEffect(() => {
    if (incomingScreenShare) {
      setShowIncomingScreenShare(true);
    } else {
      setShowIncomingScreenShare(false);
    }
  }, [incomingScreenShare]);

  useEffect(() => {
    if (incomingCall) {
      setShowIncomingCall(true);
    } else {
      setShowIncomingCall(false);
    }
  }, [incomingCall]);

  if (!isVisible && !showIncomingScreenShare && !showIncomingCall) return null;

  const handleMenuOpen = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleQualityChange = (quality) => {
    onScreenShareQualityChange(quality);
    handleMenuClose();
  };

  const handleScreenShareStart = () => {
    onStartScreenShare({ quality: screenShareQuality });
    handleMenuClose();
  };

  const handleAnswerScreenShare = () => {
    onAnswerScreenShare(incomingScreenShare);
    setShowIncomingScreenShare(false);
  };

  const handleRejectScreenShare = () => {
    onRejectScreenShare(incomingScreenShare);
    setShowIncomingScreenShare(false);
  };

  const handleAnswerCall = () => {
    onAnswerCall();
    setShowIncomingCall(false);
  };

  const handleRejectCall = () => {
    onRejectCall();
    setShowIncomingCall(false);
  };

  // Get primary status text
  const getPrimaryStatus = () => {
    if (callStatus === 'active' && screenShareStatus === 'active') {
      return `Call + Screen Share: ${callDuration}`;
    } else if (callStatus === 'active') {
      return `Call Duration: ${callDuration}`;
    } else if (screenShareStatus === 'active') {
      return `Screen Share: ${screenShareDuration}`;
    } else if (callStatus === 'dialing') {
      return 'Dialing...';
    } else if (callStatus === 'opponent_ringing') {
      return 'Ringing...';
    } else if (callStatus === 'incoming_ringing') {
      return 'Incoming Call...';
    } else if (screenShareStatus === 'connecting') {
      return 'Starting Screen Share...';
    } else if (screenShareStatus === 'incoming') {
      return 'Incoming Screen Share...';
    } else if (callStatus === 'error' || screenShareStatus === 'error') {
      return 'Connection Error';
    }
    return 'Call Ended';
  };

  // Incoming call dialog
  if (showIncomingCall) {
    return (
      <Dialog
        open={showIncomingCall}
        onClose={handleRejectCall}
        aria-labelledby="incoming-call-dialog-title"
        aria-describedby="incoming-call-dialog-description"
      >
        <DialogTitle id="incoming-call-dialog-title">
          Incoming Call
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="incoming-call-dialog-description">
            {incomingCall?.peer} is calling you. 
            Do you want to answer this call?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRejectCall} color="error">
            Decline
          </Button>
          <Button onClick={handleAnswerCall} color="primary" variant="contained">
            Answer
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Incoming screen share dialog
  if (showIncomingScreenShare) {
    return (
      <Dialog
        open={showIncomingScreenShare}
        onClose={handleRejectScreenShare}
        aria-labelledby="screen-share-dialog-title"
        aria-describedby="screen-share-dialog-description"
      >
        <DialogTitle id="screen-share-dialog-title">
          Incoming Screen Share
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="screen-share-dialog-description">
            {incomingScreenShare?.peer} wants to share their screen with you. 
            Do you want to accept this screen share?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRejectScreenShare} color="error">
            Decline
          </Button>
          <Button onClick={handleAnswerScreenShare} color="primary" variant="contained">
            Accept
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Draggable nodeRef={nodeRef}>
      <CallContainer 
        ref={nodeRef}
        elevation={3}
        sx={{ cursor: 'move' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" color="textSecondary" sx={{ flex: 1 }}>
            {getPrimaryStatus()}
          </Typography>
          
          {/* Quality indicator for screen sharing */}
          {screenShareStatus === 'active' && (
            <Chip
              label={screenShareQuality.toUpperCase()}
              size="small"
              color={
                screenShareQuality === 'high' ? 'success' :
                screenShareQuality === 'medium' ? 'warning' : 'error'
              }
              sx={{ fontSize: '0.7rem', height: '20px' }}
            />
          )}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          {/* Loading indicator */}
          {(callStatus === 'dialing' || screenShareStatus === 'connecting') && (
            <CircularProgress size={24} sx={{ mr: 1 }} />
          )}

          {/* Audio call controls */}
          {(isCallActive || callStatus === 'incoming_ringing' || callStatus === 'opponent_ringing') && (
            <Tooltip title={isMuted ? "Unmute" : "Mute"}>
              <ControlButton onClick={onMuteToggle}>
                {isMuted ? <MicOffIcon /> : <MicIcon />}
              </ControlButton>
            </Tooltip>
          )}

          {/* Screen sharing controls */}
          {!isScreenSharing && screenShareStatus !== 'active' && screenShareStatus !== 'connecting' && (
            <Tooltip title="Start Screen Share">
              <ScreenShareButton onClick={handleScreenShareStart} isActive={false}>
                <ScreenShareIcon />
              </ScreenShareButton>
            </Tooltip>
          )}

          {isScreenSharing && (
            <Tooltip title="Stop Screen Share">
              <ScreenShareButton onClick={onStopScreenShare} isActive={true}>
                <StopScreenShareIcon />
              </ScreenShareButton>
            </Tooltip>
          )}

          {/* Incoming call answer/reject buttons */}
          {callStatus === 'incoming_ringing' && (
            <>
              <CallButton 
                color="primary" 
                onClick={handleAnswerCall}
                aria-label="Answer Call"
              >
                <CallIcon />
              </CallButton>
              <CallButton 
                color="error" 
                onClick={handleRejectCall}
                aria-label="Reject Call"
              >
                <CallEndIcon />
              </CallButton>
            </>
          )}

          {/* Main call button for active/outgoing calls */}
          {(isCallActive || callStatus === 'opponent_ringing' || callStatus === 'dialing') && (
            <CallButton 
              color="error" 
              onClick={onEndCall}
              aria-label="End Call"
            >
              <CallEndIcon />
            </CallButton>
          )}

          {/* Start call button */}
          {(callStatus === 'idle' || callStatus === 'ended' || callStatus === 'error') && 
           !isScreenSharing && !incomingCall && (
            <CallButton 
              color="primary" 
              onClick={onStartCall}
              aria-label="Start Call"
            >
              <CallIcon />
            </CallButton>
          )}

          {/* Options menu */}
          <Tooltip title="Options">
            <ControlButton onClick={handleMenuOpen}>
              <MoreVertIcon />
            </ControlButton>
          </Tooltip>
        </Box>

        {/* Options menu */}
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
        >
          {/* Screen Share Start/Stop */}
          {!isScreenSharing ? (
            <MenuItem onClick={handleScreenShareStart}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScreenShareIcon fontSize="small" />
                Start Screen Share
              </Box>
            </MenuItem>
          ) : (
            <MenuItem onClick={onStopScreenShare}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StopScreenShareIcon fontSize="small" />
                Stop Screen Share
              </Box>
            </MenuItem>
          )}
          
          <MenuItem disabled>
            <Typography variant="subtitle2" color="textSecondary">
              Screen Share Quality
            </Typography>
          </MenuItem>
          <MenuItem 
            onClick={() => handleQualityChange('low')}
            selected={screenShareQuality === 'low'}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Low (720p)
              {screenShareQuality === 'low' && <CheckIcon fontSize="small" />}
            </Box>
          </MenuItem>
          <MenuItem 
            onClick={() => handleQualityChange('medium')}
            selected={screenShareQuality === 'medium'}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Medium (1080p@15fps)
              {screenShareQuality === 'medium' && <CheckIcon fontSize="small" />}
            </Box>
          </MenuItem>
          <MenuItem 
            onClick={() => handleQualityChange('high')}
            selected={screenShareQuality === 'high'}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              High (1080p@30fps)
              {screenShareQuality === 'high' && <CheckIcon fontSize="small" />}
            </Box>
          </MenuItem>
        </Menu>
      </CallContainer>
    </Draggable>
  );
};

export default CallInterface; 