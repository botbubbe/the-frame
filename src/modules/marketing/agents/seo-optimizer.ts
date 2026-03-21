/**
 * SEO Optimizer Agent
 * Analyzes content for SEO and suggests improvements.
 */

interface SeoAnalysis {
  score: number;
  issues: SeoIssue[];
  suggestions: string[];
}

interface SeoIssue {
  type: "error" | "warning" | "info";
  message: string;
}

export function analyzeContent(content: {
  title: string;
  body: string;
  metaDescription?: string;
  targetKeyword?: string;
}): SeoAnalysis {
  const issues: SeoIssue[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Title checks
  if (!content.title) { issues.push({ type: "error", message: "Missing title" }); score -= 20; }
  else if (content.title.length < 30) { issues.push({ type: "warning", message: "Title too short (<30 chars)" }); score -= 10; }
  else if (content.title.length > 60) { issues.push({ type: "warning", message: "Title too long (>60 chars)" }); score -= 5; }

  // Meta description
  if (!content.metaDescription) { issues.push({ type: "warning", message: "Missing meta description" }); score -= 10; }
  else if (content.metaDescription.length < 120) { issues.push({ type: "info", message: "Meta description could be longer" }); score -= 5; }
  else if (content.metaDescription.length > 160) { issues.push({ type: "warning", message: "Meta description too long (>160 chars)" }); score -= 5; }

  // Body checks
  const wordCount = content.body.split(/\s+/).length;
  if (wordCount < 300) { issues.push({ type: "warning", message: `Body too short (${wordCount} words, aim for 1000+)` }); score -= 15; }
  else if (wordCount < 1000) { issues.push({ type: "info", message: `Body length OK (${wordCount} words), longer content ranks better` }); score -= 5; }

  // Keyword checks
  if (content.targetKeyword) {
    const kw = content.targetKeyword.toLowerCase();
    if (!content.title.toLowerCase().includes(kw)) { issues.push({ type: "warning", message: "Target keyword not in title" }); score -= 10; }
    if (!content.body.toLowerCase().includes(kw)) { issues.push({ type: "error", message: "Target keyword not in body" }); score -= 15; }
    const kwCount = (content.body.toLowerCase().match(new RegExp(kw, "g")) || []).length;
    const density = (kwCount / wordCount) * 100;
    if (density < 0.5) { issues.push({ type: "info", message: `Low keyword density (${density.toFixed(1)}%)` }); score -= 5; }
    if (density > 3) { issues.push({ type: "warning", message: `Keyword stuffing risk (${density.toFixed(1)}%)` }); score -= 10; }
  }

  // Heading checks
  if (!content.body.includes("##") && !content.body.includes("<h2")) {
    issues.push({ type: "warning", message: "No subheadings found — add H2/H3 for structure" }); score -= 5;
  }

  // Suggestions
  if (score >= 80) suggestions.push("Content looks good for SEO. Consider adding internal links.");
  if (wordCount < 1500) suggestions.push("Longer content (1500+ words) tends to rank higher for competitive keywords.");
  if (!content.body.includes("http")) suggestions.push("Add relevant internal and external links.");
  suggestions.push("Add alt text to all images for accessibility and SEO.");

  return { score: Math.max(0, score), issues, suggestions };
}
