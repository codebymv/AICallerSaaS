// Campaign Status Badge Component

interface CampaignStatusBadgeProps {
  status: string;
  className?: string;
}

export function CampaignStatusBadge({ status, className = '' }: CampaignStatusBadgeProps) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600',
    SCHEDULED: 'bg-blue-100 text-blue-700',
    ACTIVE: 'bg-green-100 text-green-700',
    PAUSED: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-teal-100 text-teal-700',
    CANCELLED: 'bg-red-100 text-red-700',
  };

  const labels: Record<string, string> = {
    DRAFT: 'Draft',
    SCHEDULED: 'Scheduled',
    ACTIVE: 'Active',
    PAUSED: 'Paused',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };

  const statusUpper = status.toUpperCase();
  const style = styles[statusUpper] || styles.DRAFT;
  const label = labels[statusUpper] || status;

  return (
    <span className={`px-2 py-1 text-xs rounded-full ${style} ${className}`}>
      {label}
    </span>
  );
}

