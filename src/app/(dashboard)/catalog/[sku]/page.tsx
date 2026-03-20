"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Product = {
  id: string;
  skuPrefix: string | null;
  name: string | null;
  description: string | null;
  shortDescription: string | null;
  category: string | null;
  frameShape: string | null;
  frameMaterial: string | null;
  gender: string | null;
  lensType: string | null;
  wholesalePrice: number | null;
  retailPrice: number | null;
  msrp: number | null;
  factoryName: string | null;
  factorySku: string | null;
  status: string | null;
};

type Sku = {
  id: string;
  sku: string | null;
  colorName: string | null;
  colorHex: string | null;
  size: string | null;
  upc: string | null;
  costPrice: number | null;
  wholesalePrice: number | null;
  retailPrice: number | null;
  inStock: boolean | null;
  status: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  intake: "bg-gray-100 text-gray-700",
  processing: "bg-blue-100 text-blue-700",
  review: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  published: "bg-purple-100 text-purple-700",
};

export default function ProductDetailPage() {
  const params = useParams();
  const skuPrefix = params.sku as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // First find product by SKU prefix, then fetch by ID
    fetch(`/api/v1/catalog/products?search=${encodeURIComponent(skuPrefix)}`)
      .then((r) => r.json())
      .then((data) => {
        const match = data.products.find(
          (p: { skuPrefix: string }) => p.skuPrefix === skuPrefix
        );
        if (match) {
          return fetch(`/api/v1/catalog/products/${match.id}`);
        }
        throw new Error("Product not found");
      })
      .then((r) => r.json())
      .then((data) => {
        setProduct(data.product);
        setSkus(data.skus);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [skuPrefix]);

  if (loading) return <div className="text-muted-foreground p-4">Loading...</div>;
  if (!product) return <div className="p-4">Product not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/catalog"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {product.name || product.skuPrefix}
            </h1>
            <Badge
              variant="secondary"
              className={STATUS_COLORS[product.status || "intake"]}
            >
              {product.status}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono">{product.skuPrefix}</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="skus">SKUs ({skus.length})</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="copy">Copy</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Product Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Category" value={product.category} />
                <Row label="Frame Shape" value={product.frameShape} />
                <Row label="Frame Material" value={product.frameMaterial} />
                <Row label="Gender" value={product.gender} />
                <Row label="Lens Type" value={product.lensType} />
                <Row label="Factory" value={product.factoryName} />
                <Row label="Factory SKU" value={product.factorySku} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Wholesale" value={product.wholesalePrice ? `$${product.wholesalePrice.toFixed(2)}` : null} />
                <Row label="Retail" value={product.retailPrice ? `$${product.retailPrice.toFixed(2)}` : null} />
                <Row label="MSRP" value={product.msrp ? `$${product.msrp.toFixed(2)}` : null} />
              </CardContent>
            </Card>
          </div>
          {product.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Description</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{product.description}</CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="skus">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>UPC</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Wholesale</TableHead>
                    <TableHead className="text-right">Retail</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {skus.map((sku) => (
                    <TableRow key={sku.id}>
                      <TableCell className="font-mono text-sm">{sku.sku}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {sku.colorHex && (
                            <div
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: sku.colorHex }}
                            />
                          )}
                          {sku.colorName}
                        </div>
                      </TableCell>
                      <TableCell>{sku.size}</TableCell>
                      <TableCell className="font-mono text-xs">{sku.upc}</TableCell>
                      <TableCell className="text-right">
                        {sku.costPrice ? `$${sku.costPrice.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {sku.wholesalePrice ? `$${sku.wholesalePrice.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {sku.retailPrice ? `$${sku.retailPrice.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={STATUS_COLORS[sku.status || "intake"]}>
                          {sku.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="images">
          <Card>
            <CardContent className="p-6 text-muted-foreground">
              Image management coming in Phase 1.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="copy">
          <Card>
            <CardContent className="p-6 text-muted-foreground">
              Copy management coming in Phase 1.
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags">
          <Card>
            <CardContent className="p-6 text-muted-foreground">
              Tag management coming in Phase 1.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value || "—"}</span>
    </div>
  );
}
