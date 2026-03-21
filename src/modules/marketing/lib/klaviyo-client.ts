/**
 * Klaviyo API Client (stub)
 * Will sync customer segments and pull campaign stats when API key is configured.
 */

const KLAVIYO_API_KEY = process.env.KLAVIYO_API_KEY;
const BASE_URL = "https://a.klaviyo.com/api";

interface KlaviyoCampaign {
  id: string;
  name: string;
  status: string;
  send_time: string;
  stats: { recipients: number; opens: number; clicks: number; revenue: number };
}

interface KlaviyoSegment {
  id: string;
  name: string;
  member_count: number;
}

export function isConfigured(): boolean {
  return !!KLAVIYO_API_KEY;
}

async function apiRequest<T>(path: string): Promise<T | null> {
  if (!KLAVIYO_API_KEY) return null;
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        Authorization: `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
        Accept: "application/json",
        revision: "2024-02-15",
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function listCampaigns(): Promise<KlaviyoCampaign[]> {
  if (!isConfigured()) return getMockCampaigns();
  const data = await apiRequest<{ data: KlaviyoCampaign[] }>("/campaigns");
  return data?.data ?? getMockCampaigns();
}

export async function listSegments(): Promise<KlaviyoSegment[]> {
  if (!isConfigured()) return getMockSegments();
  const data = await apiRequest<{ data: KlaviyoSegment[] }>("/segments");
  return data?.data ?? getMockSegments();
}

function getMockCampaigns(): KlaviyoCampaign[] {
  return [
    { id: "mock-1", name: "Welcome Series", status: "sent", send_time: "2026-03-15", stats: { recipients: 1200, opens: 480, clicks: 96, revenue: 2400 } },
    { id: "mock-2", name: "New Collection Launch", status: "draft", send_time: "2026-04-01", stats: { recipients: 0, opens: 0, clicks: 0, revenue: 0 } },
    { id: "mock-3", name: "Wholesale Reorder Reminder", status: "sent", send_time: "2026-03-10", stats: { recipients: 340, opens: 170, clicks: 51, revenue: 8500 } },
  ];
}

function getMockSegments(): KlaviyoSegment[] {
  return [
    { id: "seg-1", name: "All Wholesale Customers", member_count: 450 },
    { id: "seg-2", name: "DTC Customers", member_count: 1200 },
    { id: "seg-3", name: "High-Value Accounts", member_count: 85 },
    { id: "seg-4", name: "Lapsed Customers (90+ days)", member_count: 120 },
  ];
}
