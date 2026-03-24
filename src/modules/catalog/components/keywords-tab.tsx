"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, X, Search } from "lucide-react";

interface KeywordTag {
  id: string;
  tagName: string;
  dimension: string;
  source: string;
}

export function KeywordsTab({ productId }: { productId: string }) {
  const [keywords, setKeywords] = useState<KeywordTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadKeywords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/catalog/tags?productId=${productId}&dimension=keyword`);
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.tags || []);
      }
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadKeywords();
  }, [loadKeywords]);

  const deleteKeyword = async (id: string) => {
    await fetch(`/api/v1/catalog/tags/${id}`, { method: "DELETE" });
    setKeywords((prev) => prev.filter((k) => k.id !== id));
  };

  const generateKeywords = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/v1/catalog/keywords/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (res.ok) {
        await loadKeywords();
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Loading keywords...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" /> SEO Keywords ({keywords.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Target keywords for product pages, Shopify SEO, and ad campaigns. Auto-selected by score (volume × competition × specificity).
            </p>
          </div>
          <Button size="sm" onClick={generateKeywords} disabled={generating}>
            {generating ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="h-3 w-3 mr-1" /> Generate Keywords</>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {keywords.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No keywords yet.</p>
            <p className="text-xs mt-1">Click "Generate Keywords" to get AI + DataForSEO suggestions.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw) => (
              <span
                key={kw.id}
                className="group inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 px-3 py-1 text-sm text-gray-800 dark:text-gray-200"
              >
                {kw.tagName}
                {kw.source === "ai" && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">AI</Badge>
                )}
                <button
                  onClick={() => deleteKeyword(kw.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 -mr-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
