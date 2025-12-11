'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  AudioLines, 
  Play, 
  Pause, 
  Volume2, 
  ChevronDown, 
  ChevronUp,
  Check,
  Loader2,
  Sliders
} from 'lucide-react';
import Image from 'next/image';

// Voice data with ElevenLabs voice IDs and sample URLs
const VOICES = [
  { 
    id: 'rachel', 
    elevenLabsId: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel', 
    description: 'Calm, professional female voice',
    avatar: '/rachel.png',
    sampleUrl: 'https://storage.googleapis.com/eleven-public-cdn/premade/voices/21m00Tcm4TlvDq8ikWAM/6edb9076-c3e4-420c-b6ab-11d43fe341c8.mp3'
  },
  { 
    id: 'drew', 
    elevenLabsId: '29vD33N1CtxCmqQRPOHJ',
    name: 'Drew', 
    description: 'Confident, articulate male voice',
    avatar: '/drew.png',
    sampleUrl: 'https://storage.googleapis.com/eleven-public-cdn/premade/voices/29vD33N1CtxCmqQRPOHJ/8bef0b2e-9e39-43b8-8c89-53c2e39a9ab3.mp3'
  },
  { 
    id: 'clyde', 
    elevenLabsId: '2EiwWnXFnvU5JabPnv8n',
    name: 'Clyde', 
    description: 'Warm, friendly male voice',
    avatar: '/clyde.png',
    sampleUrl: 'https://storage.googleapis.com/eleven-public-cdn/premade/voices/2EiwWnXFnvU5JabPnv8n/65e8b6b6-e4f8-47ee-83f2-7f7b2e3f8f90.mp3'
  },
  { 
    id: 'paul', 
    elevenLabsId: '5Q0t7uMcjvnagumLfvZi',
    name: 'Paul', 
    description: 'Clear, authoritative male voice',
    avatar: '/paul.png',
    sampleUrl: 'https://storage.googleapis.com/eleven-public-cdn/premade/voices/5Q0t7uMcjvnagumLfvZi/6d2c6618-16cd-4e65-8b3a-4c2e2f9d0f6b.mp3'
  },
  { 
    id: 'domi', 
    elevenLabsId: 'AZnzlk1XvdvUeBnXmlld',
    name: 'Domi', 
    description: 'Energetic, youthful female voice',
    avatar: '/domi.png',
    sampleUrl: 'https://storage.googleapis.com/eleven-public-cdn/premade/voices/AZnzlk1XvdvUeBnXmlld/25d7f5c8-5b6e-4b5e-8f52-4d1e2a9e7b5c.mp3'
  },
  { 
    id: 'dave', 
    elevenLabsId: 'CYw3kZ02Hs0563khs1Fj',
    name: 'Dave', 
    description: 'Conversational male voice',
    avatar: '/dave.png',
    sampleUrl: 'https://storage.googleapis.com/eleven-public-cdn/premade/voices/CYw3kZ02Hs0563khs1Fj/7b7c4e5c-5e6b-4b5e-9f52-5e1e3b9e8c6d.mp3'
  },
  { 
    id: 'fin', 
    elevenLabsId: 'D38z5RcWu1voky8WS1ja',
    name: 'Fin', 
    description: 'Sophisticated Irish male voice',
    avatar: '/fin.png',
    sampleUrl: 'https://storage.googleapis.com/eleven-public-cdn/premade/voices/D38z5RcWu1voky8WS1ja/8c7c5f5d-6e7b-5c6e-af63-6f2e4c9f9d7e.mp3'
  },
  { 
    id: 'sarah', 
    elevenLabsId: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah', 
    description: 'Soft, friendly female voice',
    avatar: '/sarah.png',
    sampleUrl: 'https://storage.googleapis.com/eleven-public-cdn/premade/voices/EXAVITQu4vr4xnSDxMaL/01a3e33c-6e99-4ee6-8be2-96472b79fd31.mp3'
  },
  { 
    id: 'antoni', 
    elevenLabsId: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni', 
    description: 'Warm, expressive male voice',
    avatar: '/antoni.png',
    sampleUrl: 'https://storage.googleapis.com/eleven-public-cdn/premade/voices/ErXwobaYiN019PkySvjV/38d8f8c4-7f7d-6c7f-bf74-7g3f5d0g0f8f.mp3'
  },
  { 
    id: 'thomas', 
    elevenLabsId: 'GBv7mTt0atIp3Br8iCZE',
    name: 'Thomas', 
    description: 'Calm, reassuring male voice',
    avatar: '/thomas.png',
    sampleUrl: 'https://storage.googleapis.com/eleven-public-cdn/premade/voices/GBv7mTt0atIp3Br8iCZE/49d9f9d5-8g8e-7d8g-cg85-8h4g6e1h1g9g.mp3'
  },
  { 
    id: 'charlie', 
    elevenLabsId: 'IKne3meq5aSn9XLyUdCD',
    name: 'Charlie', 
    description: 'Natural Australian male voice',
    avatar: '/charlie.png',
    sampleUrl: 'https://storage.googleapis.com/eleven-public-cdn/premade/voices/IKne3meq5aSn9XLyUdCD/5a0a0a0a-9h9f-8e9h-dh96-9i5h7f2i2h0h.mp3'
  },
];

