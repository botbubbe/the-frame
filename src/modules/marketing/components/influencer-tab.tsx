"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const influencers = [
  { name: "@stylewithsara", platform: "Instagram", followers: 45000, niche: "Fashion", status: "gifted", posts: 2 },
  { name: "@sunglasslover", platform: "TikTok", followers: 120000, niche: "Eyewear", status: "contacted", posts: 0 },
  { name: "@coastalvibes", platform: "Instagram", followers: 28000, niche: "Lifestyle", status: "identified", posts: 0 },
  { name: "@opticaltrends", platform: "TikTok", followers: 85000, niche: "Eyewear", status: "posting", posts: 1 },
];

const statusColor = (s: string) => s === "posting" ? "default" : s === "gifted" ? "secondary" : "outline";

export function InfluencerTab() {
  return (
    <Card><CardHeader><CardTitle>Influencer Tracking</CardTitle></CardHeader><CardContent>
      <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Platform</TableHead><TableHead>Followers</TableHead><TableHead>Niche</TableHead><TableHead>Status</TableHead><TableHead>Posts</TableHead></TableRow></TableHeader>
        <TableBody>{influencers.map(i => (
          <TableRow key={i.name}><TableCell className="font-medium">{i.name}</TableCell><TableCell>{i.platform}</TableCell><TableCell>{i.followers.toLocaleString()}</TableCell><TableCell>{i.niche}</TableCell><TableCell><Badge variant={statusColor(i.status)}>{i.status}</Badge></TableCell><TableCell>{i.posts}</TableCell></TableRow>
        ))}</TableBody></Table>
    </CardContent></Card>
  );
}
