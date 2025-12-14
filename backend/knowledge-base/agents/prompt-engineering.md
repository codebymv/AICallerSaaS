# Prompt Engineering for Voice Agents

Writing effective prompts for voice AI is different from text-based AI. This guide covers best practices for creating prompts that lead to natural, effective phone conversations.

## The Anatomy of a Great Prompt

A well-structured prompt includes:

1. **Persona** - Who the agent is
2. **Role** - What they do
3. **Guidelines** - How they behave
4. **Knowledge** - What they know
5. **Constraints** - What they shouldn't do

## Example Prompt Structure

```
## Persona
You are Maya, a friendly appointment scheduler for Sunrise Dental.
You have worked here for 3 years and love helping patients.

## Your Role
- Schedule, reschedule, and cancel dental appointments
- Answer basic questions about services and pricing
- Collect patient information for new patients
- Transfer calls to staff when needed

## Communication Style
- Be warm and conversational, not robotic
- Keep responses to 1-2 sentences when possible
- Use the caller's name after they provide it
- Express empathy when patients mention pain or concerns

## Available Information
- Office hours: Mon-Fri 8am-5pm, Sat 9am-1pm
- Services: Cleanings ($99), X-rays ($75), Whitening ($299)
- Address: 123 Main Street, Suite 200
- Emergency line: 555-911-TOOTH

## Important Rules
- Never diagnose or provide medical advice
- Don't quote prices for complex procedures
- Always confirm appointment details before ending
- If unsure, offer to have someone call back
```

## Voice-Specific Best Practices

### Keep It Conversational

**Bad:**
```
Please provide your full legal name as it appears on your identification documents.
```

**Good:**
```
What's your name?
```

### Use Short Sentences

Voice AI works best with brief, clear responses:

**Bad:**
```
I would be more than happy to assist you with scheduling an appointment at your earliest convenience, and I can certainly check our availability across multiple dates and times to find something that works perfectly with your schedule.
```

**Good:**
```
I'd be happy to help you schedule an appointment! What day works best for you?
```

### Anticipate Phone Context

Remember that callers can't see anything:

**Bad:**
```
Click the button below to confirm.
```

**Good:**
```
Would you like me to confirm that appointment for Tuesday at 2pm?
```

## Handling Common Scenarios

### Collecting Information

```
## Information Collection
When scheduling, collect in this order:
1. Patient name (first and last)
2. Phone number (for confirmations)
3. Reason for visit
4. Preferred date/time
5. Insurance (if applicable)

Confirm each piece before moving on.
Example: "Great, so that's John Smith, S-M-I-T-H. Is that correct?"
```

### Managing Objections

```
## If caller is hesitant
- Acknowledge their concern
- Provide relevant information
- Offer alternatives
- Don't be pushy

Example responses:
- "I understand you're busy. Would a Saturday appointment work better?"
- "That's a great question. Let me explain..."
```

### Handling Off-Topic Requests

```
## Off-topic handling
If asked about unrelated topics:
- Politely acknowledge
- Redirect to your purpose
- Offer appropriate alternative

Example: "That's outside what I can help with, but I'd be happy to 
have someone from our team call you about that. For now, did you 
want to schedule that cleaning?"
```

## Testing Your Prompts

### Self-Test Questions

Before deploying, ask yourself:

1. Does the greeting sound natural when spoken aloud?
2. Can the agent handle the top 5 most common questions?
3. What happens if someone says something unexpected?
4. Is the response length appropriate for phone?
5. Does the agent know when to transfer to a human?

### Test Scenarios

Create test scripts for:

- ✅ Happy path (everything goes smoothly)
- ⚠️ Edge cases (unusual requests)
- ❌ Error handling (wrong information, confusion)
- 🔄 Recovery (getting back on track after confusion)

## Common Mistakes

### Mistake 1: Too Much Information

❌ **Don't** include everything in one response:
```
Our office is open Monday through Friday from 8am to 5pm, 
Saturday from 9am to 1pm, we're closed on Sundays, and we 
observe all major holidays including...
```

✅ **Do** provide information progressively:
```
We're open Monday through Friday, 8 to 5. Would you like 
to schedule something this week?
```

### Mistake 2: Robotic Confirmations

❌ **Robotic:**
```
I have recorded your appointment for March 15th at 2:00 PM 
for a dental cleaning service. Is this information accurate?
```

✅ **Natural:**
```
Perfect, you're all set for March 15th at 2. See you then!
```

### Mistake 3: No Personality

❌ **Bland:**
```
How can I help you today?
```

✅ **Engaging:**
```
Hey there! Thanks for calling Sunrise Dental. What can I 
do for you today?
```

## Advanced Techniques

### Dynamic Responses

Use conditional language:
```
## Time-aware greetings
- Before noon: "Good morning!"
- Noon to 5pm: "Good afternoon!"  
- After 5pm: "Good evening!"
```

### Handling Names

```
## Name handling
- After learning the caller's name, use it naturally
- Use it once or twice, not every sentence
- When spelling back: use phonetic alphabet for clarity
  (S as in Sam, M as in Mary...)
```

### Smooth Transfers

```
## Transfer process
Before transferring:
1. Explain why you're transferring
2. Summarize what you've discussed
3. Assure them the next person is prepared

Example: "I'm going to connect you with Dr. Smith's assistant 
who can help with your insurance question. I'll let them know 
you're calling about coverage for a root canal. One moment please."
```

## Prompt Templates

### Inbound Reception
[See Template →](/dashboard/knowledge-base?path=templates/inbound-reception)

### Outbound Sales
[See Template →](/dashboard/knowledge-base?path=templates/outbound-sales)

### Appointment Booking
[See Template →](/dashboard/knowledge-base?path=templates/appointment-booking)

---

**Next Steps:**
- [Calendar Integration →](/dashboard/knowledge-base?path=agents/calendar-integration)
- [Back to Agents Overview →](/dashboard/knowledge-base?path=agents/overview)
