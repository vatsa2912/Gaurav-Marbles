"use client";

import { useState } from "react";
import Link from "next/link";
import { addDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateLotId } from "@/lib/stockLots";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastContext";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import {
  ArrowLeft,
  Save,
  Package,
  Layers,
  IndianRupee,
  ShieldAlert,
  Info,
} from "lucide-react";

export default function AddProductPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Tiles");
  const [unit, setUnit] = useState("box");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stock, setStock] = useState("");
  const [estimatedStock, setEstimatedStock] = useState("");
  const [size, setSize] = useState("");
  const [piecesPerBox, setPiecesPerBox] = useState("");
  const [gstRate, setGstRate] = useState("18");
  const [minimumStock, setMinimumStock] = useState("0");
  const [marbleType, setMarbleType] = useState("");
  const [marbleQuantity, setMarbleQuantity] = useState("");
  const [marbleCutSize, setMarbleCutSize] = useState("");
  const [model, setModel] = useState("");
  const [material, setMaterial] = useState("");
  const [warranty, setWarranty] = useState("");
  const [marblePieces, setMarblePieces] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [graniteQuantity, setGraniteQuantity] = useState("");
  const [granitePieces, setGranitePieces] = useState("");
  const [graniteLotNumber, setGraniteLotNumber] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Duplicate product confirmation modal
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);

    // Set default unit per category
    if (newCategory === "Tiles") {
      setUnit("box");
    } else if (newCategory === "Marble" || newCategory === "Granite") {
      setUnit("sqft");
    } else if (["Sanitary", "Taps", "Wash Basin", "Sink"].includes(newCategory)) {
      setUnit("piece");
    } else if (["Chemicals", "Adhesives"].includes(newCategory)) {
      setUnit("piece");
    } else {
      setUnit("piece");
    }

    // Clear irrelevant temporary field values when switching categories
    if (newCategory !== "Tiles") {
      setSize("");
      setPiecesPerBox("");
    }
    if (newCategory !== "Marble") {
      setMarbleType("");
      setMarbleQuantity("");
      setMarblePieces("");
      setMarbleCutSize("");
      setLotNumber("");
    }
    if (newCategory !== "Granite") {
      setGraniteQuantity("");
      setGranitePieces("");
      setGraniteLotNumber("");
    }
    if (newCategory !== "Marble" && newCategory !== "Granite") {
      setEstimatedStock("");
    }
    if (!["Sanitary", "Taps", "Wash Basin", "Sink"].includes(newCategory)) {
      setModel("");
      setMaterial("");
      setWarranty("");
    }
  };

  const executeProductCreation = async () => {
    const openingStock = Number(stock) || 0;
    const pPrice = Number(purchasePrice) || 0;
    const sPrice = Number(sellingPrice) || 0;

    const openingLots =
      openingStock > 0
        ? [
            {
              lotId: generateLotId(),
              purchasePrice: pPrice,
              quantity: openingStock,
              remainingQuantity: openingStock,
              purchasedAt: new Date().toISOString().split("T")[0],
            },
          ]
        : [];

    await addDoc(collection(db, "products"), {
      name: name.trim(),
      category,
      unit: category === "Marble" && marbleType === "Cut Size" ? "piece" : unit,

      size:
        category === "Tiles"
          ? size
          : category === "Marble" && marbleType === "Cut Size"
          ? marbleCutSize
          : "",
      piecesPerBox: category === "Tiles" && piecesPerBox ? Number(piecesPerBox) : null,
      marbleType: category === "Marble" ? marbleType : "",
      marbleQuantity:
        category === "Marble" && marbleType !== "Cut Size" && marbleQuantity
          ? Number(marbleQuantity)
          : 0,
      marblePieces: category === "Marble" && marblePieces ? Number(marblePieces) : 0,
      lotNumber: category === "Marble" && marbleType !== "Cut Size" ? lotNumber.trim() : "",
      graniteQuantity:
        category === "Granite" && graniteQuantity ? Number(graniteQuantity) : 0,
      granitePieces: category === "Granite" && granitePieces ? Number(granitePieces) : 0,
      graniteLotNumber: category === "Granite" ? graniteLotNumber.trim() : "",
      type: "",
      model: ["Sanitary", "Taps", "Wash Basin", "Sink"].includes(category)
        ? model.trim()
        : "",
      material: ["Sanitary", "Taps", "Wash Basin", "Sink"].includes(category)
        ? material.trim()
        : "",
      warranty: ["Sanitary", "Taps", "Wash Basin", "Sink"].includes(category)
        ? warranty.trim()
        : "",

      purchasePrice: pPrice,
      sellingPrice: sPrice,

      gstRate: Number(gstRate) || 0,
      stock: openingStock,
      estimatedStock:
        category === "Granite" || (category === "Marble" && marbleType !== "Cut Size")
          ? Number(estimatedStock || 0)
          : 0,
      minimumStock: Number(minimumStock) || 0,
      stockLots: openingLots,

      createdAt: new Date(),
    });

    showToast(`Product "${name.trim()}" created successfully`, "success");
    router.push("/dashboard/products");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter product name.");
      showToast("Please enter product name", "error");
      return;
    }

    try {
      setSaving(true);

      // Duplicate product check
      const existingSnap = await getDocs(collection(db, "products"));
      const duplicate = existingSnap.docs.find((d) => {
        const data = d.data();
        const sameName =
          (data.name || "").trim().toLowerCase() === name.trim().toLowerCase();
        const sameCategory =
          (data.category || "").trim().toLowerCase() === category.trim().toLowerCase();
        return sameName && sameCategory;
      });

      if (duplicate) {
        setDuplicateId(duplicate.id);
        setDuplicateModalOpen(true);
        setSaving(false);
        return;
      }

      await executeProductCreation();
    } catch (err) {
      console.error(err);
      setError("Could not save product.");
      showToast("Could not save product. Please try again.", "error");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1">
          <Link
            href="/dashboard/products"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Products</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Add New Product</h1>
          <p className="text-xs text-slate-500">
            Define item master parameters, technical attributes, and optional initial stock.
          </p>
        </div>
      </div>

      {/* Info Callout */}
      <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-2xl text-xs text-blue-900 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Master Catalog Registration:</strong> Only <strong>Product Name</strong> and{" "}
          <strong>Category</strong> are strictly required. Stock quantities and batch purchase prices
          can be left empty or at 0 and replenished anytime using{" "}
          <Link href="/dashboard/purchases/add" className="font-semibold underline hover:text-blue-950">
            Add Purchase
          </Link>.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Information */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Package className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              1. Basic Information
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Product Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kajaria Royal Statuario 2x4"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
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

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Inventory Measurement Unit *
              </label>
              <select
                value={unit}
                disabled={category === "Tiles" || category === "Marble" || category === "Granite"}
                className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition ${
                  category === "Tiles" || category === "Marble" || category === "Granite"
                    ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                    : "bg-white"
                }`}
                onChange={(e) => setUnit(e.target.value)}
              >
                {category === "Tiles" ? (
                  <option value="box">box</option>
                ) : category === "Marble" || category === "Granite" ? (
                  <option value="sqft">sqft</option>
                ) : ["Sanitary", "Taps", "Wash Basin", "Sink"].includes(category) ? (
                  <option value="piece">piece</option>
                ) : ["Chemicals", "Adhesives"].includes(category) ? (
                  <>
                    <option value="piece">piece</option>
                    <option value="kg">kg</option>
                    <option value="liter">liter</option>
                  </>
                ) : (
                  <>
                    <option value="box">box</option>
                    <option value="sqft">sqft</option>
                    <option value="piece">piece</option>
                    <option value="kg">kg</option>
                    <option value="meter">meter</option>
                    <option value="liter">liter</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Technical Specifications */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <Layers className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              2. Technical Specifications ({category})
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {category === "Tiles" && (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Tile Dimension / Size
                  </label>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
                  >
                    <option value="">Select Size</option>
                    <option value="12x18">12x18</option>
                    <option value="2x4">2x4</option>
                    <option value="2x2">2x2</option>
                    <option value="16x16">16x16</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Pieces Per Box
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={piecesPerBox}
                    onChange={(e) => setPiecesPerBox(e.target.value)}
                    placeholder="e.g. 5, 6, 8"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                  />
                </div>
              </>
            )}

            {category === "Marble" && (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Marble Form
                  </label>
                  <select
                    value={marbleType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMarbleType(val);
                      if (val === "Cut Size") {
                        setUnit("piece");
                      } else {
                        setUnit("sqft");
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
                  >
                    <option value="">Select Marble Form</option>
                    <option value="Slabs">Slabs</option>
                    <option value="Cut Size">Cut Size</option>
                  </select>
                </div>

                {marbleType === "Cut Size" ? (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                      Cut Size Dimensions
                    </label>
                    <input
                      type="text"
                      value={marbleCutSize}
                      onChange={(e) => setMarbleCutSize(e.target.value)}
                      placeholder="e.g. 2x4, 2x2, 3x6"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                        Number of Pieces (Optional)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={marblePieces}
                        onChange={(e) => setMarblePieces(e.target.value)}
                        placeholder="e.g. 12"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                        Lot / Block Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={lotNumber}
                        onChange={(e) => setLotNumber(e.target.value)}
                        placeholder="e.g. LOT-4029"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {category === "Granite" && (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Granite Pieces (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={granitePieces}
                    onChange={(e) => setGranitePieces(e.target.value)}
                    placeholder="e.g. 8"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Granite Lot Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={graniteLotNumber}
                    onChange={(e) => setGraniteLotNumber(e.target.value)}
                    placeholder="e.g. GR-908"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                  />
                </div>
              </>
            )}

            {["Sanitary", "Taps", "Wash Basin", "Sink"].includes(category) && (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Model Number
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. Coral Wall Hung"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Material / Finish
                  </label>
                  <input
                    type="text"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    placeholder="e.g. Ceramic / Stainless 304"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                    Warranty Period
                  </label>
                  <input
                    type="text"
                    value={warranty}
                    onChange={(e) => setWarranty(e.target.value)}
                    placeholder="e.g. 5 Years Manufacturer"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                  />
                </div>
              </>
            )}

            {["Chemicals", "Adhesives", "Hardware", "Other"].includes(category) && (
              <div className="sm:col-span-2 text-xs text-slate-500 py-2">
                Standard SKU item. Enter pricing and stock quantities below.
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Pricing & Taxation */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <IndianRupee className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              3. Pricing & Taxation
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Purchase Price (₹/{unit})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Selling Price (₹/{unit})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Applicable GST Rate (%)
              </label>
              <input
                type="number"
                min="0"
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
                placeholder="18"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Inventory & Stock Thresholds */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <ShieldAlert className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              4. Opening Stock & Reorder Levels
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Opening Stock ({unit})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
              <p className="text-[11px] text-slate-400 mt-1">Creates initial batch lot if &gt; 0</p>
            </div>

            {(category === "Granite" || (category === "Marble" && marbleType !== "Cut Size")) && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Estimated Stock (sqft)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={estimatedStock}
                  onChange={(e) => setEstimatedStock(e.target.value)}
                  placeholder="0"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Minimum Stock Alert Level
              </label>
              <input
                type="number"
                min="0"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                placeholder="10"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
              />
              <p className="text-[11px] text-slate-400 mt-1">Triggers dashboard warning</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3">
          <Link
            href="/dashboard/products"
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving Product...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Product</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Duplicate Product Confirmation Modal */}
      <ConfirmModal
        isOpen={duplicateModalOpen}
        title="Duplicate Product Detected"
        message={`A product named "${name.trim()}" already exists in category "${category}". If you are receiving new stock of this product at the same or different price, use "Add Purchase" instead.`}
        confirmText="Create Anyway as Distinct"
        cancelText="Switch to Add Purchase"
        isDanger={false}
        onConfirm={async () => {
          setDuplicateModalOpen(false);
          setSaving(true);
          try {
            await executeProductCreation();
          } catch (err) {
            console.error(err);
            showToast("Failed to create product", "error");
          } finally {
            setSaving(false);
          }
        }}
        onCancel={() => {
          setDuplicateModalOpen(false);
          if (duplicateId) {
            router.push(`/dashboard/purchases/add?productId=${duplicateId}`);
          }
        }}
      />
    </div>
  );
}