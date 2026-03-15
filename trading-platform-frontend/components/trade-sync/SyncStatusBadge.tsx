'use client';

import { Badge } from '@/components/ui/badge';
import type { SyncGroupStatus, SlaveStatus } from '@/types/trade-sync';

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  ACTIVE: { label: 'Active', variant: 'default' },
  PAUSED: { label: 'Paused', variant: 'secondary' },
  STOPPED: { label: 'Stopped', variant: 'outline' },
  KILLED: { label: 'Killed', variant: 'destructive' },
  ERROR: { label: 'Error', variant: 'destructive' },
};

interface SyncStatusBadgeProps {
  status: SyncGroupStatus | SlaveStatus;
  className?: string;
}

export default function SyncStatusBadge({
  status,
  className,
}: SyncStatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    variant: 'outline' as const,
  };

  return (
    <Badge variant={config.variant} className={className}>
      <span
        className={`mr-1.5 inline-block h-2 w-2 rounded-full ${
          status === 'ACTIVE'
            ? 'bg-green-400 animate-pulse'
            : status === 'ERROR' || status === 'KILLED'
              ? 'bg-red-400'
              : 'bg-muted-foreground'
        }`}
      />
      {config.label}
    </Badge>
  );
}
