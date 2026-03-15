'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { useTradeSyncStore } from '@/stores/tradeSyncStore';
import type { ReplicationEvent } from '@/types/trade-sync';
import { formatDistanceToNow } from 'date-fns';

interface ReplicationFeedProps {
  events?: ReplicationEvent[];
}

const statusIcon: Record<string, React.ReactNode> = {
  FILLED: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  PENDING: <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />,
  REJECTED: <AlertCircle className="h-4 w-4 text-orange-500" />,
  FAILED: <XCircle className="h-4 w-4 text-red-500" />,
};

export default function ReplicationFeed({
  events: propEvents,
}: ReplicationFeedProps) {
  const { recentEvents } = useTradeSyncStore();
  const events = propEvents ?? recentEvents;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Replication Feed
          {events.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {events.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-4 pb-4">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-10">
              <Clock className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No replication events yet</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {events.map((event) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-b last:border-0 py-3"
                >
                  <div className="flex items-start gap-3">
                    {statusIcon[event.status] ?? statusIcon.PENDING}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {event.symbol}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            event.masterDirection === 'BUY'
                              ? 'text-green-500'
                              : 'text-red-500'
                          }`}
                        >
                          {event.masterDirection === 'BUY' ? (
                            <ArrowUpRight className="h-3 w-3 inline" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3 inline" />
                          )}
                          {event.slaveDirection ?? event.masterDirection}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {event.slaveLot} lot
                        </span>
                        <Badge
                          variant={
                            event.status === 'FILLED'
                              ? 'default'
                              : event.status === 'REJECTED'
                                ? 'secondary'
                                : event.status === 'FAILED'
                                  ? 'destructive'
                                  : 'outline'
                          }
                          className="text-[10px] h-5"
                        >
                          {event.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {event.slave?.displayName ??
                            event.slaveId.slice(0, 8)}
                        </span>
                        <span>·</span>
                        <span>{event.latencyMs}ms</span>
                        {event.errorMessage && (
                          <>
                            <span>·</span>
                            <span className="text-destructive truncate">
                              {event.errorMessage}
                            </span>
                          </>
                        )}
                        <span className="ml-auto">
                          {formatDistanceToNow(new Date(event.createdAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
