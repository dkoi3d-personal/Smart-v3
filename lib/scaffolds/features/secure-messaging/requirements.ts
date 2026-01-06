/**
 * Secure Messaging Template - Requirements
 */

import { TemplateRequirements } from '../types';

export const secureMessagingRequirements: TemplateRequirements = {
  text: `
## Secure Messaging System (Pre-Built)

The following secure messaging features are pre-scaffolded:

### Real-Time Messaging
- WebSocket-based instant messaging
- Typing indicators
- Read receipts
- Online/offline presence
- Message delivery status

### Pre-Built Components
- \`ChatWindow\` - Message display with auto-scroll
- \`MessageInput\` - Compose with attachments
- \`ConversationList\` - List of active chats
- \`TypingIndicator\` - Shows who's typing
- \`ReadReceipts\` - Delivery/read status
- \`ParticipantList\` - Conversation members

### Pre-Built Hooks
- \`useConversation()\` - Real-time message stream
- \`useConversations()\` - List all conversations
- \`useTyping()\` - Typing status management
- \`usePresence()\` - Online/offline status

### Pre-Built API Endpoints
- \`GET /api/messages\` - List conversations
- \`POST /api/messages\` - Create conversation
- \`GET /api/messages/[id]\` - Get conversation messages
- \`POST /api/messages/[id]\` - Send message
- \`PATCH /api/messages/[id]/read\` - Mark as read

### WebSocket Events
- \`message:new\` - New message received
- \`message:read\` - Message read by recipient
- \`typing:start\` - User started typing
- \`typing:stop\` - User stopped typing
- \`presence:update\` - User online/offline

### Prisma Models Included
- Conversation - Chat thread
- Message - Individual messages
- Participant - Users in conversation

### Security Features
- Role-based access (patient, provider, care_team)
- Conversation-level permissions
- Audit logging of all messages

### Customization Needed
- Configure WebSocket server URL
- Add message encryption if needed
- Set up push notifications
- Configure file attachment storage
`,
  priority: 18, // High priority for healthcare communication
};
