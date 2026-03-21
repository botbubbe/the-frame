"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Users, Kanban, Mail, ShoppingCart, Package, Warehouse, DollarSign, Brain, BarChart3, Settings, Bell, Search,
} from "lucide-react";

const navCommands = [
  { label: "Go to Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Go to Prospects", icon: Users, path: "/prospects" },
  { label: "Go to Pipeline", icon: Kanban, path: "/pipeline" },
  { label: "Go to Campaigns", icon: Mail, path: "/campaigns" },
  { label: "Go to Orders", icon: ShoppingCart, path: "/orders" },
  { label: "Go to Catalog", icon: Package, path: "/catalog" },
  { label: "Go to Inventory", icon: Warehouse, path: "/inventory" },
  { label: "Go to Finance", icon: DollarSign, path: "/finance" },
  { label: "Go to AI Center", icon: Brain, path: "/ai" },
  { label: "Go to Intelligence", icon: BarChart3, path: "/intelligence" },
  { label: "Go to Notifications", icon: Bell, path: "/notifications" },
  { label: "Go to Settings", icon: Settings, path: "/settings" },
];

const actionCommands = [
  { label: "Search Prospects", icon: Search, path: "/prospects?focus=search" },
  { label: "Search Products", icon: Search, path: "/catalog?focus=search" },
  { label: "New Deal", icon: Kanban, path: "/pipeline?action=new" },
  { label: "Import Leads", icon: Users, path: "/prospects?action=import" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navigate = (path: string) => {
    router.push(path);
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {navCommands.map(cmd => {
            const Icon = cmd.icon;
            return (
              <CommandItem key={cmd.path} onSelect={() => navigate(cmd.path)}>
                <Icon className="mr-2 h-4 w-4" />
                <span>{cmd.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          {actionCommands.map(cmd => {
            const Icon = cmd.icon;
            return (
              <CommandItem key={cmd.label} onSelect={() => navigate(cmd.path)}>
                <Icon className="mr-2 h-4 w-4" />
                <span>{cmd.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
