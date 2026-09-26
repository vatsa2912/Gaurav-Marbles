"use client";

import { useEffect, useState, use } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { normaliseLots, totalStock, type StockLot } from "@/lib/stockLots";

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Tiles");
  const [unit, setUnit] = useState("box");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [estimatedStock, setEstimatedStock] = useState("");
  const [size, setSize] = useState("");
  const [piecesPerBox, setPiecesPerBox] = useState("");
  const [gstRate, setGstRate] = useState("18");
  const [minimumStock, setMinimumStock] = useState("0");
  const [marbleType, setMarbleType] = useState("");
  const [marbleCutSize, setMarbleCutSize] = useState("");
  const [marblePieces, setMarblePieces] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [granitePieces, setGranitePieces] = useState("");
  const [graniteLotNumber, setGraniteLotNumber] = useState("");
  const [model, setModel] = useState("");
  const [material, setMaterial] = useState("");
  const [warranty, setWarranty] = useState("");
  const [weightVolume, setWeightVolume] = useState("");
  const [packType, setPackType] = useState("");
  const [stockLots, setStockLots] = useState<StockLot[]>([]);

  const [initialCategory, setInitialCategory] = useState("");
  const [categoryWarning, setCategoryWarning] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadProduct = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const productRef = doc(db, "products", id);
        const productSnap = await getDoc(productRef);

        if (!productSnap.exists()) {
          if (isMounted) setError("Product not found.");
          return;
        }

        const data = productSnap.data();

        if (isMounted) {
          setName(data.name || "");
          setCategory(data.category || "Tiles");
          setInitialCategory(data.category || "Tiles");
          setUnit(data.unit || "box");
          setPurchasePrice(
            data.purchasePrice !== undefined && data.purchasePrice !== null
              ? String(data.purchasePrice)
              : ""
          );
          setSellingPrice(
            data.sellingPrice !== undefined && data.sellingPrice !== null
              ? String(data.sellingPrice)
              : ""
          );
          setSize(data.size || "");
          setPiecesPerBox(
            data.piecesPerBox !== undefined && data.piecesPerBox !== null
              ? String(data.piecesPerBox)
              : ""
          );
          setGstRate(
            data.gstRate !== undefined && data.gstRate !== null
              ? String(data.gstRate)
              : "18"
          );
          setMinimumStock(
            data.minimumStock !== undefined && data.minimumStock !== null
              ? String(data.minimumStock)
              : "0"
          );
          setEstimatedStock(
            data.estimatedStock
              ? String(data.estimatedStock)
              : data.estimatedStockSqft
              ? String(data.estimatedStockSqft)
              : ""
          );
          setMarbleType(data.marbleType || "Slabs");
          setMarbleCutSize(data.size || data.marbleCutSize || "");
          setMarblePieces(data.marblePieces ? String(data.marblePieces) : "");
          setLotNumber(data.lotNumber || data.llotNumber || "");
          setGranitePieces(data.granitePieces ? String(data.granitePieces) : "");
          setGraniteLotNumber(data.graniteLotNumber || "");
          setModel(data.model || "");
          setMaterial(data.material || "");
          setWarranty(data.warranty || "");
          setWeightVolume(data.weightVolume || "");
          setPackType(data.packType || "");

          const lots = normaliseLots({
            id,
            stock: data.stock,
            purchasePrice: data.purchasePrice,
            stockLots: data.stockLots,
          });
          setStockLots(lots);
          setStock(String(totalStock(lots)));
        }
      } catch (err) {
        console.error("Error loading product:", err);
        if (isMounted) setError("Could not load product.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleCategoryChange = (newCategory: string) => {
    if (initialCategory && initialCategory !== newCategory && stockLots.length > 0) {
      setCategoryWarning(
        `⚠️ Warning: This product has ${stock} ${unit} in active stock. Changing category from "${initialCategory}" to "${newCategory}" will not delete your stock lots, but please ensure unit and metrics remain consistent.`
      );
    } else {
      setCategoryWarning("");
    }
    setCategory(newCategory);

    // Set default unit if switching
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");

      if (!name.trim()) {
        setError("Product name is required.");
        return;
      }

      const productRef = doc(db, "products", id);

      const updatePayload: Record<string, unknown> = {
        name: name.trim(),
        category,
        unit: unit || (category === "Marble" ? "sqft" : "piece"),
        sellingPrice: Number(sellingPrice) || 0,
        gstRate: Number(gstRate) || 0,
        minimumStock: Number(minimumStock) || 0,
        updatedAt: new Date(),
      };

      if (purchasePrice !== "" && !isNaN(Number(purchasePrice))) {
        updatePayload.purchasePrice = Number(purchasePrice);
      }

      // Category specific assignments
      if (category === "Tiles") {
        updatePayload.size = size;
        updatePayload.piecesPerBox = piecesPerBox ? Number(piecesPerBox) : null;
      } else if (category === "Marble") {
        updatePayload.marbleType = marbleType;
        if (marbleType === "Cut Size") {
          updatePayload.size = marbleCutSize.trim();
          updatePayload.marblePieces = marblePieces ? Number(marblePieces) : 0;
          if (estimatedStock !== "") {
            updatePayload.estimatedStock = Number(estimatedStock) || 0;
          }
          // Lot number is NOT relevant for Cut Size
        } else {
          updatePayload.marblePieces = marblePieces ? Number(marblePieces) : 0;
          updatePayload.lotNumber = lotNumber.trim();
          updatePayload.estimatedStock = Number(estimatedStock) || 0;
        }
      } else if (category === "Granite") {
        updatePayload.granitePieces = granitePieces ? Number(granitePieces) : 0;
        updatePayload.graniteLotNumber = graniteLotNumber.trim();
        updatePayload.estimatedStock = Number(estimatedStock) || 0;
      } else if (["Sanitary", "Taps", "Wash Basin", "Sink"].includes(category)) {
        updatePayload.model = model.trim();
        updatePayload.material = material.trim();
        updatePayload.warranty = warranty.trim();
      } else if (["Chemicals", "Adhesives"].includes(category)) {
        updatePayload.weightVolume = weightVolume.trim();
        updatePayload.packType = packType.trim();
      }

      // NOTICE: stock and stockLots are NOT in updatePayload.
      // They are 100% preserved on the document.
      await updateDoc(productRef, updatePayload);

      router.push("/dashboard/products");
    } catch (err) {
      console.error("Error updating product:", err);
      setError("Could not update product.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="page-main flex items-center justify-center p-12">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-gray-300 border-t-black rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted">Loading product details...</p>
        </div>
      </main>
    );
  }

  if (error && !name) {
    return (
      <main className="page-main">
        <div className="page-content-narrow">
          <div className="card text-center py-10">
            <p className="text-error font-medium">{error}</p>
            <Link href="/dashboard/products" className="btn-secondary mt-4 inline-block">
              ← Back to Products
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">Gaurav Marbles</h1>
        <p className="text-muted">Edit Product</p>
      </header>

      <div className="page-content-narrow">
        <div className="mb-6">
          <button
            onClick={() => router.push("/dashboard/products")}
            className="btn-ghost"
          >
            ← Back to Products
          </button>

          <h2 className="mt-4 text-2xl font-bold text-gray-900">
            Edit Product: {name}
          </h2>
          <p className="text-xs text-muted mt-1">
            Update catalog master specifications and selling price. Physical inventory and purchase lots are preserved automatically.
          </p>
        </div>

        {categoryWarning && (
          <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 font-medium">
            {categoryWarning}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Product Name */}
            <div className="form-field md:col-span-2">
              <label htmlFor="name">Product Name *</label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Category */}
            <div className="form-field">
              <label htmlFor="category">Category *</label>
              <select
                id="category"
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
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

            {/* Unit */}
            <div className="form-field">
              <label htmlFor="unit">Unit *</label>
              <select
                id="unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="box">box</option>
                <option value="sqft">sqft</option>
                <option value="piece">piece</option>
                <option value="kg">kg</option>
                <option value="meter">meter</option>
                <option value="liter">liter</option>
              </select>
            </div>

            {/* Category-Specific Fields */}
            {category === "Tiles" && (
              <>
                <div className="form-field">
                  <label htmlFor="size">Size</label>
                  <select
                    id="size"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                  >
                    <option value="">Select Size</option>
                    <option value="12x18">12x18</option>
                    <option value="2x4">2x4</option>
                    <option value="2x2">2x2</option>
                    <option value="16x16">16x16</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="piecesPerBox">Pieces per Box</label>
                  <input
                    id="piecesPerBox"
                    type="number"
                    min="1"
                    value={piecesPerBox}
                    onChange={(e) => setPiecesPerBox(e.target.value)}
                    placeholder="e.g. 5, 6, 8"
                  />
                </div>
              </>
            )}

            {category === "Marble" && (
              <>
                <div className="form-field">
                  <label htmlFor="marbleType">Marble Type</label>
                  <select
                    id="marbleType"
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
                  >
                    <option value="Slabs">Slabs</option>
                    <option value="Cut Size">Cut Size</option>
                  </select>
                </div>

                {marbleType === "Cut Size" ? (
                  <>
                    <div className="form-field">
                      <label htmlFor="marbleCutSize">Cut Size (e.g. 2x4, 2x2, 3x6)</label>
                      <input
                        id="marbleCutSize"
                        type="text"
                        value={marbleCutSize}
                        onChange={(e) => setMarbleCutSize(e.target.value)}
                        placeholder="e.g. 2x4, 2x2, 3x6"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="marblePieces">Pieces</label>
                      <input
                        id="marblePieces"
                        type="number"
                        min="0"
                        value={marblePieces}
                        onChange={(e) => setMarblePieces(e.target.value)}
                        placeholder="Total pieces"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-field">
                      <label htmlFor="marblePieces">Pieces</label>
                      <input
                        id="marblePieces"
                        type="number"
                        min="0"
                        value={marblePieces}
                        onChange={(e) => setMarblePieces(e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="lotNumber">Lot Number</label>
                      <input
                        id="lotNumber"
                        type="text"
                        value={lotNumber}
                        onChange={(e) => setLotNumber(e.target.value)}
                        placeholder="Lot identifier"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="estimatedStock">Estimated Stock (sqft)</label>
                      <input
                        id="estimatedStock"
                        type="number"
                        min="0"
                        value={estimatedStock}
                        onChange={(e) => setEstimatedStock(e.target.value)}
                        placeholder="Estimated sqft"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {category === "Granite" && (
              <>
                <div className="form-field">
                  <label htmlFor="granitePieces">Pieces</label>
                  <input
                    id="granitePieces"
                    type="number"
                    min="0"
                    value={granitePieces}
                    onChange={(e) => setGranitePieces(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="graniteLotNumber">Lot Number</label>
                  <input
                    id="graniteLotNumber"
                    type="text"
                    value={graniteLotNumber}
                    onChange={(e) => setGraniteLotNumber(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="estimatedStock">Estimated Stock (sqft)</label>
                  <input
                    id="estimatedStock"
                    type="number"
                    min="0"
                    value={estimatedStock}
                    onChange={(e) => setEstimatedStock(e.target.value)}
                    placeholder="Estimated sqft"
                  />
                </div>
              </>
            )}

            {["Sanitary", "Taps", "Wash Basin", "Sink"].includes(category) && (
              <>
                <div className="form-field">
                  <label htmlFor="model">Model / Design</label>
                  <input
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="material">Material</label>
                  <input
                    id="material"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="warranty">Warranty</label>
                  <input
                    id="warranty"
                    value={warranty}
                    onChange={(e) => setWarranty(e.target.value)}
                    placeholder="e.g. 5 Years"
                  />
                </div>
              </>
            )}

            {["Chemicals", "Adhesives"].includes(category) && (
              <>
                <div className="form-field">
                  <label htmlFor="weightVolume">Weight / Volume</label>
                  <input
                    id="weightVolume"
                    value={weightVolume}
                    onChange={(e) => setWeightVolume(e.target.value)}
                    placeholder="e.g. 20 kg, 1 Liter"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="packType">Packaging</label>
                  <input
                    id="packType"
                    value={packType}
                    onChange={(e) => setPackType(e.target.value)}
                    placeholder="e.g. Bag, Bucket, Tin"
                  />
                </div>
              </>
            )}

            {/* Price & Stock Section */}
            <div className="form-field">
              <label htmlFor="sellingPrice">Current Selling Price (₹) *</label>
              <input
                id="sellingPrice"
                type="number"
                min="0"
                step="any"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0"
                required
              />
              <span className="text-[11px] text-muted">
                Active customer sale rate for this product.
              </span>
            </div>

            <div className="form-field">
              <label htmlFor="purchasePrice">Reference Purchase Price (₹)</label>
              <input
                id="purchasePrice"
                type="number"
                min="0"
                step="any"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0"
              />
              <span className="text-[11px] text-muted">
                Cost rate. Multi-price batches are tracked in active lots below.
              </span>
            </div>

            <div className="form-field">
              <label htmlFor="gstRate">GST Rate (%)</label>
              <select
                id="gstRate"
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="minimumStock">Minimum Stock Alert</label>
              <input
                id="minimumStock"
                type="number"
                min="0"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Current Stock (Read-Only) */}
            <div className="form-field md:col-span-2">
              <label htmlFor="stock">Total Available Physical Stock</label>
              <input
                id="stock"
                type="text"
                value={`${stock} ${category === "Marble" && marbleType === "Cut Size" ? "piece" : unit}`}
                disabled
                className="bg-gray-100 text-gray-800 cursor-not-allowed font-bold text-base"
              />
              <p className="text-xs text-muted mt-1">
                Stock is protected and managed automatically via purchases and sales. To add more stock, use{" "}
                <Link
                  href={`/dashboard/purchases/add?productId=${id}`}
                  className="text-blue-600 underline font-semibold"
                >
                  Add Purchase
                </Link>.
              </p>
            </div>

            {/* Active Stock Lots Breakdown (Read-Only) */}
            <div className="md:col-span-2 mt-2 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-800">
                  Active Stock Lots ({stockLots.length})
                </h3>
                <span className="text-xs text-muted font-medium">
                  Sum of lots: {totalStock(stockLots)} {category === "Marble" && marbleType === "Cut Size" ? "piece" : unit}
                </span>
              </div>

              {stockLots.length === 0 ? (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded text-xs text-muted italic">
                  No active stock lots found for this product (inventory is 0).
                </div>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="py-2 px-3 font-medium">Lot ID</th>
                        <th className="py-2 px-3 font-medium">Purchased Date</th>
                        <th className="py-2 px-3 font-medium">Qty Remaining</th>
                        <th className="py-2 px-3 font-medium">Purchase Cost</th>
                        <th className="py-2 px-3 font-medium">Lot Valuation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {stockLots.map((lot) => (
                        <tr key={lot.lotId} className="hover:bg-gray-50">
                          <td className="py-2 px-3 font-mono text-gray-800">{lot.lotId}</td>
                          <td className="py-2 px-3 text-gray-600">{lot.purchasedAt || "—"}</td>
                          <td className="py-2 px-3 font-semibold text-gray-900">
                            {lot.remainingQuantity ?? lot.quantity} {category === "Marble" && marbleType === "Cut Size" ? "piece" : unit}
                          </td>
                          <td className="py-2 px-3 text-gray-600">₹{lot.purchasePrice.toLocaleString("en-IN")}</td>
                          <td className="py-2 px-3 font-semibold text-emerald-700">
                            ₹{(lot.quantity * lot.purchasePrice).toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-error mt-5">{error}</p>}

          <div className="mt-8 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard/products")}
              className="btn-secondary w-full sm:w-auto text-center justify-center"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full sm:w-auto text-center justify-center"
            >
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
