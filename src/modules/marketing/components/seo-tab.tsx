"use client";

import { useEffect, useState, useCallback } from "react";
import { ArrowUp, ArrowDown, Minus, Globe, Target, Trophy, TrendingUp, Plus, Trash2, Pencil, X, Check, Search, Link2, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Keyword = {
  id: string;
  keyword: string;
  currentRank: number | null;
  previousRank: number | null;
  url: string | null;
  searchVolume: number | null;
  difficulty: number | null;
};

type SortKey = "keyword" | "currentRank" | "searchVolume" | "difficulty";
type SortDir = "asc" | "desc";

type SeoData = {
  data: Keyword[];
  summary: { improving: number; declining: number; avgRank: number; totalKeywords: number; inTop10: number; inTop3: number };
  contentPerformance: { pageViews: number; organicTraffic: number; bounceRate: number; avgTimeOnPage: string };
  backlinks: { total: number; newThisMonth: number; dofollow: number };
};

const emptyForm = { keyword: "", currentRank: "", searchVolume: "", difficulty: "", url: "" };

export function SeoTab() {
  const [seo, setSeo] = useState<SeoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [sortKey, setSortKey] = useState<SortKey>("searchVolume");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/v1/marketing/seo").then(r => r.json()).then(d => { setSeo(d); setLoading(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const addKeyword = async () => {
    if (!form.keyword.trim()) return;
    setSaving(true);
    await fetch("/api/v1/marketing/seo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
    load();
  };

  const deleteKeyword = async (id: string) => {
    await fetch("/api/v1/marketing/seo", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  };

  const startEdit = (kw: Keyword) => {
    setEditId(kw.id);
    setEditForm({ keyword: kw.keyword, currentRank: String(kw.currentRank ?? ""), searchVolume: String(kw.searchVolume ?? ""), difficulty: String(kw.difficulty ?? ""), url: kw.url ?? "" });
  };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    await fetch("/api/v1/marketing/seo", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editId, ...editForm }) });
    setEditId(null);
    setSaving(false);
    load();
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  if (loading) return <div className="animate-pulse h-96 bg-muted rounded-lg" />;
  if (!seo) return null;

  const sorted = [...seo.data].sort((a, b) => {
    const av = a[sortKey] ?? 999999;
    const bv = b[sortKey] ?? 999999;
    if (av < bv) return sortDir === "asc" ? -1 : 1;
    if (av > bv) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  const getRankChange = (curr: number | null, prev: number | null) => {
    if (!curr || !prev) return { icon: <Minus className="h-4 w-4" />, color: "text-gray-400", change: 0 };
    const diff = prev - curr;
    if (diff > 0) return { icon: <ArrowUp className="h-4 w-4" />, color: "text-green-600", change: diff };
    if (diff < 0) return { icon: <ArrowDown className="h-4 w-4" />, color: "text-red-600", change: diff };
    return { icon: <Minus className="h-4 w-4" />, color: "text-gray-400", change: 0 };
  };

  const getDifficultyBadge = (d: number | null) => {
    if (d == null) return <span className="text-muted-foreground">—</span>;
    if (d <= 30) return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Easy ({d})</Badge>;
    if (d <= 60) return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Medium ({d})</Badge>;
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Hard ({d})</Badge>;
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort(field)}>
      <span className="flex items-center gap-1">
        {label}
        {sortKey === field && <span className="text-xs">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </span>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Search className="h-4 w-4" />Keywords Tracked</div>
            <div className="text-3xl font-bold mt-1">{seo.summary.totalKeywords}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Globe className="h-4 w-4" />Avg Position</div>
            <div className="text-3xl font-bold mt-1">#{seo.summary.avgRank || "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Target className="h-4 w-4 text-blue-600" />In Top 10</div>
            <div className="text-3xl font-bold mt-1 text-blue-600">{seo.summary.inTop10}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Trophy className="h-4 w-4 text-yellow-600" />In Top 3</div>
            <div className="text-3xl font-bold mt-1 text-yellow-600">{seo.summary.inTop3}</div>
          </CardContent>
        </Card>
      </div>

      {/* Content & Backlinks Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{seo.contentPerformance.pageViews.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Page Views</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{seo.contentPerformance.organicTraffic.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Organic Traffic</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{seo.summary.improving}</div>
            <div className="text-xs text-muted-foreground">Improving</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{seo.summary.declining}</div>
            <div className="text-xs text-muted-foreground">Declining</div>
          </CardContent>
        </Card>
      </div>

      {/* Keyword Rankings Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Keyword Rankings</CardTitle>
          <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Cancel" : "Add Keyword"}
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {showForm && (
            <div className="p-4 border-b bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <input placeholder="Keyword *" value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))} className="px-3 py-2 rounded-md border text-sm bg-background" />
                <input placeholder="Current Rank" type="number" value={form.currentRank} onChange={e => setForm(f => ({ ...f, currentRank: e.target.value }))} className="px-3 py-2 rounded-md border text-sm bg-background" />
                <input placeholder="Search Volume" type="number" value={form.searchVolume} onChange={e => setForm(f => ({ ...f, searchVolume: e.target.value }))} className="px-3 py-2 rounded-md border text-sm bg-background" />
                <input placeholder="Difficulty (0-100)" type="number" min="0" max="100" value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))} className="px-3 py-2 rounded-md border text-sm bg-background" />
                <input placeholder="Target URL" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} className="px-3 py-2 rounded-md border text-sm bg-background" />
              </div>
              <div className="mt-3 flex justify-end">
                <button onClick={addKeyword} disabled={saving || !form.keyword.trim()} className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {saving ? "Saving..." : "Add Keyword"}
                </button>
              </div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="Keyword" field="keyword" />
                <SortHeader label="Rank" field="currentRank" />
                <TableHead className="text-right">Change</TableHead>
                <SortHeader label="Volume" field="searchVolume" />
                <SortHeader label="Difficulty" field="difficulty" />
                <TableHead>Target URL</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No keywords tracked yet. Add your first keyword above.</TableCell></TableRow>
              )}
              {sorted.map(kw => {
                const change = getRankChange(kw.currentRank, kw.previousRank);
                const isEditing = editId === kw.id;
                return (
                  <TableRow key={kw.id}>
                    <TableCell className="font-medium">
                      {isEditing ? <input value={editForm.keyword} onChange={e => setEditForm(f => ({ ...f, keyword: e.target.value }))} className="px-2 py-1 rounded border text-sm w-full bg-background" /> : kw.keyword}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? <input type="number" value={editForm.currentRank} onChange={e => setEditForm(f => ({ ...f, currentRank: e.target.value }))} className="px-2 py-1 rounded border text-sm w-20 bg-background" /> : (kw.currentRank ? `#${kw.currentRank}` : "—")}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isEditing && <span className={`flex items-center justify-end gap-1 ${change.color}`}>{change.icon}{change.change !== 0 && Math.abs(change.change)}</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? <input type="number" value={editForm.searchVolume} onChange={e => setEditForm(f => ({ ...f, searchVolume: e.target.value }))} className="px-2 py-1 rounded border text-sm w-24 bg-background" /> : (kw.searchVolume?.toLocaleString() ?? "—")}
                    </TableCell>
                    <TableCell>
                      {isEditing ? <input type="number" min="0" max="100" value={editForm.difficulty} onChange={e => setEditForm(f => ({ ...f, difficulty: e.target.value }))} className="px-2 py-1 rounded border text-sm w-20 bg-background" /> : getDifficultyBadge(kw.difficulty)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                      {isEditing ? <input value={editForm.url} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))} className="px-2 py-1 rounded border text-sm w-full bg-background" /> : (kw.url || "—")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <button onClick={saveEdit} disabled={saving} className="p-1 rounded hover:bg-green-100 text-green-600"><Check className="h-4 w-4" /></button>
                            <button onClick={() => setEditId(null)} className="p-1 rounded hover:bg-gray-100 text-gray-500"><X className="h-4 w-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(kw)} className="p-1 rounded hover:bg-blue-100 text-blue-600"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => deleteKeyword(kw.id)} className="p-1 rounded hover:bg-red-100 text-red-600"><Trash2 className="h-4 w-4" /></button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
