'use client';

import { useState, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bug,
  Camera,
  Upload,
  X,
  ArrowLeft,
  Send,
  Plus,
  Trash2,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Screenshot {
  id: string;
  dataUrl: string;
  filename: string;
}

function ReportBugContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState<string[]>(['']);
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [severity, setSeverity] = useState<string>('medium');
  const [category, setCategory] = useState<string>('functionality');
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add step
  const addStep = () => {
    setStepsToReproduce([...stepsToReproduce, '']);
  };

  // Update step
  const updateStep = (index: number, value: string) => {
    const newSteps = [...stepsToReproduce];
    newSteps[index] = value;
    setStepsToReproduce(newSteps);
  };

  // Remove step
  const removeStep = (index: number) => {
    if (stepsToReproduce.length > 1) {
      setStepsToReproduce(stepsToReproduce.filter((_, i) => i !== index));
    }
  };

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setScreenshots(prev => [...prev, {
            id: `screenshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            dataUrl,
            filename: file.name,
          }]);
        };
        reader.readAsDataURL(file);
      }
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Capture screenshot from clipboard
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            setScreenshots(prev => [...prev, {
              id: `screenshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              dataUrl,
              filename: `pasted-${Date.now()}.png`,
            }]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }, []);

  // Remove screenshot
  const removeScreenshot = (id: string) => {
    setScreenshots(screenshots.filter(s => s.id !== id));
  };

  // Add tag
  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  // Remove tag
  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  // Submit bug report
  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      alert('Please provide a title and description');
      return;
    }

    setSubmitting(true);

    try {
      // Get browser/environment info
      const environment = {
        browser: navigator.userAgent,
        os: navigator.platform,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        url: window.location.href,
      };

      const res = await fetch('/api/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title,
          description,
          stepsToReproduce: stepsToReproduce.filter(s => s.trim()),
          expectedBehavior,
          actualBehavior,
          severity,
          category,
          reportedBy: 'uat_tester', // TODO: Get from auth
          reportedByName: 'UAT Tester', // TODO: Get from auth
          screenshots: [], // We'll upload these separately
          environment,
          tags,
        }),
      });

      if (!res.ok) throw new Error('Failed to create bug');

      const bug = await res.json();

      // Upload screenshots
      for (const screenshot of screenshots) {
        await fetch(`/api/bugs/${bug.id}/screenshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            screenshotData: screenshot.dataUrl,
          }),
        });
      }

      router.push(`/uat/bugs/${bug.id}?projectId=${projectId}`);
    } catch (error) {
      console.error('Failed to submit bug:', error);
      alert('Failed to submit bug report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl" onPaste={handlePaste}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bug className="h-6 w-6 text-red-500" />
            Report a Bug
          </h1>
          <p className="text-muted-foreground">
            Help us improve by reporting issues you find
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Bug Details</CardTitle>
            <CardDescription>Describe the issue you encountered</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Brief description of the bug"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Provide a detailed description of the bug..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Critical
                      </span>
                    </SelectItem>
                    <SelectItem value="high">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        High
                      </span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                        Medium
                      </span>
                    </SelectItem>
                    <SelectItem value="low">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Low
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ui">UI/Visual</SelectItem>
                    <SelectItem value="functionality">Functionality</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="accessibility">Accessibility</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Steps to Reproduce */}
        <Card>
          <CardHeader>
            <CardTitle>Steps to Reproduce</CardTitle>
            <CardDescription>List the steps to reproduce this bug</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stepsToReproduce.map((step, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-muted-foreground w-6">{index + 1}.</span>
                <Input
                  placeholder={`Step ${index + 1}`}
                  value={step}
                  onChange={(e) => updateStep(index, e.target.value)}
                />
                {stepsToReproduce.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeStep(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addStep}>
              <Plus className="h-4 w-4 mr-2" />
              Add Step
            </Button>
          </CardContent>
        </Card>

        {/* Expected vs Actual */}
        <Card>
          <CardHeader>
            <CardTitle>Behavior</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="expected">Expected Behavior</Label>
              <Textarea
                id="expected"
                placeholder="What should happen?"
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="actual">Actual Behavior</Label>
              <Textarea
                id="actual"
                placeholder="What actually happened?"
                value={actualBehavior}
                onChange={(e) => setActualBehavior(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Screenshots */}
        <Card>
          <CardHeader>
            <CardTitle>Screenshots</CardTitle>
            <CardDescription>
              Attach screenshots to help explain the bug. You can paste images directly (Ctrl+V).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Upload area */}
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, GIF up to 10MB
                </p>
              </div>

              {/* Screenshot previews */}
              {screenshots.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {screenshots.map(screenshot => (
                    <div key={screenshot.id} className="relative group">
                      <img
                        src={screenshot.dataUrl}
                        alt={screenshot.filename}
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => removeScreenshot(screenshot.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {screenshot.filename}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Camera className="h-4 w-4" />
                <span>Tip: Press Ctrl+V to paste screenshots from clipboard</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
            <CardDescription>Add tags to help categorize this bug</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button onClick={() => removeTag(tag)}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <Button variant="outline" onClick={addTag}>
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Bug Report
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ReportBugPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>}>
      <ReportBugContent />
    </Suspense>
  );
}
