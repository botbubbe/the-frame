"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Users, UserCheck, Gift, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Influencer = {
  id: string;
  name: string;
  platform: string;
  handle: string | null;
  followers: number | null;
  niche: string | null;
  status: string;
  cost: number | null;
  postsDelivered: number | null;
  engagement: number | null;
  notes: string | null;
};

const statusColors: Record<string, string> = {
  identified: "bg-gray-100 text-gray-800",
  contacted: "bg-blue-100 text-blue-800",
  gifted: "bg-purple-100 text-purple-800",
  posting: "bg-green-100 text-green-800",
  completed: "bg-emerald-100 text-emerald-800",
};

const statusIcons: Record<string, typeof Users> = {
  identified: Users,
  contacted: Send,
  gifted: Gift,
  posting: UserCheck,
  completed: UserCheck,
};

const PLATFORMS = ["instagram", "tiktok", "youtube", "twitter"] as const;
const STATUSES = ["identified", "contacted", "gifted", "posting", "completed"] as const;

const emptyForm = { name: "", platform: "instagram", handle: "", followers: 0, niche: "", status: "identified", cost: 0, postsDelivered: 0, engagement: 0, notes: "" };

export function InfluencerTab() {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Influencer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (platformFilter !== "all") params.set("platform", platformFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await fetch(`/api/v1/marketing/influencers?${params}`);
    const json = await res.json();
    setInfluencers(json.data || []);
    setLoading(false);
  }, [platformFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setEditingItem(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (inf: Influencer) => {
    setEditingItem(inf);
    setForm({
      name: inf.name, platform: inf.platform, handle: inf.handle || "",
      followers: inf.followers || 0, niche: inf.niche || "", status: inf.status,
      cost: inf.cost || 0, postsDelivered: inf.postsDelivered || 0,
      engagement: inf.engagement || 0, notes: inf.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const url = editingItem ? `/api/v1/marketing/influencers/${editingItem.id}` : "/api/v1/marketing/influencers";
    await fetch(url, {
      method: editingItem ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setDialogOpen(false); setEditingItem(null); setForm(emptyForm); fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/v1/marketing/influencers/${id}`, { method: "DELETE" });
    setDeleteConfirm(null); fetchData();
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/v1/marketing/influencers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchData();
  };

  // Pipeline counts
  const counts = Object.fromEntries(STATUSES.map(s => [s, influencers.filter(i => i.status === s).length]));

  return (
    <div className="space-y-4">
      {/* Pipeline */}
      <div className="grid grid-cols-5 gap-3">
        {STATUSES.map(status => {
          const Icon = statusIcons[status] || Users;
          return (
            <Card key={status} className={`cursor-pointer hover:shadow-md transition-shadow ${status === statusFilter ? "ring-2 ring-primary" : ""}`} onClick={() => setStatusFilter(status === statusFilter ? "all" : status)}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${statusColors[status]}`}><Icon className="h-4 w-4" /></div>
                <div>
                  <div className="text-xl font-bold">{counts[status] || 0}</div>
                  <div className="text-xs text-muted-foreground capitalize">{status}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters + Add */}
      <div className="flex items-center gap-3">
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Platform" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {PLATFORMS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Influencer</Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Handle</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead className="text-right">Followers</TableHead>
                <TableHead>Niche</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Posts</TableHead>
                <TableHead className="text-right">Engagement</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : influencers.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No influencers found. Add one to get started.</TableCell></TableRow>
              ) : influencers.map(inf => (
                <TableRow key={inf.id}>
                  <TableCell className="font-medium">{inf.name}</TableCell>
                  <TableCell className="text-muted-foreground">{inf.handle || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{inf.platform}</Badge></TableCell>
                  <TableCell className="text-right">{inf.followers?.toLocaleString() || "—"}</TableCell>
                  <TableCell>{inf.niche || "—"}</TableCell>
                  <TableCell>
                    <Select value={inf.status} onValueChange={v => updateStatus(inf.id, v)}>
                      <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">{inf.cost ? `$${inf.cost.toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-right">{inf.postsDelivered || 0}</TableCell>
                  <TableCell className="text-right">{inf.engagement ? `${inf.engagement}%` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(inf)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(inf.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingItem ? "Edit Influencer" : "Add Influencer"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Influencer name..." /></div>
              <div><Label>Handle</Label><Input value={form.handle} onChange={e => setForm({ ...form, handle: e.target.value })} placeholder="@handle" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Platform</Label>
                <Select value={form.platform} onValueChange={v => setForm({ ...form, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Followers</Label><Input type="number" value={form.followers} onChange={e => setForm({ ...form, followers: Number(e.target.value) })} /></div>
              <div><Label>Niche</Label><Input value={form.niche} onChange={e => setForm({ ...form, niche: e.target.value })} placeholder="e.g. Fashion" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Cost ($)</Label><Input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: Number(e.target.value) })} /></div>
              <div><Label>Engagement (%)</Label><Input type="number" step="0.1" value={form.engagement} onChange={e => setForm({ ...form, engagement: Number(e.target.value) })} /></div>
            </div>
            <div><Label>Posts Delivered</Label><Input type="number" value={form.postsDelivered} onChange={e => setForm({ ...form, postsDelivered: Number(e.target.value) })} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Outreach notes, product seeding details..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.name}>{editingItem ? "Save Changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Influencer</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
