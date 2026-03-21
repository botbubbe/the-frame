"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Package, Users, TrendingDown, DollarSign, AlertTriangle, Check } from "lucide-react";
import { useState } from "react";

const initialAlerts = [
  { id: "1", type: "inventory", icon: Package, title: "Low Stock: JX1001-BLK (Golden Hour)", message: "12 units remaining. Reorder point is 50. Lead time: 55 days.", severity: "high", time: "2h ago", read: false },
  { id: "2", type: "inventory", icon: Package, title: "Out of Stock: JX1008-GRN (Forest Walk)", message: "0 units. No PO in progress.", severity: "critical", time: "1d ago", read: false },
  { id: "3", type: "deal", icon: TrendingDown, title: "Stale Deal: Sunset Boutique", message: "No activity for 14 days in 'Interested' stage.", severity: "medium", time: "3h ago", read: false },
  { id: "4", type: "deal", icon: TrendingDown, title: "Stale Deal: Pacific Optical", message: "No activity for 21 days in 'Contact Made' stage.", severity: "high", time: "5h ago", read: false },
  { id: "5", type: "customer", icon: Users, title: "Churning: Marina Gift Shop", message: "Health score dropped to 28. Last order 95 days ago.", severity: "high", time: "1d ago", read: false },
  { id: "6", type: "customer", icon: Users, title: "Reorder Due: Coastal Accessories", message: "Last ordered 88 days ago. Average reorder cycle: 75 days.", severity: "medium", time: "2d ago", read: true },
  { id: "7", type: "finance", icon: DollarSign, title: "Settlement Pending: Shopify DTC Week 11", message: "$3,240 expected. Not yet received.", severity: "low", time: "3d ago", read: true },
  { id: "8", type: "agent", icon: AlertTriangle, title: "Agent Error: Cash Flow Predictor", message: "Failed with timeout after 30s. Will retry.", severity: "medium", time: "12h ago", read: true },
];

const severityColor = (s: string) => {
  switch (s) {
    case "critical": return "destructive" as const;
    case "high": return "destructive" as const;
    case "medium": return "secondary" as const;
    default: return "outline" as const;
  }
};

export default function NotificationsPage() {
  const [alerts, setAlerts] = useState(initialAlerts);
  const unread = alerts.filter(a => !a.read).length;

  const markRead = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  const markAllRead = () => setAlerts(prev => prev.map(a => ({ ...a, read: true })));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Bell className="h-6 w-6" /> Notifications</h1>
          <p className="text-muted-foreground">{unread} unread alert{unread !== 1 ? "s" : ""}</p>
        </div>
        <Button variant="outline" onClick={markAllRead} disabled={unread === 0}><Check className="h-4 w-4 mr-1" />Mark All Read</Button>
      </div>

      <div className="space-y-3">
        {alerts.map(alert => {
          const Icon = alert.icon;
          return (
            <Card key={alert.id} className={alert.read ? "opacity-60" : "border-l-4 border-l-red-500"}>
              <CardContent className="flex items-start gap-4 py-4">
                <Icon className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{alert.title}</span>
                    <Badge variant={severityColor(alert.severity)}>{alert.severity}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                  <span className="text-xs text-muted-foreground">{alert.time}</span>
                </div>
                {!alert.read && <Button size="sm" variant="ghost" onClick={() => markRead(alert.id)}>Dismiss</Button>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
