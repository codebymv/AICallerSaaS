'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HelpCircle, ExternalLink } from 'lucide-react';

interface HelpLinkProps {
  /** Short tooltip text shown on hover */
  tooltip: string;
  /** Path to KB article (without /dashboard/knowledge-base?path=) */
  articlePath: string;
  /** Optional: Override the icon size */
  size?: 'sm' | 'md' | 'lg';
  /** Optional: Custom className */
  className?: string;
}

const sizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

/**
 * HelpLink Component
 * 
 * A contextual help icon that shows a tooltip and links to a Knowledge Base article.
 * Use throughout the app to provide inline documentation links.
 * 
 * @example
 * <HelpLink 
 *   tooltip="Learn how to configure Twilio" 
 *   articlePath="twilio-setup" 
 * />
 * 
 * @example
 * <HelpLink 
 *   tooltip="Voice configuration options" 
 *   articlePath="agents/voice-settings" 
 *   size="sm"
 * />
 */
export function HelpLink({ 
  tooltip, 
  articlePath, 
  size = 'md',
  className = '' 
}: HelpLinkProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const kbUrl = `/dashboard/knowledge-base?path=${encodeURIComponent(articlePath)}`;

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <Link
        href={kbUrl}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="text-slate-400 hover:text-teal-600 transition-colors cursor-help"
        title={tooltip}
      >
        <HelpCircle className={sizeClasses[size]} />
      </Link>
      
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-slate-900 text-white text-xs rounded-lg py-2 px-3 max-w-xs whitespace-normal shadow-lg">
            <p className="mb-1">{tooltip}</p>
            <p className="text-teal-300 flex items-center gap-1 text-[10px]">
              Click to learn more <ExternalLink className="h-2.5 w-2.5" />
            </p>
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </span>
  );
}

/**
 * HelpText Component
 * 
 * Inline help text with a link to KB article.
 * Use for longer explanatory text with a documentation link.
 * 
 * @example
 * <HelpText articlePath="campaigns/overview">
 *   Campaigns allow automated outbound calling
 * </HelpText>
 */
interface HelpTextProps {
  children: React.ReactNode;
  articlePath: string;
  className?: string;
}

export function HelpText({ children, articlePath, className = '' }: HelpTextProps) {
  const kbUrl = `/dashboard/knowledge-base?path=${encodeURIComponent(articlePath)}`;

  return (
    <span className={`text-slate-500 text-sm ${className}`}>
      {children}{' '}
      <Link
        href={kbUrl}
        className="text-teal-600 hover:text-teal-700 hover:underline inline-flex items-center gap-0.5"
      >
        Learn more
        <ExternalLink className="h-3 w-3" />
      </Link>
    </span>
  );
}

/**
 * KBLink Component
 * 
 * Simple styled link to a KB article.
 * 
 * @example
 * <KBLink path="twilio-setup">Twilio Setup Guide</KBLink>
 */
interface KBLinkProps {
  children: React.ReactNode;
  path: string;
  className?: string;
  external?: boolean;
}

export function KBLink({ children, path, className = '', external = false }: KBLinkProps) {
  const kbUrl = `/dashboard/knowledge-base?path=${encodeURIComponent(path)}`;

  return (
    <Link
      href={kbUrl}
      className={`text-teal-600 hover:text-teal-700 hover:underline inline-flex items-center gap-1 ${className}`}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {children}
      {external && <ExternalLink className="h-3 w-3" />}
    </Link>
  );
}
