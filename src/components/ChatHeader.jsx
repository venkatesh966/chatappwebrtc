import { Box, Typography, Avatar, IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

function formatUserId(id, minLength = 10) {
  if (!id) return '';
  if (id.length < minLength) {
    return id.padEnd(minLength, '0');
  }
  return id;
}

const ChatHeader = ({ myId }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(myId);
  };

  return (
    <Box
      sx={{
        background: 'linear-gradient(90deg, #4f8cff 0%, #3ff57a 100%)',
        py: 1.2,
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
          color: '#4f8cff',
          width: 38,
          height: 38,
          fontSize: 22,
          border: '2px solid #3b6be0',
        }}
      >
        😃
      </Avatar>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
        <Typography
          variant="subtitle1"
          sx={{
            color: '#fff',
            fontWeight: 600,
            fontSize: 17,
            userSelect: 'all',
            letterSpacing: 0.5,
            lineHeight: 1.1,
          }}
        >
          Your ID: <b style={{ color: '#fff' }}>{formatUserId(myId)}</b>
        </Typography>
        <Tooltip title="Copy ID">
          <IconButton 
            onClick={handleCopy}
            sx={{ 
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default ChatHeader;
