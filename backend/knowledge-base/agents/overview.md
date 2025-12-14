# Agents Overview

AI Agents are the core of Gleam. An agent is a configured AI personality that can handle phone calls on your behalf, complete with its own voice, behavior, and capabilities.

## What Can Agents Do?

- **Answer Inbound Calls** - Greet callers, answer questions, take messages
- **Make Outbound Calls** - Reach out to leads, confirm appointments, conduct surveys
- **Book Appointments** - Integrate with calendars to schedule meetings
- **Send Follow-up Messages** - SMS/MMS support for omnichannel communication
- **Transfer Calls** - Hand off to a human when needed

## Agent Modes

| Mode | Description | Use Cases |
|------|-------------|-----------|
| **Inbound** | Only handles incoming calls | Customer support, reception, after-hours |
| **Outbound** | Only makes outgoing calls | Lead qualification, appointment reminders |
| **Hybrid** | Both inbound and outbound | Full-service agent (Pro plan required) |

## Communication Channels

| Channel | Description | Best For |
|---------|-------------|----------|
| **Voice Only** | Phone calls only | Traditional calling |
| **Messaging Only** | SMS/MMS only | Text-based support |
| **Omnichannel** | Voice + Messaging | Complete coverage |

## Agent Components

### Voice Settings

Choose how your agent sounds:

- **Voice Provider** - ElevenLabs (premium) or Deepgram (fast)
- **Voice Selection** - Choose from 20+ natural-sounding voices
- **Speaking Speed** - Adjust pace for your use case

### System Prompt

The system prompt defines your agent's personality and behavior:

```
You are Sarah, a friendly receptionist for Acme Dental.
Your goal is to help callers schedule appointments and answer
questions about our services. Be warm, professional, and helpful.
```

### Greeting

What the agent says first:

- **Inbound**: "Thank you for calling Acme Dental, this is Sarah. How can I help you today?"
- **Outbound**: "Hi, this is Sarah calling from Acme Dental. Is this a good time to talk about your upcoming appointment?"

### Behavior Settings

- **Interruptible** - Can the caller interrupt the agent?
- **Max Call Duration** - Automatic call end after X minutes
- **End Call Phrases** - Phrases that trigger call completion
- **Transfer Number** - Where to forward when human help is needed

## Agent Templates

Start quickly with pre-built templates:

| Template | Description |
|----------|-------------|
| **Appointment Booking** | Schedule appointments with calendar integration |
| **Lead Qualification** | Qualify leads with qualifying questions |
| **Customer Support** | Answer FAQs and route complex issues |
| **Survey Agent** | Conduct phone surveys and collect responses |

## Getting Started

1. [Create Your First Agent →](/dashboard/knowledge-base?path=agents/creating-agents)
2. [Configure Voice Settings →](/dashboard/knowledge-base?path=agents/voice-settings)
3. [Write Effective Prompts →](/dashboard/knowledge-base?path=agents/prompt-engineering)
4. [Set Up Calendar Integration →](/dashboard/knowledge-base?path=agents/calendar-integration)

---

*Ready to create an agent? [Go to Agents →](/dashboard/agents)*
