# Voice Settings

Your agent's voice is crucial for creating a natural, engaging experience. This guide covers everything you need to know about configuring voice settings.

## Voice Providers

Gleam supports two voice providers, each with different strengths:

### ElevenLabs

**Best for:** Premium quality, natural conversation

| Pros | Cons |
|------|------|
| Most natural-sounding | Slightly higher latency |
| Excellent emotional range | Premium pricing tier |
| Wide voice variety | |

### Deepgram

**Best for:** Fast response, high-volume calling

| Pros | Cons |
|------|------|
| Ultra-low latency | Less vocal variety |
| Cost-effective | Less emotional depth |
| Reliable at scale | |

## Available Voices

### ElevenLabs Voices

| Voice | Description | Best For |
|-------|-------------|----------|
| Rachel | Calm, professional female | Corporate, medical |
| Drew | Confident, articulate male | Sales, consulting |
| Sarah | Soft, friendly female | Customer service |
| Charlie | Natural Australian male | Casual, approachable |
| Antoni | Warm, expressive male | Hospitality |
| Fin | Sophisticated Irish male | Premium services |

### Deepgram Voices

| Voice | Description | Best For |
|-------|-------------|----------|
| Asteria | Professional female | Business calls |
| Luna | Warm female | Support calls |
| Orion | Professional male | Formal interactions |
| Perseus | Friendly male | General purpose |

## Voice Settings

### Stability

Controls how consistent the voice sounds:
- **Lower (0.3-0.5)**: More expressive, varied
- **Medium (0.5-0.7)**: Balanced (recommended)
- **Higher (0.7-1.0)**: Very consistent, less emotional

### Similarity Boost

How closely to match the original voice:
- **Lower**: More natural variation
- **Higher**: Closer to voice sample

### Style

The speaking style intensity:
- **0**: Neutral, professional
- **0.5**: Moderate expression
- **1**: Maximum expression

## Choosing the Right Voice

### For Different Industries

| Industry | Recommended Voice | Why |
|----------|------------------|-----|
| Healthcare | Rachel | Calm, reassuring |
| Real Estate | Drew | Confident, professional |
| E-commerce | Sarah | Friendly, approachable |
| Legal | Antoni | Warm but professional |
| Tech Support | Orion | Clear, patient |

### For Different Purposes

| Purpose | Voice Style |
|---------|-------------|
| Sales calls | Energetic, confident |
| Support | Patient, empathetic |
| Appointments | Efficient, friendly |
| Surveys | Neutral, clear |

## Testing Voices

Before going live:

1. **Preview**: Click play button next to each voice
2. **Test Call**: Use the test call feature with your own phone
3. **Review**: Listen to test call recordings
4. **Adjust**: Fine-tune settings based on feedback

## Voice Best Practices

### Do's

✅ Match voice gender to your agent's persona
✅ Choose accents appropriate for your audience
✅ Test with real callers before scaling
✅ Use consistent voice across all agents in a campaign

### Don'ts

❌ Use overly casual voices for professional services
❌ Switch voices mid-conversation
❌ Ignore feedback about voice quality
❌ Use voices that don't match your brand

## Advanced Configuration

### Custom Voice Cloning

*Available on Professional and Enterprise plans*

Create a custom voice from your own audio samples:

1. Record 1-3 minutes of clear speech
2. Upload to ElevenLabs via their platform
3. Use the custom voice ID in Gleam

### Multi-language Support

Some voices support multiple languages:
- Ensure your system prompt specifies the language
- Test pronunciation of key terms
- Consider native-language voices for specific markets

## Troubleshooting

### Voice Sounds Choppy

- Check your internet connection
- Try Deepgram for lower latency
- Reduce stability setting slightly

### Voice Doesn't Match Preview

- Clear browser cache
- Verify voice ID is correct
- Check that settings saved properly

### Callers Can't Understand Agent

- Increase speaking pace slightly
- Use clearer, shorter sentences in prompts
- Consider a different voice with better clarity

---

**Next Steps:**
- [Prompt Engineering →](/dashboard/knowledge-base?path=agents/prompt-engineering)
- [Back to Agents Overview →](/dashboard/knowledge-base?path=agents/overview)
