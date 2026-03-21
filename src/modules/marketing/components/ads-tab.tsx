"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const ads = [
  { platform: "Google", campaign: "Brand Search", spend: 1200, impressions: 45000, clicks: 2100, cpc: 0.57, conversions: 28, roas: 3.2 },
  { platform: "Meta", campaign: "Retargeting", spend: 800, impressions: 62000, clicks: 1800, cpc: 0.44, conversions: 15, roas: 2.1 },
  { platform: "TikTok", campaign: "Awareness", spend: 500, impressions: 120000, clicks: 3200, cpc: 0.16, conversions: 8, roas: 1.4 },
];

export function AdsTab() {
  return (
    <Card><CardHeader><CardTitle>Ad Campaigns</CardTitle></CardHeader><CardContent>
      <Table><TableHeader><TableRow><TableHead>Platform</TableHead><TableHead>Campaign</TableHead><TableHead>Spend</TableHead><TableHead>Impressions</TableHead><TableHead>Clicks</TableHead><TableHead>CPC</TableHead><TableHead>Conv.</TableHead><TableHead>ROAS</TableHead></TableRow></TableHeader>
        <TableBody>{ads.map(a => (
          <TableRow key={a.campaign}><TableCell><Badge variant="outline">{a.platform}</Badge></TableCell><TableCell>{a.campaign}</TableCell><TableCell>${a.spend}</TableCell><TableCell>{a.impressions.toLocaleString()}</TableCell><TableCell>{a.clicks.toLocaleString()}</TableCell><TableCell>${a.cpc}</TableCell><TableCell>{a.conversions}</TableCell><TableCell className={a.roas >= 2 ? "text-green-600 font-medium" : "text-orange-500"}>{a.roas}x</TableCell></TableRow>
        ))}</TableBody></Table>
    </CardContent></Card>
  );
}
