/**
 * lib/stockLots.ts
 * Shared types and pure helpers for FIFO stock-lot management.
 * No Firebase imports here — these are pure data transforms used
 * inside Firestore transactions.
 */

// ─── Core types ──────────────────────────────────────────────────────────────

/** A single price-based stock batch stored on a product document. */
export type StockLot = {
  lotId: string;
  purchasePrice: number;
  quantity: number;
  remainingQuantity?: number;
  originalQuantity?: number;
  /** ISO date string of the purchase that created this lot (for FIFO ordering). */
  purchasedAt: string;
  supplierName?: string;
  invoiceNumber?: string;
  lotNumber?: string;
};

/** Per-item FIFO allocation saved on a sale item. */
export type CostAllocation = {
  lotId: string;
  purchasePrice: number;
  quantity: number;
  totalCost: number;
  /** Preserved purchase date of the source lot (prevents FIFO date corruption on edit/delete). */
  purchasedAt: string;
};

/** A sale item as stored in Firestore. */
export type SavedSaleItem = {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  sellingPrice: number;
  /** Weighted-average cost per unit, derived from costAllocations. */
  costPrice: number;
  /** Total cost = sum of costAllocations[].totalCost */
  costTotal: number;
  total: number;
  costAllocations?: CostAllocation[];
};

/** A purchase item as stored in Firestore. */
export type SavedPurchaseItem = {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  total: number;
  /** The lotId that was created / updated by this purchase item. */
  lotId?: string;
  /** ISO date string used to order FIFO. */
  purchasedAt?: string;
};

// ─── Lot helpers ─────────────────────────────────────────────────────────────

/**
 * Generate a simple unique lot ID.
 * Uses a timestamp + random suffix — no external lib needed.
 */
