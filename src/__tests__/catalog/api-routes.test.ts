import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTestDb, resetTestDb } from "../setup";
import { createRequest, parseResponse } from "../api-helpers";

// Route handler imports
import { GET as getProducts } from "@/app/api/v1/catalog/products/route";
import { GET as getProductDetail, PATCH as patchProduct } from "@/app/api/v1/catalog/products/[id]/route";
import { PATCH as patchSku } from "@/app/api/v1/catalog/skus/[id]/route";
import { GET as getImages, POST as postImage } from "@/app/api/v1/catalog/images/route";
import { PATCH as patchImage, DELETE as deleteImage } from "@/app/api/v1/catalog/images/[id]/route";
import { GET as getTags, POST as postTag } from "@/app/api/v1/catalog/tags/route";
import { DELETE as deleteTag } from "@/app/api/v1/catalog/tags/[id]/route";
import { POST as postIntake } from "@/app/api/v1/catalog/intake/route";
import { POST as postCopyGenerate } from "@/app/api/v1/catalog/copy/generate/route";

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function platformParams(platform: string) {
  return { params: Promise.resolve({ platform }) };
}

function seedCatalog() {
  const db = getTestDb();
  db.prepare(`INSERT INTO catalog_products (id, sku_prefix, name, category, status, wholesale_price, retail_price, frame_shape, frame_material, gender)
    VALUES ('p1', 'JX1-001', 'Sunset Aviator', 'sunglasses', 'approved', 12.50, 29.99, 'aviator', 'metal', 'unisex')`).run();
  db.prepare(`INSERT INTO catalog_products (id, sku_prefix, name, category, status, wholesale_price, retail_price)
    VALUES ('p2', 'JX2-001', 'Urban Square', 'optical', 'intake', 10.00, 24.99)`).run();
  db.prepare(`INSERT INTO catalog_skus (id, product_id, sku, color_name, color_hex, cost_price, wholesale_price, retail_price, status)
    VALUES ('sk1', 'p1', 'JX1-001-BLK', 'Black', '#000000', 5.00, 12.50, 29.99, 'approved')`).run();
  db.prepare(`INSERT INTO catalog_skus (id, product_id, sku, color_name, cost_price, status)
    VALUES ('sk2', 'p1', 'JX1-001-GLD', 'Gold', 5.00, 'intake')`).run();
  db.prepare(`INSERT INTO catalog_skus (id, product_id, sku, color_name, status)
    VALUES ('sk3', 'p2', 'JX2-001-BRN', 'Brown', 'intake')`).run();
}

