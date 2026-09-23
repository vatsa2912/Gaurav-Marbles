# Gaurav Marbles — System Architecture & Maintenance Guide

## 1. Executive Summary

**Gaurav Marbles** is a specialized retail and wholesale inventory, point-of-sale, and business management application built with **Next.js 16 (Turbopack)**, **React 19**, **TypeScript**, and **Google Cloud Firestore**.

This system manages stone inventory (marble slabs, granite, tiles) using a strict **First-In, First-Out (FIFO) stock-lot engine**, atomic transaction processing for sales and purchases, customer balance reconciliation, and expense tracking.

---

## 2. Technology Stack & System Architecture

| Layer | Technology | Key Responsibility |
|---|---|---|
| **Framework** | Next.js 16.3.3 (App Router) | Static and dynamic routing, SSR/Client hydration |
| **UI Runtime** | React 19.2.8 | Modern React architecture, concurrent rendering |
| **Styling** | Tailwind CSS 4.x + Custom CSS | Responsive layout and high-contrast print sheets |
| **Database** | Google Cloud Firestore (v12) | NoSQL document storage, ACID transactions |
| **Authentication** | Firebase Authentication | Email/Password auth with client-side layout guard |
| **Scripting / CLI** | Node.js v22 + TSX | Standalone dry-run audits and integrity verification |

### Directory Structure

```
marble-shop/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx             # Auth guard, global navigation, user profile
│   │   ├── page.tsx               # Analytics dashboard (KPIs, profit, stock, alerts)
│   │   ├── products/              # Inventory catalog (list, add, edit with lot breakdown)
│   │   ├── purchases/             # Supplier purchases (FIFO lot creation, reversal check)
│   │   ├── sales/                 # Customer sales (FIFO deduction, atomic transaction)
│   │   ├── customers/             # Customer directory, sales history, balance reconciliation
│   │   └── expenses/              # Operating expenses with strict numeric validation
│   └── login/                     # Secure authentication portal
├── lib/
│   ├── firebase.ts                # Firebase app & Firestore initialization
│   ├── stockLots.ts               # Core FIFO inventory engine & lot algorithms
│   ├── customerBalance.ts         # Customer balance & payment reconciliation engine
│   └── dateUtils.ts               # Timezone-safe date formatting and filtering
├── scripts/
│   └── dry_run_audit.mjs          # 100% read-only database integrity audit script
└── MAINTENANCE_GUIDE.md           # This document
```

---

## 3. Data Models & Firestore Schemas

### 3.1 `products` Collection
Stores product metadata and its inventory broken down into physical batches (`stockLots`).

```typescript
interface ProductDocument {
  id: string;                      // Auto-generated Firestore document ID
  name: string;                    // Product name (e.g. "Italian White Statuario")
  description?: string;            // Dimensions, quarry origin, or quality grade
  unit: "box" | "sqft" | "piece";  // Unit of measure
  stock: number;                   // Total available stock (must equal sum of stockLots)
  minimumStock: number;            // Alert threshold for low-stock warnings
  purchasePrice: number;           // Default catalog purchase price (for estimates)
  sellingPrice: number;            // Standard selling price per unit
  stockLots: StockLot[];           // Active physical lots remaining in warehouse
  createdAt: Timestamp;            // Server timestamp
}

interface StockLot {
  lotId: string;                   // Deterministic or UUID lot identifier
  quantity: number;                // Units available in this specific purchase lot
  purchasePrice: number;           // Actual cost price per unit paid for this lot
  purchasedAt: string;             // Purchase date (YYYY-MM-DD)
}
```

### 3.2 `sales` Collection
Records customer invoices and immutable historical cost allocations.

```typescript
interface SaleDocument {
  id: string;                      // Document ID
  saleNumber: number;              // Monotonically increasing invoice number
  saleDate: string;                // Date of invoice (YYYY-MM-DD)
  customerId?: string;             // Optional reference to customer document
  customerName: string;            // Customer or walk-in buyer name
  customerPhone?: string;          // Contact number
  items: SaleItem[];               // Line items sold
  subtotal: number;                // Sum of line item totals
  tax: number;                     // Applied tax in currency
  discount: number;                // Applied discount in currency
  totalAmount: number;             // Final invoice amount (subtotal + tax - discount)
  receivedAmount?: number;         // Amount collected at time of sale
  dueDate?: string;                // Payment due date (YYYY-MM-DD)
  notes?: string;                  // Transport / billing notes
  createdAt: Timestamp;            // Transaction creation timestamp
}

interface SaleItem {
  productId: string;               // Reference to products document
  productName: string;             // Name at time of sale
  quantity: number;                // Units sold
  unit: string;                    // Unit of measure
  sellingPrice: number;            // Unit selling price charged
  costPrice: number;               // Weighted average purchase cost for this sale
  costTotal: number;               // Total COGS for this line item (sum of allocation costs)
  costAllocations: CostAllocation[]; // Audit trail of exact lots consumed
  total: number;                   // Line item total (quantity * sellingPrice)
}

interface CostAllocation {
  lotId: string;                   // ID of lot consumed
  quantity: number;                // Units taken from this lot
  purchasePrice: number;           // Cost per unit of this lot
  purchasedAt: string;             // Original purchase date of this lot
}
```

