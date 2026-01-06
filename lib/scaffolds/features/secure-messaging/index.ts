/**
 * Secure Messaging Template
 * Real-time encrypted chat with WebSocket
 */

import { FeatureTemplate } from '../types';
import { secureMessagingFiles } from './files';
import { secureMessagingTests } from './tests';
import { secureMessagingRequirements } from './requirements';

export const secureMessagingTemplate: FeatureTemplate = {
  id: 'secure-messaging',
  name: 'Secure Messaging',
  version: '1.0.0',
  description: 'Real-time chat system with WebSocket, typing indicators, read receipts, and presence',
  category: 'messaging',

  keywords: [
    'chat',
    'messaging',
    'secure messaging',
    'real-time',
    'websocket',
    'patient messaging',
    'provider messaging',
    'instant messaging',
    'communication',
    'conversations',
    'messages',
    'direct message',
    'dm',
  ],

  patterns: [
    'chat.*system',
    'messaging.*feature',
    'real.*time.*chat',
    'patient.*provider.*communication',
    'secure.*chat',
    'instant.*message',
  ],

  files: secureMessagingFiles,
  tests: secureMessagingTests,
  requirements: secureMessagingRequirements,

  dependencies: {
    packages: {
      'socket.io-client': '^4.7.0',
      'date-fns': '^3.0.0',
    },
    devPackages: {},
    expectedModels: ['Conversation', 'Message', 'Participant'],
  },

  agentInstructions: `
## Secure Messaging Template Customization

### What's Pre-Built:
- WebSocket client with auto-reconnect
- Real-time message delivery
- Typing indicators
- Read receipts
- Online/offline presence
- Conversation list with unread counts
- Chat window with auto-scroll
- Message input with Enter key send

### File Locations:
- Lib: \`lib/messaging/\` (types.ts, socket.ts)
- API: \`app/api/messages/\` (CRUD endpoints)
- Hooks: \`hooks/useConversation.ts\`, \`hooks/useConversations.ts\`
- Components: \`components/messaging/\`
- Pages: \`app/messages/\`
- Tests: \`__tests__/messaging/\`

### Required Prisma Models:
\`\`\`prisma
model Conversation {
  id           String        @id @default(cuid())
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  participants Participant[]
  messages     Message[]
}

model Participant {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  userId         Int
  user           User         @relation(fields: [userId], references: [id])
  role           String       // patient, provider, care_team, admin
  joinedAt       DateTime     @default(now())

  @@unique([conversationId, userId])
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  senderId       Int
  sender         User         @relation(fields: [senderId], references: [id])
  content        String
  readAt         DateTime?
  createdAt      DateTime     @default(now())

  @@index([conversationId])
  @@index([createdAt])
}
\`\`\`

### Environment Variables:
\`\`\`env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
\`\`\`

### How to Use:

1. **Connect to WebSocket**:
\`\`\`typescript
import { messagingSocket } from '@/lib/messaging/socket';

// Connect with user credentials
messagingSocket.connect(userId, authToken);

// Subscribe to messages
messagingSocket.onMessage((message) => {
  console.log('New message:', message);
});
\`\`\`

2. **Use conversation hooks**:
\`\`\`typescript
// List all conversations
const { conversations, createConversation } = useConversations();

// Single conversation with real-time updates
const {
  messages,
  sendMessage,
  typingUsers,
  startTyping,
  stopTyping,
} = useConversation({ conversationId, userId, authToken });
\`\`\`

3. **Use pre-built components**:
\`\`\`tsx
<ConversationList
  conversations={conversations}
  onSelect={(conv) => router.push(\`/messages/\${conv.id}\`)}
  currentUserId={userId}
/>

<ChatWindow
  messages={messages}
  currentUserId={userId}
  typingUsers={typingUsers}
/>

<MessageInput
  onSend={sendMessage}
  onTyping={startTyping}
  onStopTyping={stopTyping}
/>
\`\`\`

### WebSocket Server Setup:
You'll need a WebSocket server. Example with Socket.io:

\`\`\`typescript
// server.js
const io = require('socket.io')(3001, {
  cors: { origin: 'http://localhost:3000' }
});

io.on('connection', (socket) => {
  const { userId } = socket.handshake.query;

  socket.on('conversation:join', ({ conversationId }) => {
    socket.join(conversationId);
  });

  socket.on('message:send', ({ conversationId, content }) => {
    io.to(conversationId).emit('message:new', {
      conversationId,
      senderId: userId,
      content,
      createdAt: new Date(),
    });
  });

  socket.on('typing:start', ({ conversationId }) => {
    socket.to(conversationId).emit('typing:start', { userId });
  });
});
\`\`\`

### Customization Needed:
1. Set up WebSocket server (Socket.io recommended)
2. Add message encryption if required
3. Configure push notifications for mobile
4. Add file attachment support
5. Customize message retention policies
6. Add message search functionality

### DO NOT Modify:
- Socket reconnection logic
- Read receipt tracking
- Typing indicator debouncing
- Message ordering logic
`,
};
