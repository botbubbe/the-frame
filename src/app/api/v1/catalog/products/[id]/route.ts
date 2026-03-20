import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, skus } from "@/modules/catalog/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const product = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);

  if (product.length === 0) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const productSkus = await db
    .select()
    .from(skus)
    .where(eq(skus.productId, id));

  return NextResponse.json({
    product: product[0],
    skus: productSkus,
  });
}
