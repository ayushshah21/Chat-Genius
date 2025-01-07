# ChatGenius PRD (Product Requirements Document)

## 1. Product Overview

ChatGenius is a real-time workplace communication platform enhanced with AI capabilities, enabling users to create AI avatars that represent them in conversations.

## 2. Tech Stack

### Core Stack

- **Frontend**: React + TypeScript + Tailwind + lucide-react
- **Backend**: Node.js (Express) + TypeScript
- **Database**: PostgreSQL
- **Real-time**: Socket.io
- **AI**: LangChain + OpenAI
- **Storage**: AWS S3
- **Auth**: Oauth

### Additional Infrastructure

- Redis (caching, pub/sub)
- pgvector (vector embeddings)
- AWS CloudFront (CDN)
- WebRTC (future voice/video)

## 3. Core Features

### MVP (Week 1)

#### Authentication

- [P0] Email/password login
- [P0] OAuth (Google)
- [P1] Password reset
- [P1] Session management

#### Messaging

- [P0] Real-time message delivery
- [P0] Channel & DM support
- [P0] Basic message formatting
- [P0] File sharing (images, docs)
- [P1] Message threading
- [P1] Emoji reactions
- [P1] Read receipts
- [P2] Message search

#### Channels

- [P0] Create/join channels
- [P0] Public/private channels
- [P0] Direct messages
- [P1] Channel discovery
- [P2] Channel management

### AI Features (Week 2)

#### Basic AI Avatar

- [P0] Avatar creation/configuration
- [P0] Context-aware responses
- [P0] Personality mirroring
- [P1] Automated responses

#### Advanced Features

- [P2] Voice synthesis
- [P2] Video avatar
- [P3] Custom appearance
- [P3] Expression system

## 4. Technical Architecture

### API Routes

```typescript
// Auth
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout

// Channels
GET /api/channels
POST /api/channels
GET /api/channels/:id
PUT /api/channels/:id
DELETE /api/channels/:id

// Messages
GET /api/channels/:id/messages
POST /api/channels/:id/messages
PUT /api/messages/:id
DELETE /api/messages/:id

// AI
POST /api/avatar/configure
POST /api/avatar/respond
GET /api/avatar/context
```

### WebSocket Events

```typescript
interface WebSocketEvents {
    'message.new': (message: Message) => void;
    'message.update': (message: Message) => void;
    'user.typing': (data: {channelId: string, userId: string}) => void;
    'user.status': (data: {userId: string, status: string}) => void;
    'avatar.responding': (data: {userId: string, channelId: string}) => void;
}
```

## 5. Performance Requirements

- Message delivery latency < 100ms
- Search response time < 500ms
- Support 10,000 concurrent users
- 99.9% uptime
- File upload limit: 50MB

## 6. Security Requirements

- Input sanitization
- Rate limiting
- JWT token authentication
- End-to-end encryption for DMs
- GDPR compliance
- Regular security audits

## 7. Monitoring

- Langfuse for AI observability
- Sentry for error tracking
- Custom analytics for user engagement
- Performance monitoring dashboard