### 3.3 `purchases` Collection
Records incoming stock batches from quarries and suppliers.

```typescript
interface PurchaseDocument {
  id: string;
  purchaseNumber: number;          // Monotonically increasing purchase number
  purchaseDate: string;            // Purchase date (YYYY-MM-DD)
  supplierName: string;            // Quarry or supplier firm name
  supplierInvoice?: string;        // Supplier's external invoice reference
  items: PurchaseItem[];           // Goods received
  totalAmount: number;             // Total cost paid to supplier
  notes?: string;
  createdAt: Timestamp;
}

interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  total: number;
  lotId?: string;                  // Lot ID created in product's stockLots array
}
```

### 3.4 `customers` Collection
Maintains customer profiles. Financial balances are calculated dynamically from `sales`.

```typescript
interface CustomerDocument {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: Timestamp;
}
```

### 3.5 `expenses` Collection
Records operational overhead expenses (rent, electricity, labour, transport).

```typescript
interface ExpenseDocument {
  id: string;
  title: string;                   // Short description of expense
  category: string;                // "Rent" | "Electricity" | "Transport" | "Labour" | ...
  amount: number;                  // Strictly positive, finite number
  expenseDate: string;             // Expense date (YYYY-MM-DD)
  notes?: string;
  createdAt: Timestamp;
}
```

### 3.6 `counters` Collection
Guarantees sequential, collision-free invoice numbering across concurrent users.
- `counters/sales`: `{ current: number }`
- `counters/purchases`: `{ current: number }`

---

## 4. The FIFO Stock-Lot Engine (`lib/stockLots.ts`)

### 4.1 Normalization (`normaliseLots`)
To guarantee backward compatibility with legacy products that only had a single `stock` number:
- If `stockLots` array exists and contains items, it filters valid lots and sorts them chronologically (`purchasedAt` ascending).
- If `stockLots` is empty but aggregate `stock > 0`, it produces a deterministic legacy lot with `lotId = "legacy_<productId>"`, `quantity = stock`, and `purchasedAt = "2000-01-01"`.
- If a tie occurs (multiple lots with identical dates), it breaks the tie using `lotId.localeCompare()`, preventing unstable reordering across renders.

### 4.2 Deducting Stock via FIFO (`allocateFifo`)
When a sale occurs:
1. Active lots are sorted chronologically (oldest purchase first).
2. The requested quantity is drawn from the oldest available lot(s).
3. If a lot is partially consumed, its remaining quantity is updated.
4. If a lot is completely consumed, it is removed from the active lots array.
5. The exact cost per lot and the original `purchasedAt` date are recorded in `costAllocations`.
6. Total cost of goods sold (`costTotal`) is returned:
   $$\text{costTotal} = \sum (\text{allocation.quantity} \times \text{allocation.purchasePrice})$$

### 4.3 Restoring Stock on Sale Deletion or Edit (`restoreFromAllocations`)
When a sale is deleted or edited:
1. `restoreFromAllocations()` takes the saved `costAllocations` and restores the inventory units into the product's `stockLots`.
2. Crucially, the **original `purchasedAt` date is preserved**. Units do NOT get stamped with today's date, ensuring they return to their rightful place at the front of the FIFO queue.

### 4.4 Purchase Reversal Protection (`checkPurchaseCanBeReversed`)
A major audit finding (GM-003) revealed that deleting a purchase could deduct stock from unrelated lots if units had already been sold.
The engine now enforces:
$$\text{unitsSold} = \text{originalPurchaseQty} - \text{currentLotRemainingQty}$$
If $\text{unitsSold} > 0$, the system **strictly blocks** deleting or editing the purchase, displaying:
> *"Cannot delete or modify purchase for '<Product>': X unit(s) from this purchase have already been sold in customer sales."*

---

## 5. Atomic Sales Workflows & Data Integrity

### 5.1 Atomic Firestore Transaction (`sales/add/page.tsx`)
Sales creation uses `runTransaction(db, async (transaction) => { ... })`:
1. **Reads first**: Reads `counters/sales` and all product documents involved in the sale.
2. **Pre-validation**: Verifies every product has sufficient aggregate and lot stock. If any product is short, the transaction aborts cleanly before any document is written.
3. **Double-Submission Lock**: Guarded by `isSubmittingRef.current` to prevent rapid double-clicks from double-deducting stock or generating duplicate invoices.
4. **Writes**:
   - Updates `counters/sales` (`current = current + 1`).
   - Writes updated `stockLots` and `stock = totalStock(stockLots)` to each product document.
   - Writes the new invoice to `sales`.

