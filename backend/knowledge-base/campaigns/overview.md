# Campaigns Overview

Campaigns allow you to automate outbound calling at scale. Upload a list of contacts, assign an agent, and let AI handle the calls systematically.

> 📌 **Plan Requirements**:
> - Starter: 1 campaign
> - Professional: 3 campaigns  
> - Enterprise: Unlimited

## What Are Campaigns?

A campaign is an organized outbound calling effort where an AI agent calls through a list of contacts based on your schedule and rules.

**Use Cases:**
- Lead qualification
- Appointment reminders
- Survey collection
- Follow-up calls
- Re-engagement outreach

## Campaign Components

| Component | Description |
|-----------|-------------|
| **Agent** | The AI agent making calls |
| **Contacts** | List of people to call |
| **Schedule** | When calls should be made |
| **Rules** | Retry logic, call windows |
| **Tracking** | Status and results |

## Campaign Statuses

| Status | Description |
|--------|-------------|
| **Draft** | Being configured, not running |
| **Scheduled** | Set to start at future date |
| **Active** | Currently making calls |
| **Paused** | Temporarily stopped |
| **Completed** | All contacts processed |
| **Cancelled** | Manually stopped |

## Creating a Campaign

### Step 1: Basic Setup

1. Go to **Campaigns** in the sidebar
2. Click **Create Campaign**
3. Enter campaign name and description
4. Select an agent (must be Outbound or Hybrid mode)

### Step 2: Upload Contacts

Upload a CSV file with your contact list:

**Required columns:**
- `phone` - Phone number (E.164 format preferred)

**Optional columns:**
- `name` - Contact name
- `email` - Email address
- `company` - Company name
- Any custom fields for personalization

**Example CSV:**
```csv
phone,name,email,company
+14155551234,John Smith,john@example.com,Acme Corp
+14155555678,Jane Doe,jane@example.com,Tech Inc
```

### Step 3: Configure Schedule

**Call Window**
- Set hours when calls can be made
- Respects contact timezone (if provided)
- Example: 9 AM - 6 PM local time

**Start/End Dates**
- When the campaign should begin
- Optional end date

**Pacing**
- How many concurrent calls
- Calls per hour limit

### Step 4: Set Rules

**Retry Logic**
- Number of retry attempts (0-5)
- Time between retries
- Retry on: No answer, busy, voicemail

**Call Handling**
- Max call duration
- Voicemail detection
- Transfer rules

### Step 5: Review & Launch

1. Review all settings
2. Preview first few contacts
3. Click **Launch Campaign** (or **Schedule** for later)

## Managing Active Campaigns

### Monitoring Progress

The campaign dashboard shows:
- Total contacts vs. completed
- Success rate
- Average call duration
- Calls remaining

### Taking Actions

| Action | What It Does |
|--------|--------------|
| **Pause** | Stop making calls, keep progress |
| **Resume** | Continue from where paused |
| **Cancel** | Stop permanently |
| **Export** | Download results CSV |

## Lead Statuses

Each contact in a campaign has a status:

| Status | Description |
|--------|-------------|
| **Pending** | Not yet called |
| **Scheduled** | Call scheduled for specific time |
| **Calling** | Currently on call |
| **Completed** | Call finished successfully |
| **Failed** | Could not connect |
| **Skipped** | Manually skipped |

## Best Practices

### Contact Quality

✅ **Do:**
- Verify phone numbers before upload
- Remove duplicates
- Include timezone if calling nationally
- Use E.164 format (+1XXXXXXXXXX)

❌ **Don't:**
- Upload invalid numbers
- Include Do Not Call numbers
- Ignore consent requirements

### Timing

✅ **Do:**
- Call during business hours (recipient's timezone)
- Avoid early morning and late night
- Consider industry-specific best times

❌ **Don't:**
- Call outside reasonable hours
- Ignore local regulations
- Blast calls without pacing

### Agent Configuration

For campaign agents:
- Use clear, concise outbound greetings
- Handle voicemail gracefully
- Include clear call purpose
- Have fallback for "not interested"

## Compliance Considerations

⚠️ **Important**: You are responsible for compliance with:

- **TCPA** (US) - Telephone Consumer Protection Act
- **TSR** - Telemarketing Sales Rule
- **GDPR** (EU) - If calling EU contacts
- **Local regulations** - State/country specific rules

**Recommendations:**
- Only call contacts who have consented
- Honor Do Not Call requests immediately
- Maintain accurate records
- Identify yourself and purpose quickly

## Analytics

After campaigns complete, review:

- **Connection rate** - % of calls that connected
- **Completion rate** - % that finished as intended
- **Average call time** - How long calls lasted
- **Outcome distribution** - Results breakdown

Export results for further analysis or CRM import.

---

**Next Steps:**
- [Uploading Contacts →](/dashboard/knowledge-base?path=campaigns/uploading-contacts)
- [Campaign Analytics →](/dashboard/knowledge-base?path=campaigns/analytics)
- [Create a Campaign →](/dashboard/campaigns)
