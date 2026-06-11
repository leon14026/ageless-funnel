export type CatalogItem = {
  sku: string;
  name: string;
  kind: "access" | "addon";
  usd: number;
  bdt: number;
  months?: number;
};

export const catalog: Record<string, CatalogItem> = {
  access_1_month: { sku: "access_1_month", name: "1 Month Access", kind: "access", usd: 49.99, bdt: 4999, months: 1 },
  access_3_months: { sku: "access_3_months", name: "3 Months Access", kind: "access", usd: 59.99, bdt: 5999, months: 3 },
  access_6_months: { sku: "access_6_months", name: "6 Months Access", kind: "access", usd: 74.99, bdt: 7499, months: 6 },
  meal_prep_guide: { sku: "meal_prep_guide", name: "7-Day Meal Prep Guide", kind: "addon", usd: 9.99, bdt: 999 },
  personal_nutrition_plan: { sku: "personal_nutrition_plan", name: "Personal Nutrition Plan", kind: "addon", usd: 14.99, bdt: 1499 },
  meal_plan_collection: { sku: "meal_plan_collection", name: "Bangladeshi Meal Plan Collection", kind: "addon", usd: 6.99, bdt: 699 },
};

export function validateItems(skus: unknown, allowAddons: boolean) {
  if (!Array.isArray(skus) || skus.length === 0 || !skus.every((sku) => typeof sku === "string")) {
    throw new Error("Choose a valid access term.");
  }

  const items = skus.map((sku) => {
    const item = catalog[sku];
    if (!item) throw new Error("Unknown checkout item.");
    return item;
  });
  if (items.filter((item) => item.kind === "access").length !== 1) {
    throw new Error("Choose exactly one access term.");
  }
  if (!allowAddons && items.some((item) => item.kind === "addon")) {
    throw new Error("Add-ons are not available yet.");
  }
  if (items.some((item, index) => items.findIndex((other) => other.sku === item.sku) !== index)) {
    throw new Error("Duplicate checkout item.");
  }
  if (items.some((item) => item.sku === "personal_nutrition_plan") &&
      items.some((item) => item.sku === "meal_plan_collection")) {
    throw new Error("Choose only one nutrition add-on.");
  }

  return items;
}
