"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { normaliseLots, type StockLot } from "@/lib/stockLots";
import { useToast } from "@/components/ui/ToastContext";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  Package,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  AlertTriangle,
  RotateCcw,
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
  estimatedStock?: number;
  estimatedStockSqft?: number;
  minimumStock?: number;
  size?: string;
  piecesPerBox?: number;
  marbleType?: string;
  stockLots?: StockLot[];
};

const CATEGORIES = [
  "Tiles",
  "Marble",
  "Granite",
  "Sanitary",
  "Taps",
  "Wash Basin",
  "Sink",
  "Chemicals",
  "Adhesives",
  "Hardware",
  "Other",
];

export default function ProductsPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Tiles");
  const [sizeFilter, setSizeFilter] = useState("");
  const [marbleTypeFilter, setMarbleTypeFilter] = useState("All");
  const [marbleSizeFilter, setMarbleSizeFilter] = useState("");
  const [sortBy, setSortBy] = useState("name-asc");

  // Deletion modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    return <span className="text-slate-400">—</span>;
  };

  const getStockBadge = (product: Product) => {
    const minimumStock = Number(product.minimumStock) || 0;

    if (product.stock <= 0) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          Out of Stock
        </span>
      );
    }

    if (product.stock <= minimumStock) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          Low Stock
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        In Stock
      </span>
    );
  };

  const openDeleteModal = (product: Product) => {
    setProductToDelete(product);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    const id = productToDelete.id;
    const prodName = productToDelete.name;

    setDeleting(true);
    try {
      // 1. Check historical sales
      const salesSnap = await getDocs(collection(db, "sales"));
      const linkedSale = salesSnap.docs.find((d) => {
        const items = (d.data().items || []) as { productId?: string }[];
        return items.some((item) => item.productId === id);
      });

      if (linkedSale) {
        const saleNum = linkedSale.data().saleNumber ?? linkedSale.id;
        showToast(
          `Cannot delete "${prodName}": Linked to customer Sale #${saleNum}. Records preserved.`,
          "error"
        );
        setDeleteModalOpen(false);
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
        showToast(
          `Cannot delete "${prodName}": Linked to supplier Purchase #${purchaseNum}. Records preserved.`,
          "error"
        );
        setDeleteModalOpen(false);
        return;
      }

      // 3. No linked sales or purchases: safely delete
      await deleteDoc(doc(db, "products", id));
      setProducts((prev) => prev.filter((p) => p.id !== id));
      showToast(`Product "${prodName}" deleted successfully`, "success");
      setDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting product:", error);
      showToast(error instanceof Error ? error.message : "Could not delete product.", "error");
    } finally {
      setDeleting(false);
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
        showToast("Failed to load products", "error");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProducts();

    return () => {
      isMounted = false;
    };
  }, [showToast]);

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
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Products Catalog</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage catalog specifications, batch pricing lots, and inventory stock.
          </p>
        </div>

        <Link
          href="/dashboard/products/add"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </Link>
      </div>

      {/* Category Pills Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
        {CATEGORIES.map((cat) => {
          const count = products.filter((p) => p.category === cat).length;
          const isActive = categoryFilter === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setCategoryFilter(cat);
                setSizeFilter("");
                setMarbleTypeFilter("All");
                setMarbleSizeFilter("");
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span>{cat}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  isActive ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Search Input */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Search Products
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, size..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-slate-50/50 hover:bg-white"
              />
            </div>
          </div>

          {/* If Tiles, show Tile Size filter */}
          {isTiles && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Tile Size
              </label>
              <select
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
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
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Marble Type
              </label>
              <select
                value={marbleTypeFilter}
                onChange={(e) => {
                  setMarbleTypeFilter(e.target.value);
                  setMarbleSizeFilter("");
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
              >
                <option value="All">All Types</option>
                <option value="Slabs">Slabs</option>
                <option value="Cut Size">Cut Size</option>
              </select>
            </div>
          )}

          {/* If Marble Cut Size, show Cut Size filter */}
          {isMarble && marbleTypeFilter === "Cut Size" && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Cut Size
              </label>
              <select
                value={marbleSizeFilter}
                onChange={(e) => setMarbleSizeFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
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

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
            >
              <option value="name-asc">Name (A → Z)</option>
              <option value="name-desc">Name (Z → A)</option>
              <option value="stock-asc">Stock (Low → High)</option>
              <option value="stock-desc">Stock (High → Low)</option>
              <option value="price-asc">Selling Price (Low → High)</option>
              <option value="price-desc">Selling Price (High → Low)</option>
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSizeFilter("");
                setMarbleTypeFilter("All");
                setMarbleSizeFilter("");
                setSortBy("name-asc");
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Loading products catalog...
          </p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            No {categoryFilter} products found
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {search || sizeFilter
              ? "No catalog items matched your active search and filter options."
              : `You haven't added any products under ${categoryFilter} yet.`}
          </p>
          <Link
            href="/dashboard/products/add"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add {categoryFilter} Product</span>
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 min-w-[180px]">Product</th>
                  {showSizeColumn && (
                    <th className="py-3 px-3 text-center min-w-[90px]">Size</th>
                  )}
                  {isTiles && (
                    <th className="py-3 px-3 text-center min-w-[90px]">Pieces/Box</th>
                  )}
                  <th className="py-3 px-3 text-right min-w-[100px]">Selling Price</th>
                  <th className="py-3 px-3 text-right min-w-[100px]">Stock</th>
                  {showEstimatedStockColumn && (
                    <th className="py-3 px-3 text-right min-w-[120px]">Estimated Stock</th>
                  )}
                  <th className="py-3 px-4 min-w-[170px]">Stock by Lot Price</th>
                  <th className="py-3 px-3 text-center min-w-[100px]">Status</th>
                  <th className="py-3 px-4 text-center min-w-[120px]">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => {
                  const effectiveStock = Number(product.stock ?? product.quantity ?? 0);
                  const lots = normaliseLots({
                    stock: effectiveStock,
                    purchasePrice: product.purchasePrice,
                    stockLots: product.stockLots,
                  });

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <Link
                          href={`/dashboard/products/${product.id}`}
                          className="font-bold text-slate-900 hover:text-blue-600 transition"
                        >
                          {product.name}
                        </Link>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {product.category}
                        </div>
                      </td>

                      {showSizeColumn && (
                        <td className="py-3 px-3 text-center font-mono text-slate-700">
                          {product.size || <span className="text-slate-400">—</span>}
                        </td>
                      )}

                      {isTiles && (
                        <td className="py-3 px-3 text-center text-slate-700">
                          {product.piecesPerBox ? (
                            <span>{product.piecesPerBox} pcs</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      )}

                      <td className="py-3 px-3 text-right font-semibold text-slate-900">
                        ₹{Number(product.sellingPrice).toLocaleString("en-IN")}
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {effectiveStock.toLocaleString("en-IN")}
                        <span className="font-normal text-slate-500 text-[11px] ml-1">
                          {product.unit}
                        </span>
                      </td>

                      {showEstimatedStockColumn && (
                        <td className="py-3 px-3 text-right text-slate-700 font-medium">
                          {renderEstimatedStock(product)}
                        </td>
                      )}

                      <td className="py-3 px-4">
                        {(() => {
                          if (lots.length === 0) {
                            return <span className="text-slate-400 text-[11px]">No active lots</span>;
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
                              <span className="text-slate-700 text-xs">
                                ₹{groups[0][0].toLocaleString("en-IN")} ·{" "}
                                <span className="font-semibold">{groups[0][1].toLocaleString("en-IN")}</span>{" "}
                                {product.unit}
                              </span>
                            );
                          }

                          return (
                            <div className="max-h-16 overflow-y-auto space-y-0.5 text-xs pr-1 scrollbar-thin">
                              {groups.map(([price, qty]) => (
                                <div key={price} className="whitespace-nowrap text-slate-600">
                                  <span>₹{price.toLocaleString("en-IN")}</span>
                                  <span className="text-slate-300"> · </span>
                                  <span className="font-semibold text-slate-800">
                                    {qty.toLocaleString("en-IN")} {product.unit}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </td>

                      <td className="py-3 px-3 text-center">{getStockBadge(product)}</td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/dashboard/products/${product.id}`}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                            title="View Product"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/products/edit/${product.id}`)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Edit Product"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openDeleteModal(product)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Accessible Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Product"
        message={`Are you sure you want to delete "${productToDelete?.name}"? If this product has historical transactions, deletion will be blocked.`}
        confirmText="Delete Product"
        cancelText="Cancel"
        isDanger={true}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
}
