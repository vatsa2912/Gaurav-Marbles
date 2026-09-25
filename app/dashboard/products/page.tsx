"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normaliseLots, type StockLot } from "@/lib/stockLots";

type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  quantity?: number;
  estimatedStock?: number;
  estimatedStockSqft?: number;
  minimumStock?: number;
  size?: string;
  piecesPerBox?: number;
  marbleType?: string;
  stockLots?: StockLot[];
};


export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Tiles");
  const [sizeFilter, setSizeFilter] = useState("");
  const [marbleTypeFilter, setMarbleTypeFilter] = useState("All");
  const [marbleSizeFilter, setMarbleSizeFilter] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");

  const isTiles = categoryFilter === "Tiles";
  const isMarble = categoryFilter === "Marble";
  const isGranite = categoryFilter === "Granite";

  const tileSizes = Array.from(
    new Set(
      products
        .filter(
          (product) =>
            product.category === "Tiles" &&
            product.size &&
            product.size.trim() !== ""
        )
        .map((product) => product.size!.trim())
    )
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const marbleCutSizes = Array.from(
    new Set(
      products
        .filter(
          (product) =>
            product.category === "Marble" &&
            (product.marbleType === "Cut Size" || (product.size && product.size.trim() !== "")) &&
            product.size &&
            product.size.trim() !== ""
        )
        .map((product) => product.size!.trim())
    )
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const showSizeColumn = isTiles || (isMarble && marbleTypeFilter === "Cut Size");
  const showEstimatedStockColumn = isGranite || (isMarble && marbleTypeFilter !== "Cut Size");

  const renderEstimatedStock = (product: Product) => {
    const storedEst = product.estimatedStock ?? product.estimatedStockSqft;
    if (storedEst !== undefined && storedEst !== null && Number(storedEst) > 0) {
      return `${Number(storedEst).toLocaleString("en-IN")} sqft`;
    }
    return <span className="text-muted">N/A</span>;
  };

  const getStockStatus = (product: Product) => {
    const minimumStock = Number(product.minimumStock) || 0;

    if (product.stock <= 0) {
      return {
        label: "Out of Stock",
        className: "text-red-600 font-semibold",
      };
    }

    if (product.stock <= minimumStock) {
      return {
        label: "Low Stock",
        className: "text-yellow-600 font-semibold",
      };
    }

    return {
      label: "In Stock",
      className: "text-green-600 font-semibold",
    };
  };

  const handleDelete = async (id: string) => {
    const productToDelete = products.find((p) => p.id === id);
    const prodName = productToDelete?.name || "this product";

    const confirmed = window.confirm(
      `Are you sure you want to delete "${prodName}"?`
    );
    if (!confirmed) return;

    try {
      // 1. Check historical sales
      const salesSnap = await getDocs(collection(db, "sales"));
      const linkedSale = salesSnap.docs.find((d) => {
        const items = (d.data().items || []) as { productId?: string }[];
        return items.some((item) => item.productId === id);
      });

      if (linkedSale) {
        const saleNum = linkedSale.data().saleNumber ?? linkedSale.id;
        alert(
          `Cannot delete "${prodName}": This product is linked to customer Sale #${saleNum}. Deleting it would corrupt historical accounting records.`
        );
        return;
      }

      // 2. Check historical purchases
      const purchasesSnap = await getDocs(collection(db, "purchases"));
      const linkedPurchase = purchasesSnap.docs.find((d) => {
        const items = (d.data().items || []) as { productId?: string }[];
        return items.some((item) => item.productId === id);
      });

      if (linkedPurchase) {
        const purchaseNum = linkedPurchase.data().purchaseNumber ?? linkedPurchase.id;
        alert(
          `Cannot delete "${prodName}": This product is linked to supplier Purchase #${purchaseNum}. Deleting it would corrupt historical inventory and purchase records.`
        );
        return;
      }

      // 3. No linked sales or purchases: safely delete
      await deleteDoc(doc(db, "products", id));
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Error deleting product:", error);
      alert(error instanceof Error ? error.message : "Could not delete product.");
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchProducts = async () => {
      try {
        const snapshot = await getDocs(collection(db, "products"));
        if (!isMounted) return;
        const productList = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Product[];
        setProducts(productList);
      } catch (error) {
        console.error("Error loading products:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredProducts = products
    .filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        (product.size ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (product.marbleType ?? "").toLowerCase().includes(search.toLowerCase());

      const matchesCategory = product.category === categoryFilter;

      let matchesSize = true;
      if (isTiles) {
        matchesSize = sizeFilter === "" || (product.size ?? "").trim() === sizeFilter;
      }

      let matchesMarble = true;
      if (isMarble) {
        if (marbleTypeFilter === "Slabs") {
          matchesMarble = product.marbleType === "Slabs" || (!product.marbleType && !product.size);
        } else if (marbleTypeFilter === "Cut Size") {
          matchesMarble = product.marbleType === "Cut Size" || Boolean(product.size);
          if (matchesMarble && marbleSizeFilter) {
            matchesMarble = (product.size ?? "").trim() === marbleSizeFilter;
          }
        }
      }

      return matchesSearch && matchesCategory && matchesSize && matchesMarble;
    })
    .sort((a, b) => {
      const stockA = Number(a.stock ?? a.quantity ?? 0);
      const stockB = Number(b.stock ?? b.quantity ?? 0);

      switch (sortBy) {
        case "name-desc":
          return b.name.localeCompare(a.name);

        case "stock-asc":
          return stockA - stockB;

        case "stock-desc":
          return stockB - stockA;

        case "price-asc":
          return a.sellingPrice - b.sellingPrice;

        case "price-desc":
          return b.sellingPrice - a.sellingPrice;

        case "name-asc":
        default:
          return a.name.localeCompare(b.name);
      }
    });

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">Gaurav Marbles</h1>
        <p className="text-muted">Products &amp; Inventory</p>
      </header>

      <div className="page-content">
        {/* Header Row: Title & Subtitle on left, + Add Product button on right */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Products</h2>
            <p className="text-muted text-sm mt-1">Manage your shop inventory</p>
          </div>

          <Link
            href="/dashboard/products/add"
            className="btn-primary inline-flex items-center justify-center gap-2 self-start sm:self-auto"
          >
            + Add Product
          </Link>
        </div>

        {/* Filter Row inside clean card */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="form-field">
              <label htmlFor="searchProduct">Search Product</label>
              <input
                id="searchProduct"
                type="text"
                placeholder="Search by name or size..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="categoryFilter">Category</label>
              <select
                id="categoryFilter"
                value={categoryFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setCategoryFilter(val);
                  setSizeFilter("");
                  setMarbleTypeFilter("All");
                  setMarbleSizeFilter("");
                }}
              >
                <option value="Tiles">Tiles</option>
                <option value="Marble">Marble</option>
                <option value="Granite">Granite</option>
                <option value="Sanitary">Sanitary</option>
                <option value="Taps">Taps</option>
                <option value="Wash Basin">Wash Basin</option>
                <option value="Sink">Sink</option>
                <option value="Chemicals">Chemicals</option>
                <option value="Adhesives">Adhesives</option>
                <option value="Hardware">Hardware</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* If Tiles, show Tile Size filter */}
            {isTiles && (
              <div className="form-field">
                <label htmlFor="sizeFilter">Size</label>
                <select
                  id="sizeFilter"
                  value={sizeFilter}
                  onChange={(e) => setSizeFilter(e.target.value)}
                >
                  <option value="">All Sizes</option>
                  {tileSizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* If Marble, show Marble Type filter */}
            {isMarble && (
              <div className="form-field">
                <label htmlFor="marbleTypeFilter">Marble Type</label>
                <select
                  id="marbleTypeFilter"
                  value={marbleTypeFilter}
                  onChange={(e) => {
                    setMarbleTypeFilter(e.target.value);
                    setMarbleSizeFilter("");
                  }}
                >
                  <option value="All">All Types</option>
                  <option value="Slabs">Slabs</option>
                  <option value="Cut Size">Cut Size</option>
                </select>
              </div>
            )}

            {/* If Marble Cut Size, show Cut Size filter */}
            {isMarble && marbleTypeFilter === "Cut Size" && (
              <div className="form-field">
                <label htmlFor="marbleSizeFilter">Cut Size</label>
                <select
                  id="marbleSizeFilter"
                  value={marbleSizeFilter}
                  onChange={(e) => setMarbleSizeFilter(e.target.value)}
                >
                  <option value="">All Sizes</option>
                  {marbleCutSizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-field">
              <label htmlFor="sortBy">Sort By</label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="name-asc">Name A–Z</option>
                <option value="name-desc">Name Z–A</option>
                <option value="stock-asc">Stock: Low → High</option>
                <option value="stock-desc">Stock: High → Low</option>
                <option value="price-asc">Selling Price: Low → High</option>
                <option value="price-desc">Selling Price: High → Low</option>
              </select>
            </div>
          </div>

          {(search || sizeFilter || marbleTypeFilter !== "All" || marbleSizeFilter || categoryFilter !== "Tiles") && (
            <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSizeFilter("");
                  setMarbleTypeFilter("All");
                  setMarbleSizeFilter("");
                  setCategoryFilter("Tiles");
                }}
                className="btn-ghost text-xs text-muted hover:text-gray-700"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>

        {/* Product Table or Empty State */}
        {loading ? (
          <div className="rounded-xl bg-white p-8 text-center border border-gray-200">
            Loading products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center border border-gray-200">
            <div className="text-5xl">📦</div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              No {categoryFilter} products found
            </h3>
            <p className="text-muted mt-2 text-sm">
              {search || sizeFilter
                ? "Try adjusting your search query or filters."
                : `No products have been added under the "${categoryFilter}" category yet.`}
            </p>

            <Link
              href="/dashboard/products/add"
              className="btn-primary mt-5 inline-flex items-center justify-center gap-2"
            >
              Add New {categoryFilter} Product
            </Link>
          </div>
        ) : (
          <div className="table-wrapper overflow-x-auto w-full">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="text-left font-medium min-w-[160px]">Product</th>
                  {showSizeColumn && (
                    <th className="text-center font-medium min-w-[90px]">Size</th>
                  )}
                  {isTiles && (
                    <th className="text-center font-medium min-w-[90px]">Pieces</th>
                  )}
                  <th className="text-right font-medium min-w-[100px]">Selling Price</th>
                  <th className="text-right font-medium min-w-[100px]">Stock</th>
                  {showEstimatedStockColumn && (
                    <th className="text-right font-medium min-w-[130px]">Estimated Stock</th>
                  )}
                  <th className="text-left font-medium min-w-[160px]">Stock by Price</th>
                  <th className="text-center font-medium min-w-[100px]">Status</th>
                  <th className="text-center font-medium min-w-[140px]">Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((product) => {
                  const effectiveStock = Number(product.stock ?? product.quantity ?? 0);
                  const lots = normaliseLots({
                    stock: effectiveStock,
                    purchasePrice: product.purchasePrice,
                    stockLots: product.stockLots,
                  });
                  const status = getStockStatus(product);

                  return (
                    <tr key={product.id}>
                      <td className="font-medium text-left">
                        <Link
                          href={`/dashboard/products/${product.id}`}
                          className="text-gray-900 hover:text-blue-600 hover:underline font-semibold"
                        >
                          {product.name}
                        </Link>
                      </td>
                      {showSizeColumn && (
                        <td className="text-center">
                          {product.size || <span className="text-muted">—</span>}
                        </td>
                      )}
                      {isTiles && (
                        <td className="text-center">
                          {product.piecesPerBox
                            ? product.piecesPerBox
                            : <span className="text-muted">—</span>}
                        </td>
                      )}
                      <td className="text-right font-medium">
                        ₹{Number(product.sellingPrice).toLocaleString("en-IN")}
                      </td>
                      <td className="text-right font-semibold">
                        {effectiveStock.toLocaleString("en-IN")} {product.unit}
                      </td>
                      {showEstimatedStockColumn && (
                        <td className="text-right">
                          {renderEstimatedStock(product)}
                        </td>
                      )}
                      <td className="text-left">
                        {(() => {
                          if (lots.length === 0) {
                            return <span className="text-muted text-xs">No stock</span>;
                          }
                          const priceMap = new Map<number, number>();
                          lots.forEach((lot) => {
                            const p = Number(lot.purchasePrice) || 0;
                            const q = Number(lot.remainingQuantity ?? lot.quantity) || 0;
                            priceMap.set(p, (priceMap.get(p) || 0) + q);
                          });
                          const groups = Array.from(priceMap.entries()).sort((a, b) => a[0] - b[0]);

                          if (groups.length === 1) {
                            return (
                              <span className="text-xs text-gray-700">
                                ₹{groups[0][0].toLocaleString("en-IN")} · {groups[0][1].toLocaleString("en-IN")} {product.unit}
                              </span>
                            );
                          }

                          return (
                            <div
                              className="max-h-16 overflow-y-auto space-y-1 text-xs pr-1"
                              style={{ scrollbarWidth: "thin" }}
                            >
                              {groups.map(([price, qty]) => (
                                <div key={price} className="whitespace-nowrap">
                                  <span className="text-gray-500">
                                    ₹{price.toLocaleString("en-IN")}
                                  </span>
                                  <span className="text-gray-400"> · </span>
                                  <span className="font-semibold text-gray-800">
                                    {qty.toLocaleString("en-IN")} {product.unit}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="text-center">
                        <span className={status.className}>{status.label}</span>
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-3">
                          <Link
                            href={`/dashboard/products/${product.id}`}
                            className="text-sm font-medium text-emerald-600 hover:underline"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => router.push(`/dashboard/products/edit/${product.id}`)}
                            className="text-sm font-medium text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="text-sm font-medium text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </main>
  );
}
