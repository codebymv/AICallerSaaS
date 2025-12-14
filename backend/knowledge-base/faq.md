# Frequently Asked Questions

Find answers to common questions about Gleam.

## Getting Started

### What is Gleam?

Gleam is an AI-powered voice agent platform that enables you to create virtual phone agents capable of handling inbound and outbound calls with natural conversation.

### Do I need technical skills to use Gleam?

No! Gleam is designed to be user-friendly. You can create and deploy AI agents without any coding knowledge. Simply configure your agent using our intuitive interface.

### What do I need to get started?

1. A Gleam account (free to create)
2. A Twilio account (for phone capabilities)
3. A phone number (purchased through Twilio)
4. An AI agent configuration

### Is there a free plan?

Yes! Our Free plan includes 100 minutes/month and 1 AI agent. No credit card required.

---

## Twilio & Phone Numbers

### Why do I need my own Twilio account?

We use a BYOT (Bring Your Own Twilio) model, which gives you:
- Full control over your phone numbers
- Direct billing at Twilio's published rates
- Compliance under your own business
- Ability to take numbers with you

### How much does Twilio cost?

Typical Twilio costs (billed separately):
- Phone number: ~$1.15/month
- Inbound calls: ~$0.0085/minute
- Outbound calls: ~$0.014/minute
- SMS: ~$0.0079/segment

### Can I use my existing phone number?

Yes! You can port your existing number to Twilio, then connect it to Gleam.

### What if I already have a Twilio account?

Perfect! Just connect it in Settings → Twilio Configuration using your Account SID and Auth Token.

---

## AI Agents

### How natural do the agents sound?

Very natural! We use ElevenLabs and Deepgram's latest voice synthesis technology. Most callers can't tell they're speaking with AI.

### Can I customize what my agent says?

Absolutely. You control:
- The greeting and personality
- How the agent responds
- What information it knows
- When to transfer to a human

### What if my agent doesn't know something?

You can configure fallback behaviors:
- Transfer to a human
- Offer to have someone call back
- Collect a message
- Politely decline and offer alternatives

### How long can calls last?

You set the maximum duration per agent (up to 60 minutes). Most calls are configured for 5-15 minutes.

### Can the agent handle multiple calls at once?

Yes, AI agents can handle unlimited concurrent calls. However, phone number capacity depends on your Twilio configuration.

---

## Calls & Conversations

### Are calls recorded?

Yes, calls can be recorded for quality and training purposes. Recordings are stored securely and accessible in your Call Logs.

### Can I see transcripts?

Yes! Every call includes a full transcript showing the conversation between your agent and the caller.

### What about voicemail?

For outbound calls, you can configure whether to leave voicemails or hang up when detecting voicemail.

### Can the agent transfer calls?

Yes, configure a transfer number and conditions. The agent will announce the transfer and connect the caller.

---

## Campaigns

### What's the difference between calls and campaigns?

- **Calls**: Individual calls made via dialpad
- **Campaigns**: Automated bulk calling through a contact list

### How many contacts can I call in a campaign?

There's no hard limit on contact list size. However, calling pace is controlled to ensure quality and compliance.

### Can I pause a campaign?

Yes, campaigns can be paused at any time and resumed later without losing progress.

### What happens to contacts that don't answer?

Based on your retry settings, the system will:
1. Mark as "no answer"
2. Retry at specified intervals
3. Mark as failed after max attempts

---

## Calendar & Scheduling

### Which calendars are supported?

- Google Calendar
- Cal.com
- Calendly

### Can the agent book appointments during a call?

Yes! When calendar integration is enabled, agents can check availability and book appointments in real-time.

### Will I get notifications for bookings?

Yes, appointments appear on your connected calendar with notifications enabled based on your calendar settings.

---

## Billing & Plans

### When does my billing cycle reset?

On the anniversary of your signup date each month.

### Do unused minutes roll over?

No, included minutes reset each billing cycle. However, purchased credits never expire.

### Can I upgrade or downgrade anytime?

Yes! Upgrades take effect immediately. Downgrades take effect at the next billing cycle.

### What happens if I exceed my minutes?

You can:
1. Use purchased credits
2. Get charged overage ($0.05/minute)
3. Upgrade to a higher plan

### How do I cancel?

Go to Settings → Subscription → Cancel. You'll retain access until the period ends.

---

## Privacy & Security

### Is my data secure?

Yes. We use:
- Encrypted connections (TLS/SSL)
- Encrypted data at rest
- Secure authentication
- Regular security audits

### Who can access my recordings?

Only you and users in your organization can access recordings. We don't listen to or share your calls.

### Are you HIPAA compliant?

Enterprise plans can include BAA for HIPAA compliance. Contact sales for healthcare deployments.

### How long is data retained?

- Call recordings: 90 days (default)
- Transcripts: Indefinite
- Analytics: Indefinite
- Custom retention available on Enterprise

---

## Technical Questions

### What's the latency like?

Sub-500ms response time for natural-feeling conversations.

### What languages are supported?

Currently English, with more languages coming soon.

### Is there an API?

Yes! API access is available for programmatic control of agents, calls, and data.

### What integrations are available?

- Calendar: Google, Cal.com, Calendly
- CRM: Coming soon
- Custom webhooks available now

---

## Still Have Questions?

- **Email**: support@gleam.ai
- **Documentation**: [Knowledge Base](/dashboard/knowledge-base)
- **Community**: Coming soon

---

*Last updated: December 2024*
