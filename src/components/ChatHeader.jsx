import { Box, Typography, Avatar } from '@mui/material';

const ChatHeader = ({ myId }) => (
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
    <Box>
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
        Your ID: <b style={{ color: '#fff' }}>{myId}</b>
      </Typography>
    </Box>
  </Box>
);

export default ChatHeader;
