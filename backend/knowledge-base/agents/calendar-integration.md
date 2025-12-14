# Calendar Integration

Enable your AI agents to check availability and book appointments directly during phone calls. This feature creates a seamless experience where callers can schedule without waiting for callbacks.

> 📌 **Plan Requirement**: Calendar integration is available on Professional and Enterprise plans.

## Supported Calendars

| Provider | Status | Best For |
|----------|--------|----------|
| **Google Calendar** | ✅ Full Support | Personal/small business |
| **Cal.com** | ✅ Full Support | Scheduling pages |
| **Calendly** | ✅ Full Support | Professional scheduling |

## Setup Overview

1. Connect your calendar in Settings
2. Enable calendar on your agent
3. Configure event types
4. Test the integration

## Google Calendar Setup

### Step 1: Connect Google Account

1. Go to **Settings** → **Calendar Integration**
2. Click **Connect Google Calendar**
3. Sign in with your Google account
4. Grant the requested permissions:
   - View and edit calendar events
   - View calendar settings

### Step 2: Select Calendar

After connecting, choose which calendar to use:
- Primary calendar (default)
- Or a specific calendar from your account

### Step 3: Configure Default Event

Set defaults for appointments booked by AI:
- **Event Duration**: 30 minutes (adjustable)
- **Buffer Time**: Time between appointments
- **Event Title Template**: "Appointment with {caller_name}"

## Cal.com Setup

### Step 1: Get API Key

1. Log in to [Cal.com](https://cal.com)
2. Go to Settings → Developer → API Keys
3. Create a new API key
4. Copy the key

### Step 2: Connect in Gleam

1. Go to **Settings** → **Calendar Integration**
2. Click **Connect Cal.com**
3. Paste your API key
4. Select your event type

### Step 3: Choose Event Type

Select which Cal.com event type the agent should book:
- 15-minute consultation
- 30-minute meeting
- Custom event types

## Calendly Setup

### Step 1: Get Personal Access Token

1. Log in to [Calendly](https://calendly.com)
2. Go to **Integrations** → **API & Webhooks**
3. Generate a Personal Access Token
4. Copy the token

### Step 2: Connect in Gleam

1. Go to **Settings** → **Calendar Integration**
2. Click **Connect Calendly**
3. Paste your access token
4. Authorize the connection

### Step 3: Select Event Type

Choose which Calendly event type to use for bookings.

## Enabling Calendar on Agents

After connecting a calendar:

1. Go to **Agents** → Select your agent
2. Find **Calendar Settings** section
3. Toggle **Enable Calendar Access**
4. Select the connected calendar
5. Choose available event types
6. Set calendar permissions (scopes)

### Calendar Permissions (Scopes)

| Scope | Description |
|-------|-------------|
| Read Calendar | Check availability only |
| Create Events | Book new appointments |
| Reschedule Events | Move existing appointments |

## How It Works During Calls

When calendar is enabled, the agent can:

1. **Check Availability**
   ```
   Caller: "Can I come in next Tuesday?"
   Agent: "Let me check... I have openings at 10am, 2pm, and 4pm. 
          Which works best for you?"
   ```

2. **Book Appointments**
   ```
   Caller: "2pm sounds good."
   Agent: "Perfect! I've booked you for Tuesday at 2pm. You'll 
          receive a confirmation email shortly."
   ```

3. **Handle Conflicts**
   ```
   Caller: "How about 3pm?"
   Agent: "I'm sorry, 3pm is already taken. Would 2pm or 4pm work?"
   ```

## Best Practices

### Prompt Configuration

Add calendar context to your system prompt:

```
## Calendar Access
You have access to our appointment calendar. When someone wants 
to schedule:

1. Ask for their preferred date/time
2. Check availability
3. Offer alternatives if needed
4. Confirm the booking
5. Collect their email for confirmation

Always confirm the final time and date before booking.
```

### Availability Windows

Set when appointments can be booked:
- Business hours only
- Minimum advance notice (e.g., 24 hours)
- Maximum advance booking (e.g., 30 days)

### Confirmation Messages

Enable automatic confirmations:
- Email to caller (requires collecting email)
- SMS confirmation (if phone number collected)
- Calendar invite to your calendar

## Troubleshooting

### "Calendar Not Connected"

- Re-authenticate with your calendar provider
- Check that permissions haven't been revoked
- Verify API keys haven't expired

### "No Available Times"

- Check your calendar isn't fully booked
- Verify availability windows are set correctly
- Ensure event duration fits available slots

### Bookings Not Appearing

- Verify the correct calendar is selected
- Check that events are being created (not just checked)
- Look for events in the calendar's spam/hidden items

### Agent Not Offering to Book

- Ensure calendar is enabled on the agent
- Check system prompt mentions scheduling
- Verify calendar scopes include "Create Events"

## Privacy & Data

When using calendar integration:

- Only availability is checked (not event details)
- Booked appointments are created with minimal info
- Caller data is handled per your privacy policy
- You control what information is stored

---

**Next Steps:**
- [Campaigns Overview →](/dashboard/knowledge-base?path=campaigns/overview)
- [Back to Agents →](/dashboard/knowledge-base?path=agents/overview)
