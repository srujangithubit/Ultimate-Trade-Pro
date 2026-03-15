'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Plus,
    BookMarked,
    Target,
    BarChart3,
    Activity,
    ChevronRight,
    Tag,
    Edit,
    Trash2,
    Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { playbooksApi, Playbook } from '@/lib/api/playbooks';

export default function PlaybooksPage() {
    const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create Dialog State
    const [createOpen, setCreateOpen] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createDescription, setCreateDescription] = useState('');
    const [createRules, setCreateRules] = useState('');
    const [createTags, setCreateTags] = useState('');

    // Edit Dialog State
    const [editOpen, setEditOpen] = useState(false);
    const [editLoading, setEditLoading] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editRules, setEditRules] = useState('');
    const [editTags, setEditTags] = useState('');

    // Delete Dialog State
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteName, setDeleteName] = useState('');

    const fetchPlaybooks = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await playbooksApi.getAll();
            setPlaybooks(data);
        } catch (err: any) {
            console.error('Failed to fetch playbooks:', err);
            setError('Failed to load playbooks. Make sure the backend is running.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPlaybooks();
    }, [fetchPlaybooks]);

    // ── Create ──
    const resetCreateForm = () => {
        setCreateName('');
        setCreateDescription('');
        setCreateRules('');
        setCreateTags('');
    };

    const handleCreate = async () => {
        if (!createName.trim()) return;

        setCreateLoading(true);
        try {
            const rules = createRules
                .split('\n')
                .map((r) => r.trim())
                .filter(Boolean);
            const tags = createTags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean);

            await playbooksApi.create({
                name: createName.trim(),
                description: createDescription.trim() || undefined,
                rules,
                tags,
            });

            setCreateOpen(false);
            resetCreateForm();
            fetchPlaybooks();
        } catch (err) {
            console.error('Failed to create playbook:', err);
        } finally {
            setCreateLoading(false);
        }
    };

    // ── Edit ──
    const openEditDialog = (playbook: Playbook) => {
        setEditId(playbook.id);
        setEditName(playbook.name);
        setEditDescription(playbook.description || '');
        setEditRules((playbook.rules || []).join('\n'));
        setEditTags((playbook.tags || []).join(', '));
        setEditOpen(true);
    };

    const handleEdit = async () => {
        if (!editId || !editName.trim()) return;

        setEditLoading(true);
        try {
            const rules = editRules
                .split('\n')
                .map((r) => r.trim())
                .filter(Boolean);
            const tags = editTags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean);

            await playbooksApi.update(editId, {
                name: editName.trim(),
                description: editDescription.trim() || undefined,
                rules,
                tags,
            });

            setEditOpen(false);
            fetchPlaybooks();
        } catch (err) {
            console.error('Failed to update playbook:', err);
        } finally {
            setEditLoading(false);
        }
    };

    // ── Delete ──
    const openDeleteDialog = (playbook: Playbook) => {
        setDeleteId(playbook.id);
        setDeleteName(playbook.name);
        setDeleteOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteId) return;

        setDeleteLoading(true);
        try {
            await playbooksApi.delete(deleteId);
            setDeleteOpen(false);
            fetchPlaybooks();
        } catch (err) {
            console.error('Failed to delete playbook:', err);
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Playbooks</h1>
                    <p className="text-muted-foreground">
                        Define and track your trading strategies with detailed rules.
                    </p>
                </div>

                {/* ── Create Dialog ── */}
                <Dialog open={createOpen} onOpenChange={(v) => {
                    setCreateOpen(v);
                    if (!v) resetCreateForm();
                }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            New Playbook
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create Playbook</DialogTitle>
                            <DialogDescription>
                                Define a new trading strategy with rules and tags.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                                <Label>Strategy Name *</Label>
                                <Input
                                    placeholder="e.g., Morning Breakout"
                                    value={createName}
                                    onChange={(e) => setCreateName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea
                                    placeholder="Describe your strategy, when to use it, and market conditions..."
                                    rows={3}
                                    value={createDescription}
                                    onChange={(e) => setCreateDescription(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Rules (one per line)</Label>
                                <Textarea
                                    placeholder={"Wait for first 15-min candle to close\nEnter on break above range\nStop loss at opposite end"}
                                    rows={5}
                                    value={createRules}
                                    onChange={(e) => setCreateRules(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tags</Label>
                                <Input
                                    placeholder="momentum, breakout, intraday (comma separated)"
                                    value={createTags}
                                    onChange={(e) => setCreateTags(e.target.value)}
                                />
                            </div>
                            <Button
                                className="w-full"
                                onClick={handleCreate}
                                disabled={!createName.trim() || createLoading}
                            >
                                {createLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Creating...
                                    </>
                                ) : (
                                    'Create Playbook'
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* ── Loading / Error / Empty ── */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {error && (
                <div className="text-center py-12">
                    <p className="text-destructive">{error}</p>
                    <Button variant="outline" className="mt-4" onClick={fetchPlaybooks}>
                        Retry
                    </Button>
                </div>
            )}

            {!loading && !error && playbooks.length === 0 && (
                <div className="text-center py-12">
                    <BookMarked className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                    <h3 className="text-lg font-semibold">No playbooks yet</h3>
                    <p className="text-muted-foreground mt-1">
                        Create your first playbook to start tracking your strategies.
                    </p>
                </div>
            )}

            {/* ── Playbook Cards ── */}
            {!loading && !error && playbooks.length > 0 && (
                <motion.div
                    className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                    initial="hidden"
                    animate="show"
                    variants={{
                        hidden: { opacity: 0 },
                        show: {
                            opacity: 1,
                            transition: {
                                staggerChildren: 0.1
                            }
                        }
                    }}
                >
                    <AnimatePresence>
                        {playbooks.map((playbook) => (
                            <motion.div
                                key={playbook.id}
                                layout
                                variants={{
                                    hidden: { opacity: 0, y: 20 },
                                    show: { opacity: 1, y: 0 }
                                }}
                                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                                exit={{ opacity: 0 }}
                            >
                                <Card className="card-hover group h-full">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                                                    <BookMarked className="h-4 w-4 text-primary" />
                                                </div>
                                                <CardTitle className="text-base font-semibold">{playbook.name}</CardTitle>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => openEditDialog(playbook)}
                                                >
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-destructive"
                                                    onClick={() => openDeleteDialog(playbook)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {playbook.description && (
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {playbook.description}
                                            </p>
                                        )}

                                        {/* Rules */}
                                        {playbook.rules && playbook.rules.length > 0 && (
                                            <div className="space-y-1.5">
                                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rules</p>
                                                <ul className="space-y-1 max-h-30 overflow-y-auto pr-1 custom-scrollbar">
                                                    {playbook.rules.map((rule, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-xs">
                                                            <ChevronRight className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                                                            <span className="text-muted-foreground">{rule}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Stats */}
                                        <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                                            <div className="flex items-center gap-1.5">
                                                <Target className="h-3.5 w-3.5 text-green-500" />
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Win Rate</p>
                                                    <p className="text-sm font-semibold">{playbook.winRate}%</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Avg R:R</p>
                                                    <p className="text-sm font-semibold">{playbook.avgRR}:1</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Activity className="h-3.5 w-3.5 text-purple-500" />
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Trades</p>
                                                    <p className="text-sm font-semibold">{playbook.totalTrades}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tags */}
                                        {playbook.tags && playbook.tags.length > 0 && (
                                            <div className="flex gap-1 flex-wrap">
                                                {playbook.tags.map((tag) => (
                                                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5">
                                                        <Tag className="h-2.5 w-2.5 mr-0.5" />{tag}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* ── Edit Dialog ── */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Playbook</DialogTitle>
                        <DialogDescription>
                            Modify your trading strategy details.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Strategy Name *</Label>
                            <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="e.g., Morning Breakout"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                placeholder="Describe your strategy..."
                                rows={3}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Rules (one per line)</Label>
                            <Textarea
                                value={editRules}
                                onChange={(e) => setEditRules(e.target.value)}
                                placeholder={"Wait for first 15-min candle to close\nEnter on break above range"}
                                rows={5}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Tags</Label>
                            <Input
                                value={editTags}
                                onChange={(e) => setEditTags(e.target.value)}
                                placeholder="momentum, breakout, intraday (comma separated)"
                            />
                        </div>
                        <Button
                            className="w-full"
                            onClick={handleEdit}
                            disabled={!editName.trim() || editLoading}
                        >
                            {editLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirmation ── */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Playbook</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>&quot;{deleteName}&quot;</strong>?
                            This action cannot be undone. All linked trade associations will be removed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleteLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