### 5.2 Product Deletion Safeguards (GM-008)
Before deleting any product from `products/page.tsx`:
- Queries `sales` where `items.productId == id`.
- Queries `purchases` where `items.productId == id`.
- If any sales or purchase history exists, deletion is blocked with a descriptive dialog citing the specific invoice number.

---

## 6. Financial Reporting & Customer Balances

### 6.1 Accurate Profit Calculation (GM-005)
Historical sales profit must **never** fluctuate when catalog prices change.
Dashboard profit calculation:
$$\text{Revenue} = \sum \text{sale.totalAmount}$$
$$\text{COGS} = \sum_{\text{items}} (\text{item.costTotal} \parallel (\text{item.quantity} \times \text{item.costPrice}))$$
$$\text{Gross Profit} = \text{Revenue} - \text{COGS}$$
$$\text{Net Estimated Profit} = \text{Gross Profit} - \text{Total Expenses}$$

### 6.2 Customer Account Reconciliation (`lib/customerBalance.ts`)
Customer balances are computed dynamically from actual invoices:
$$\text{Total Invoiced} = \sum \text{sale.totalAmount}$$
$$\text{Total Received} = \sum \text{sale.receivedAmount}$$
$$\text{Net Balance} = \text{Total Invoiced} - \text{Total Received}$$
- If $\text{Net Balance} > 0$, it represents **Outstanding Balance** (receivable).
- If $\text{Net Balance} < 0$, it represents **Credit Balance** (customer advance / overpayment).
- **Payment Statuses**:
  - `paid`: `receivedAmount >= totalAmount`
  - `partial`: `0 < receivedAmount < totalAmount`
  - `unpaid`: `receivedAmount == 0`
  - `overdue`: `dueDate < today` and `receivedAmount < totalAmount`

---

## 7. Date, Timezone, and Input Standards

### 7.1 Timezone-Safe Dates (`lib/dateUtils.ts`)
To avoid UTC day shifts (e.g., parsing `"2026-03-15"` shifting to `"14/03/2026"` in timezones behind UTC):
- Dates are stored strictly in `YYYY-MM-DD` ISO date string format.
- `formatDisplayDate(str)` splits date string components directly, outputting `DD/MM/YYYY` without UTC offset distortion.
- `matchesDateFilter(target, filter)` supports exact `YYYY-MM-DD` and `YYYY-MM` month prefix filtering.
- `compareDatesDesc(a, b)` provides null-safe, newest-first sorting.

### 7.2 Expense Input Validation (GM-010)
All expense creation and editing forms enforce:
- Non-empty, non-whitespace title.
- Valid date (`YYYY-MM-DD`).
- Amount validation: `!amount.trim() || isNaN(numericAmount) || !Number.isFinite(numericAmount) || numericAmount <= 0` triggers validation rejection.

---

## 8. Dry-Run Audit Utility (`scripts/dry_run_audit.mjs`)

The codebase includes a **100% read-only diagnostic tool** that scans all database records without writing or mutating data.

### How to Run:
```bash
# 1. Authenticated mode (recommended for cloud database):
node scripts/dry_run_audit.mjs --email admin@gauravmarbles.com --password yourpassword

# 2. Offline / backup dump mode:
node scripts/dry_run_audit.mjs --file ./backup.json
```

### Audit Checks Performed:
1. **Products**: Checks for negative stock, missing lot arrays, corrupted lot IDs, and desynchronizations between `product.stock` and $\sum \text{stockLots}$.
2. **Purchases**: Checks for missing dates, line items with invalid prices/quantities, and orphaned product references.
3. **Sales**: Validates invoice numbers, dates, orphaned products, and verifies that `costAllocations` match item quantities.
4. **Customers**: Compares cached customer balances against actual sales history.
5. **Expenses**: Detects NaN, zero, or negative expense entries.

---

## 9. Backup, Disaster Recovery & Best Practices

1. **Scheduled Firestore Exports**:
   Set up automated Google Cloud Storage backups using Cloud Firestore export:
   ```bash
   gcloud firestore export gs://gaurav-marbles-backups/$(date +%Y%m%d)
   ```
2. **Safe Code Updates**:
   Before deploying changes to production, always run the automated test suite:
   ```bash
   npm run lint
   npm run build
   npx tsx scratch/verify_phase_1.ts
   npx tsx scratch/verify_phase_2.ts
   npx tsx scratch/verify_phase_3.ts
   ```
3. **Firestore Security Rules**:
   Ensure `firestore.rules` requires `request.auth != null` for all operational collections, and blocks writing negative `stock` or negative `amount`.

---

## 10. Known Limitations & Roadmap

1. **Firestore Transaction Limit**: A single transaction can read/write up to 500 documents. Sales orders with more than 100 distinct products should be processed in smaller batches.
2. **Multi-Location Warehousing**: The current schema models a single central stock location. Multi-godown tracking can be introduced by adding a `godownId` property to `StockLot`.
