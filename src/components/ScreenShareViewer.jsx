import React, { useRef, useEffect, useState } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Paper,
  Tooltip,
  Chip,
  Fade,
  Backdrop,
} from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import CloseIcon from '@mui/icons-material/Close';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import { styled } from '@mui/material/styles';

const ScreenShareContainer = styled(Paper)(({ theme, isFullscreen }) => ({
  position: isFullscreen ? 'fixed' : 'relative',
  top: isFullscreen ? 0 : 'auto',
  left: isFullscreen ? 0 : 'auto',
  width: isFullscreen ? '100vw' : '100%',
  height: isFullscreen ? '100vh' : 'auto',
  maxHeight: isFullscreen ? '100vh' : '40vh',
  backgroundColor: '#000',
  borderRadius: isFullscreen ? 0 : theme.spacing(2),
  overflow: 'hidden',
  zIndex: isFullscreen ? 1300 : 1,
  display: 'flex',
  flexDirection: 'column',
}));

const VideoContainer = styled(Box)({
  position: 'relative',
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#000',
});

const VideoElement = styled('video')({
  width: '100%',
  height: '100%',
  objectFit: 'contain',
});

const ControlsOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  right: theme.spacing(1),
  display: 'flex',
  gap: theme.spacing(1),
  zIndex: 10,
}));

const InfoOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: theme.spacing(1),
  left: theme.spacing(1),
  display: 'flex',
  gap: theme.spacing(1),
  zIndex: 10,
}));

const ControlButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  color: 'white',
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
}));

const ScreenShareViewer = ({
  stream,
  isVisible,
  onClose,
  screenShareType = 'receiving', // 'sending' | 'receiving'
  quality = 'medium',
  duration = '00:00',
}) => {
  const videoRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const hideControlsTimeoutRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      setVideoError(false);
    }
  }, [stream]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      // Auto-hide controls in fullscreen after 3 seconds
      const timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
      hideControlsTimeoutRef.current = timeout;

      return () => {
        if (hideControlsTimeoutRef.current) {
          clearTimeout(hideControlsTimeoutRef.current);
        }
      };
    } else {
      setShowControls(true);
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    }
  }, [isFullscreen]);

  const handleFullscreenToggle = async () => {
    try {
      if (!isFullscreen) {
        await videoRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn('Fullscreen toggle failed:', error);
    }
  };

  const handleMuteToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleMouseMove = () => {
    if (isFullscreen) {
      setShowControls(true);
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const handleVideoError = () => {
    setVideoError(true);
  };

  const getQualityColor = (quality) => {
    switch (quality) {
      case 'high': return 'success';
      case 'medium': return 'warning';
      case 'low': return 'error';
      default: return 'default';
    }
  };

  if (!isVisible || !stream) {
    return null;
  }

  return (
    <>
      {isFullscreen && (
        <Backdrop open={isFullscreen} sx={{ zIndex: 1200, backgroundColor: 'black' }} />
      )}
      <ScreenShareContainer 
        elevation={isFullscreen ? 0 : 8}
        isFullscreen={isFullscreen}
        onMouseMove={handleMouseMove}
      >
        <VideoContainer>
          {videoError ? (
            <Box sx={{ textAlign: 'center', color: 'white', p: 4 }}>
              <Typography variant="h6" gutterBottom>
                Unable to display screen share
              </Typography>
              <Typography variant="body2" color="grey.400">
                There was an error loading the video stream
              </Typography>
            </Box>
          ) : (
            <VideoElement
              ref={videoRef}
              autoPlay
              playsInline
              muted={isMuted}
              onError={handleVideoError}
            />
          )}

          <Fade in={showControls || !isFullscreen} timeout={300}>
            <ControlsOverlay>
              {stream && stream.getAudioTracks().length > 0 && (
                <Tooltip title={isMuted ? "Unmute" : "Mute"}>
                  <ControlButton size="small" onClick={handleMuteToggle}>
                    {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                  </ControlButton>
                </Tooltip>
              )}
              
              <Tooltip title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                <ControlButton size="small" onClick={handleFullscreenToggle}>
                  {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </ControlButton>
              </Tooltip>

              <Tooltip title="Close Screen Share">
                <ControlButton size="small" onClick={onClose}>
                  <CloseIcon />
                </ControlButton>
              </Tooltip>
            </ControlsOverlay>
          </Fade>

          <Fade in={showControls || !isFullscreen} timeout={300}>
            <InfoOverlay>
              <Chip
                label={screenShareType === 'sending' ? 'Sharing Screen' : 'Viewing Screen'}
                size="small"
                color="primary"
                variant="filled"
                sx={{ 
                  backgroundColor: 'rgba(25, 118, 210, 0.8)',
                  color: 'white',
                  fontSize: '0.75rem'
                }}
              />
              
              <Chip
                label={`${quality.toUpperCase()} Quality`}
                size="small"
                color={getQualityColor(quality)}
                variant="filled"
                sx={{ fontSize: '0.75rem' }}
              />
              
              <Chip
                label={duration}
                size="small"
                color="default"
                variant="filled"
                sx={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  color: 'white',
                  fontSize: '0.75rem'
                }}
              />
            </InfoOverlay>
          </Fade>
        </VideoContainer>
      </ScreenShareContainer>
    </>
  );
};

export default ScreenShareViewer; 