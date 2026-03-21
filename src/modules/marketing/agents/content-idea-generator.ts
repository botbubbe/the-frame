/**
 * Content Idea Generator Agent
 * Suggests content ideas based on product launches, calendar, and trends.
 */
import { sqlite } from "@/lib/db";

interface ContentIdea {
  title: string;
  type: "blog" | "social" | "email" | "ad";
  platform: string;
  reasoning: string;
  priority: "high" | "medium" | "low";
}

export async function generateContentIdeas(): Promise<ContentIdea[]> {
  const ideas: ContentIdea[] = [];
  const now = new Date();
  const month = now.getMonth();

  // Seasonal ideas
  if (month >= 3 && month <= 5) {
    ideas.push(
      { title: "Summer Sunglasses Guide: Find Your Perfect Pair", type: "blog", platform: "blog", reasoning: "Peak sunglasses season approaching", priority: "high" },
      { title: "Festival Season Eyewear Lookbook", type: "social", platform: "instagram", reasoning: "Festival season content performs well in spring", priority: "high" },
      { title: "UV Protection: Why Quality Lenses Matter", type: "blog", platform: "blog", reasoning: "Educational content builds trust", priority: "medium" },
    );
  }
  if (month >= 9 && month <= 11) {
    ideas.push(
      { title: "Fall Eyewear Trends: What's Hot This Season", type: "blog", platform: "blog", reasoning: "Seasonal trend content", priority: "high" },
      { title: "Holiday Gift Guide: Sunglasses Under $25", type: "social", platform: "instagram", reasoning: "Gift guide season", priority: "high" },
    );
  }

  // Product-based ideas
  try {
    const newProducts = sqlite().prepare(
      "SELECT name FROM products WHERE status = 'approved' AND created_at >= datetime('now', '-30 days') LIMIT 5"
    ).all() as { name: string }[];
    for (const p of newProducts) {
      ideas.push({ title: `New Arrival: ${p.name} — Style Spotlight`, type: "social", platform: "tiktok", reasoning: "New product launch content", priority: "high" });
    }
  } catch { /* DB not available */ }

  // Evergreen ideas
  ideas.push(
    { title: "How to Choose Sunglasses for Your Face Shape", type: "social", platform: "tiktok", reasoning: "Evergreen, high search volume", priority: "medium" },
    { title: "Behind the Scenes: How Jaxy Sunglasses Are Made", type: "social", platform: "instagram", reasoning: "Brand story content builds connection", priority: "medium" },
    { title: "Wholesale Partner Spotlight: [Store Name]", type: "social", platform: "instagram", reasoning: "Social proof + partner relationship building", priority: "low" },
    { title: "Polarized vs UV400: What's the Difference?", type: "blog", platform: "blog", reasoning: "SEO keyword opportunity", priority: "medium" },
  );

  return ideas;
}
