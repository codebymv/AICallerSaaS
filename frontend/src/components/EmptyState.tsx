'use client';

import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { LucideIcon, Plus } from 'lucide-react';

interface EmptyStateProps {
    /** The icon to display */
    icon: LucideIcon;
    /** Main title text */
    title: string;
    /** Description text */
    description?: string;
    /** 
     * Size variant:
     * - 'page' - Full page empty state (larger icon, more padding)
     * - 'card' - Smaller empty state for cards/sections
     */
    variant?: 'page' | 'card';
    /** Action button configuration */
    action?: {
        label: string;
        onClick: () => void;
        icon?: LucideIcon;
    };
    /** Custom action element (alternative to action prop) */
    children?: ReactNode;
    /** Additional classes for the container */
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    variant = 'page',
    action,
    children,
    className = '',
}: EmptyStateProps) {
    const isPage = variant === 'page';

    return (
        <div
            className={`flex flex-col items-center justify-center text-center ${isPage ? 'py-16' : 'py-8 border rounded-lg bg-slate-50'
                } ${className}`}
        >
            <Icon
                className={`text-muted-foreground ${isPage ? 'h-16 w-16 mb-4' : 'h-10 w-10 text-slate-400 mb-3'
                    }`}
            />
            <h3
                className={`${isPage
                        ? 'text-lg font-semibold text-slate-600 mb-2'
                        : 'font-medium text-slate-600 mb-1'
                    }`}
            >
                {title}
            </h3>
            {description && (
                <p
                    className={`text-muted-foreground ${isPage ? 'max-w-md mb-6' : 'text-sm mb-4'
                        }`}
                >
                    {description}
                </p>
            )}
            {action && (
                <Button
                    onClick={action.onClick}
                    className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700"
                >
                    {action.icon ? (
                        <action.icon className="h-4 w-4 mr-2" />
                    ) : (
                        <Plus className="h-4 w-4 mr-2" />
                    )}
                    {action.label}
                </Button>
            )}
            {children}
        </div>
    );
}
