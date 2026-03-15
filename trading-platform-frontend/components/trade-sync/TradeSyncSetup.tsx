'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTradeSyncStore } from '@/stores/tradeSyncStore';
import { useRegisterMaster } from '@/hooks/useTradeSync';
import { fadeInUp } from '@/lib/utils/motion';

export default function TradeSyncSetup() {
  const { setView, setActiveGroupId } = useTradeSyncStore();
  const registerMaster = useRegisterMaster();

  const [form, setForm] = useState({
    groupName: '',
    displayName: '',
    accountNumber: '',
    brokerName: '',
    serverName: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const group = await registerMaster.mutateAsync({
        groupName: form.groupName,
        displayName: form.displayName,
        accountNumber: form.accountNumber,
        brokerName: form.brokerName,
        serverName: form.serverName,
        description: form.description || undefined,
      });

      setActiveGroupId(group.id);
      setView('dashboard');
    } catch {
      // mutation error handled by TanStack
    }
  };

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const isValid =
    form.groupName.length >= 3 &&
    form.displayName.length >= 2 &&
    form.accountNumber.length > 0 &&
    form.brokerName.length > 0 &&
    form.serverName.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button
        variant="ghost"
        onClick={() => setView('overview')}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Overview
      </Button>

      <motion.div {...fadeInUp}>
        <Card>
          <CardHeader>
            <CardTitle>Create Sync Group</CardTitle>
            <CardDescription>
              Register your master account to start replicating trades. You can
              add slave accounts after setup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Group Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Group Info
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="groupName">Group Name *</Label>
                    <Input
                      id="groupName"
                      placeholder="My Trading Group"
                      value={form.groupName}
                      onChange={(e) => update('groupName', e.target.value)}
                      minLength={3}
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Optional description..."
                      value={form.description}
                      onChange={(e) => update('description', e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Master Account */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Master Account
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name *</Label>
                    <Input
                      id="displayName"
                      placeholder="Main Trading Account"
                      value={form.displayName}
                      onChange={(e) => update('displayName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountNumber">Account Number *</Label>
                    <Input
                      id="accountNumber"
                      placeholder="12345678"
                      value={form.accountNumber}
                      onChange={(e) => update('accountNumber', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brokerName">Broker *</Label>
                    <Input
                      id="brokerName"
                      placeholder="ICMarkets"
                      value={form.brokerName}
                      onChange={(e) => update('brokerName', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serverName">Server *</Label>
                    <Input
                      id="serverName"
                      placeholder="ICMarketsSC-Demo"
                      value={form.serverName}
                      onChange={(e) => update('serverName', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!isValid || registerMaster.isPending}
              >
                {registerMaster.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Sync Group'
                )}
              </Button>

              {registerMaster.isError && (
                <p className="text-sm text-destructive text-center">
                  {(registerMaster.error as Error & { response?: { data?: { message?: string } } })?.response?.data?.message ??
                    'Failed to create sync group'}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
