"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Product = {
  id: string;
  skuPrefix: string | null;
  name: string | null;
  category: string | null;
  factoryName: string | null;
  wholesalePrice: number | null;
  retailPrice: number | null;
  status: string | null;
  variantCount: number;
};

const STATUS_COLORS: Record<string, string> = {
  intake: "bg-gray-100 text-gray-700",
  processing: "bg-blue-100 text-blue-700",
  review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  published: "bg-purple-100 text-purple-700",
};

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/v1/catalog/products?search=${encodeURIComponent(search)}`)
        .then((r) => r.json())
        .then((data) => {
          setProducts(data.products);
          setLoading(false);
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Catalog</h1>
          <p className="text-muted-foreground">
            {products.length} products
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <Link key={product.id} href={`/catalog/${product.skuPrefix}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">
                      {product.name || product.skuPrefix}
                    </CardTitle>
                    <Badge
                      variant="secondary"
                      className={STATUS_COLORS[product.status || "intake"]}
                    >
                      {product.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                    <span className="font-mono">{product.skuPrefix}</span>
                    {product.factoryName && (
                      <span>· {product.factoryName}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {product.variantCount} variant{product.variantCount !== 1 ? "s" : ""}
                    </span>
                    {product.retailPrice && (
                      <span className="font-medium">
                        ${product.retailPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
