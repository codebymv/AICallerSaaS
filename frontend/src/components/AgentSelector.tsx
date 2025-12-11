'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Bot, ChevronDown } from 'lucide-react';
import { ELEVENLABS_VOICES } from '@/lib/constants';

interface Agent {
    id: string;
    name: string;
    voice?: string;
}

interface AgentSelectorProps {
    /** List of available agents */
    agents: Agent[];
    /** Currently selected agent ID (empty string or null for none/all) */
    selectedAgentId: string | null;
    /** Callback when an agent is selected */
    onSelect: (agentId: string) => void;
    /** Whether the selector is disabled */
    disabled?: boolean;
    /** 
     * Size variant:
     * - 'sm' - Compact (32x32 avatar) - for filters
     * - 'md' - Medium (40x40 avatar) - for assignments  
     * - 'lg' - Large (48x48 avatar) - for prominent selection
     */
    size?: 'sm' | 'md' | 'lg';
    /** 
     * Label for when no agent is selected:
     * - 'all' - Shows "All Agents" (for filters)
     * - 'none' - Shows "No agent" (for assignments)
     */
    emptyLabel?: 'all' | 'none';
    /** Whether to show the empty/all option in dropdown */
    showEmptyOption?: boolean;
    /** Additional CSS classes for the container */
    className?: string;
}

// Helper to get avatar for a voice
const getVoiceAvatar = (voiceId?: string): string | null => {
    if (!voiceId) return null;
    const voiceLower = voiceId.toLowerCase();
    const voice = ELEVENLABS_VOICES.find(v => v.id === voiceLower || v.name.toLowerCase() === voiceLower);
    return voice?.avatar || null;
};

export function AgentSelector({
    agents,
    selectedAgentId,
    onSelect,
    disabled = false,
    size = 'md',
    emptyLabel = 'none',
    showEmptyOption = true,
    className = '',
}: AgentSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedAgent = agents.find(a => a.id === selectedAgentId);
    const selectedAvatar = selectedAgent ? getVoiceAvatar(selectedAgent.voice) : null;

    // Avatar and icon sizes based on variant
    const sizeConfig = {
        sm: { avatar: 32, icon: 'h-4 w-4', containerClass: 'w-8 h-8', minWidth: 'min-w-[140px]' },
        md: { avatar: 40, icon: 'h-5 w-5', containerClass: 'w-10 h-10', minWidth: 'min-w-[180px]' },
        lg: { avatar: 48, icon: 'h-6 w-6', containerClass: 'w-12 h-12', minWidth: 'min-w-[200px]' },
    };

    const config = sizeConfig[size];
    const emptyText = emptyLabel === 'all' ? 'All Agents' : 'No agent';

    // Handle click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm border rounded-md bg-white disabled:opacity-50 ${config.minWidth} justify-between hover:bg-slate-50 transition-colors w-full`}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    {selectedAgent ? (
                        <>
                            <div className={`${config.containerClass} rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0`}>
                                {selectedAvatar ? (
                                    <Image
                                        src={selectedAvatar}
                                        alt={selectedAgent.name}
                                        width={config.avatar}
                                        height={config.avatar}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Bot className={`${config.icon} text-muted-foreground`} />
                                )}
                            </div>
                            <span className="truncate font-medium">{selectedAgent.name}</span>
                        </>
                    ) : (
                        <>
                            <div className={`${config.containerClass} rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0`}>
                                <Bot className={`${config.icon} text-muted-foreground`} />
                            </div>
                            <span className="text-muted-foreground">{emptyText}</span>
                        </>
                    )}
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[200px] bg-white border rounded-md shadow-lg py-1 max-h-60 overflow-auto right-0 sm:right-auto">
                    {showEmptyOption && (
                        <button
                            type="button"
                            onClick={() => {
                                onSelect('');
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-slate-50 text-left ${!selectedAgentId ? 'bg-blue-50' : ''
                                }`}
                        >
                            <div className={`${config.containerClass} rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0`}>
                                <Bot className={`${config.icon} text-muted-foreground`} />
                            </div>
                            <span className="text-muted-foreground">{emptyText}</span>
                        </button>
                    )}
                    {agents.map((agent) => {
                        const avatar = getVoiceAvatar(agent.voice);
                        return (
                            <button
                                key={agent.id}
                                type="button"
                                onClick={() => {
                                    onSelect(agent.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-slate-50 text-left ${agent.id === selectedAgentId ? 'bg-blue-50' : ''
                                    }`}
                            >
                                <div className={`${config.containerClass} rounded-full bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0`}>
                                    {avatar ? (
                                        <Image
                                            src={avatar}
                                            alt={agent.name}
                                            width={config.avatar}
                                            height={config.avatar}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <Bot className={`${config.icon} text-muted-foreground`} />
                                    )}
                                </div>
                                <span className="truncate font-medium">{agent.name}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
