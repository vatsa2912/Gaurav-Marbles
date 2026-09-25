"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  collection,
  getCountFromServer,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normaliseLots, totalStock as calcLotStock, type StockLot } from "@/lib/stockLots";
import { formatDisplayDate } from "@/lib/dateUtils";
import { useUserProfile } from "@/components/ui/UserProfileContext";
import {
  Package,
  ShoppingBag,
  ShoppingCart,
  Users,
  AlertTriangle,
  Layers,
  ArrowRight,
  Plus,
  FileText,
  CalendarCheck2,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

export default function DashboardPage() {
  const { profile } = useUserProfile();

  const [productCount, setProductCount] = useState(0);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [totalStock, setTotalStock] = useState(0);
  const [stockByUnit, setStockByUnit] = useState<Record<string, number>>({});
  const [lowStockCount, setLowStockCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState<
    {
      id: string;
      name: string;
      stock: number;
      minimumStock: number;
      unit: string;
    }[]
  >([]);
  const [recentSales, setRecentSales] = useState<
    {
      id: string;
      saleNumber: number;
      customerName: string;
      saleDate: string;
      totalAmount: number;
    }[]
  >([]);
  const [recentPurchases, setRecentPurchases] = useState<
    {
      id: string;
      purchaseNumber: number;
      supplierName: string;
      purchaseDate: string;
      totalAmount: number;
      items: unknown[];
    }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [productsCountSnap, purchasesCountSnap, salesCountSnap, customersCountSnap] =
          await Promise.all([
            getCountFromServer(collection(db, "products")),
            getCountFromServer(collection(db, "purchases")),
            getCountFromServer(collection(db, "sales")),
            getCountFromServer(collection(db, "customers")),
          ]);

        setProductCount(productsCountSnap.data().count);
        setPurchaseCount(purchasesCountSnap.data().count);
        setSalesCount(salesCountSnap.data().count);
        setCustomerCount(customersCountSnap.data().count);

        const [productSnapshot, purchaseSnapshot, salesSnapshot] = await Promise.all([
          getDocs(collection(db, "products")),
          getDocs(collection(db, "purchases")),
          getDocs(collection(db, "sales")),
        ]);

        const recentPurchasesData = purchaseSnapshot.docs
          .map((purchaseDoc) => {
            const data = purchaseDoc.data();
            return {
              id: purchaseDoc.id,
              purchaseNumber: Number(data.purchaseNumber) || 0,
              supplierName: data.supplierName || "—",
              purchaseDate: data.purchaseDate || "",
              totalAmount: Number(data.totalAmount) || 0,
              items: Array.isArray(data.items) ? data.items : [],
            };
          })
          .sort(
            (a, b) =>
              new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
          )
          .slice(0, 5);

        setRecentPurchases(recentPurchasesData);

        const recentSalesData = salesSnapshot.docs
          .map((saleDoc) => {
            const data = saleDoc.data();
            return {
              id: saleDoc.id,
              saleNumber: Number(data.saleNumber) || 0,
              customerName: data.customerName || "Walk-in Customer",
              saleDate: data.saleDate || "",
              totalAmount: Number(data.totalAmount) || 0,
            };
          })
          .sort(
            (a, b) =>
              new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
          )
          .slice(0, 5);

        setRecentSales(recentSalesData);

        let stockTotal = 0;
        let lowStock = 0;
        let outOfStock = 0;
        const unitMap: Record<string, number> = {};

        const lowStockList: {
          id: string;
          name: string;
          stock: number;
          minimumStock: number;
          unit: string;
        }[] = [];

        productSnapshot.forEach((productDoc) => {
          const data = productDoc.data() as {
            name?: string;
            stock?: number;
            minimumStock?: number;
            purchasePrice?: number;
            stockLots?: StockLot[];
            unit?: string;
          };

          const lots = normaliseLots({
            id: productDoc.id,
            stock: data.stock,
            purchasePrice: data.purchasePrice,
            stockLots: data.stockLots,
          });

          const actualStock = calcLotStock(lots);
          const minimumStock = Number(data.minimumStock) || 0;
          const unit = (data.unit || "unit").trim().toLowerCase();

          stockTotal += actualStock;
          unitMap[unit] = (unitMap[unit] || 0) + actualStock;

          if (actualStock <= 0) {
            outOfStock++;
          }

          if (actualStock <= minimumStock) {
            lowStock++;
            lowStockList.push({
              id: productDoc.id,
              name: data.name || "Unnamed Product",
              stock: actualStock,
              minimumStock,
              unit: data.unit || "",
            });
          }
        });

        setTotalStock(stockTotal);
        setStockByUnit(unitMap);
        setLowStockCount(lowStock);
        setOutOfStockCount(outOfStock);
        setLowStockProducts(lowStockList.slice(0, 6));
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const todayFormatted = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live System
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-medium text-slate-500">{todayFormatted}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1.5">
              Welcome back, {profile?.fullName || "Administrator"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Here is your daily operational summary for{" "}
              <span className="font-semibold text-slate-700">{profile?.shopName || "Gaurav Marbles"}</span>.
            </p>
          </div>

          {/* Quick Action Launchers */}
          <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
            <Link
              href="/dashboard/sales/add"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Sale</span>
            </Link>

            <Link
              href="/dashboard/purchases/add"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Purchase</span>
            </Link>

            <Link
              href="/dashboard/daily-maintain"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition shadow-xs"
            >
              <CalendarCheck2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Daily Maintain</span>
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Products KPI */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Products
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">
                {loading ? "..." : productCount.toLocaleString()}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Catalog items</span>
            <Link
              href="/dashboard/products"
              className="font-semibold text-slate-900 hover:text-slate-600 flex items-center gap-1"
            >
              <span>View</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Total Stock KPI */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total Inventory Stock
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">
                {loading ? "..." : totalStock.toLocaleString()}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1 min-h-[22px]">
            {!loading &&
              Object.entries(stockByUnit).map(([unit, qty]) => (
                <span
                  key={unit}
                  className="inline-block text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md"
                >
                  {qty.toLocaleString()} {unit}
                </span>
              ))}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Stock lots tracked</span>
            <Link
              href="/dashboard/products"
              className="font-semibold text-slate-900 hover:text-slate-600 flex items-center gap-1"
            >
              <span>Details</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Low Stock Alert KPI */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Low / Out of Stock
              </p>
              <p className="text-2xl font-bold text-amber-600 mt-2 tracking-tight">
                {loading ? "..." : lowStockCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-amber-700 font-medium">
              {outOfStockCount > 0 ? `${outOfStockCount} critical out-of-stock` : "Healthy thresholds"}
            </span>
            <Link
              href="/dashboard/products"
              className="font-semibold text-slate-900 hover:text-slate-600 flex items-center gap-1"
            >
              <span>Restock</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Customers KPI */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition group">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Registered Customers
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-2 tracking-tight">
                {loading ? "..." : customerCount.toLocaleString()}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Accounts & Ledgers</span>
            <Link
              href="/dashboard/customers"
              className="font-semibold text-slate-900 hover:text-slate-600 flex items-center gap-1"
            >
              <span>View</span>
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Low Stock Restock Watchlist (if any) */}
      {lowStockProducts.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200/90 shadow-xs p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Restock Attention Needed</h3>
                <p className="text-xs text-slate-500">
                  Products currently at or below minimum required stock
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/purchases/add"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:underline"
            >
              <span>Order Stock</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Available</th>
                  <th className="py-2.5 px-3">Min. Required</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      <Link href={`/dashboard/products/${p.id}`} className="hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      {p.stock} <span className="font-normal text-slate-500">{p.unit}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {p.minimumStock} {p.unit}
                    </td>
                    <td className="py-2.5 px-3">
                      {p.stock <= 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Out of Stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Low Stock
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        href={`/dashboard/products/${p.id}`}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px] transition"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Transactions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Sales</h3>
                <p className="text-xs text-slate-500">Latest customer invoices & dispatch</p>
              </div>
            </div>
            <Link
              href="/dashboard/sales"
              className="text-xs font-semibold text-slate-900 hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentSales.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No sales recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Sale #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        <Link href={`/dashboard/sales/${sale.id}`} className="hover:underline">
                          #{sale.saleNumber}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {formatDisplayDate(sale.saleDate)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 truncate max-w-[120px]">
                        {sale.customerName}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        ₹{sale.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          href={`/dashboard/sales/${sale.id}`}
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

        {/* Recent Purchases Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Purchases</h3>
                <p className="text-xs text-slate-500">Inward invoices & lot replenishments</p>
              </div>
            </div>
            <Link
              href="/dashboard/purchases"
              className="text-xs font-semibold text-slate-900 hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentPurchases.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No purchases recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Purchase #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Supplier</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentPurchases.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        <Link href={`/dashboard/purchases/${purchase.id}`} className="hover:underline">
                          #{purchase.purchaseNumber}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {formatDisplayDate(purchase.purchaseDate)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 truncate max-w-[120px]">
                        {purchase.supplierName}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        ₹{purchase.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          href={`/dashboard/purchases/${purchase.id}`}
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
    </div>
  );
}