// Voice presets
const VOICE_PRESETS = {
  professional: {
    name: 'Professional',
    description: 'Stable, consistent delivery',
    stability: 0.75,
    similarity_boost: 0.85,
    style: 0.3,
  },
  conversational: {
    name: 'Conversational',
    description: 'Natural, balanced tone',
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.5,
  },
  expressive: {
    name: 'Expressive',
    description: 'Dynamic, emotional delivery',
    stability: 0.3,
    similarity_boost: 0.6,
    style: 0.8,
  },
};

type PresetKey = keyof typeof VOICE_PRESETS;

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
}

export default function VoicesPage() {
  const { toast } = useToast();
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('conversational');
  const [customSettings, setCustomSettings] = useState<VoiceSettings>({
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.5,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Update custom settings when preset changes
  useEffect(() => {
    const preset = VOICE_PRESETS[selectedPreset];
    setCustomSettings({
      stability: preset.stability,
      similarity_boost: preset.similarity_boost,
      style: preset.style,
    });
  }, [selectedPreset]);

  const handlePlayVoice = async (voiceId: string, sampleUrl: string) => {
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingVoice === voiceId) {
      setPlayingVoice(null);
      return;
    }

    setPlayingVoice(voiceId);
    
    try {
      const audio = new Audio(sampleUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPlayingVoice(null);
        audioRef.current = null;
      };
      
      audio.onerror = () => {
        setPlayingVoice(null);
        audioRef.current = null;
        toast({
          title: 'Playback error',
          description: 'Could not play voice sample',
          variant: 'destructive',
        });
      };
      
      await audio.play();
    } catch (error) {
      setPlayingVoice(null);
      toast({
        title: 'Playback error',
        description: 'Could not play voice sample',
        variant: 'destructive',
      });
    }
  };

  const handleSaveDefaults = async () => {
    if (!selectedVoice) {
      toast({
        title: 'No voice selected',
        description: 'Please select a voice first',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // TODO: Save to user preferences API
      // For now, save to localStorage
      const voiceDefaults = {
        voice: selectedVoice,
        settings: customSettings,
        preset: selectedPreset,
      };
      localStorage.setItem('voiceDefaults', JSON.stringify(voiceDefaults));
      
      toast({
        title: 'Defaults saved!',
        description: `${VOICES.find(v => v.id === selectedVoice)?.name} will be the default voice for new agents`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save voice defaults',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Load saved defaults on mount
  useEffect(() => {
    const saved = localStorage.getItem('voiceDefaults');
    if (saved) {
      try {
        const defaults = JSON.parse(saved);
        if (defaults.voice) setSelectedVoice(defaults.voice);
        if (defaults.preset) setSelectedPreset(defaults.preset);
        if (defaults.settings) setCustomSettings(defaults.settings);
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AudioLines className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">Voices</h1>
          <p className="hidden sm:block text-muted-foreground text-sm">Choose and customize voices for your AI agents</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Voice Selection Grid */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-600">Available Voices</CardTitle>
              <CardDescription>Click to select, or press play to preview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {VOICES.map((voice) => (
                  <div
                    key={voice.id}
                    className={`relative p-4 border rounded-lg cursor-pointer transition-all hover:border-teal-400 ${
                      selectedVoice === voice.id
                        ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                    onClick={() => setSelectedVoice(voice.id)}
                  >
                    {/* Selection indicator */}
                    {selectedVoice === voice.id && (
                      <div className="absolute top-2 right-2">
                        <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                        <Image
                          src={voice.avatar}
                          alt={voice.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-600">{voice.name}</h3>
                        <p className="text-xs text-muted-foreground truncate">{voice.description}</p>
                      </div>
                    </div>
                    
                    {/* Play button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayVoice(voice.id, voice.sampleUrl);
                      }}
                      className={`mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors border ${
                        playingVoice === voice.id
                          ? 'bg-teal-500 text-white border-teal-500'
                          : 'border-teal-600 text-teal-600 bg-transparent hover:bg-teal-50'
                      }`}
                    >
                      {playingVoice === voice.id ? (
                        <>
                          <Pause className="h-4 w-4" />
                          Playing...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Preview
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Voice Settings Panel */}
        <div className="space-y-6">
          {/* Presets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-600">Voice Style</CardTitle>
              <CardDescription>
                {selectedVoice 
                  ? `Customize ${VOICES.find(v => v.id === selectedVoice)?.name}'s voice`
                  : 'Select a voice to customize'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Preset buttons */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Quick Presets</Label>
                <div className="grid gap-2">
                  {(Object.entries(VOICE_PRESETS) as [PresetKey, typeof VOICE_PRESETS[PresetKey]][]).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedPreset(key)}
                      className={`flex items-center justify-between p-3 border rounded-lg text-left transition-colors ${
                        selectedPreset === key
                          ? 'border-teal-500 bg-teal-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-slate-600">{preset.name}</p>
                        <p className="text-xs text-muted-foreground">{preset.description}</p>
                      </div>
                      {selectedPreset === key && (
                        <Check className="h-4 w-4 text-teal-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-slate-600 transition-colors"
              >
                <Sliders className="h-4 w-4" />
                Advanced Settings
                {showAdvanced ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {/* Advanced Sliders */}
              {showAdvanced && (
                <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                  {/* Stability */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">Stability</Label>
                      <span className="text-sm font-medium text-slate-600">
                        {Math.round(customSettings.stability * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={customSettings.stability * 100}
                      onChange={(e) => setCustomSettings({
                        ...customSettings,
                        stability: parseInt(e.target.value) / 100,
                      })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                    <p className="text-xs text-muted-foreground">
                      Lower = more expressive, Higher = more consistent
                    </p>
                  </div>

                  {/* Clarity */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">Clarity</Label>
                      <span className="text-sm font-medium text-slate-600">
                        {Math.round(customSettings.similarity_boost * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={customSettings.similarity_boost * 100}
                      onChange={(e) => setCustomSettings({
                        ...customSettings,
                        similarity_boost: parseInt(e.target.value) / 100,
                      })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                    <p className="text-xs text-muted-foreground">
                      How closely to match the original voice
                    </p>
                  </div>

                  {/* Style */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">Style</Label>
                      <span className="text-sm font-medium text-slate-600">
                        {Math.round(customSettings.style * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={customSettings.style * 100}
                      onChange={(e) => setCustomSettings({
                        ...customSettings,
                        style: parseInt(e.target.value) / 100,
                      })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                    <p className="text-xs text-muted-foreground">
                      Expressive style intensity
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save as Default */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Volume2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-slate-600">Default Voice</p>
                    <p className="text-sm text-muted-foreground">
                      New agents will use this voice
                    </p>
                  </div>
                </div>
                
                {selectedVoice && (
                  <div className="flex items-center gap-3 p-3 bg-teal-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full overflow-hidden">
                      <Image
                        src={VOICES.find(v => v.id === selectedVoice)?.avatar || ''}
                        alt=""
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-medium text-slate-600">
                        {VOICES.find(v => v.id === selectedVoice)?.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {VOICE_PRESETS[selectedPreset].name} preset
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleSaveDefaults}
                  disabled={!selectedVoice || saving}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Set as Default'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
