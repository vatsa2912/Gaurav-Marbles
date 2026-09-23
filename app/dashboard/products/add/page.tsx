"use client";

import { useState } from "react";
import Link from "next/link";
import { addDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateLotId } from "@/lib/stockLots";
import { useRouter } from "next/navigation";


export default function AddProductPage() {
  const router = useRouter();

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [marblePieces, setMarblePieces] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [graniteQuantity, setGraniteQuantity] = useState("");
  const [granitePieces, setGranitePieces] = useState("");
  const [graniteLotNumber, setGraniteLotNumber] = useState("");

  const handleCategoryChange = (newCategory: string) => {
    setCategory(newCategory);

    // Set default unit per category
    if (newCategory === "Tiles") {
      setUnit("box");
    } else if (newCategory === "Marble" || newCategory === "Granite") {
      setUnit("sqft");
    } else if (
      ["Sanitary", "Taps", "Wash Basin", "Sink"].includes(newCategory)
    ) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");

    if (!name.trim()) {
      setError("Please enter product name.");
      return;
    }

    try {
      setSaving(true);

      // Duplicate product check
      const existingSnap = await getDocs(collection(db, "products"));
      const duplicate = existingSnap.docs.find((d) => {
        const data = d.data();
        const sameName = (data.name || "").trim().toLowerCase() === name.trim().toLowerCase();
        const sameCategory = (data.category || "").trim().toLowerCase() === category.trim().toLowerCase();
        return sameName && sameCategory;
      });

      if (duplicate) {
        const confirmed = window.confirm(
          `A product named "${name.trim()}" already exists in category "${category}".\n\n` +
          `• If you are purchasing new stock of this product at the same or different price, please use "Add Purchase" instead of creating a duplicate product.\n\n` +
          `• Click CANCEL to switch to Add Purchase for this product.\n` +
          `• Click OK only if you genuinely intend to create a separate distinct product.`
        );
        if (!confirmed) {
          router.push(`/dashboard/purchases/add?productId=${duplicate.id}`);
          return;
        }
      }

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

        size: category === "Tiles" ? size : category === "Marble" && marbleType === "Cut Size" ? marbleCutSize : "",
        piecesPerBox: category === "Tiles" && piecesPerBox ? Number(piecesPerBox) : null,
        marbleType: category === "Marble" ? marbleType : "",
        marbleQuantity: category === "Marble" && marbleType !== "Cut Size" && marbleQuantity ? Number(marbleQuantity) : 0,
        marblePieces: category === "Marble" && marblePieces ? Number(marblePieces) : 0,
        lotNumber: category === "Marble" && marbleType !== "Cut Size" ? lotNumber.trim() : "",
        graniteQuantity: category === "Granite" && graniteQuantity ? Number(graniteQuantity) : 0,
        granitePieces: category === "Granite" && granitePieces ? Number(granitePieces) : 0,
        graniteLotNumber: category === "Granite" ? graniteLotNumber.trim() : "",
        type: "",
        model: ["Sanitary", "Taps", "Wash Basin", "Sink"].includes(category) ? model.trim() : "",
        material: ["Sanitary", "Taps", "Wash Basin", "Sink"].includes(category) ? material.trim() : "",
        warranty: ["Sanitary", "Taps", "Wash Basin", "Sink"].includes(category) ? warranty.trim() : "",

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

      router.push("/dashboard/products");
    } catch (error) {
      console.error(error);
      setError("Could not save product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">Gaurav Marbles</h1>

        <p className="text-muted">Add Product</p>
      </header>

      <div className="page-content-narrow">
        <div className="mb-6">
          <button
            onClick={() => router.push("/dashboard/products")}
            className="btn-ghost"
          >
            ← Back to Products
          </button>

          <h2 className="mt-4 text-2xl">Add New Product</h2>
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center justify-between">
            <span>
              ℹ️ <strong>Product Master:</strong> You only need to enter Product Name and Category to register a product into your master catalog. Stock, Purchase Price, and Selling Price are completely optional — they can be left at 0 and added later via{" "}
              <Link href="/dashboard/purchases/add" className="font-semibold underline hover:text-blue-900">
                Add Purchase
              </Link>.
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Product Name */}
            <div className="form-field md:col-span-2">
              <label htmlFor="name">Product Name *</label>

              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Example: Kajaria Royal"
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
                required
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
                disabled={category === "Tiles" || category === "Marble" || category === "Granite"}
                className={category === "Tiles" || category === "Marble" || category === "Granite" ? "bg-gray-100 cursor-not-allowed" : ""}
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

            {/* Category-specific fields */}
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
                    placeholder="e.g. 5, 6, 8 (for sqft calculation)"
                  />
                </div>

                {/* Purchase Price */}
                <div className="form-field">
                  <label htmlFor="purchasePrice">Purchase Price (per box, optional)</label>

                  <input
                    id="purchasePrice"
                    type="number"
                    min="0"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="0"
                  />
                </div>

                {/* Selling Price */}
                <div className="form-field">
                  <label htmlFor="sellingPrice">Selling Price (per box, optional)</label>

                  <input
                    id="sellingPrice"
                    type="number"
                    min="0"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="0"
                  />
                </div>

                {/* Opening Stock */}
                <div className="form-field">
                  <label htmlFor="stock">Opening Stock in boxes (optional)</label>

                  <input
                    id="stock"
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </>
            )}

            {category === "Marble" && (
              <>
                {/* Marble Type */}
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
                    <option value="">Select Type</option>
                    <option value="Slabs">Slabs</option>
                    <option value="Cut Size">Cut Size</option>
                  </select>
                </div>

                {marbleType === "Cut Size" ? (
                  <div className="form-field">
                    <label htmlFor="marbleCutSize">Cut Size</label>

                    <input
                      id="marbleCutSize"
                      type="text"
                      value={marbleCutSize}
                      onChange={(e) => setMarbleCutSize(e.target.value)}
                      placeholder="Example: 2x4, 2x2, 3x6"
                    />
                  </div>
                ) : (
                  <>
                    <div className="form-field">
                      <label htmlFor="marbleQuantity">
                        Opening Quantity (sqft, optional)
                      </label>

                      <input
                        id="marbleQuantity"
                        type="number"
                        min="0"
                        value={marbleQuantity}
                        onChange={(e) => setMarbleQuantity(e.target.value)}
                        placeholder="Enter quantity in sqft"
                      />
                    </div>

                    {/* Pieces */}
                    <div className="form-field">
                      <label htmlFor="marblePieces">Pieces (optional)</label>

                      <input
                        id="marblePieces"
                        type="number"
                        min="0"
                        value={marblePieces}
                        onChange={(e) => setMarblePieces(e.target.value)}
                        placeholder="Enter number of pieces"
                      />
                    </div>

                    {/* Lot Number */}
                    <div className="form-field">
                      <label htmlFor="lotNumber">Lot Number (optional)</label>

                      <input
                        id="lotNumber"
                        type="text"
                        value={lotNumber}
                        onChange={(e) => setLotNumber(e.target.value)}
                        placeholder="Enter lot number"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {category === "Granite" && (
              <>
                {/* Granite Quantity */}
                <div className="form-field">
                  <label htmlFor="graniteQuantity">
                    Quantity {unit === "sqft" ? "(sqft)" : "(pieces)"}
                  </label>

                  <input
                    id="graniteQuantity"
                    type="number"
                    min="0"
                    value={graniteQuantity}
                    onChange={(e) => setGraniteQuantity(e.target.value)}
                    placeholder={
                      unit === "sqft"
                        ? "Enter quantity in sqft"
                        : "Enter quantity in pieces"
                    }
                  />
                </div>

                {/* Granite Pieces */}
                <div className="form-field">
                  <label htmlFor="granitePieces">Pieces</label>

                  <input
                    id="granitePieces"
                    type="number"
                    min="0"
                    value={granitePieces}
                    onChange={(e) => setGranitePieces(e.target.value)}
                    placeholder="Enter number of pieces"
                  />
                </div>

                {/* Granite Lot Number */}
                <div className="form-field">
                  <label htmlFor="graniteLotNumber">Lot Number</label>

                  <input
                    id="graniteLotNumber"
                    type="text"
                    value={graniteLotNumber}
                    onChange={(e) => setGraniteLotNumber(e.target.value)}
                    placeholder="Enter lot number"
                  />
                </div>
              </>
            )}

            {["Sanitary", "Taps", "Wash Basin", "Sink"].includes(category) && (
              <>
                <div className="form-field">
                  <label htmlFor="model">Model</label>

                  <input
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Example: Model 123"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="material">Material</label>

                  <input
                    id="material"
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    placeholder="Example: Brass"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="warranty">Warranty</label>

                  <input
                    id="warranty"
                    value={warranty}
                    onChange={(e) => setWarranty(e.target.value)}
                    placeholder="Example: 5 years"
                  />
                </div>
              </>
            )}

            {/* Non-Tiles: Opening Stock, Estimated Stock (Marble/Granite), Purchase Price, Selling Price */}
            {category !== "Tiles" && (
              <>
                {/* Opening Stock */}
                <div className="form-field">
                  <label htmlFor="stock">
                    {category === "Marble" && marbleType === "Cut Size"
                      ? "Opening Stock in pieces (optional)"
                      : category === "Marble" || category === "Granite"
                      ? "Opening Stock in sqft (optional)"
                      : `Opening Stock (${unit}, optional)`}
                  </label>

                  <input
                    id="stock"
                    type="number"
                    min="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="0"
                  />
                </div>

                {(category === "Granite" || (category === "Marble" && marbleType !== "Cut Size")) && (
                  <div className="form-field">
                    <label htmlFor="estimatedStock">
                      Estimated Stock in sqft (optional)
                    </label>

                    <input
                      id="estimatedStock"
                      type="number"
                      min="0"
                      value={estimatedStock}
                      onChange={(e) => setEstimatedStock(e.target.value)}
                      placeholder="Enter estimated stock in sqft"
                    />
                  </div>
                )}

                {/* Purchase Price */}
                <div className="form-field">
                  <label htmlFor="purchasePrice">
                    {category === "Marble" && marbleType === "Cut Size"
                      ? "Purchase Price per piece (optional)"
                      : category === "Marble" || category === "Granite"
                      ? "Purchase Price per sqft (optional)"
                      : `Purchase Price (${unit}, optional)`}
                  </label>

                  <input
                    id="purchasePrice"
                    type="number"
                    min="0"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="0"
                  />
                </div>

                {/* Selling Price */}
                <div className="form-field">
                  <label htmlFor="sellingPrice">
                    {category === "Marble" && marbleType === "Cut Size"
                      ? "Selling Price per piece (optional)"
                      : category === "Marble" || category === "Granite"
                      ? "Selling Price per sqft (optional)"
                      : `Selling Price (${unit}, optional)`}
                  </label>

                  <input
                    id="sellingPrice"
                    type="number"
                    min="0"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </>
            )}

            {/* GST */}
            <div className="form-field">
              <label htmlFor="gstRate">GST %</label>

              <input
                id="gstRate"
                type="number"
                min="0"
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
              />
            </div>

            {/* Minimum Stock */}
            <div className="form-field">
              <label htmlFor="minimumStock">Minimum Stock</label>

              <input
                id="minimumStock"
                type="number"
                min="0"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                placeholder="Example: 10"
              />
            </div>
          </div>

          {error && <p className="text-error mt-5">{error}</p>}

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard/products")}
              className="btn-secondary"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Saving..." : "Save Product"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}