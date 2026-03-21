"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Brain, Play, Clock, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";

const agents = [
  { name: "ICP Classifier", module: "Sales", status: "active", lastRun: "2h ago", runs: 12, successRate: 98, tokens: 4200 },
  { name: "Response Classifier", module: "Sales", status: "active", lastRun: "15m ago", runs: 89, successRate: 95, tokens: 12400 },
  { name: "Email Copywriter", module: "Sales", status: "active", lastRun: "1h ago", runs: 34, successRate: 91, tokens: 28600 },
  { name: "Conversion Scorer", module: "Sales", status: "idle", lastRun: "1d ago", runs: 8, successRate: 100, tokens: 1800 },
  { name: "Demand Forecaster", module: "Inventory", status: "active", lastRun: "6h ago", runs: 4, successRate: 100, tokens: 3200 },
  { name: "Margin Optimizer", module: "Finance", status: "idle", lastRun: "3d ago", runs: 2, successRate: 100, tokens: 900 },
  { name: "Cash Flow Predictor", module: "Finance", status: "active", lastRun: "12h ago", runs: 7, successRate: 86, tokens: 2100 },
  { name: "Churn Predictor", module: "Customers", status: "idle", lastRun: "5d ago", runs: 3, successRate: 100, tokens: 600 },
  { name: "Upsell Recommender", module: "Customers", status: "idle", lastRun: "5d ago", runs: 3, successRate: 67, tokens: 1200 },
  { name: "Content Idea Generator", module: "Marketing", status: "active", lastRun: "4h ago", runs: 6, successRate: 100, tokens: 5400 },
];

const recentRuns = [
  { agent: "Response Classifier", status: "success", input: "Reply from Luxe Boutiques", duration: "1.2s", tokens: 180, time: "15m ago" },
  { agent: "Email Copywriter", status: "success", input: "Campaign: Boutique Intro Q2", duration: "3.4s", tokens: 420, time: "1h ago" },
  { agent: "ICP Classifier", status: "success", input: "Batch: 500 companies", duration: "12s", tokens: 350, time: "2h ago" },
  { agent: "Content Idea Generator", status: "success", input: "Weekly ideas", duration: "2.1s", tokens: 900, time: "4h ago" },
  { agent: "Demand Forecaster", status: "success", input: "All SKUs", duration: "8.5s", tokens: 800, time: "6h ago" },
  { agent: "Cash Flow Predictor", status: "error", input: "12-week projection", duration: "4.2s", tokens: 350, time: "12h ago" },
];

export default function AICommandCenter() {
  const [agentStates, setAgentStates] = useState<Record<string, boolean>>(
    Object.fromEntries(agents.map(a => [a.name, a.status === "active"]))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Brain className="h-6 w-6" /> AI Command Center</h1>
          <p className="text-muted-foreground">Manage and monitor all AI agents across The Frame</p>
        </div>
        <div className="flex items-center gap-4">
          <Card className="px-4 py-2"><span className="text-sm text-muted-foreground">Total Token Cost (30d)</span><p className="text-lg font-bold">$4.82</p></Card>
          <Card className="px-4 py-2"><span className="text-sm text-muted-foreground">Success Rate</span><p className="text-lg font-bold text-green-600">94.2%</p></Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {agents.map((agent) => (
          <Card key={agent.name}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">{agent.name}</CardTitle>
                <Switch checked={agentStates[agent.name]} onCheckedChange={(v) => setAgentStates(s => ({ ...s, [agent.name]: v }))} />
              </div>
              <Badge variant={agent.module === "Sales" ? "default" : agent.module === "Inventory" ? "secondary" : "outline"} className="w-fit text-xs">{agent.module}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Last run</span><span>{agent.lastRun}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total runs</span><span>{agent.runs}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Success</span><span className={agent.successRate >= 90 ? "text-green-600" : "text-orange-500"}>{agent.successRate}%</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tokens</span><span>{agent.tokens.toLocaleString()}</span></div>
              <Button size="sm" variant="outline" className="w-full mt-2" disabled={!agentStates[agent.name]}><Play className="h-3 w-3 mr-1" />Run Now</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Agent Runs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead><TableHead>Status</TableHead><TableHead>Input</TableHead><TableHead>Duration</TableHead><TableHead>Tokens</TableHead><TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentRuns.map((run, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{run.agent}</TableCell>
                  <TableCell>{run.status === "success" ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{run.input}</TableCell>
                  <TableCell>{run.duration}</TableCell>
                  <TableCell>{run.tokens}</TableCell>
                  <TableCell className="text-muted-foreground">{run.time}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
