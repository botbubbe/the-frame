"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Send, Calendar, Users, TrendingUp, MessageCircle, Heart, Share2 } from "lucide-react";

type SocialAccount = {
  id: string;
  platform: string;
  handle: string | null;
  followers: number;
  posts: number;
  engagementRate: number;
  growth: number;
};

type SocialPost = {
  id: string;
  content: string;
  platform: string;
  status: string;
  scheduledDate: string | null;
  likes: number;
  comments: number;
  shares: number;
  createdAt: string;
};

const platformIcons: Record<string, string> = { instagram: "📸", tiktok: "🎵", pinterest: "📌", facebook: "👍", twitter: "🐦" };
const platformColors: Record<string, string> = {
  instagram: "from-purple-500 to-pink-500",
  tiktok: "from-gray-900 to-gray-700",
  pinterest: "from-red-500 to-red-600",
};

export function SocialMediaTab() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState({ content: "", platform: "instagram", scheduledDate: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/v1/marketing/social").then(r => r.json()).then(d => {
      setAccounts(d.accounts || []);
      setPosts(d.posts || []);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const createPost = async () => {
    if (!form.content.trim()) return;
    setSaving(true);
    await fetch("/api/v1/marketing/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ content: "", platform: "instagram", scheduledDate: "" });
    setShowComposer(false);
    setSaving(false);
    load();
  };

  const deletePost = async (id: string) => {
    await fetch("/api/v1/marketing/social", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  };

  if (loading) return <div className="animate-pulse h-96 bg-muted rounded-lg" />;

  const totalFollowers = accounts.reduce((s, a) => s + (a.followers || 0), 0);
  const avgEngagement = accounts.length > 0 ? (accounts.reduce((s, a) => s + (a.engagementRate || 0), 0) / accounts.length).toFixed(1) : "0";
  const scheduledPosts = posts.filter(p => p.status === "scheduled");
  const publishedPosts = posts.filter(p => p.status === "published");

  return (
    <div className="space-y-6">
      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Users className="h-4 w-4" />Total Followers</div>
            <div className="text-3xl font-bold mt-1">{totalFollowers.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><TrendingUp className="h-4 w-4" />Avg Engagement</div>
            <div className="text-3xl font-bold mt-1">{avgEngagement}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Calendar className="h-4 w-4" />Scheduled</div>
            <div className="text-3xl font-bold mt-1">{scheduledPosts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Send className="h-4 w-4" />Published</div>
            <div className="text-3xl font-bold mt-1">{publishedPosts.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {accounts.map((a) => (
          <Card key={a.id} className="overflow-hidden">
            <div className={`h-2 bg-gradient-to-r ${platformColors[a.platform] || "from-gray-400 to-gray-500"}`} />
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="text-2xl">{platformIcons[a.platform] || "📱"}</span>
                {a.platform.charAt(0).toUpperCase() + a.platform.slice(1)}
                {a.handle && <span className="text-sm font-normal text-muted-foreground">{a.handle}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold">{(a.followers || 0).toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Followers</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{a.posts}</div>
                  <div className="text-xs text-muted-foreground">Posts</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{a.engagementRate}%</div>
                  <div className="text-xs text-muted-foreground">Engagement</div>
                </div>
                <div>
                  <Badge variant="outline" className="bg-green-50 text-green-700">+{a.growth}%</Badge>
                  <div className="text-xs text-muted-foreground mt-1">Growth</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Post Composer */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Post Composer</CardTitle>
          <button onClick={() => setShowComposer(!showComposer)} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />{showComposer ? "Cancel" : "New Post"}
          </button>
        </CardHeader>
        {showComposer && (
          <CardContent className="border-t bg-muted/30">
            <div className="space-y-3 pt-4">
              <textarea placeholder="What do you want to post?" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-md border text-sm bg-background resize-none" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="px-3 py-2 rounded-md border text-sm bg-background">
                  <option value="instagram">📸 Instagram</option>
                  <option value="tiktok">🎵 TikTok</option>
                  <option value="pinterest">📌 Pinterest</option>
                  <option value="facebook">👍 Facebook</option>
                  <option value="twitter">🐦 Twitter</option>
                </select>
                <input type="datetime-local" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className="px-3 py-2 rounded-md border text-sm bg-background" />
                <button onClick={createPost} disabled={saving || !form.content.trim()} className="inline-flex items-center justify-center gap-1 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  <Send className="h-4 w-4" />{saving ? "Saving..." : form.scheduledDate ? "Schedule" : "Save Draft"}
                </button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Scheduled Posts Queue */}
      {posts.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Posts Queue</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Engagement</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map(p => (
                  <TableRow key={p.id}>
                    <TableCell><span className="text-lg">{platformIcons[p.platform] || "📱"}</span></TableCell>
                    <TableCell className="max-w-[300px] truncate text-sm">{p.content}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "published" ? "default" : p.status === "scheduled" ? "secondary" : "outline"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.scheduledDate ? new Date(p.scheduledDate).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" />{p.likes}</span>
                        <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" />{p.comments}</span>
                        <span className="flex items-center gap-0.5"><Share2 className="h-3 w-3" />{p.shares}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => deletePost(p.id)} className="p-1 rounded hover:bg-red-100 text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
