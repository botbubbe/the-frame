import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products } from "@/modules/catalog/schema";
import { like, sql, eq, and, type SQL } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";

  const conditions: SQL[] = [];
  if (search) {
    conditions.push(like(products.name, `%${search}%`));
  }
  if (status) {
    conditions.push(eq(products.status, status as "intake" | "processing" | "review" | "approved" | "published"));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const results = await db
    .select({
      id: products.id,
      skuPrefix: products.skuPrefix,
      name: products.name,
      category: products.category,
      factoryName: products.factoryName,
      wholesalePrice: products.wholesalePrice,
      retailPrice: products.retailPrice,
      status: products.status,
      createdAt: products.createdAt,
      variantCount: sql<number>`(SELECT COUNT(*) FROM catalog_skus WHERE product_id = ${products.id})`,
    })
    .from(products)
    .where(where)
    .orderBy(products.skuPrefix);

  return NextResponse.json({ products: results });
}
