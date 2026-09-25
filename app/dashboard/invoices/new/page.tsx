"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  type InvoiceItem,
  type PartyDetails,
  type ShopSettings,
  type TaxType,
  DEFAULT_SHOP_SETTINGS,
  calculateInvoiceTotals,
  calculateItemAmount,
} from "@/lib/invoiceTypes";
import {
  getShopSettings,
  peekNextInvoiceNumber,
  saveInvoice,
} from "@/lib/invoiceService";
import { getTodayDateString } from "@/lib/dateUtils";
import TaxInvoiceDocument from "@/components/invoices/TaxInvoiceDocument";
import { useToast } from "@/components/ui/ToastContext";

type Customer = {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  gstin?: string;
};

type Product = {
  id: string;
  name: string;
  category: string;
  size?: string;
  unit: string;
  sellingPrice: number;
  stock: number;
  hsn?: string;
};

export default function NewInvoicePage() {
  const router = useRouter();
  const { showToast } = useToast();

  // Settings & Reference Data
  const [settings, setSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Invoice Metadata
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(getTodayDateString());
  const [deliveryNote, setDeliveryNote] = useState("");
  const [paymentMode, setPaymentMode] = useState("Immediate");
  const [supplierRef, setSupplierRef] = useState("");
  const [otherRef, setOtherRef] = useState("");
  const [buyerOrderNo, setBuyerOrderNo] = useState("");
  const [buyerOrderDate, setBuyerOrderDate] = useState("");
  const [dispatchDocNo, setDispatchDocNo] = useState("");
  const [deliveryNoteDate, setDeliveryNoteDate] = useState("");
  const [dispatchedThrough, setDispatchedThrough] = useState("");
  const [destination, setDestination] = useState("");
  const [termsOfDelivery, setTermsOfDelivery] = useState("Ex-Shop / Standard Delivery");

  // Parties
  const [consignee, setConsignee] = useState<PartyDetails>({
    name: "",
    address: "",
    address2: "",
    gstin: "",
    state: "Uttar Pradesh",
    stateCode: "09",
    phone: "",
  });

  const [sameAsConsignee, setSameAsConsignee] = useState(true);
  const [buyer, setBuyer] = useState<PartyDetails>({
    name: "",
    address: "",
    address2: "",
    gstin: "",
    state: "Uttar Pradesh",
    stateCode: "09",
    phone: "",
  });

  // Items
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      id: "item-1",
      productName: "",
      category: "Tiles",
      size: "",
      hsn: "6907",
      quantity: 1,
      unit: "box",
      rate: 0,
      amount: 0,
    },
  ]);

  // Tax Setup
  const [taxType, setTaxType] = useState<TaxType>("CGST_SGST");
  const [cgstRate, setCgstRate] = useState(9);
  const [sgstRate, setSgstRate] = useState(9);
  const [igstRate, setIgstRate] = useState(18);

  // UI State
  const [activeTab, setActiveTab] = useState<"form" | "preview">("form");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Customer Autocomplete dropdown state
  const [custQuery, setCustQuery] = useState("");
  const [custDropdownOpen, setCustDropdownOpen] = useState(false);
  const custRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const loadInitial = async () => {
      try {
        const [shopCfg, custSnap, prodSnap, nextInvNum] = await Promise.all([
          getShopSettings(),
          getDocs(collection(db, "customers")),
          getDocs(collection(db, "products")),
          peekNextInvoiceNumber(),
        ]);

        if (!isMounted) return;

        setSettings(shopCfg);
        setCgstRate(shopCfg.defaultCgstRate ?? 9);
        setSgstRate(shopCfg.defaultSgstRate ?? 9);
        setIgstRate(shopCfg.defaultIgstRate ?? 18);
        setInvoiceNumber(nextInvNum);

        setCustomers(
          custSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Customer, "id">),
          }))
        );

        setProducts(
          prodSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Product, "id">),
          }))
        );
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInitial();

    return () => {
      isMounted = false;
    };
  }, []);

  // Close customer dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (custRef.current && !custRef.current.contains(e.target as Node)) {
        setCustDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectCustomer = (c: Customer) => {
    const updatedConsignee: PartyDetails = {
      name: c.name,
      address: c.address || "",
      address2: "",
      gstin: c.gstin || "",
      state: "Uttar Pradesh",
      stateCode: "09",
      phone: c.phone || "",
    };
    setConsignee(updatedConsignee);
    if (sameAsConsignee) {
      setBuyer(updatedConsignee);
    }
    setCustQuery(c.name);
    setCustDropdownOpen(false);
  };

  const handleConsigneeChange = (field: keyof PartyDetails, val: string) => {
    const updated = { ...consignee, [field]: val };
    setConsignee(updated);
    if (sameAsConsignee) {
      setBuyer(updated);
    }
  };

  const handleItemChange = (
    index: number,
    field: keyof InvoiceItem,
    val: unknown
  ) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: val };

      // Category unit locking
      if (field === "category") {
        if (val === "Tiles") {
          item.unit = "box";
          item.hsn = settings.defaultTilesHsn || "6907";
        } else if (val === "Marble") {
          item.unit = "sqft";
          item.hsn = settings.defaultMarbleHsn || "6802";
        } else if (val === "Granite") {
          item.unit = "sqft";
          item.hsn = settings.defaultGraniteHsn || "6802";
        }
      }

      if (field === "quantity" || field === "rate") {
        item.amount = calculateItemAmount(item.quantity, item.rate);
      }

      next[index] = item;
      return next;
    });
  };

  const selectProductForItem = (index: number, productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    setItems((prev) => {
      const next = [...prev];
      const cat = prod.category || "Tiles";
      let unit = "box";
      let defaultHsn = settings.defaultTilesHsn || "6907";

      if (cat === "Marble") {
        unit = "sqft";
        defaultHsn = settings.defaultMarbleHsn || "6802";
      } else if (cat === "Granite") {
        unit = "sqft";
        defaultHsn = settings.defaultGraniteHsn || "6802";
      }

      const rate = prod.sellingPrice || 0;
      const qty = next[index]?.quantity || 1;

      next[index] = {
        ...next[index],
        productId: prod.id,
        productName: prod.name,
        category: cat,
        size: prod.size || "",
        unit,
        hsn: prod.hsn || defaultHsn,
        rate,
        quantity: qty,
        amount: calculateItemAmount(qty, rate),
      };

      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length}`,
        productName: "",
        category: "Tiles",
        size: "",
        hsn: settings.defaultTilesHsn || "6907",
        quantity: 1,
        unit: "box",
        rate: 0,
        amount: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      showToast("An invoice must contain at least one item.", "error");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totals = calculateInvoiceTotals({
    items,
    taxType,
    cgstRate,
    sgstRate,
    igstRate,
  });

  const handleSubmit = async (status: "Draft" | "Confirmed") => {
    setError("");

    if (!consignee.name.trim()) {
      setError("Please provide a Consignee / Customer name.");
      setActiveTab("form");
      return;
    }

    if (items.some((i) => !i.productName.trim() || i.quantity <= 0 || i.rate < 0)) {
      setError("Please ensure all item names, positive quantities, and rates are filled.");
      setActiveTab("form");
      return;
    }

    try {
      setSaving(true);

      const invoiceData = {
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate,
        deliveryNote,
        paymentMode,
        supplierRef,
        otherRef,
        buyerOrderNo,
        buyerOrderDate,
        dispatchDocNo,
        deliveryNoteDate,
        dispatchedThrough,
        destination,
        termsOfDelivery,
        consignee,
        buyer: sameAsConsignee ? consignee : buyer,
        items,
        taxType,
        cgstRate,
        sgstRate,
        igstRate,
        subtotal: totals.subtotal,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        totalTax: totals.totalTax,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        amountInWords: totals.amountInWords,
        taxAmountInWords: totals.taxAmountInWords,
        status,
        stockUpdated: false, // Stock is never deducted on draft creation
      };

      const newId = await saveInvoice(invoiceData);
      router.push(`/dashboard/invoices/${newId}`);
    } catch (err) {
      console.error("Save invoice error:", err);
      setError(err instanceof Error ? err.message : "Failed to save invoice.");
      setSaving(false);
    }
  };

  // Preview object
  const previewInvoice = {
    id: "preview-temp-id",
    invoiceNumber: invoiceNumber || "GM/PREVIEW/0001",
    invoiceDate,
    deliveryNote,
    paymentMode,
    supplierRef,
    otherRef,
    buyerOrderNo,
    buyerOrderDate,
    dispatchDocNo,
    deliveryNoteDate,
    dispatchedThrough,
    destination,
    termsOfDelivery,
    consignee,
    buyer: sameAsConsignee ? consignee : buyer,
    items,
    taxType,
    cgstRate,
    sgstRate,
    igstRate,
    subtotal: totals.subtotal,
    cgstAmount: totals.cgstAmount,
    sgstAmount: totals.sgstAmount,
    igstAmount: totals.igstAmount,
    totalTax: totals.totalTax,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    amountInWords: totals.amountInWords,
    taxAmountInWords: totals.taxAmountInWords,
    status: "Draft" as const,
    stockUpdated: false,
  };

  if (loading) {
    return (
      <main className="page-main p-8 text-center text-muted">
        Loading invoice builder...
      </main>
    );
  }

  return (
    <main className="page-main">
      <header className="site-header no-print">
        <h1 className="text-xl font-bold">Gaurav Marbles</h1>
        <p className="text-muted">Generate Tax Invoice</p>
      </header>

      <div className="page-content">
        {/* Top Header & Tab Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 no-print">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/invoices"
                className="text-xs text-blue-600 hover:underline"
              >
                ← Back to Invoices
              </Link>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">Generate Tax Invoice</h2>
            <p className="text-muted text-sm">
              Standard Indian GST billing layout with automated tax calculations
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Form vs Preview Toggle */}
            <div className="bg-gray-200 p-0.5 rounded-lg flex text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("form")}
                className={`px-3 py-1.5 rounded-md transition ${
                  activeTab === "form"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Edit Form
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1.5 rounded-md transition ${
                  activeTab === "preview"
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Live A4 Preview
              </button>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit("Draft")}
              className="btn-secondary text-sm"
            >
              {saving ? "Saving..." : "Save as Draft"}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSubmit("Confirmed")}
              className="btn-primary text-sm"
            >
              {saving ? "Saving..." : "Save & Review"}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-6 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 no-print">
            {error}
          </div>
        )}

        {/* ─── TAB 1: FORM VIEW ────────────────────────────────────────────── */}
        {activeTab === "form" && (
          <div className="space-y-6">
            {/* Section 1: Invoice Header & Dispatch Metadata */}
            <div className="card">
              <h3 className="text-base font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                1. Invoice &amp; Dispatch Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="form-field">
                  <label htmlFor="invNum">Invoice Number</label>
                  <input
                    id="invNum"
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="invDate">Invoice Date</label>
                  <input
                    id="invDate"
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="payMode">Payment Mode / Terms</label>
                  <select
                    id="payMode"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                  >
                    <option value="Immediate">Immediate</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="NEFT / RTGS / UPI">NEFT / RTGS / UPI</option>
                    <option value="Credit / Due">Credit / Due</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="delNote">Delivery Note</label>
                  <input
                    id="delNote"
                    type="text"
                    placeholder="e.g. DN-2026-01"
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="suppRef">Reference No. &amp; Date</label>
                  <input
                    id="suppRef"
                    type="text"
                    placeholder="e.g. Ref #102, 14-09-2026"
                    value={supplierRef}
                    onChange={(e) => setSupplierRef(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="otherRef">Other References</label>
                  <input
                    id="otherRef"
                    type="text"
                    placeholder="Optional remarks"
                    value={otherRef}
                    onChange={(e) => setOtherRef(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="buyerOrder">Buyer&apos;s Order No.</label>
                  <input
                    id="buyerOrder"
                    type="text"
                    placeholder="PO number"
                    value={buyerOrderNo}
                    onChange={(e) => setBuyerOrderNo(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="buyerOrderDate">Buyer Order Date</label>
                  <input
                    id="buyerOrderDate"
                    type="date"
                    value={buyerOrderDate}
                    onChange={(e) => setBuyerOrderDate(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="dispatchDoc">Dispatch Doc No.</label>
                  <input
                    id="dispatchDoc"
                    type="text"
                    placeholder="Challan / E-Way bill"
                    value={dispatchDocNo}
                    onChange={(e) => setDispatchDocNo(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="deliveryNoteDate">Delivery Note Date</label>
                  <input
                    id="deliveryNoteDate"
                    type="date"
                    value={deliveryNoteDate}
                    onChange={(e) => setDeliveryNoteDate(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="dispatchThrough">Dispatched through</label>
                  <input
                    id="dispatchThrough"
                    type="text"
                    placeholder="e.g. Mini Truck / UP-83-T-1234"
                    value={dispatchedThrough}
                    onChange={(e) => setDispatchedThrough(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="destination">Destination</label>
                  <input
                    id="destination"
                    type="text"
                    placeholder="City / Site location"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="termsDelivery">Terms of Delivery</label>
                  <input
                    id="termsDelivery"
                    type="text"
                    value={termsOfDelivery}
                    onChange={(e) => setTermsOfDelivery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Consignee & Buyer Customer Details */}
            <div className="card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-2 mb-4">
                <h3 className="text-base font-bold text-gray-900">
                  2. Customer &amp; Billing Parties
                </h3>

                {/* Customer quick autocomplete */}
                <div ref={custRef} className="relative mt-2 sm:mt-0 min-w-[240px]">
                  <input
                    type="text"
                    placeholder="Search existing customer…"
                    value={custQuery}
                    onFocus={() => setCustDropdownOpen(true)}
                    onChange={(e) => {
                      setCustQuery(e.target.value);
                      setCustDropdownOpen(true);
                    }}
                    className="text-xs py-1.5 px-3"
                  />
                  {custDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 z-30 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                      {customers
                        .filter((c) =>
                          c.name.toLowerCase().includes(custQuery.toLowerCase()) ||
                          (c.phone || "").includes(custQuery)
                        )
                        .slice(0, 6)
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={() => selectCustomer(c)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 border-b border-gray-100"
                          >
                            <div className="font-bold text-gray-900">{c.name}</div>
                            {c.phone && <div className="text-muted">{c.phone}</div>}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Consignee / Ship To */}
                <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-200 space-y-3">
                  <div className="font-bold text-xs uppercase tracking-wider text-gray-700">
                    Consignee / Ship To
                  </div>

                  <div className="form-field">
                    <label>Customer Name *</label>
                    <input
                      type="text"
                      placeholder="Full Name / Firm Name"
                      value={consignee.name}
                      onChange={(e) => handleConsigneeChange("name", e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label>Address</label>
                    <input
                      type="text"
                      placeholder="Street address, site location"
                      value={consignee.address}
                      onChange={(e) => handleConsigneeChange("address", e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-field">
                      <label>GSTIN / UIN (Optional)</label>
                      <input
                        type="text"
                        placeholder="GST number if registered"
                        value={consignee.gstin || ""}
                        onChange={(e) => handleConsigneeChange("gstin", e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label>Contact Phone</label>
                      <input
                        type="text"
                        placeholder="Phone number"
                        value={consignee.phone || ""}
                        onChange={(e) => handleConsigneeChange("phone", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-field">
                      <label>State Name</label>
                      <input
                        type="text"
                        value={consignee.state}
                        onChange={(e) => handleConsigneeChange("state", e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label>State Code</label>
                      <input
                        type="text"
                        value={consignee.stateCode}
                        onChange={(e) => handleConsigneeChange("stateCode", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Buyer / Bill To */}
                <div className="p-4 bg-gray-50/70 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs uppercase tracking-wider text-gray-700">
                      Buyer / Bill To
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-blue-700">
                      <input
                        type="checkbox"
                        checked={sameAsConsignee}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSameAsConsignee(checked);
                          if (checked) {
                            setBuyer(consignee);
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      Same as Consignee
                    </label>
                  </div>

                  <div className="form-field">
                    <label>Buyer Name</label>
                    <input
                      type="text"
                      disabled={sameAsConsignee}
                      value={sameAsConsignee ? consignee.name : buyer.name}
                      onChange={(e) =>
                        setBuyer((b) => ({ ...b, name: e.target.value }))
                      }
                      className={sameAsConsignee ? "bg-gray-100 text-gray-500" : ""}
                    />
                  </div>

                  <div className="form-field">
                    <label>Billing Address</label>
                    <input
                      type="text"
                      disabled={sameAsConsignee}
                      value={sameAsConsignee ? consignee.address : buyer.address}
                      onChange={(e) =>
                        setBuyer((b) => ({ ...b, address: e.target.value }))
                      }
                      className={sameAsConsignee ? "bg-gray-100 text-gray-500" : ""}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-field">
                      <label>Buyer GSTIN / UIN</label>
                      <input
                        type="text"
                        disabled={sameAsConsignee}
                        value={sameAsConsignee ? consignee.gstin : buyer.gstin}
                        onChange={(e) =>
                          setBuyer((b) => ({ ...b, gstin: e.target.value }))
                        }
                        className={sameAsConsignee ? "bg-gray-100 text-gray-500" : ""}
                      />
                    </div>
                    <div className="form-field">
                      <label>Buyer Contact</label>
                      <input
                        type="text"
                        disabled={sameAsConsignee}
                        value={sameAsConsignee ? consignee.phone : buyer.phone}
                        onChange={(e) =>
                          setBuyer((b) => ({ ...b, phone: e.target.value }))
                        }
                        className={sameAsConsignee ? "bg-gray-100 text-gray-500" : ""}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-field">
                      <label>State Name</label>
                      <input
                        type="text"
                        disabled={sameAsConsignee}
                        value={sameAsConsignee ? consignee.state : buyer.state}
                        onChange={(e) =>
                          setBuyer((b) => ({ ...b, state: e.target.value }))
                        }
                        className={sameAsConsignee ? "bg-gray-100 text-gray-500" : ""}
                      />
                    </div>
                    <div className="form-field">
                      <label>State Code</label>
                      <input
                        type="text"
                        disabled={sameAsConsignee}
                        value={sameAsConsignee ? consignee.stateCode : buyer.stateCode}
                        onChange={(e) =>
                          setBuyer((b) => ({ ...b, stateCode: e.target.value }))
                        }
                        className={sameAsConsignee ? "bg-gray-100 text-gray-500" : ""}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Goods Items Table */}
            <div className="card">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    3. Goods &amp; Line Items
                  </h3>
                  <p className="text-xs text-muted">
                    Units are category-aware: Tiles use <b>box</b>, Marble &amp; Granite use <b>sqft</b>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  className="btn-secondary text-xs inline-flex items-center gap-1"
                >
                  + Add Item
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b-2 border-gray-700 bg-gray-50 text-gray-800">
                      <th className="py-2 px-2 w-8">#</th>
                      <th className="py-2 px-2 min-w-[200px]">Product / Description</th>
                      <th className="py-2 px-2 min-w-[90px]">Category</th>
                      <th className="py-2 px-2 min-w-[80px]">Size</th>
                      <th className="py-2 px-2 min-w-[80px]">HSN/SAC</th>
                      <th className="py-2 px-2 min-w-[90px]">Quantity</th>
                      <th className="py-2 px-2 min-w-[60px]">Unit</th>
                      <th className="py-2 px-2 min-w-[100px]">Rate (₹)</th>
                      <th className="py-2 px-2 min-w-[100px] text-right">Amount (₹)</th>
                      <th className="py-2 px-1 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td className="py-2 px-2 text-center font-bold text-gray-500">
                          {idx + 1}
                        </td>

                        {/* Product selection or custom title */}
                        <td className="py-2 px-2">
                          <div className="space-y-1">
                            <select
                              value={item.productId || ""}
                              onChange={(e) => selectProductForItem(idx, e.target.value)}
                              className="text-xs py-1.5 px-2 mb-1"
                            >
                              <option value="">— Select from inventory or custom —</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.category}) · Stock: {p.stock} {p.unit}
                                </option>
                              ))}
                            </select>

                            <input
                              type="text"
                              placeholder="Description of Goods"
                              value={item.productName}
                              onChange={(e) =>
                                handleItemChange(idx, "productName", e.target.value)
                              }
                              className="text-xs py-1 px-2"
                              required
                            />
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-2 px-2">
                          <select
                            value={item.category}
                            onChange={(e) =>
                              handleItemChange(idx, "category", e.target.value)
                            }
                            className="text-xs py-1 px-1"
                          >
                            <option value="Tiles">Tiles</option>
                            <option value="Marble">Marble</option>
                            <option value="Granite">Granite</option>
                            <option value="Other">Other</option>
                          </select>
                        </td>

                        {/* Size (for Tiles) */}
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            placeholder={item.category === "Tiles" ? "e.g. 2x4" : "N/A"}
                            disabled={item.category !== "Tiles"}
                            value={item.size || ""}
                            onChange={(e) =>
                              handleItemChange(idx, "size", e.target.value)
                            }
                            className={`text-xs py-1 px-2 ${
                              item.category !== "Tiles" ? "bg-gray-100 text-gray-400" : ""
                            }`}
                          />
                        </td>

                        {/* HSN */}
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={item.hsn || ""}
                            onChange={(e) =>
                              handleItemChange(idx, "hsn", e.target.value)
                            }
                            className="text-xs py-1 px-2 font-mono"
                          />
                        </td>

                        {/* Quantity */}
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "quantity",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="text-xs py-1 px-2 text-right font-semibold"
                            required
                          />
                        </td>

                        {/* Unit (locked box for Tiles, sqft for Marble/Granite) */}
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={item.unit}
                            disabled={item.category === "Tiles" || item.category === "Marble" || item.category === "Granite"}
                            onChange={(e) =>
                              handleItemChange(idx, "unit", e.target.value)
                            }
                            className="text-xs py-1 px-1 text-center bg-gray-50 font-medium"
                          />
                        </td>

                        {/* Rate */}
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={item.rate}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "rate",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="text-xs py-1 px-2 text-right"
                            required
                          />
                        </td>

                        {/* Amount */}
                        <td className="py-2 px-2 text-right font-bold text-gray-900 whitespace-nowrap">
                          ₹ {Number(item.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        {/* Remove */}
                        <td className="py-2 px-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-red-500 hover:text-red-700 font-bold text-sm"
                            title="Remove item"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 4: Tax Configuration & Final Calculation Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tax Setup */}
              <div className="card space-y-4">
                <h3 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-2">
                  4. Tax Rules &amp; Rates
                </h3>

                <div className="form-field">
                  <label>Taxation Type</label>
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value as TaxType)}
                  >
                    <option value="CGST_SGST">
                      Intra-State (Uttar Pradesh): CGST + SGST
                    </option>
                    <option value="IGST">
                      Inter-State (Outside UP): IGST
                    </option>
                    <option value="NONE">
                      Exempt / No Tax (0%)
                    </option>
                  </select>
                </div>

                {taxType === "CGST_SGST" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-field">
                      <label>CGST Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cgstRate}
                        onChange={(e) => setCgstRate(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="form-field">
                      <label>SGST Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={sgstRate}
                        onChange={(e) => setSgstRate(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                )}

                {taxType === "IGST" && (
                  <div className="form-field">
                    <label>IGST Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={igstRate}
                      onChange={(e) => setIgstRate(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                )}

                <div className="text-xs text-muted p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p>
                    💡 <b>Note:</b> You can adjust CGST/SGST/IGST rates freely per invoice. All totals and HSN breakdowns update in real time.
                  </p>
                </div>
              </div>

              {/* Total Calculation Card */}
              <div className="card space-y-3">
                <h3 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-2">
                  5. Invoice Totals &amp; Words
                </h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-700">
                    <span>Taxable Subtotal:</span>
                    <span className="font-semibold">
                      ₹ {totals.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {taxType === "CGST_SGST" && (
                    <>
                      <div className="flex justify-between text-gray-600 text-xs">
                        <span>Central Tax (CGST @ {cgstRate}%):</span>
                        <span>
                          ₹ {totals.cgstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600 text-xs">
                        <span>State Tax (SGST @ {sgstRate}%):</span>
                        <span>
                          ₹ {totals.sgstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  )}

                  {taxType === "IGST" && (
                    <div className="flex justify-between text-gray-600 text-xs">
                      <span>Integrated Tax (IGST @ {igstRate}%):</span>
                      <span>
                        ₹ {totals.igstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-gray-700 font-medium">
                    <span>Total Tax:</span>
                    <span>
                      ₹ {totals.totalTax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {totals.roundOff !== 0 && (
                    <div className="flex justify-between text-gray-500 text-xs">
                      <span>Round Off:</span>
                      <span>
                        {totals.roundOff > 0 ? "+" : ""}
                        {totals.roundOff.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-lg font-bold text-gray-950 pt-2 border-t border-gray-300">
                    <span>Grand Total:</span>
                    <span>
                      ₹ {totals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Amount in words */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-[10px] uppercase font-bold text-gray-500">
                    Amount in Words
                  </div>
                  <div className="text-xs font-bold text-gray-900 mt-0.5">
                    {totals.amountInWords}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: LIVE A4 PREVIEW ──────────────────────────────────────── */}
        {activeTab === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-blue-50 text-blue-900 px-4 py-3 rounded-xl border border-blue-200 no-print text-xs">
              <div>
                <b>Live Print Preview:</b> This is how your invoice will appear on an A4 sheet.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSubmit("Draft")}
                  disabled={saving}
                  className="btn-secondary text-xs"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit("Confirmed")}
                  disabled={saving}
                  className="btn-primary text-xs"
                >
                  Save &amp; Print
                </button>
              </div>
            </div>

            <div className="p-4 bg-gray-200 rounded-xl overflow-x-auto flex justify-center">
              <TaxInvoiceDocument
                invoice={previewInvoice}
                settings={settings}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