describe("Catalog API Routes", () => {
  beforeEach(() => {
    resetTestDb();
    seedCatalog();
  });

  // ── Products List ──
  describe("GET /catalog/products", () => {
    it("returns all products", async () => {
      const req = createRequest("GET", "/api/v1/catalog/products");
      const res = await getProducts(req);
      const { status, data } = await parseResponse<any>(res);
      expect(status).toBe(200);
      expect(data.products).toHaveLength(2);
    });

    it("filters by status", async () => {
      const req = createRequest("GET", "/api/v1/catalog/products", { searchParams: { status: "approved" } });
      const res = await getProducts(req);
      const { data } = await parseResponse<any>(res);
      expect(data.products).toHaveLength(1);
      expect(data.products[0].name).toBe("Sunset Aviator");
    });

    it("filters by search term", async () => {
      const req = createRequest("GET", "/api/v1/catalog/products", { searchParams: { search: "Urban" } });
      const res = await getProducts(req);
      const { data } = await parseResponse<any>(res);
      expect(data.products).toHaveLength(1);
      expect(data.products[0].skuPrefix).toBe("JX2-001");
    });

    it("includes variant count", async () => {
      const req = createRequest("GET", "/api/v1/catalog/products");
      const res = await getProducts(req);
      const { data } = await parseResponse<any>(res);
      const p1 = data.products.find((p: any) => p.id === "p1");
      // variantCount comes from a SQL subquery; verify it's a number
      expect(typeof p1.variantCount).toBe("number");
    });
  });

  // ── Product Detail & Update ──
  describe("GET/PATCH /catalog/products/[id]", () => {
    it("returns product detail with skus and tags", async () => {
      const req = createRequest("GET", "/api/v1/catalog/products/p1");
      const res = await getProductDetail(req, routeParams("p1"));
      const { status, data } = await parseResponse<any>(res);
      expect(status).toBe(200);
      expect(data.product.name).toBe("Sunset Aviator");
      expect(data.skus).toHaveLength(2);
    });

    it("returns 404 for missing product", async () => {
      const req = createRequest("GET", "/api/v1/catalog/products/nope");
      const res = await getProductDetail(req, routeParams("nope"));
      expect(res.status).toBe(404);
    });

    it("updates product name and category", async () => {
      const req = createRequest("PATCH", "/api/v1/catalog/products/p1", {
        body: { name: "Sunset Aviator Pro", category: "optical" },
      });
      const res = await patchProduct(req, routeParams("p1"));
      const { data } = await parseResponse<any>(res);
      expect(data.product.name).toBe("Sunset Aviator Pro");
      expect(data.product.category).toBe("optical");
    });

    it("updates product status", async () => {
      const req = createRequest("PATCH", "/api/v1/catalog/products/p2", {
        body: { status: "processing" },
      });
      const res = await patchProduct(req, routeParams("p2"));
      const { data } = await parseResponse<any>(res);
      expect(data.product.status).toBe("processing");
    });
  });

  // ── SKU Update ──
  describe("PATCH /catalog/skus/[id]", () => {
    it("updates SKU fields", async () => {
      const req = createRequest("PATCH", "/api/v1/catalog/skus/sk1", {
        body: { colorName: "Matte Black", retailPrice: 34.99, status: "approved" },
      });
      const res = await patchSku(req, routeParams("sk1"));
      const { data } = await parseResponse<any>(res);
      expect(data.sku.colorName).toBe("Matte Black");
      expect(data.sku.retailPrice).toBe(34.99);
    });

    it("rejects empty update", async () => {
      const req = createRequest("PATCH", "/api/v1/catalog/skus/sk1", { body: {} });
      const res = await patchSku(req, routeParams("sk1"));
      expect(res.status).toBe(400);
    });
  });

  // ── Images ──
  describe("Images CRUD", () => {
    it("POST creates image metadata", async () => {
      const req = createRequest("POST", "/api/v1/catalog/images", {
        body: { skuId: "sk1", filePath: "/images/test.jpg", altText: "Test image", width: 800, height: 600 },
      });
      const res = await postImage(req);
      const { status, data } = await parseResponse<any>(res);
      expect(status).toBe(201);
      expect(data.image.filePath).toBe("/images/test.jpg");
      expect(data.image.status).toBe("draft");
    });

    it("GET lists images by skuId", async () => {
      const db = getTestDb();
      db.prepare(`INSERT INTO catalog_images (id, sku_id, file_path, status) VALUES ('img1', 'sk1', '/img/a.jpg', 'draft')`).run();
      db.prepare(`INSERT INTO catalog_images (id, sku_id, file_path, status) VALUES ('img2', 'sk1', '/img/b.jpg', 'approved')`).run();

      const req = createRequest("GET", "/api/v1/catalog/images", { searchParams: { skuId: "sk1" } });
      const res = await getImages(req);
      const { data } = await parseResponse<any>(res);
      expect(data.images).toHaveLength(2);
    });

    it("PATCH updates image status", async () => {
      const db = getTestDb();
      db.prepare(`INSERT INTO catalog_images (id, sku_id, file_path, status) VALUES ('img1', 'sk1', '/img/a.jpg', 'draft')`).run();

      const req = createRequest("PATCH", "/api/v1/catalog/images/img1", { body: { status: "approved" } });
      const res = await patchImage(req, routeParams("img1"));
      const { data } = await parseResponse<any>(res);
      expect(data.image.status).toBe("approved");
    });

    it("DELETE removes image", async () => {
      const db = getTestDb();
      db.prepare(`INSERT INTO catalog_images (id, sku_id, file_path) VALUES ('img1', 'sk1', '/img/a.jpg')`).run();

      const req = createRequest("DELETE", "/api/v1/catalog/images/img1");
      const res = await deleteImage(req, routeParams("img1"));
      const { data } = await parseResponse<any>(res);
      expect(data.deleted).toBe(true);

      const row = db.prepare("SELECT * FROM catalog_images WHERE id = 'img1'").get();
      expect(row).toBeUndefined();
    });

    it("POST requires skuId and filePath", async () => {
      const req = createRequest("POST", "/api/v1/catalog/images", { body: { altText: "no sku" } });
      const res = await postImage(req);
      expect(res.status).toBe(400);
    });
  });

  // ── Tags ──
  describe("Tags CRUD", () => {
    it("POST creates a tag", async () => {
      const req = createRequest("POST", "/api/v1/catalog/tags", {
        body: { productId: "p1", tagName: "retro", dimension: "style", source: "manual" },
      });
      const res = await postTag(req);
      const { status, data } = await parseResponse<any>(res);
      expect(status).toBe(201);
      expect(data.tag.tagName).toBe("retro");
    });

    it("GET lists tags for product", async () => {
      const db = getTestDb();
      db.prepare(`INSERT INTO catalog_tags (id, product_id, tag_name, dimension, source) VALUES ('t1', 'p1', 'retro', 'style', 'ai')`).run();
      db.prepare(`INSERT INTO catalog_tags (id, product_id, tag_name, dimension, source) VALUES ('t2', 'p1', 'summer', 'season', 'manual')`).run();

      const req = createRequest("GET", "/api/v1/catalog/tags", { searchParams: { productId: "p1" } });
      const res = await getTags(req);
      const { data } = await parseResponse<any>(res);
      expect(data.tags).toHaveLength(2);
    });

    it("DELETE removes a tag", async () => {
      const db = getTestDb();
      db.prepare(`INSERT INTO catalog_tags (id, product_id, tag_name) VALUES ('t1', 'p1', 'retro')`).run();

      const req = createRequest("DELETE", "/api/v1/catalog/tags/t1");
      const res = await deleteTag(req, routeParams("t1"));
      const { data } = await parseResponse<any>(res);
      expect(data.deleted).toBe(true);
    });

    it("POST requires productId and tagName", async () => {
      const req = createRequest("POST", "/api/v1/catalog/tags", { body: { productId: "p1" } });
      const res = await postTag(req);
      expect(res.status).toBe(400);
    });
  });

  // ── Product Intake ──
  describe("POST /catalog/intake", () => {
    it("creates products with variants", async () => {
      const req = createRequest("POST", "/api/v1/catalog/intake", {
        body: {
          mode: "manual",
          items: [{
            skuPrefix: "JX3-001",
            name: "Beach Runner",
            category: "sunglasses",
            variants: [
              { sku: "JX3-001-RED", colorName: "Red" },
              { sku: "JX3-001-BLU", colorName: "Blue" },
            ],
          }],
        },
      });
      const res = await postIntake(req);
      const { status, data } = await parseResponse<any>(res);
      expect(status).toBe(201);
      expect(data.created).toBe(1);
      expect(data.details.created).toContain("JX3-001");
    });

    it("rejects duplicate skuPrefix", async () => {
      const req = createRequest("POST", "/api/v1/catalog/intake", {
        body: { mode: "manual", items: [{ skuPrefix: "JX1-001" }] },
      });
      const res = await postIntake(req);
      const { data } = await parseResponse<any>(res);
      expect(data.errors).toBe(1);
      expect(data.details.errors[0].error).toContain("already exists");
    });

    it("requires items array", async () => {
      const req = createRequest("POST", "/api/v1/catalog/intake", { body: { mode: "manual" } });
      const res = await postIntake(req);
      expect(res.status).toBe(400);
    });
  });

  // ── Copy Generation (template fallback) ──
  describe("POST /catalog/copy/generate", () => {
    it("generates description", async () => {
      const req = createRequest("POST", "/api/v1/catalog/copy/generate", {
        body: { productId: "p1", field: "description" },
      });
      const res = await postCopyGenerate(req);
      const { status, data } = await parseResponse<any>(res);
      expect(status).toBe(200);
      expect(data.content).toBeTruthy();
      expect(data.model).toBeTruthy();
    });

    it("returns 404 for missing product", async () => {
      const req = createRequest("POST", "/api/v1/catalog/copy/generate", {
        body: { productId: "nope", field: "description" },
      });
      const res = await postCopyGenerate(req);
      expect(res.status).toBe(404);
    });

    it("requires productId and field", async () => {
      const req = createRequest("POST", "/api/v1/catalog/copy/generate", {
        body: { productId: "p1" },
      });
      const res = await postCopyGenerate(req);
      expect(res.status).toBe(400);
    });
  });
});
