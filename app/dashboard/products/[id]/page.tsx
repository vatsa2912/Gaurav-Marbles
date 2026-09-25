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
import {
  ArrowLeft,
  Plus,
  Edit2,
  Package,
  Layers,
  IndianRupee,
  ShieldAlert,
  Calendar,
  Eye,
  TrendingUp,
} from "lucide-react";

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
        if (!id) {
          if (isMounted) setError("Product not found.");
          return;
        }
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

  // ALL Hooks must be called unconditionally above all early returns
  const sortedPurchases = useMemo(() => {
    return [...purchaseHistory].sort((a, b) => {
      const dateDiff =
        purchaseSort === "newest"
          ? compareDatesDesc(a.purchaseDate, b.purchaseDate)
          : compareDatesAsc(a.purchaseDate, b.purchaseDate);
      if (dateDiff !== 0) return dateDiff;
      const invA = String(a.supplierInvoice || a.purchaseNumber || a.id);
      const invB = String(b.supplierInvoice || b.purchaseNumber || b.id);
      return purchaseSort === "newest" ? invB.localeCompare(invA) : invA.localeCompare(invB);
    });
  }, [purchaseHistory, purchaseSort]);

  const sortedSales = useMemo(() => {
    return [...saleHistory].sort((a, b) => {
      const dateDiff =
        saleSort === "newest"
          ? compareDatesDesc(a.saleDate, b.saleDate)
          : compareDatesAsc(a.saleDate, b.saleDate);
      if (dateDiff !== 0) return dateDiff;
      const invA = String(a.invoiceNumber || a.saleNumber || a.id);
      const invB = String(b.invoiceNumber || b.saleNumber || b.id);
      return saleSort === "newest" ? invB.localeCompare(invA) : invA.localeCompare(invB);
    });
  }, [saleHistory, saleSort]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Loading product details...
        </p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Product Not Found</h2>
          <p className="text-xs text-slate-500 mt-1">{error || "The requested item could not be retrieved."}</p>
        </div>
        <Link
          href="/dashboard/products"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Products Catalog</span>
        </Link>
      </div>
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
  const weightedAvgCost =
    effectiveStock > 0 ? totalLotValuation / effectiveStock : product.purchasePrice;

  const minStock = Number(product.minimumStock) || 0;
  const isOutOfStock = effectiveStock <= 0;
  const isLowStock = !isOutOfStock && effectiveStock <= minStock;

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <Link
            href="/dashboard/products"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Products</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{product.name}</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {product.category}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/purchases/add?productId=${product.id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Purchase</span>
          </Link>

          <Link
            href={`/dashboard/products/edit/${product.id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition shadow-xs"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Product</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Stock */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Current Stock
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              {effectiveStock.toLocaleString("en-IN")}{" "}
              <span className="text-sm font-normal text-slate-500">{product.unit}</span>
            </span>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isOutOfStock
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : isLowStock
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {isOutOfStock ? "Out of Stock" : isLowStock ? "Low Stock" : "In Stock"}
            </span>
          </div>
          {minStock > 0 && (
            <p className="text-[11px] text-slate-400 mt-1">Min. threshold: {minStock} {product.unit}</p>
          )}
        </div>

        {/* Selling Price */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Selling Price
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            ₹{Number(product.sellingPrice).toLocaleString("en-IN")}
            <span className="text-xs text-slate-400 font-normal ml-1">/ {product.unit}</span>
          </div>
          {product.gstRate !== undefined && (
            <p className="text-[11px] text-slate-400 mt-1">Applicable GST: {product.gstRate}%</p>
          )}
        </div>

        {/* Latest Purchase Price */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Latest Purchase Price
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            ₹{Number(product.purchasePrice).toLocaleString("en-IN")}
            <span className="text-xs text-slate-400 font-normal ml-1">/ {product.unit}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Weighted Avg: ₹{weightedAvgCost.toFixed(2)}
          </p>
        </div>

        {/* FIFO Valuation */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Stock Valuation (FIFO)
          </span>
          <div className="mt-2 text-2xl font-bold text-emerald-700">
            ₹{Math.round(totalLotValuation).toLocaleString("en-IN")}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Across {lots.length} active lot{lots.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Specifications Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100">
          Master Specifications & Attributes
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Category</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">{product.category}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">Measurement Unit</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">{product.unit}</span>
          </div>

          {product.category === "Tiles" && (
            <>
              <div>
                <span className="text-slate-400 block text-[11px]">Tile Dimension / Size</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">{product.size || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Pieces Per Box</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
                  {product.piecesPerBox ? `${product.piecesPerBox} pcs` : "—"}
                </span>
              </div>
            </>
          )}

          {product.category === "Marble" && (
            <>
              <div>
                <span className="text-slate-400 block text-[11px]">Marble Form</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
                  {product.marbleType || "Slabs"}
                </span>
              </div>
              {product.marbleType === "Cut Size" ? (
                <div>
                  <span className="text-slate-400 block text-[11px]">Cut Size</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    {product.marbleCutSize || product.size || "—"}
                  </span>
                </div>
              ) : (
                <>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Lot Number</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">
                      {product.lotNumber || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Estimated Stock</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">
                      {product.estimatedStock || product.estimatedStockSqft
                        ? `${product.estimatedStock || product.estimatedStockSqft} sqft`
                        : "—"}
                    </span>
                  </div>
                </>
              )}
              {product.marblePieces && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Total Pieces</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">{product.marblePieces}</span>
                </div>
              )}
            </>
          )}

          {product.category === "Granite" && (
            <>
              <div>
                <span className="text-slate-400 block text-[11px]">Lot Number</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
                  {product.graniteLotNumber || product.lotNumber || "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Total Pieces</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
                  {product.granitePieces || "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Estimated Stock</span>
                <span className="font-semibold text-slate-800 mt-0.5 block">
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
                  <span className="text-slate-400 block text-[11px]">Model</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">{product.model}</span>
                </div>
              )}
              {product.material && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Material</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">{product.material}</span>
                </div>
              )}
              {product.warranty && (
                <div>
                  <span className="text-slate-400 block text-[11px]">Warranty</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">{product.warranty}</span>
                </div>
              )}
            </>
          )}

          <div>
            <span className="text-slate-400 block text-[11px]">Minimum Reorder Threshold</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">
              {product.minimumStock ? `${product.minimumStock} ${product.unit}` : "Not set"}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">GST Rate</span>
            <span className="font-semibold text-slate-800 mt-0.5 block">
              {product.gstRate !== undefined ? `${product.gstRate}%` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Active Stock Lots Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Active Stock Lots (FIFO Valuation)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Breakdown of current physical inventory by purchase price lot
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
            {lots.length} Active Lot{lots.length === 1 ? "" : "s"}
          </span>
        </div>

        {lots.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No active stock lots. Product is currently out of stock.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Lot ID</th>
                  <th className="py-2.5 px-3">Purchase Date</th>
                  <th className="py-2.5 px-3 text-right">Purchase Price</th>
                  <th className="py-2.5 px-3 text-right">Remaining Qty</th>
                  <th className="py-2.5 px-3 text-right">Lot Valuation</th>
                  <th className="py-2.5 px-3 text-right">Stock Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lots.map((lot, idx) => {
                  const lotVal = lot.quantity * lot.purchasePrice;
                  const share = effectiveStock > 0 ? (lot.quantity / effectiveStock) * 100 : 0;
                  return (
                    <tr key={lot.lotId || idx} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {lot.lotId ? lot.lotId.slice(0, 14) : `Lot #${idx + 1}`}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {lot.purchasedAt ? formatDisplayDate(lot.purchasedAt) : "Opening Stock"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                        ₹{Number(lot.purchasePrice).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {Number(lot.quantity).toLocaleString("en-IN")} {product.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                        ₹{Math.round(lotVal).toLocaleString("en-IN")}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {share.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-slate-900">
                  <td colSpan={3} className="py-3 px-3">Total Inventory</td>
                  <td className="py-3 px-3 text-right">
                    {effectiveStock.toLocaleString("en-IN")} {product.unit}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-700">
                    ₹{Math.round(totalLotValuation).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 px-3 text-right">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Purchase History Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-4 gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Purchase History
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical purchase shipments received for this product
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <label htmlFor="purchaseSortSelect" className="font-semibold text-slate-500">Sort:</label>
              <select
                id="purchaseSortSelect"
                value={purchaseSort}
                onChange={(e) => setPurchaseSort(e.target.value as "newest" | "oldest")}
                className="px-2 py-1 rounded-lg border border-slate-300 text-xs font-medium bg-white"
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
          <div className="py-6 text-center text-xs text-slate-400">
            No purchase records found for this product.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Purchase Price</th>
                  <th className="py-2.5 px-3 text-right">Selling Price</th>
                  <th className="py-2.5 px-3">Invoice</th>
                  <th className="py-2.5 px-3">Lot #</th>
                  <th className="py-2.5 px-3 text-center">Payment</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedPurchases.map((item, idx) => (
                  <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3 text-slate-700">{formatDisplayDate(item.purchaseDate)}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{item.supplierName}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {item.quantity.toLocaleString("en-IN")} {item.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-800">
                      ₹{item.purchasePrice.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                      {item.sellingPrice ? `₹${item.sellingPrice.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-purple-600">
                      <Link
                        href={`/dashboard/purchases/${item.id}`}
                        className="hover:underline font-semibold"
                      >
                        {item.supplierInvoice || `#${item.purchaseNumber}` || "View"}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{item.lotNumber || "—"}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                        {item.paymentMethod || "—"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Link
                        href={`/dashboard/purchases/${item.id}`}
                        className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-[11px] transition"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sales History Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 mb-4 gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Sales History
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical sales containing this product
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <label htmlFor="saleSortSelect" className="font-semibold text-slate-500">Sort:</label>
            <select
              id="saleSortSelect"
              value={saleSort}
              onChange={(e) => setSaleSort(e.target.value as "newest" | "oldest")}
              className="px-2 py-1 rounded-lg border border-slate-300 text-xs font-medium bg-white"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>

        {sortedSales.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No sales recorded for this product yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Invoice</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3 text-right">Quantity</th>
                  <th className="py-2.5 px-3 text-right">Rate</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                  <th className="py-2.5 px-3 text-center">Payment</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedSales.map((item, idx) => (
                  <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3 text-slate-700">{formatDisplayDate(item.saleDate)}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-blue-600">
                      <Link href={`/dashboard/sales/${item.id}`} className="hover:underline">
                        {item.invoiceNumber || `#${item.saleNumber}`}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{item.customerName}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {item.quantity.toLocaleString("en-IN")} {item.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700">
                      ₹{Number(item.rate).toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      ₹{Math.round(item.total).toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                        {item.paymentMethod || "—"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Link
                        href={`/dashboard/sales/${item.id}`}
                        className="inline-flex items-center px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-[11px] transition"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
