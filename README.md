# AI Caller SaaS Platform

A production-ready SaaS platform for creating and deploying AI voice agents that can handle inbound/outbound calls with natural conversation.

## 🚀 Features

- **🎙️ Real-time Voice Processing**: Sub-500ms latency with streaming STT, LLM, and TTS
- **📞 Twilio Integration**: Handle inbound/outbound calls with WebSocket audio streaming
- **🤖 Multiple AI Models**: Deepgram Nova-2, OpenAI GPT-4, ElevenLabs TTS
- **📋 Pre-built Templates**: Appointment booking, lead qualification, customer support, surveys
- **💰 Usage Tracking**: Real-time cost tracking and credit-based billing
- **📊 Analytics**: Call transcripts, recordings, and performance metrics
- **🔐 Secure Authentication**: JWT-based auth with bcrypt password hashing
- **⚡ Redis Caching**: Session management and concurrent call tracking

## 🏗️ Tech Stack

### Backend
- **Framework**: Next.js 14 (App Router) + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis (ioredis)
- **WebSocket**: Socket.IO for real-time audio streaming

### Voice Pipeline
- **STT**: Deepgram Nova-2 (real-time transcription)
- **LLM**: OpenAI GPT-4 Turbo (conversation logic)
- **TTS**: ElevenLabs Turbo v2 (text-to-speech)
- **Telephony**: Twilio (call handling)

### Frontend
- **UI**: Tailwind CSS + shadcn/ui components
- **State**: React hooks
- **Authentication**: JWT tokens

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Redis server
- Twilio account
- Deepgram API key
- OpenAI API key
- ElevenLabs API key

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/codebymv/AICallerSaaS.git
cd AICallerSaaS
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/aicallers"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"
TWILIO_ACCOUNT_SID="your_twilio_sid"
TWILIO_AUTH_TOKEN="your_twilio_token"
DEEPGRAM_API_KEY="your_deepgram_key"
OPENAI_API_KEY="your_openai_key"
ELEVENLABS_API_KEY="your_elevenlabs_key"
```

4. **Initialize database**
```bash
npm run prisma:generate
npm run prisma:migrate
```

5. **Start development servers**

Terminal 1 (Next.js):
```bash
npm run dev
```

Terminal 2 (WebSocket server):
```bash
npm run ws
```

6. **Open your browser**
```
http://localhost:3000
```

## 📖 API Documentation

### Authentication

**Register**
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Login**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Get Current User**
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Agents

**List Agents**
```http
GET /api/agents
Authorization: Bearer <token>
```

**Create Agent**
```http
POST /api/agents
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Support Agent",
  "template": "customerSupport",
  "systemPrompt": "You are a helpful support agent...",
  "voice": "rachel",
  "greeting": "Hello! How can I help you today?"
}
```

**Get Agent**
```http
GET /api/agents/:id
Authorization: Bearer <token>
```

**Update Agent**
```http
PATCH /api/agents/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "isActive": true
}
```

**Delete Agent**
```http
DELETE /api/agents/:id
Authorization: Bearer <token>
```

### Calls

**List Calls**
```http
GET /api/calls?agentId=<agent_id>&limit=50&offset=0
Authorization: Bearer <token>
```

**Get Call Details**
```http
GET /api/calls/:id
Authorization: Bearer <token>
```

### Templates

**List Templates**
```http
GET /api/templates
```

## 🎨 Agent Templates

### 1. Appointment Booking
Perfect for medical offices, salons, and service businesses. Handles scheduling with natural conversation.

### 2. Lead Qualification
Qualifies leads using BANT framework (Budget, Authority, Need, Timeline) for sales teams.

### 3. Customer Support
Answers common questions, troubleshoots issues, and escalates when needed.

### 4. Survey & Feedback
Collects NPS scores and customer feedback with structured questions.

## 🔧 Configuration

### Voice Settings
```typescript
{
  voice: "rachel",           // Voice ID from ElevenLabs
  voiceProvider: "elevenlabs", // elevenlabs or google
  voiceSettings: {
    stability: 0.5,
    similarity_boost: 0.75
  }
}
```

### Call Behavior
```typescript
{
  maxCallDuration: 600,      // seconds (10 minutes)
  interruptible: false,       // Enable barge-in
  greeting: "Hello! How can I help you?"
}
```

### Webhooks
```typescript
{
  webhookUrl: "https://your-app.com/webhook",
  webhookEvents: ["call_started", "call_ended", "call_failed"]
}
```

## 💰 Pricing & Cost Management

### Cost Breakdown (per 3-minute call)
- Deepgram STT: $0.013
- OpenAI GPT-4: $0.015
- ElevenLabs TTS: $0.135
- Twilio: $0.039
- **Total**: ~$0.20 per call

### Pricing Model
- $0.12/minute ($0.36 per 3-min call)
- 78% gross margin
- Credit-based system with bonus packs

## 🚦 Rate Limiting

- **Concurrent calls**: 10 per user (configurable)
- **Daily API calls**: 100 per user for free tier
- **Monthly minutes**: Usage-based with quota tracking

## 🧪 Testing

### Test Call Flow
1. Create an agent via API or UI
2. Provision a phone number
3. Call the number to test the agent
4. View transcript and recording in dashboard

### Mock Testing (without phone calls)
```bash
# Run test suite
npm test

# Test voice pipeline
npm run test:voice
```

## 📊 Database Schema

Key tables:
- `users` - User accounts and authentication
- `agents` - AI agent configurations
- `phone_numbers` - Twilio phone numbers
- `calls` - Call records with transcripts
- `usage_metrics` - Usage tracking for billing

## 🔒 Security

- JWT-based authentication with secure token storage
- Bcrypt password hashing (10 rounds)
- API key encryption for external services
- Rate limiting on all endpoints
- HTTPS/WSS required in production
- Input validation with Zod schemas

## 🚀 Deployment

### Production Checklist

1. **Environment Variables**
   - Set strong `JWT_SECRET`
   - Use production API keys
   - Configure production database URL

2. **Database**
   ```bash
   npm run prisma:migrate deploy
   ```

3. **Build**
   ```bash
   npm run build
   ```

4. **Start**
   ```bash
   npm start
   ```

### Recommended Hosting
- **App**: Vercel, Railway, or Render
- **Database**: Neon, Supabase, or Railway
- **Redis**: Upstash or Redis Cloud
- **Region**: us-east-1 (lowest latency for AI APIs)

## 🛣️ Roadmap

### Phase 1 (MVP) ✅
- [x] Core voice pipeline (STT → LLM → TTS)
- [x] Twilio integration
- [x] Agent templates
- [x] Authentication
- [x] Basic API

### Phase 2 (Coming Soon)
- [ ] Dashboard UI with React
- [ ] Real-time call monitoring
- [ ] Audio playback and waveforms
- [ ] Usage analytics
- [ ] Stripe billing integration

### Phase 3 (Future)
- [ ] Outbound calling campaigns
- [ ] Visual flow builder
- [ ] Knowledge base (RAG)
- [ ] Multi-language support
- [ ] Team collaboration

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please open an issue or PR.

## 📧 Support

For issues and questions, please open a GitHub issue or contact support@example.com

---

Built with ❤️ by [codebymv](https://github.com/codebymv)