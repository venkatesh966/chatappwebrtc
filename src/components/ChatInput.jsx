import { TextField, Button, IconButton, Box } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

const ChatInput = ({
  value,
  onChange,
  onSend,
  connectMode = false,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
    <TextField
      placeholder={connectMode ? 'Enter peer ID' : 'Type your message...'}
      variant="outlined"
      size="small"
      value={value}
      onChange={e => onChange(e.target.value)}
      fullWidth
      InputProps={{ style: { fontSize: 15, padding: 8 } }}
      onKeyDown={e => {
        if (e.key === 'Enter' && !connectMode) {
          e.preventDefault();
          onSend();
        }
      }}
    />
    {connectMode ? (
      <Button
        variant="contained"
        onClick={onSend}
        sx={{
          fontSize: 15,
          fontWeight: 600,
          py: 1,
          px: 2,
          borderRadius: 2,
          boxShadow: 1,
        }}
        size="large"
        disabled={!value.trim()}
      >
        CONNECT
      </Button>
    ) : (
      <IconButton
        type="submit"
        color="primary"
        disabled={!value.trim()}
        onClick={onSend}
        sx={{
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          width: 38,
          height: 38,
          borderRadius: 2,
          fontSize: 20,
          '&:hover': { bgcolor: 'primary.dark' },
        }}
      >
        <SendIcon fontSize="inherit" />
      </IconButton>
    )}
  </Box>
);

export default ChatInput;
