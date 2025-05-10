import { useState, useEffect, useRef } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Paper,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import CallIcon from '@mui/icons-material/Call';
import { styled } from '@mui/material/styles';

const CallContainer = styled(Paper)(({ theme }) => ({
  position: 'fixed',
  bottom: '20px',
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

const MuteButton = styled(IconButton)(({ theme }) => ({
  width: '40px',
  height: '40px',
  backgroundColor: theme.palette.grey[200],
  '&:hover': {
    backgroundColor: theme.palette.grey[300],
  },
}));

const AudioCall = ({ 
  isCallActive, 
  onStartCall, 
  onEndCall, 
  onMuteToggle, 
  isMuted,
  callStatus,
  callDuration 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isCallActive) {
      setIsVisible(true);
    } else {
      // Add delay before hiding to show the end call animation
      const timer = setTimeout(() => setIsVisible(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isCallActive]);

  if (!isVisible) return null;

  return (
    <CallContainer elevation={3}>
      <Typography variant="subtitle2" color="textSecondary">
        {callStatus === 'connecting' ? 'Connecting...' : 
         callStatus === 'active' ? `Call Duration: ${callDuration}` : 
         'Call Ended'}
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {callStatus === 'connecting' ? (
          <CircularProgress size={24} />
        ) : (
          <>
            <MuteButton onClick={onMuteToggle}>
              <Tooltip title={isMuted ? "Unmute" : "Mute"}>
                {isMuted ? <MicOffIcon /> : <MicIcon />}
              </Tooltip>
            </MuteButton>
            
            {isCallActive ? (
              <CallButton 
                color="error" 
                onClick={onEndCall}
                aria-label="End Call"
              >
                <CallEndIcon />
              </CallButton>
            ) : (
              <CallButton 
                color="primary" 
                onClick={onStartCall}
                aria-label="Start Call"
              >
                <CallIcon />
              </CallButton>
            )}
          </>
        )}
      </Box>
    </CallContainer>
  );
};

export default AudioCall; 