export function generateLotId(): string {
  return `lot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Given raw product data from Firestore, return the canonical stockLots array.
 * Backward-compatibility: if the product has no stockLots, synthesise one lot
 * from the existing stock + purchasePrice fields with a deterministic legacy ID.
 */
export function normaliseLots(productData: {
  id?: string;
  stock?: number | string;
  purchasePrice?: number | string;
  stockLots?: StockLot[];
}): StockLot[] {
  if (Array.isArray(productData.stockLots) && productData.stockLots.length > 0) {
    // Sort FIFO: oldest first, with stable lotId tie-breaker
    return [...productData.stockLots]
      .filter((lot) => lot && typeof lot.quantity === "number" && lot.quantity > 0)
      .map((lot) => ({
        ...lot,
        remainingQuantity: lot.remainingQuantity ?? lot.quantity,
      }))
      .sort((a, b) => {
        const cmp = (a.purchasedAt ?? "").localeCompare(b.purchasedAt ?? "");
        if (cmp !== 0) return cmp;
        return (a.lotId ?? "").localeCompare(b.lotId ?? "");
      });
  }

  // Legacy product — synthesise a single lot with deterministic lotId
  const qty = Number(productData.stock) || 0;
  if (qty <= 0) return [];

  const deterministicLotId = productData.id ? `legacy_${productData.id}` : "legacy_opening";
  return [
    {
      lotId: deterministicLotId,
      purchasePrice: Number(productData.purchasePrice) || 0,
      quantity: qty,
      remainingQuantity: qty,
      purchasedAt: "2000-01-01", // earliest date so legacy stock is consumed first
    },
  ];
}

/**
 * Add or merge a lot into the lots array.
 * If a lot with the same purchasePrice and purchasedAt date already exists,
 * merge quantities instead of creating a duplicate.
 * Returns the updated lots array AND the lotId used.
 */
export function addLot(
  lots: StockLot[],
  purchasePrice: number,
  quantity: number,
  purchasedAt: string,
  extra?: { supplierName?: string; invoiceNumber?: string; lotNumber?: string }
): { lots: StockLot[]; lotId: string } {
  // Try to find an existing lot for the same price on the same date
  const existing = lots.find(
    (l) => l.purchasePrice === purchasePrice && l.purchasedAt === purchasedAt && l.lotNumber === extra?.lotNumber
  );

  if (existing) {
    const updated = lots.map((l) =>
      l.lotId === existing.lotId
        ? {
            ...l,
            quantity: l.quantity + quantity,
            remainingQuantity: (l.remainingQuantity ?? l.quantity) + quantity,
          }
        : l
    );
    return { lots: updated, lotId: existing.lotId };
  }

  const lotId = generateLotId();
  return {
    lots: [
      ...lots,
      {
        lotId,
        purchasePrice,
        quantity,
        remainingQuantity: quantity,
        purchasedAt,
        ...(extra?.supplierName ? { supplierName: extra.supplierName } : {}),
        ...(extra?.invoiceNumber ? { invoiceNumber: extra.invoiceNumber } : {}),
        ...(extra?.lotNumber ? { lotNumber: extra.lotNumber } : {}),
      },
    ],
    lotId,
  };
}

/**
 * Remove quantity from a specific lot (used when reversing a purchase or
 * restoring a sale). Returns updated lots (lots with 0 quantity are removed).
 * Throws if the lot does not contain enough quantity.
 */
export function removeLotQuantity(
  lots: StockLot[],
  lotId: string,
  quantity: number
): StockLot[] {
  return lots
    .map((l) => {
      if (l.lotId !== lotId) return l;
      const remaining = l.quantity - quantity;
      if (remaining < 0) {
        throw new Error(
          `Lot ${lotId} only has ${l.quantity} units; cannot remove ${quantity}.`
        );
      }
      return { ...l, quantity: remaining };
    })
    .filter((l) => l.quantity > 0);
}

/**
 * Verify that a purchase item can be safely deleted or reduced.
 * Throws if any units from this purchase lot were already consumed in customer sales.
 */
export function checkPurchaseCanBeReversed(
  lots: StockLot[],
  lotId: string,
  quantityToReverse: number,
  productName: string
): void {
  const lot = lots.find((l) => l.lotId === lotId);
  const remaining = lot ? lot.quantity : 0;
  if (!lot || remaining < quantityToReverse) {
    const sold = quantityToReverse - remaining;
    throw new Error(
      `Cannot delete or modify purchase for "${productName}": ${sold} unit(s) from this purchase have already been sold in customer sales.`
    );
  }
}

/**
 * FIFO allocation: consume the oldest lots first.
 *
 * Returns:
 *  - allocations: the per-lot breakdown saved on the sale item (with lot purchasedAt preserved)
 *  - updatedLots: lots after deduction
 *  - costTotal: total purchase cost for this sale item
 *  - costPrice: weighted average cost per unit
 *
 * Throws if available stock is insufficient.
 */
export function allocateFifo(
  lots: StockLot[],
  quantityNeeded: number,
  productName: string
): {
  allocations: CostAllocation[];
  updatedLots: StockLot[];
  costTotal: number;
  costPrice: number;
} {
  const sorted = [...lots].sort((a, b) => {
    const cmp = (a.purchasedAt ?? "").localeCompare(b.purchasedAt ?? "");
    if (cmp !== 0) return cmp;
    return (a.lotId ?? "").localeCompare(b.lotId ?? "");
  });

  const totalAvailable = sorted.reduce((s, l) => s + l.quantity, 0);
  if (quantityNeeded > totalAvailable) {
    throw new Error(
      `Not enough stock for "${productName}". Available: ${totalAvailable}, requested: ${quantityNeeded}.`
    );
  }

  const allocations: CostAllocation[] = [];
  let remaining = quantityNeeded;
  const workingLots = sorted.map((l) => ({ ...l }));

  for (const lot of workingLots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.quantity, remaining);
    allocations.push({
      lotId: lot.lotId,
      purchasePrice: lot.purchasePrice,
      quantity: take,
      totalCost: take * lot.purchasePrice,
      purchasedAt: lot.purchasedAt, // preserve original lot's purchase date
    });
    lot.quantity -= take;
    remaining -= take;
  }

  // Rebuild lot list: update quantities, drop empties
  const lotMap = new Map(workingLots.map((l) => [l.lotId, l.quantity]));
  const updatedLots = lots
    .map((l) => {
      const q = lotMap.has(l.lotId) ? (lotMap.get(l.lotId) ?? l.quantity) : l.quantity;
      return {
        ...l,
        quantity: q,
        remainingQuantity: q,
      };
    })
    .filter((l) => l.quantity > 0);

  const costTotal = allocations.reduce((s, a) => s + a.totalCost, 0);
  const costPrice = quantityNeeded > 0 ? costTotal / quantityNeeded : 0;

  return { allocations, updatedLots, costTotal, costPrice };
}

/**
 * Restore lots from saved costAllocations (used on sale delete / sale edit reversal).
 * Each allocation was deducted from a specific lot; we add it back.
 * If the lot was fully consumed, we recreate it using the original preserved purchasedAt date.
 */
export function restoreFromAllocations(
  lots: StockLot[],
  allocations: CostAllocation[],
  fallbackPurchasedAt: string = "2000-01-01"
): StockLot[] {
  let result = [...lots];
  for (const alloc of allocations) {
    const idx = result.findIndex((l) => l.lotId === alloc.lotId);
    if (idx >= 0) {
      result = result.map((l, i) =>
        i === idx ? { ...l, quantity: l.quantity + alloc.quantity } : l
      );
    } else {
      // Lot was fully consumed and removed; recreate it using the allocation's preserved purchasedAt
      result.push({
        lotId: alloc.lotId,
        purchasePrice: alloc.purchasePrice,
        quantity: alloc.quantity,
        purchasedAt: alloc.purchasedAt || fallbackPurchasedAt,
      });
    }
  }
  // Keep FIFO sort stable
  return result.sort((a, b) => {
    const cmp = (a.purchasedAt ?? "").localeCompare(b.purchasedAt ?? "");
    if (cmp !== 0) return cmp;
    return (a.lotId ?? "").localeCompare(b.lotId ?? "");
  });
}

/** Sum all lot quantities to get total stock. */
export function totalStock(lots: StockLot[]): number {
  return lots.reduce((s, l) => s + l.quantity, 0);
}
