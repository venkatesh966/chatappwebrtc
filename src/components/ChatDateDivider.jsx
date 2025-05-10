import { Divider, Chip } from '@mui/material';

function formatDate(date) {
  const now = new Date();
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (msgDate.getTime() === today.getTime()) return 'Today';
  if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const ChatDateDivider = ({ date }) => (
  <Divider sx={{ my: 1.5 }}>
    <Chip
      label={formatDate(date)}
      sx={{
        bgcolor: '#e3e8f0',
        color: '#4f8cff',
        fontWeight: 600,
        fontSize: 13,
        px: 1.5,
      }}
    />
  </Divider>
);

export default ChatDateDivider;
