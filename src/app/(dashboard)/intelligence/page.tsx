"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";

const sellThrough = [
  { sku: "JX1001-BLK", name: "Golden Hour", sold30: 45, sold60: 82, sold90: 118, revenue: 2950, velocity: "fast" },
  { sku: "JX1003-TRT", name: "Midnight Drive", sold30: 38, sold60: 71, sold90: 98, revenue: 2450, velocity: "fast" },
  { sku: "JX2004-GLD", name: "Coastline", sold30: 22, sold60: 40, sold90: 55, revenue: 1375, velocity: "normal" },
  { sku: "JX3001-SLV", name: "Park Avenue", sold30: 15, sold60: 28, sold90: 42, revenue: 1050, velocity: "normal" },
  { sku: "JX2002-BLU", name: "Ocean Blue", sold30: 8, sold60: 18, sold90: 30, revenue: 750, velocity: "slow" },
  { sku: "JX4003-PNK", name: "Rose Garden", sold30: 3, sold60: 5, sold90: 8, revenue: 200, velocity: "slow" },
  { sku: "JX1008-GRN", name: "Forest Walk", sold30: 0, sold60: 1, sold90: 3, revenue: 75, velocity: "dead" },
];

const trends = [
  { product: "Golden Hour", direction: "up", change: 18.5, alert: false },
  { product: "Midnight Drive", direction: "up", change: 12.3, alert: false },
  { product: "Coastline", direction: "stable", change: 2.1, alert: false },
  { product: "Ocean Blue", direction: "down", change: -15.2, alert: true },
  { product: "Rose Garden", direction: "down", change: -28.4, alert: true },
  { product: "Forest Walk", direction: "down", change: -66.7, alert: true },
];

const pricing = [
  { product: "Golden Hour", landed: 3.20, wholesale: 7.00, retail: 25.00, margin: 54.3 },
  { product: "Midnight Drive", landed: 3.40, wholesale: 7.00, retail: 25.00, margin: 51.4 },
  { product: "Coastline", landed: 3.80, wholesale: 7.00, retail: 25.00, margin: 45.7 },
  { product: "Park Avenue", landed: 3.60, wholesale: 7.00, retail: 25.00, margin: 48.6 },
  { product: "Ocean Blue", landed: 3.80, wholesale: 7.00, retail: 25.00, margin: 45.7 },
];

const geography = [
  { state: "CA", prospects: 3341, orders: 28, revenue: 4900 },
  { state: "TX", prospects: 2796, orders: 22, revenue: 3850 },
  { state: "FL", prospects: 2109, orders: 18, revenue: 3150 },
  { state: "NY", prospects: 1857, orders: 15, revenue: 2625 },
  { state: "NC", prospects: 1355, orders: 8, revenue: 1400 },
  { state: "GA", prospects: 953, orders: 6, revenue: 1050 },
  { state: "IL", prospects: 932, orders: 5, revenue: 875 },
  { state: "PA", prospects: 837, orders: 4, revenue: 700 },
];

const velocityBadge = (v: string) => {
  switch (v) {
    case "fast": return <Badge className="bg-green-100 text-green-800">Fast</Badge>;
    case "normal": return <Badge variant="secondary">Normal</Badge>;
    case "slow": return <Badge className="bg-orange-100 text-orange-800">Slow</Badge>;
    case "dead": return <Badge variant="destructive">Dead</Badge>;
    default: return <Badge variant="outline">{v}</Badge>;
  }
};

const trendIcon = (d: string) => {
  switch (d) {
    case "up": return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "down": return <TrendingDown className="h-4 w-4 text-red-500" />;
    default: return <Minus className="h-4 w-4 text-gray-400" />;
  }
};

export default function IntelligencePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Product Intelligence</h1>
        <p className="text-muted-foreground">Analytics, trends, pricing, and geographic insights</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">Top Seller (30d)</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">Golden Hour</p><p className="text-sm text-green-600">45 units</p></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">Fast Movers</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-green-600">2</p></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">Dead Stock</CardTitle></CardHeader><CardContent><p className="text-xl font-bold text-red-600">1</p></CardContent></Card>
        <Card><CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground">Avg Margin</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">49.1%</p></CardContent></Card>
      </div>

      <Tabs defaultValue="sell-through">
        <TabsList>
          <TabsTrigger value="sell-through">Sell-Through</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="geography">Geography</TabsTrigger>
        </TabsList>

        <TabsContent value="sell-through">
          <Card><CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Product</TableHead><TableHead>30d</TableHead><TableHead>60d</TableHead><TableHead>90d</TableHead><TableHead>Revenue</TableHead><TableHead>Velocity</TableHead></TableRow></TableHeader>
              <TableBody>
                {sellThrough.map(s => (
                  <TableRow key={s.sku}><TableCell className="font-mono text-sm">{s.sku}</TableCell><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.sold30}</TableCell><TableCell>{s.sold60}</TableCell><TableCell>{s.sold90}</TableCell><TableCell>${s.revenue.toLocaleString()}</TableCell><TableCell>{velocityBadge(s.velocity)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card><CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Trend</TableHead><TableHead>Change %</TableHead><TableHead>Alert</TableHead></TableRow></TableHeader>
              <TableBody>
                {trends.map(t => (
                  <TableRow key={t.product}><TableCell className="font-medium">{t.product}</TableCell><TableCell>{trendIcon(t.direction)}</TableCell><TableCell className={t.change >= 0 ? "text-green-600" : "text-red-600"}>{t.change > 0 ? "+" : ""}{t.change}%</TableCell><TableCell>{t.alert && <Badge variant="destructive">Alert</Badge>}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="pricing">
          <Card><CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Landed Cost</TableHead><TableHead>Wholesale</TableHead><TableHead>Retail</TableHead><TableHead>Margin %</TableHead></TableRow></TableHeader>
              <TableBody>
                {pricing.map(p => (
                  <TableRow key={p.product}><TableCell className="font-medium">{p.product}</TableCell><TableCell>${p.landed.toFixed(2)}</TableCell><TableCell>${p.wholesale.toFixed(2)}</TableCell><TableCell>${p.retail.toFixed(2)}</TableCell><TableCell className={p.margin >= 50 ? "text-green-600 font-medium" : ""}>{p.margin.toFixed(1)}%</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="geography">
          <Card><CardContent className="pt-4">
            <Table>
              <TableHeader><TableRow><TableHead>State</TableHead><TableHead>Prospects</TableHead><TableHead>Orders</TableHead><TableHead>Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {geography.map(g => (
                  <TableRow key={g.state}><TableCell className="font-bold">{g.state}</TableCell><TableCell>{g.prospects.toLocaleString()}</TableCell><TableCell>{g.orders}</TableCell><TableCell>${g.revenue.toLocaleString()}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
