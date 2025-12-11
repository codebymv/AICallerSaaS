'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { ELEVENLABS_VOICES } from '@/lib/constants';
import { ChevronDown, User } from 'lucide-react';

interface VoiceSelectorProps {
  value: string;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
}

export function VoiceSelector({ value, onChange, disabled = false }: VoiceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const selectedVoice = ELEVENLABS_VOICES.find((v) => v.id === value) || ELEVENLABS_VOICES[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (voiceId: string) => {
    onChange(voiceId);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center gap-3 px-3 py-2.5 border rounded-md justify-between transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          value ? 'border-teal-500 bg-teal-50' : 'bg-white hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Avatar */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${
            value ? 'bg-teal-100' : 'bg-slate-100'
          }`}>
            {selectedVoice.avatar ? (
              <Image
                src={selectedVoice.avatar}
                alt={selectedVoice.name}
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className={`w-6 h-6 ${value ? 'text-teal-600' : 'text-slate-400'}`} />
            )}
          </div>
          
          {/* Name and description */}
          <div className="flex-1 text-left min-w-0">
            <div className="font-medium text-sm text-slate-600">{selectedVoice.name}</div>
            <div className="text-xs text-muted-foreground">{selectedVoice.description}</div>
          </div>
        </div>
        
        {/* Chevron */}
        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-80 overflow-y-auto">
          {ELEVENLABS_VOICES.map((voice) => {
            const isSelected = voice.id === value;
            return (
              <button
                key={voice.id}
                type="button"
                onClick={() => handleSelect(voice.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors ${
                  isSelected ? 'bg-teal-50' : ''
                }`}
              >
                {/* Avatar */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${
                  isSelected ? 'bg-teal-100' : 'bg-slate-100'
                }`}>
                  {voice.avatar ? (
                    <Image
                      src={voice.avatar}
                      alt={voice.name}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className={`w-6 h-6 ${isSelected ? 'text-teal-600' : 'text-slate-400'}`} />
                  )}
                </div>
                
                {/* Name and description */}
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-sm text-slate-600">{voice.name}</div>
                  <div className="text-xs text-muted-foreground">{voice.description}</div>
                </div>
                
                {/* Selected indicator */}
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-teal-600 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

