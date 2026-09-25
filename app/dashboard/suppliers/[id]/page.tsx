"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatDisplayDate, extractTransactionDate, compareDatesDesc } from "@/lib/dateUtils";
import { formatLedgerAmount } from "@/lib/ledgerTypes";

type Supplier = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  gstin?: string;
  openingBalance?: number;
  openingBalanceType?: "Debit" | "Credit";
  status?: string;
  notes?: string;
};

type SupplierPurchase = {
  id: string;
  purchaseNumber: number | string;
  purchaseDate: string;
  supplierInvoice?: string;
  totalAmount: number;
  paymentMethod?: string;
  itemsCount: number;
  productsSummary: string;
};

export default function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchases, setPurchases] = useState<SupplierPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadSupplierData = async () => {
      if (!id) {
        if (isMounted) {
          setError("Invalid supplier ID.");
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError("");

        let suppData: Supplier | null = null;

        // 1. Try fetching from `parties`
        const partySnap = await getDoc(doc(db, "parties", id));
        if (partySnap.exists()) {
          const d = partySnap.data();
          suppData = {
            id: partySnap.id,
            name: d.name || "Unnamed Supplier",
            phone: d.phone || "",
            email: d.email || "",
            address: d.address || "",
            city: d.city || "",
            state: d.state || "",
            stateCode: d.stateCode || "",
            gstin: d.gstin || "",
            openingBalance: Number(d.openingBalance) || 0,
            openingBalanceType: d.openingBalanceType || "Credit",
            status: d.status || "Active",
            notes: d.notes || "",
          };
        } else {
          // 2. Try fetching from `suppliers` collection fallback
          const suppSnap = await getDoc(doc(db, "suppliers", id));
          if (suppSnap.exists()) {
            const d = suppSnap.data();
            suppData = {
              id: suppSnap.id,
              name: d.name || "Unnamed Supplier",
              phone: d.phone || "",
              email: d.email || "",
              address: d.address || "",
              city: d.city || "",
              state: d.state || "",
              gstin: d.gstin || "",
              openingBalance: Number(d.openingBalance) || 0,
              openingBalanceType: "Credit",
              status: "Active",
            };
          }
        }

        // 3. Fallback: if supplier not found by document ID, check if id is an encoded supplier name
        if (!suppData) {
          const decodedName = decodeURIComponent(id);
          const allPurchasesSnap = await getDocs(collection(db, "purchases"));
          const matchedPurchases = allPurchasesSnap.docs.filter(
            (p) => (p.data().supplierName || "").toLowerCase().trim() === decodedName.toLowerCase().trim()
          );
          if (matchedPurchases.length > 0) {
            suppData = {
              id: id,
              name: decodedName,
              status: "Active",
            };
          }
        }

        if (!suppData) {
          if (isMounted) setError("Supplier not found.");
          return;
        }

        if (isMounted) setSupplier(suppData);

        // 4. Load all purchases for this supplier
        const allPurchasesSnap = await getDocs(collection(db, "purchases"));
        const suppNameLower = suppData.name.toLowerCase().trim();

        const supplierPurchases: SupplierPurchase[] = [];

        allPurchasesSnap.docs.forEach((docSnap) => {
          const p = docSnap.data();
          const matchByName = (p.supplierName || "").toLowerCase().trim() === suppNameLower;
          const matchById = p.supplierId === suppData!.id || p.partyId === suppData!.id;

          if (matchByName || matchById) {
            const rawItems = Array.isArray(p.items) ? p.items : [];
            const itemsList = rawItems.length > 0
              ? rawItems
              : p.productName
              ? [{ productName: p.productName, quantity: p.quantity, unit: p.unit }]
              : [];

            const productNames = itemsList
              .map((it: { productName?: string; quantity?: number; unit?: string }) => {
                const q = it.quantity ? ` (${it.quantity} ${it.unit || ""})` : "";
                return `${it.productName || "Product"}${q}`;
              })
              .filter(Boolean)
              .join(", ");

            supplierPurchases.push({
              id: docSnap.id,
              purchaseNumber: p.purchaseNumber ?? docSnap.id,
              purchaseDate: extractTransactionDate(p, "purchaseDate"),
              supplierInvoice: p.supplierInvoice || p.invoiceNumber || "",
              totalAmount: Number(p.totalAmount) || 0,
              paymentMethod: p.paymentMethod || "Cash",
              itemsCount: itemsList.length,
              productsSummary: productNames || "—",
            });
          }
        });

        // Sort purchases newest first
        supplierPurchases.sort((a, b) => compareDatesDesc(a.purchaseDate, b.purchaseDate));

        if (isMounted) setPurchases(supplierPurchases);
      } catch (err) {
        console.error("Error loading supplier details:", err);
        if (isMounted) setError("Failed to load supplier details.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadSupplierData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="page-main">
        <header className="site-header">
          <h1 className="text-xl">Gaurav Marbles</h1>
          <p className="text-muted">Supplier Details</p>
        </header>
        <div className="page-content">
          <div className="card text-center py-12">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-black rounded-full animate-spin mx-auto mb-3" />
            <p className="text-muted text-sm">Loading supplier details...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !supplier) {
    return (
      <main className="page-main">
        <header className="site-header">
          <h1 className="text-xl">Gaurav Marbles</h1>
          <p className="text-muted">Supplier Details</p>
        </header>
        <div className="page-content">
          <button
            type="button"
            onClick={() => router.push("/dashboard/accounts/parties")}
            className="btn-ghost"
          >
            ← Back to Parties
          </button>
          <div className="card mt-6 text-center py-12">
            <h2 className="text-xl font-bold text-gray-900">
              {error || "Supplier not found"}
            </h2>
            <p className="text-muted mt-2 text-sm">
              This supplier record does not exist or may have been removed.
            </p>
            <Link
              href="/dashboard/accounts/parties"
              className="btn-primary mt-5 inline-block"
            >
              Back to All Parties
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const totalPurchased = purchases.reduce((sum, p) => sum + p.totalAmount, 0);

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">Gaurav Marbles</h1>
        <p className="text-muted">Supplier Details</p>
      </header>

      <div className="page-content space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => router.push("/dashboard/accounts/parties")}
              className="btn-ghost"
            >
              ← Back to Parties
            </button>
            <div className="flex items-center gap-3 mt-3">
              <h2 className="text-2xl font-bold text-gray-900">{supplier.name}</h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
                Supplier
              </span>
            </div>
            {supplier.city && (
              <p className="text-muted text-sm mt-0.5">
                {supplier.city}{supplier.state ? `, ${supplier.state}` : ""}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/accounts/supplier-ledger?party=${encodeURIComponent(supplier.id || supplier.name)}`}
              className="btn-primary text-sm inline-flex items-center gap-1.5"
            >
              <span>📖</span> View Tally Ledger ↗
            </Link>
            <Link
              href="/dashboard/purchases/add"
              className="btn-secondary text-sm inline-flex items-center gap-1.5"
            >
              + Add Purchase
            </Link>
          </div>
        </div>

        {/* Overview KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-5 border-l-4 border-l-purple-600">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Total Invoiced Purchases
            </span>
            <div className="mt-2 text-2xl font-bold text-purple-700">
              ₹{totalPurchased.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted mt-1">Across {purchases.length} purchase invoice{purchases.length === 1 ? "" : "s"}</p>
          </div>

          <div className="card p-5 border-l-4 border-l-blue-600">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Opening Balance
            </span>
            <div className="mt-2 text-2xl font-bold text-gray-800">
              ₹{formatLedgerAmount(supplier.openingBalance || 0)}
              <span className="text-xs text-muted font-normal ml-1">
                ({supplier.openingBalanceType || "Credit"})
              </span>
            </div>
          </div>

          <div className="card p-5 border-l-4 border-l-emerald-600">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Contact Phone
            </span>
            <div className="mt-2 text-xl font-bold text-gray-800">
              {supplier.phone || "—"}
            </div>
            {supplier.email && <p className="text-xs text-muted mt-1">{supplier.email}</p>}
          </div>
        </div>

        {/* Supplier Information Card */}
        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 border-b border-gray-100 pb-2 mb-4">
            Supplier Master Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-xs text-muted block">Supplier Name</span>
              <span className="font-medium text-gray-900">{supplier.name}</span>
            </div>

            <div>
              <span className="text-xs text-muted block">Phone</span>
              <span className="font-mono text-gray-800">{supplier.phone || "—"}</span>
            </div>

            <div>
              <span className="text-xs text-muted block">Email</span>
              <span className="text-gray-800">{supplier.email || "—"}</span>
            </div>

            <div>
              <span className="text-xs text-muted block">GSTIN</span>
              <span className="font-mono font-semibold text-gray-800">
                {supplier.gstin || "—"}
              </span>
            </div>

            <div className="sm:col-span-2">
              <span className="text-xs text-muted block">Address</span>
              <span className="text-gray-800">
                {supplier.address
                  ? `${supplier.address}${supplier.city ? `, ${supplier.city}` : ""}${supplier.state ? `, ${supplier.state}` : ""}`
                  : "—"}
              </span>
            </div>

            <div>
              <span className="text-xs text-muted block">Status</span>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                {supplier.status || "Active"}
              </span>
            </div>

            <div>
              <span className="text-xs text-muted block">Supplier ID</span>
              <span className="font-mono text-xs text-gray-500">{supplier.id}</span>
            </div>
          </div>
        </div>

        {/* Purchase History Section */}
        <div className="card p-6">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Purchase History ({purchases.length})
              </h3>
              <p className="text-muted text-xs mt-0.5">
                All purchase invoices billed by {supplier.name}
              </p>
            </div>
          </div>

          {purchases.length === 0 ? (
            <p className="text-muted text-sm py-8 text-center">
              No purchase transactions recorded for this supplier yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left font-medium">Date</th>
                    <th className="text-left font-medium">Invoice #</th>
                    <th className="text-left font-medium">Products</th>
                    <th className="text-right font-medium">Total Amount</th>
                    <th className="text-center font-medium">Payment Method</th>
                    <th className="text-center font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <td className="whitespace-nowrap font-medium text-gray-800">
                        {formatDisplayDate(purchase.purchaseDate)}
                      </td>
                      <td className="font-mono text-xs font-semibold text-blue-600">
                        {purchase.supplierInvoice || `#${purchase.purchaseNumber}`}
                      </td>
                      <td className="text-gray-700 max-w-xs truncate" title={purchase.productsSummary}>
                        {purchase.productsSummary}
                      </td>
                      <td className="text-right font-bold text-gray-900 whitespace-nowrap">
                        ₹{purchase.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                          {purchase.paymentMethod || "Cash"}
                        </span>
                      </td>
                      <td className="text-center whitespace-nowrap">
                        <Link
                          href={`/dashboard/purchases/${purchase.id}`}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          View Invoice
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
    </main>
  );
}
