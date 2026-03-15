'use client';

import { useState } from 'react';
import { X, Loader2, ImagePlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCommunity } from '@/lib/hooks/useCommunity';
import { PostType, Direction } from '@/lib/types/community';

const POST_TYPES = [
  { value: PostType.TRADE_IDEA, label: 'Trade Idea' },
  { value: PostType.ANALYSIS, label: 'Analysis' },
  { value: PostType.FORECAST, label: 'Forecast' },
  { value: PostType.JOURNAL, label: 'Journal Entry' },
  { value: PostType.DISCUSSION, label: 'Discussion' },
];

const DIRECTIONS = [
  { value: Direction.BULLISH, label: 'Bullish', emoji: '🟢' },
  { value: Direction.BEARISH, label: 'Bearish', emoji: '🔴' },
  { value: Direction.NEUTRAL, label: 'Neutral', emoji: '🟡' },
];

const TIMEFRAMES = [
  'M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN',
];

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CreatePostModal({ open, onClose }: CreatePostModalProps) {
  const { createPost } = useCommunity();

  const [type, setType] = useState<PostType>(PostType.TRADE_IDEA);
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<Direction>(Direction.BULLISH);
  const [timeframe, setTimeframe] = useState('');
  const [entry, setEntry] = useState('');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    setError('');
    if (!symbol.trim()) {
      setError('Symbol is required');
      return;
    }
    if (description.length < 10) {
      setError('Description must be at least 10 characters');
      return;
    }

    setSubmitting(true);
    try {
      await createPost({
        type,
        symbol: symbol.toUpperCase().trim(),
        direction,
        timeframe: timeframe || undefined,
        description: description.trim(),
        entry: entry ? parseFloat(entry) : undefined,
        sl: sl ? parseFloat(sl) : undefined,
        tp: tp ? parseFloat(tp) : undefined,
        image: image || undefined,
      });
      // Reset & close
      resetForm();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to create post';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setType(PostType.TRADE_IDEA);
    setSymbol('');
    setDirection(Direction.BULLISH);
    setTimeframe('');
    setEntry('');
    setSl('');
    setTp('');
    setDescription('');
    setImage(null);
    setImagePreview(null);
    setError('');
  };

  const showTradeLevels =
    type === PostType.TRADE_IDEA || type === PostType.FORECAST;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Post Type */}
          <div className="space-y-2">
            <Label>Post Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as PostType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POST_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Symbol & Direction */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Symbol</Label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="EURUSD"
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection(v as Direction)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.emoji} {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Timeframe */}
          <div className="space-y-2">
            <Label>Timeframe (optional)</Label>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger>
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map((tf) => (
                  <SelectItem key={tf} value={tf}>
                    {tf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trade Levels */}
          {showTradeLevels && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Entry</Label>
                <Input
                  type="number"
                  step="any"
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  placeholder="1.0850"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-red-500">Stop Loss</Label>
                <Input
                  type="number"
                  step="any"
                  value={sl}
                  onChange={(e) => setSl(e.target.value)}
                  placeholder="1.0800"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-green-500">Take Profit</Label>
                <Input
                  type="number"
                  step="any"
                  value={tp}
                  onChange={(e) => setTp(e.target.value)}
                  placeholder="1.0950"
                />
              </div>
            </div>
          )}

          {/* R:R Preview */}
          {entry && sl && tp && (
            <div className="text-sm text-center text-blue-500 font-medium">
              R:R Ratio 1:
              {(
                Math.abs(parseFloat(tp) - parseFloat(entry)) /
                Math.abs(parseFloat(entry) - parseFloat(sl))
              ).toFixed(2)}
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Share your analysis, reasoning, or trade setup..."
              className="min-h-30"
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/5000
            </p>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Chart Screenshot (optional)</Label>
            <div className="relative">
              {imagePreview ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-40 object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => {
                      setImage(null);
                      setImagePreview(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 h-24 rounded-lg border-2 border-dashed border-border cursor-pointer hover:border-primary/50 transition-colors">
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Upload chart image
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Publish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
