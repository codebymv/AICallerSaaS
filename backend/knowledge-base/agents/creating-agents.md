# Creating Your First Agent

This guide walks you through creating an AI agent from scratch. By the end, you'll have a working agent ready to handle calls.

## Prerequisites

Before creating an agent, ensure you have:

- ✅ Twilio configured in Settings
- ✅ At least one phone number purchased

## Step-by-Step Guide

### Step 1: Navigate to Agent Creation

1. Click **Agents** in the sidebar
2. Click the **Create Agent** button
3. You'll see the agent creation wizard

### Step 2: Basic Information

**Agent Name**
Give your agent a descriptive name for your reference (e.g., "Main Reception Agent", "Sales Qualifier").

**Description** (optional)
Add notes about this agent's purpose.

### Step 3: Choose a Mode

Select how this agent will operate:

- **Inbound** - For handling incoming calls only
- **Outbound** - For making outbound calls only
- **Hybrid** - For both (requires Professional plan)

### Step 4: Configure the Voice

**Voice Provider**
- **ElevenLabs** - Most natural, best for premium experiences
- **Deepgram** - Faster response, good for high-volume

**Voice Selection**
Choose a voice that matches your brand:
- Rachel - Calm, professional female
- Drew - Confident, articulate male
- Sarah - Soft, friendly female
- And many more...

> 💡 **Tip**: Test different voices by clicking the play button next to each option.

### Step 5: Write the System Prompt

The system prompt is the most important part of your agent. It defines:
- Who the agent is (persona)
- What they should do
- How they should behave
- What they know

**Example System Prompt:**

```
You are Alex, a friendly customer service representative for TechCo.

Your role:
- Answer questions about our products and services
- Help customers troubleshoot basic issues
- Schedule callbacks with our technical team when needed
- Collect customer feedback

Guidelines:
- Be warm, professional, and patient
- Keep responses concise (2-3 sentences max)
- If you don't know something, offer to have someone call back
- Never make up information about products or pricing

Company Info:
- Business hours: 9 AM - 5 PM EST, Monday-Friday
- Support email: support@techco.com
- Main products: CloudSync, DataGuard, SecureVault
```

### Step 6: Set the Greeting

**Inbound Greeting**
What the agent says when answering:
```
Thanks for calling TechCo, this is Alex. How can I help you today?
```

**Outbound Greeting** (if applicable)
What the agent says when the person answers:
```
Hi, this is Alex calling from TechCo. Is this [Name]?
```

### Step 7: Behavior Settings

**Interruptible**: Toggle ON to allow natural interruption (recommended)

**Max Call Duration**: Set a limit (default: 10 minutes)
- Short calls: 5 minutes
- Standard: 10 minutes  
- Complex conversations: 20+ minutes

**Transfer Number**: Where to send calls that need human help

### Step 8: Save and Assign

1. Click **Create Agent** to save
2. Go to **Phone Numbers**
3. Click on a number and assign your new agent
4. Your agent is now live!

## Testing Your Agent

### Test Call (Recommended)

1. From the agent page, click **Test Call**
2. Enter your personal phone number
3. The agent will call you
4. Have a conversation to test the flow

### What to Test

- ✅ Does the greeting sound natural?
- ✅ Does the agent understand your questions?
- ✅ Are responses appropriate and helpful?
- ✅ Does the agent stay in character?
- ✅ Does call transfer work (if configured)?

## Common Issues

### Agent Sounds Robotic
- Try a different voice
- Adjust your system prompt to be more conversational
- Enable interruptibility

### Agent Doesn't Understand Context
- Add more detail to the system prompt
- Include example scenarios
- Provide specific company information

### Calls Ending Abruptly
- Check max call duration setting
- Review end call phrases
- Ensure your Twilio balance is sufficient

## Next Steps

- [Voice Settings Deep Dive →](/dashboard/knowledge-base?path=agents/voice-settings)
- [Prompt Engineering Tips →](/dashboard/knowledge-base?path=agents/prompt-engineering)
- [Add Calendar Integration →](/dashboard/knowledge-base?path=agents/calendar-integration)

---

*Need help? Contact support or check our [FAQ](/dashboard/knowledge-base?path=faq).*
