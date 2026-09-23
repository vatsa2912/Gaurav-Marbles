"use client";

import { useEffect, useState, useMemo, use } from "react";
import Link from "next/link";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normaliseLots, type StockLot } from "@/lib/stockLots";
import {
  formatDisplayDate,
  extractTransactionDate,
  compareDatesDesc,
  compareDatesAsc,
} from "@/lib/dateUtils";

type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  quantity?: number;
  minimumStock?: number;
  gstRate?: number;
  size?: string;
  piecesPerBox?: number;
  marbleType?: string;
  marbleCutSize?: string;
  marblePieces?: number | string;
  lotNumber?: string;
  granitePieces?: number | string;
  graniteLotNumber?: string;
  estimatedStock?: number;
  estimatedStockSqft?: number;
  model?: string;
  material?: string;
  warranty?: string;
  weightVolume?: string;
  packType?: string;
  stockLots?: StockLot[];
};

type PurchaseHistoryItem = {
  id: string;
  purchaseNumber: number | string;
  purchaseDate: string;
  supplierName: string;
  supplierInvoice?: string;
  lotNumber?: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice?: number;
  total: number;
  unit: string;
  paymentMethod?: string;
};

type SaleHistoryItem = {
  id: string;
  saleNumber: number | string;
  invoiceNumber?: string;
  saleDate: string;
  customerName: string;
  quantity: number;
  rate: number;
  total: number;
  unit: string;
  paymentMethod?: string;
};

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryItem[]>([]);
  const [saleHistory, setSaleHistory] = useState<SaleHistoryItem[]>([]);
  const [purchaseSort, setPurchaseSort] = useState<"newest" | "oldest">("newest");
  const [saleSort, setSaleSort] = useState<"newest" | "oldest">("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        // 1. Fetch Product
        const prodSnap = await getDoc(doc(db, "products", id));
        if (!prodSnap.exists()) {
          if (isMounted) setError("Product not found.");
          return;
        }

        const prodData = { id: prodSnap.id, ...prodSnap.data() } as Product;
        if (isMounted) setProduct(prodData);

        // 2. Fetch Purchases containing this product
        const purchasesSnap = await getDocs(collection(db, "purchases"));
        const pHistory: PurchaseHistoryItem[] = [];

        purchasesSnap.docs.forEach((d) => {
          const data = d.data();
          const effectiveDate = extractTransactionDate(data, "purchaseDate");
          type PItem = {
            productId?: string;
            quantity?: number;
            purchasePrice?: number;
            sellingPrice?: number;
            total?: number;
            unit?: string;
            lotNumber?: string;
          };
          const items = (data.items || []) as PItem[];
          items.forEach((it) => {
            if (it.productId === id) {
              pHistory.push({
                id: d.id,
                purchaseNumber: data.purchaseNumber ?? d.id,
                purchaseDate: effectiveDate,
                supplierName: data.supplierName ?? "Unknown Supplier",
                supplierInvoice: data.supplierInvoice || data.invoiceNumber || "",
                lotNumber: it.lotNumber || data.lotNumber || "",
                quantity: Number(it.quantity) || 0,
                purchasePrice: Number(it.purchasePrice) || 0,
                sellingPrice:
                  it.sellingPrice !== undefined && it.sellingPrice !== null
                    ? Number(it.sellingPrice)
                    : undefined,
                total: Number(it.total) || Number(it.quantity) * Number(it.purchasePrice),
                unit: it.unit || prodData.unit || "unit",
                paymentMethod: data.paymentMethod || "—",
              });
            }
          });
        });
        if (isMounted) setPurchaseHistory(pHistory);

        // 3. Fetch Sales containing this product
        const salesSnap = await getDocs(collection(db, "sales"));
        const sHistory: SaleHistoryItem[] = [];

        salesSnap.docs.forEach((d) => {
          const data = d.data();
          const effectiveDate = extractTransactionDate(data, "saleDate");
          type SItem = {
            productId?: string;
            quantity?: number;
            rate?: number;
            sellingPrice?: number;
            total?: number;
            unit?: string;
          };
          const items = (data.items || []) as SItem[];
          items.forEach((it) => {
            if (it.productId === id) {
              const qty = Number(it.quantity) || 0;
              const total = Number(it.total) || 0;
              const rate = Number(it.rate ?? it.sellingPrice) || (qty > 0 ? total / qty : 0);
              sHistory.push({
                id: d.id,
                saleNumber: data.saleNumber ?? d.id,
                invoiceNumber:
                  data.invoiceNumber ??
                  (data.saleNumber ? `INV-${data.saleNumber}` : `INV-${d.id.slice(0, 6)}`),
                saleDate: effectiveDate,
                customerName: data.customerName ?? "Cash Sale",
                quantity: qty,
                rate: rate,
                total: total,
                unit: it.unit || prodData.unit || "unit",
                paymentMethod: data.paymentMethod || "—",
              });
            }
          });
        });
        if (isMounted) setSaleHistory(sHistory);
      } catch (err) {
        console.error("Error loading product detail:", err);
        if (isMounted) setError("Failed to load product details.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="page-main">
        <div className="page-content">
          <div className="card text-center py-12">
            <p className="text-muted">Loading product details...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="page-main">
        <div className="page-content">
          <div className="card text-center py-12">
            <p className="text-error font-medium">{error || "Product not found"}</p>
            <Link href="/dashboard/products" className="btn-secondary mt-4 inline-block">
              ← Back to Products
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const effectiveStock = Number(product.stock ?? product.quantity ?? 0);
  const lots = normaliseLots({
    stock: effectiveStock,
    purchasePrice: product.purchasePrice,
    stockLots: product.stockLots,
  });

  const totalLotValuation = lots.reduce(
    (sum, lot) => sum + lot.quantity * lot.purchasePrice,
    0
  );
  const weightedAvgCost = effectiveStock > 0 ? totalLotValuation / effectiveStock : product.purchasePrice;

  const sortedPurchases = useMemo(() => {
    return [...purchaseHistory].sort((a, b) =>
      purchaseSort === "newest"
        ? compareDatesDesc(a.purchaseDate, b.purchaseDate)
        : compareDatesAsc(a.purchaseDate, b.purchaseDate)
    );
  }, [purchaseHistory, purchaseSort]);

  const sortedSales = useMemo(() => {
    return [...saleHistory].sort((a, b) =>
      saleSort === "newest"
        ? compareDatesDesc(a.saleDate, b.saleDate)
        : compareDatesAsc(a.saleDate, b.saleDate)
    );
  }, [saleHistory, saleSort]);

  const minStock = Number(product.minimumStock) || 0;
  const isOutOfStock = effectiveStock <= 0;
  const isLowStock = !isOutOfStock && effectiveStock <= minStock;

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">Gaurav Marbles</h1>
        <p className="text-muted">Product Details &amp; History</p>
      </header>

      <div className="page-content space-y-6">
        {/* Navigation & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/products"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm"
            >
              ← All Products
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {product.name}
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {product.category}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/purchases/add?productId=${product.id}`}
              className="btn-primary inline-flex items-center gap-1.5"
            >
              + Add Purchase
            </Link>
            <Link
              href={`/dashboard/products/edit/${product.id}`}
              className="btn-secondary inline-flex items-center gap-1.5"
            >
              Edit Product
            </Link>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5">
            <span className="text-xs uppercase tracking-wider text-muted font-semibold">
              Current Stock
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-gray-900">
                {effectiveStock.toLocaleString("en-IN")} {product.unit}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  isOutOfStock
                    ? "bg-red-100 text-red-700"
                    : isLowStock
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {isOutOfStock ? "Out of Stock" : isLowStock ? "Low Stock" : "In Stock"}
              </span>
            </div>
            {minStock > 0 && (
              <p className="text-xs text-muted mt-1">Min threshold: {minStock} {product.unit}</p>
            )}
          </div>

          <div className="card p-5">
            <span className="text-xs uppercase tracking-wider text-muted font-semibold">
              Selling Price
            </span>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              ₹{Number(product.sellingPrice).toLocaleString("en-IN")}
              <span className="text-xs text-muted font-normal ml-1">/ {product.unit}</span>
            </div>
            {product.gstRate !== undefined && (
              <p className="text-xs text-muted mt-1">GST Rate: {product.gstRate}%</p>
            )}
          </div>

          <div className="card p-5">
            <span className="text-xs uppercase tracking-wider text-muted font-semibold">
              Latest Purchase Price
            </span>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              ₹{Number(product.purchasePrice).toLocaleString("en-IN")}
              <span className="text-xs text-muted font-normal ml-1">/ {product.unit}</span>
            </div>
            <p className="text-xs text-muted mt-1">
              Weighted Avg Cost: ₹{weightedAvgCost.toFixed(2)}
            </p>
          </div>

          <div className="card p-5">
            <span className="text-xs uppercase tracking-wider text-muted font-semibold">
              Stock Valuation (FIFO)
            </span>
            <div className="mt-2 text-2xl font-bold text-emerald-700">
              ₹{Math.round(totalLotValuation).toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-muted mt-1">
              Across {lots.length} active lot{lots.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {/* Product Specifications & Details Card */}
        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">
            Specifications &amp; Attributes
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted block text-xs">Category</span>
              <span className="font-medium text-gray-800">{product.category}</span>
            </div>
            <div>
              <span className="text-muted block text-xs">Unit</span>
              <span className="font-medium text-gray-800">{product.unit}</span>
            </div>

            {/* Category-specific specifications */}
            {product.category === "Tiles" && (
              <>
                <div>
                  <span className="text-muted block text-xs">Tile Size</span>
                  <span className="font-medium text-gray-800">{product.size || "—"}</span>
                </div>
                <div>
                  <span className="text-muted block text-xs">Pieces per Box</span>
                  <span className="font-medium text-gray-800">
                    {product.piecesPerBox ? `${product.piecesPerBox} pcs` : "—"}
                  </span>
                </div>
              </>
            )}

            {product.category === "Marble" && (
              <>
                <div>
                  <span className="text-muted block text-xs">Marble Type</span>
                  <span className="font-medium text-gray-800">
                    {product.marbleType || "Slabs"}
                  </span>
                </div>
                {product.marbleType === "Cut Size" ? (
                  <div>
                    <span className="text-muted block text-xs">Cut Size</span>
                    <span className="font-medium text-gray-800">
                      {product.marbleCutSize || product.size || "—"}
                    </span>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="text-muted block text-xs">Lot Number</span>
                      <span className="font-medium text-gray-800">
                        {product.lotNumber || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-xs">Estimated Stock</span>
                      <span className="font-medium text-gray-800">
                        {product.estimatedStock || product.estimatedStockSqft
                          ? `${product.estimatedStock || product.estimatedStockSqft} sqft`
                          : "—"}
                      </span>
                    </div>
                  </>
                )}
                {product.marblePieces && (
                  <div>
                    <span className="text-muted block text-xs">Total Pieces</span>
                    <span className="font-medium text-gray-800">{product.marblePieces}</span>
                  </div>
                )}
              </>
            )}

            {product.category === "Granite" && (
              <>
                <div>
                  <span className="text-muted block text-xs">Lot Number</span>
                  <span className="font-medium text-gray-800">
                    {product.graniteLotNumber || product.lotNumber || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted block text-xs">Total Pieces</span>
                  <span className="font-medium text-gray-800">
                    {product.granitePieces || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted block text-xs">Estimated Stock</span>
                  <span className="font-medium text-gray-800">
                    {product.estimatedStock || product.estimatedStockSqft
                      ? `${product.estimatedStock || product.estimatedStockSqft} sqft`
                      : "—"}
                  </span>
                </div>
              </>
            )}

            {["Sanitary", "Taps", "Wash Basin", "Sink"].includes(product.category) && (
              <>
                {product.model && (
                  <div>
                    <span className="text-muted block text-xs">Model</span>
                    <span className="font-medium text-gray-800">{product.model}</span>
                  </div>
                )}
                {product.material && (
                  <div>
                    <span className="text-muted block text-xs">Material</span>
                    <span className="font-medium text-gray-800">{product.material}</span>
                  </div>
                )}
                {product.warranty && (
                  <div>
                    <span className="text-muted block text-xs">Warranty</span>
                    <span className="font-medium text-gray-800">{product.warranty}</span>
                  </div>
                )}
              </>
            )}

            {["Chemicals", "Adhesives"].includes(product.category) && (
              <>
                {product.weightVolume && (
                  <div>
                    <span className="text-muted block text-xs">Weight / Volume</span>
                    <span className="font-medium text-gray-800">{product.weightVolume}</span>
                  </div>
                )}
                {product.packType && (
                  <div>
                    <span className="text-muted block text-xs">Packaging</span>
                    <span className="font-medium text-gray-800">{product.packType}</span>
                  </div>
                )}
              </>
            )}

            <div>
              <span className="text-muted block text-xs">Minimum Stock Alert</span>
              <span className="font-medium text-gray-800">
                {product.minimumStock ? `${product.minimumStock} ${product.unit}` : "Not set"}
              </span>
            </div>
            <div>
              <span className="text-muted block text-xs">GST Rate</span>
              <span className="font-medium text-gray-800">
                {product.gstRate !== undefined ? `${product.gstRate}%` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Active Stock Lots Card */}
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-gray-100 gap-2 mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Active Stock Lots (FIFO Valuation)
              </h3>
              <p className="text-muted text-xs mt-0.5">
                Breakdown of current physical inventory by purchase price tier
              </p>
            </div>
            <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2.5 py-1 rounded border border-gray-200">
              {lots.length} Active Lot{lots.length === 1 ? "" : "s"}
            </span>
          </div>

          {lots.length === 0 ? (
            <p className="text-muted text-sm py-4 text-center">
              No active stock lots. Product is currently out of stock.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left font-medium">Lot ID</th>
                    <th className="text-left font-medium">Purchased Date</th>
                    <th className="text-right font-medium">Purchase Price</th>
                    <th className="text-right font-medium">Remaining Qty</th>
                    <th className="text-right font-medium">Lot Valuation</th>
                    <th className="text-right font-medium">Share of Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {lots.map((lot, idx) => {
                    const lotVal = lot.quantity * lot.purchasePrice;
                    const share = effectiveStock > 0 ? (lot.quantity / effectiveStock) * 100 : 0;
                    return (
                      <tr key={lot.lotId || idx}>
                        <td className="font-mono text-xs text-gray-600">
                          {lot.lotId ? lot.lotId.slice(0, 14) : `Lot #${idx + 1}`}
                        </td>
                        <td>
                          {lot.purchasedAt ? formatDisplayDate(lot.purchasedAt) : "Opening Stock"}
                        </td>
                        <td className="text-right font-medium">
                          ₹{Number(lot.purchasePrice).toLocaleString("en-IN")}
                        </td>
                        <td className="text-right font-semibold">
                          {Number(lot.quantity).toLocaleString("en-IN")} {product.unit}
                        </td>
                        <td className="text-right font-semibold text-emerald-700">
                          ₹{Math.round(lotVal).toLocaleString("en-IN")}
                        </td>
                        <td className="text-right text-gray-500 text-xs">
                          {share.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200">
                    <td colSpan={3} className="text-left py-2.5">Total</td>
                    <td className="text-right py-2.5">
                      {effectiveStock.toLocaleString("en-IN")} {product.unit}
                    </td>
                    <td className="text-right py-2.5 text-emerald-700">
                      ₹{Math.round(totalLotValuation).toLocaleString("en-IN")}
                    </td>
                    <td className="text-right py-2.5 text-gray-500">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Purchase History */}
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 mb-4 gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Purchase History</h3>
              <p className="text-muted text-xs mt-0.5">
                Past purchases received for this product
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <label htmlFor="purchaseSortSelect" className="font-medium">Sort:</label>
                <select
                  id="purchaseSortSelect"
                  value={purchaseSort}
                  onChange={(e) => setPurchaseSort(e.target.value as "newest" | "oldest")}
                  className="font-medium border border-gray-300 rounded px-2 py-1 bg-white text-xs"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>
              <Link
                href={`/dashboard/purchases/add?productId=${product.id}`}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                + Add Purchase
              </Link>
            </div>
          </div>

          {sortedPurchases.length === 0 ? (
            <p className="text-muted text-sm py-4 text-center">
              No purchase orders found for this product.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left font-medium">Date</th>
                    <th className="text-left font-medium">Supplier</th>
                    <th className="text-right font-medium">Quantity</th>
                    <th className="text-right font-medium">Purchase Price</th>
                    <th className="text-right font-medium">Selling Price</th>
                    <th className="text-left font-medium">Invoice</th>
                    <th className="text-left font-medium">Lot Number</th>
                    <th className="text-center font-medium">Payment Method</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPurchases.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDisplayDate(item.purchaseDate)}</td>
                      <td className="font-medium text-gray-800">{item.supplierName}</td>
                      <td className="text-right font-semibold">
                        {item.quantity.toLocaleString("en-IN")} {item.unit}
                      </td>
                      <td className="text-right">
                        ₹{item.purchasePrice.toLocaleString("en-IN")}
                      </td>
                      <td className="text-right font-medium text-emerald-700">
                        {item.sellingPrice ? `₹${item.sellingPrice.toLocaleString("en-IN")}` : "—"}
                      </td>
                      <td className="text-gray-600 text-xs font-mono">
                        {item.supplierInvoice || `#${item.purchaseNumber}` || "—"}
                      </td>
                      <td className="text-gray-600 text-xs font-mono">
                        {item.lotNumber || "—"}
                      </td>
                      <td className="text-center">
                        <span className="badge-gray text-xs">{item.paymentMethod || "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sales History */}
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 mb-4 gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Sales History</h3>
              <p className="text-muted text-xs mt-0.5">
                Past customer sales containing this product
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <label htmlFor="saleSortSelect" className="font-medium">Sort:</label>
              <select
                id="saleSortSelect"
                value={saleSort}
                onChange={(e) => setSaleSort(e.target.value as "newest" | "oldest")}
                className="font-medium border border-gray-300 rounded px-2 py-1 bg-white text-xs"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>

          {sortedSales.length === 0 ? (
            <p className="text-muted text-sm py-4 text-center">
              No sales recorded for this product yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left font-medium">Date</th>
                    <th className="text-left font-medium">Invoice</th>
                    <th className="text-left font-medium">Customer</th>
                    <th className="text-right font-medium">Quantity</th>
                    <th className="text-right font-medium">Selling Price</th>
                    <th className="text-right font-medium">Amount</th>
                    <th className="text-center font-medium">Payment Method</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSales.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDisplayDate(item.saleDate)}</td>
                      <td className="font-mono text-xs font-semibold text-blue-600">
                        {item.invoiceNumber || `#${item.saleNumber}`}
                      </td>
                      <td className="font-medium text-gray-800">{item.customerName}</td>
                      <td className="text-right font-semibold">
                        {item.quantity.toLocaleString("en-IN")} {item.unit}
                      </td>
                      <td className="text-right">
                        ₹{Number(item.rate).toLocaleString("en-IN")}
                      </td>
                      <td className="text-right font-semibold">
                        ₹{Math.round(item.total).toLocaleString("en-IN")}
                      </td>
                      <td className="text-center">
                        <span className="badge-gray text-xs">{item.paymentMethod || "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
