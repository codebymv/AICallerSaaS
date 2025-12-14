# Twilio Setup Guide

Gleam uses the **BYOT (Bring Your Own Twilio)** model, which means you connect your own Twilio account to make and receive calls. This gives you full control over your phone numbers, billing, and compliance.

## Why BYOT?

- **Full Control** - You own your phone numbers and can take them anywhere
- **Direct Billing** - Pay Twilio directly at their published rates
- **Compliance** - Register for A2P 10DLC under your own business
- **Transparency** - See exactly what you're paying for calls and SMS

## Prerequisites

Before you begin, you'll need:

1. A Twilio account ([Sign up here](https://www.twilio.com/try-twilio))
2. A verified phone number or completed business profile
3. Payment method added to your Twilio account (for production use)

## Step-by-Step Setup

### 1. Get Your Twilio Credentials

1. Log in to your [Twilio Console](https://console.twilio.com/)
2. On the dashboard, you'll see your **Account SID** and **Auth Token**
3. Click the eye icon to reveal your Auth Token
4. Copy both values - you'll need them in Gleam

> ⚠️ **Security Note**: Never share your Auth Token publicly. It provides full access to your Twilio account.

### 2. Configure Twilio in Gleam

1. In Gleam, go to **Settings** (gear icon in sidebar)
2. Find the **Twilio Configuration** section
3. Enter your **Account SID**
4. Enter your **Auth Token**
5. Click **Save Configuration**

You should see a green checkmark indicating successful connection.

### 3. Purchase a Phone Number

Once Twilio is configured:

1. Go to **Phone Numbers** in the sidebar
2. Click **Buy Number**
3. Search by area code, city, or capabilities
4. Select a number and confirm purchase
5. The number will be charged to your Twilio account

### 4. Configure Webhooks (Automatic)

When you assign a phone number to an agent, Gleam automatically configures the Twilio webhooks. You don't need to manually set up any webhook URLs.

## Messaging Service (Optional)

For high-volume SMS or A2P 10DLC compliance, you may want to set up a Twilio Messaging Service:

1. In Twilio Console, go to **Messaging** → **Services**
2. Create a new Messaging Service
3. Add your phone numbers to the service
4. Copy the **Messaging Service SID**
5. In Gleam Settings, add this SID to enable messaging service support

## Troubleshooting

### "Invalid Credentials" Error

- Double-check your Account SID (starts with `AC`)
- Make sure you copied the full Auth Token
- Ensure there are no extra spaces

### "Number Not Available" When Purchasing

- Try a different area code
- Check if your Twilio account is verified
- Ensure you have payment method configured

### Calls Not Connecting

- Verify the phone number is assigned to an agent
- Check that your agent is set to "Active"
- Ensure you have sufficient Twilio balance

## Twilio Pricing

Twilio charges are separate from your Gleam subscription:

| Service | Typical Cost |
|---------|--------------|
| Local Phone Number | ~$1.15/month |
| Toll-Free Number | ~$2.15/month |
| Inbound Calls | ~$0.0085/min |
| Outbound Calls | ~$0.014/min |
| SMS (Outbound) | ~$0.0079/segment |

*Prices vary by region. Check [Twilio Pricing](https://www.twilio.com/pricing) for current rates.*

## A2P 10DLC Registration

If you're sending SMS to US numbers, you'll need to register for A2P 10DLC:

1. Complete your Twilio Business Profile
2. Register your Brand
3. Register your Campaign
4. This process typically takes 1-2 weeks

[Learn more about A2P 10DLC →](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc)

---

**Next Steps:**
- [Create Your First Agent →](/dashboard/knowledge-base?path=agents/creating-agents)
- [Buy a Phone Number →](/dashboard/phone-numbers)
