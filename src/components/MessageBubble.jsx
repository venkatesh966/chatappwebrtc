import { Box, Chip, Typography } from '@mui/material';

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

const MessageBubble = ({ message, peerEmoji }) => {
  const isMe = message.sender === 'me';
  return (
    <Box sx={{ mb: 1.5 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: isMe ? 'flex-end' : 'flex-start',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: isMe ? 'primary.main' : 'grey.200',
            color: isMe ? 'primary.contrastText' : 'text.primary',
            px: 2,
            py: 1,
            borderRadius: 2,
            maxWidth: '75%',
            fontSize: 16,
            wordBreak: 'break-word',
            boxShadow: isMe ? 2 : 0,
            minWidth: 80,
          }}
        >
          <span style={{ fontSize: 18 }}>
            {isMe ? '😃' : peerEmoji}
          </span>
          <span>{message.text}</span>
          {isMe && (
            <Chip
              label="You"
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.25)',
                color: '#fff',
                fontWeight: 500,
                fontSize: 11,
                ml: 1,
                height: 20,
              }}
            />
          )}
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: isMe ? 'flex-end' : 'flex-start',
          px: 1.5,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: '#222',
            fontSize: 12,
            fontWeight: 500,
            mt: 0.5,
            opacity: 0.7,
          }}
        >
          {formatTime(new Date(message.timestamp))}
        </Typography>
      </Box>
    </Box>
  );
};

export default MessageBubble;
