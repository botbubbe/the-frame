"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const campaigns = [
  { name: "Welcome Series", status: "sent", recipients: 1200, opens: 480, clicks: 96, revenue: 2400 },
  { name: "New Collection Launch", status: "draft", recipients: 0, opens: 0, clicks: 0, revenue: 0 },
  { name: "Wholesale Reorder Reminder", status: "sent", recipients: 340, opens: 170, clicks: 51, revenue: 8500 },
];

const segments = [
  { name: "All Wholesale Customers", members: 450 },
  { name: "DTC Customers", members: 1200 },
  { name: "High-Value Accounts", members: 85 },
  { name: "Lapsed (90+ days)", members: 120 },
];

export function KlaviyoTab() {
  return (
    <div className="space-y-4">
      <Card><CardHeader><CardTitle>Klaviyo Campaigns</CardTitle></CardHeader><CardContent>
        <Table><TableHeader><TableRow><TableHead>Campaign</TableHead><TableHead>Status</TableHead><TableHead>Recipients</TableHead><TableHead>Opens</TableHead><TableHead>Clicks</TableHead><TableHead>Revenue</TableHead></TableRow></TableHeader>
          <TableBody>{campaigns.map(c => (
            <TableRow key={c.name}><TableCell className="font-medium">{c.name}</TableCell><TableCell><Badge variant={c.status === "sent" ? "default" : "outline"}>{c.status}</Badge></TableCell><TableCell>{c.recipients.toLocaleString()}</TableCell><TableCell>{c.opens}</TableCell><TableCell>{c.clicks}</TableCell><TableCell>${c.revenue.toLocaleString()}</TableCell></TableRow>
          ))}</TableBody></Table>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Segments</CardTitle></CardHeader><CardContent>
        <Table><TableHeader><TableRow><TableHead>Segment</TableHead><TableHead>Members</TableHead></TableRow></TableHeader>
          <TableBody>{segments.map(s => (
            <TableRow key={s.name}><TableCell>{s.name}</TableCell><TableCell>{s.members.toLocaleString()}</TableCell></TableRow>
          ))}</TableBody></Table>
      </CardContent></Card>
    </div>
  );
}
