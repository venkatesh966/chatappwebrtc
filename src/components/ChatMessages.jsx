import { Box, Typography } from '@mui/material';
import ChatDateDivider from './ChatDateDivider';
import MessageBubble from './MessageBubble';

function groupMessagesByDate(messages) {
  const groups = [];
  let lastDate = null;
  messages.forEach((msg) => {
    const msgDate = new Date(msg.timestamp);
    const dateKey = msgDate.toDateString();
    if (!lastDate || lastDate !== dateKey) {
      groups.push({ type: 'date', date: msgDate });
      lastDate = dateKey;
    }
    groups.push({ type: 'msg', ...msg });
  });
  return groups;
}

const ChatMessages = ({ messages, peerEmoji, endRef }) => {
  const grouped = groupMessagesByDate(messages);

  return (
    <Box
      sx={{
        minHeight: 280,
        maxHeight: 340,
        overflowY: 'auto',
        mb: 2,
        bgcolor: 'grey.50',
        borderRadius: 2,
        p: 2,
        border: '1px solid #e3e8f0',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        transition: 'min-height 0.4s cubic-bezier(.4,2,.6,1)',
      }}
    >
      {grouped.length === 0 && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: 'center', mt: 4, opacity: 0.7 }}
        >
          <span role="img" aria-label="wave">👋</span> Say hello to your peer!
        </Typography>
      )}
      {grouped.map((item, i) =>
        item.type === 'date' ? (
          <ChatDateDivider key={i} date={item.date} />
        ) : (
          <MessageBubble
            key={i}
            message={item}
            peerEmoji={peerEmoji}
          />
        )
      )}
      <div ref={endRef} />
    </Box>
  );
};

export default ChatMessages;
