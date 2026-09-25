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

export default function DashboardPage() {
  const [productCount, setProductCount] = useState(0);
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [totalPurchaseAmount, setTotalPurchaseAmount] = useState(0);
  const [totalSalesAmount, setTotalSalesAmount] = useState(0);
  const [estimatedProfit, setEstimatedProfit] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalStock, setTotalStock] = useState(0);
  const [stockByUnit, setStockByUnit] = useState<Record<string, number>>({});
  const [lowStockCount, setLowStockCount] = useState(0);
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
        const products = await getCountFromServer(
          collection(db, "products")
        );

        const purchases = await getCountFromServer(
          collection(db, "purchases")
        );

        const sales = await getCountFromServer(
          collection(db, "sales")
        );

        const customers = await getCountFromServer(
          collection(db, "customers")
        );

        const productSnapshot = await getDocs(
          collection(db, "products")
        );

        const purchaseSnapshot = await getDocs(
          collection(db, "purchases")
        );

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
              new Date(b.purchaseDate).getTime() -
              new Date(a.purchaseDate).getTime()
          )
          .slice(0, 5);

        setRecentPurchases(recentPurchasesData);

        const salesSnapshot = await getDocs(
          collection(db, "sales")
        );

        const expenseSnapshot = await getDocs(
          collection(db, "expenses")
        );

        let expenseAmount = 0;

        expenseSnapshot.forEach((expenseDoc) => {
          const data = expenseDoc.data();
          expenseAmount += Number(data.amount) || 0;
        });

        setTotalExpenses(expenseAmount);

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
              new Date(b.saleDate).getTime() -
              new Date(a.saleDate).getTime()
          )
          .slice(0, 5);

        setRecentSales(recentSalesData);

        let purchaseAmount = 0;
        let salesAmount = 0;
        let costOfGoodsSold = 0;

        purchaseSnapshot.forEach((purchaseDoc) => {
          const data = purchaseDoc.data();
          purchaseAmount += Number(data.totalAmount) || 0;
        });

        salesSnapshot.forEach((saleDoc) => {
          const data = saleDoc.data();

          salesAmount += Number(data.totalAmount) || 0;

          if (Array.isArray(data.items)) {
            type ItemWithCost = {
              costTotal?: number;
              costAllocations?: { totalCost?: number }[];
              costPrice?: number;
              quantity?: number;
            };

            (data.items as ItemWithCost[]).forEach((item) => {
              if (item.costTotal !== undefined && !isNaN(Number(item.costTotal))) {
                costOfGoodsSold += Number(item.costTotal);
              } else if (Array.isArray(item.costAllocations) && item.costAllocations.length > 0) {
                costOfGoodsSold += item.costAllocations.reduce(
                  (sum, alloc) => sum + (Number(alloc.totalCost) || 0),
                  0
                );
              } else {
                costOfGoodsSold +=
                  (Number(item.costPrice) || 0) * (Number(item.quantity) || 0);
              }
            });
          }
        });

        setTotalPurchaseAmount(purchaseAmount);
        setTotalSalesAmount(salesAmount);
        setEstimatedProfit(
          salesAmount - costOfGoodsSold - expenseAmount
        );

        let stockTotal = 0;
        let lowStock = 0;
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
        setLowStockProducts(lowStockList);
        setProductCount(products.data().count);
        setPurchaseCount(purchases.data().count);
        setSalesCount(sales.data().count);
        setCustomerCount(customers.data().count);
      } catch (error) {
        console.error("Error loading dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">
          Gaurav Marbles
        </h1>

        <p className="text-muted">
          Dashboard
        </p>
      </header>

      <div className="page-content">

        <div className="mb-6">
          <h2 className="text-2xl">
            Dashboard
          </h2>

          <p className="text-muted mt-1">
            Welcome to Gaurav Marbles management system
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-4 lg:grid-cols-6">

          {/* Products */}
          <div className="card">
            <p className="text-muted">
              Total Products
            </p>

            <p className="mt-2 text-3xl font-bold">
              {loading ? "..." : productCount}
            </p>

            <button
              onClick={() => {
                window.location.href = "/dashboard/products";
              }}
              className="btn-primary mt-5"
            >
              View Products
            </button>
          </div>

          {/* Purchases */}
          <div className="card">
            <p className="text-muted">
              Total Purchases
            </p>

            <p className="mt-2 text-3xl font-bold">
              {loading ? "..." : purchaseCount}
            </p>

            <button
              onClick={() => {
                window.location.href = "/dashboard/purchases";
              }}
              className="btn-primary mt-5"
            >
              View Purchases
            </button>
          </div>

          {/* Sales */}
          <div className="card">
            <p className="text-muted">
              Total Sales
            </p>

            <p className="mt-2 text-3xl font-bold">
              {loading ? "..." : salesCount}
            </p>

            <button
              onClick={() => {
                window.location.href = "/dashboard/sales";
              }}
              className="btn-primary mt-5"
            >
              View Sales
            </button>
          </div>

          {/* Customers */}
          <div className="card">
            <p className="text-muted">
              Total Customers
            </p>

            <p className="mt-2 text-3xl font-bold">
              {loading ? "..." : customerCount}
            </p>

            <button
              onClick={() => {
                window.location.href = "/dashboard/customers";
              }}
              className="btn-primary mt-5"
            >
              View Customers
            </button>
          </div>

          {/* Total Stock */}
          <div className="card">
            <p className="text-muted">
              Total Stock
            </p>

            <p className="mt-2 text-3xl font-bold">
              {loading ? "..." : totalStock}
            </p>

            {/* Unit breakdown */}
            <div className="mt-2 min-h-6 flex flex-wrap gap-1">
              {!loading && Object.keys(stockByUnit).length > 0 && (
                Object.entries(stockByUnit).map(([unit, qty]) => (
                  <span
                    key={unit}
                    className="inline-block text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-medium"
                  >
                    {qty.toLocaleString()} {unit}
                  </span>
                ))
              )}
            </div>

            <button
              onClick={() => {
                window.location.href = "/dashboard/products";
              }}
              className="btn-primary mt-3"
            >
              View Inventory
            </button>
          </div>

          {/* Low Stock */}
          <div className="card">
            <p className="text-muted">
              Low Stock
            </p>

            <p className="mt-2 text-3xl font-bold">
              {loading ? "..." : lowStockCount}
            </p>

            <button
              onClick={() => {
                window.location.href = "/dashboard/products";
              }}
              className="btn-primary mt-5"
            >
              View Products
            </button>
          </div>

        </div>

        {/* Financial Summary KPI Totals (Temporarily on hold per instruction while preserving data and queries) */}
        {false && (
          <div className="grid grid-cols-1 gap-5 mt-6 md:grid-cols-4">

            {/* Total Purchase Amount */}
            <div className="card">
              <p className="text-muted">
                Total Purchase Amount
              </p>

              <p className="mt-2 text-3xl font-bold">
                {loading
                  ? "..."
                  : `₹${totalPurchaseAmount.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}`}
              </p>

              <p className="text-muted mt-2">
                Sales minus purchases and expenses
              </p>
            </div>

            {/* Total Sales Amount */}
            <div className="card">
              <p className="text-muted">
                Total Sales Amount
              </p>

              <p className="mt-2 text-3xl font-bold">
                {loading
                  ? "..."
                  : `₹${totalSalesAmount.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}`}
              </p>

              <p className="text-muted mt-2">
                Total amount received from sales
              </p>
            </div>

            {/* Estimated Business Difference */}
            <div className="card">
              <p className="text-muted">
                Estimated Business Difference
              </p>

              <p className="mt-2 text-3xl font-bold">
                {loading
                  ? "..."
                  : `₹${estimatedProfit.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}`}
              </p>

              <p className="text-muted mt-2">
                Sales minus actual product cost and expenses
              </p>
            </div>

            {/* Total Expenses */}
            <div className="card">
              <p className="text-muted">
                Total Expenses
              </p>

              <p className="mt-2 text-3xl font-bold">
                {loading
                  ? "..."
                  : `₹${totalExpenses.toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}`}
              </p>

              <p className="text-muted mt-2">
                Total business expenses
              </p>

              <button
                onClick={() => {
                  window.location.href = "/dashboard/expenses";
                }}
                className="btn-secondary mt-4"
              >
                View Expenses
              </button>
            </div>

          </div>
        )}

        {/* Recent Sales */}
        <div className="card mt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">
                Recent Sales
              </h3>

              <p className="text-muted mt-1">
                Latest sales transactions
              </p>
            </div>

            <Link
              href="/dashboard/sales"
              className="btn-secondary"
            >
              View All
            </Link>
          </div>

          {recentSales.length === 0 ? (
            <p className="text-muted mt-5">
              No sales available.
            </p>
          ) : (
            <div className="table-wrapper mt-5">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Sale No.</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Total Amount</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {recentSales.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <Link
                          href={`/dashboard/sales/${sale.id}`}
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          #{sale.saleNumber}
                        </Link>
                      </td>

                      <td>
                        {formatDisplayDate(sale.saleDate)}
                      </td>

                      <td>{sale.customerName}</td>

                      <td>
                        ₹
                        {sale.totalAmount.toLocaleString(
                          "en-IN",
                          {
                            maximumFractionDigits: 2,
                          }
                        )}
                      </td>

                      <td className="text-center">
                        <Link
                          href={`/dashboard/sales/${sale.id}`}
                          className="btn-secondary text-xs px-2.5 py-1"
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

        {/* Recent Purchases */}
        <div className="card mt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">
                Recent Purchases
              </h3>

              <p className="text-muted mt-1">
                Latest purchase transactions
              </p>
            </div>

            <Link
              href="/dashboard/purchases"
              className="btn-secondary"
            >
              View All
            </Link>
          </div>

          {recentPurchases.length === 0 ? (
            <p className="text-muted mt-5">
              No purchases available.
            </p>
          ) : (
            <div className="table-wrapper mt-5">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Purchase No.</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Items</th>
                    <th>Total Amount</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {recentPurchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <td>
                        <Link
                          href={`/dashboard/purchases/${purchase.id}`}
                          className="font-semibold text-purple-600 hover:underline"
                        >
                          #{purchase.purchaseNumber}
                        </Link>
                      </td>

                      <td>
                        {formatDisplayDate(purchase.purchaseDate)}
                      </td>

                      <td>{purchase.supplierName}</td>

                      <td>{purchase.items.length}</td>

                      <td>
                        ₹
                        {purchase.totalAmount.toLocaleString(
                          "en-IN",
                          {
                            maximumFractionDigits: 2,
                          }
                        )}
                      </td>

                      <td className="text-center">
                        <Link
                          href={`/dashboard/purchases/${purchase.id}`}
                          className="btn-secondary text-xs px-2.5 py-1"
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

        {/* Low Stock Products */}
        <div className="card mt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">
                Low Stock Products
              </h3>

              <p className="text-muted mt-1">
                Products that may need restocking
              </p>
            </div>

            <Link
              href="/dashboard/products"
              className="btn-secondary"
            >
              View Inventory
            </Link>
          </div>

          {lowStockProducts.length === 0 ? (
            <p className="text-muted mt-5">
              No low-stock products.
            </p>
          ) : (
            <div className="table-wrapper mt-5">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th>Minimum Stock</th>
                    <th>Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {lowStockProducts.map((product) => (
                    <tr key={product.id}>
                      <td className="font-medium">
                        <Link
                          href={`/dashboard/products/${product.id}`}
                          className="text-blue-600 hover:underline font-semibold"
                        >
                          {product.name}
                        </Link>
                      </td>

                      <td>
                        {product.stock} {product.unit}
                      </td>

                      <td>
                        {product.minimumStock} {product.unit}
                      </td>

                      <td>
                        {product.stock <= 0 ? (
                          <span className="text-error font-medium">
                            Out of Stock
                          </span>
                        ) : (
                          <span className="font-medium">
                            Low Stock
                          </span>
                        )}
                      </td>

                      <td className="text-center">
                        <Link
                          href={`/dashboard/products/${product.id}`}
                          className="btn-secondary text-xs px-2.5 py-1"
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

        {/* Quick Actions */}
        <div className="card mt-6">
          <h3 className="text-lg font-semibold">
            Quick Actions
          </h3>

          <div className="mt-4 flex flex-wrap gap-3">

            <button
              onClick={() => {
                window.location.href = "/dashboard/products/add";
              }}
              className="btn-primary"
            >
              + Add Product
            </button>

            <button
              onClick={() => {
                window.location.href = "/dashboard/purchases/add";
              }}
              className="btn-secondary"
            >
              + New Purchase
            </button>

            <button
              onClick={() => {
                window.location.href = "/dashboard/sales/add";
              }}
              className="btn-secondary"
            >
              + New Sale
            </button>

            <Link
              href="/dashboard/invoices/new"
              className="btn-primary"
            >
              + Generate Bill
            </Link>

            <Link
              href="/dashboard/invoices"
              className="btn-secondary"
            >
              Invoices
            </Link>

            <button
              onClick={() => {
                window.location.href = "/dashboard/customers";
              }}
              className="btn-secondary"
            >
              Customers
            </button>

            <button
              onClick={() => {
                window.location.href = "/dashboard/expenses";
              }}
              className="btn-secondary"
            >
              Expenses
            </button>

          </div>
        </div>

      </div>
    </main>
  );
}