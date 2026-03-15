'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ShieldAlert, ShieldCheck, Loader2 } from 'lucide-react';
import {
  useTriggerKillSwitch,
  useResetKillSwitch,
} from '@/hooks/useTradeSync';

interface KillSwitchButtonProps {
  slaveId: string;
  isActive: boolean;
  slaveName: string;
}

export default function KillSwitchButton({
  slaveId,
  isActive,
  slaveName,
}: KillSwitchButtonProps) {
  const triggerKill = useTriggerKillSwitch();
  const resetKill = useResetKillSwitch();
  const [open, setOpen] = useState(false);

  const isPending = triggerKill.isPending || resetKill.isPending;

  const handleConfirm = async () => {
    if (isActive) {
      await resetKill.mutateAsync(slaveId);
    } else {
      await triggerKill.mutateAsync(slaveId);
    }
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant={isActive ? 'outline' : 'destructive'}
          size="sm"
          className="gap-1.5"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isActive ? (
            <ShieldCheck className="h-3 w-3" />
          ) : (
            <ShieldAlert className="h-3 w-3" />
          )}
          {isActive ? 'Reset Kill' : 'Kill Switch'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isActive ? 'Reset Kill Switch' : 'Activate Kill Switch'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isActive
              ? `This will reset the kill switch for "${slaveName}" and set it to paused. You can resume trading manually after.`
              : `This will immediately stop all trade replication for "${slaveName}". Any open positions will NOT be closed automatically.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={isActive ? '' : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
          >
            {isActive ? 'Reset' : 'Activate Kill Switch'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
