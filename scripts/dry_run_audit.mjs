/**
 * Gaurav Marbles - Database Integrity & Consistency Dry-Run Audit Utility
 *
 * STRICT SAFETY RULE:
 * This script is 100% READ-ONLY. It never executes write, update, or delete operations.
 * It detects anomalies, stock desynchronizations, missing costs, orphaned references,
 * and balance mismatches, then reports them clearly for safe remediation.
 *
 * Usage:
 *   1. Using Firebase Auth:
 *      node scripts/dry_run_audit.mjs --email admin@gauravmarbles.com --password <password>
 *      (Or set FIREBASE_AUTH_EMAIL and FIREBASE_AUTH_PASSWORD in .env.local)
 *
 *   2. Using Offline JSON Export:
 *      node scripts/dry_run_audit.mjs --file backup.json
 */

import { createRequire } from "module";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceDir = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

// Parse CLI flags
const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}
const cliEmail = getArg("--email");
const cliPassword = getArg("--password");
const cliFile = getArg("--file");

// Load .env.local
const envPath = path.resolve(workspaceDir, ".env.local");
let env = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      env[match[1]] = value;
    }
  }
} else {
  env = process.env;
}

const authEmail = cliEmail || env.FIREBASE_AUTH_EMAIL || process.env.FIREBASE_AUTH_EMAIL;
const authPassword = cliPassword || env.FIREBASE_AUTH_PASSWORD || process.env.FIREBASE_AUTH_PASSWORD;

const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Stock lot normaliser
function normaliseLots(product) {
  const rawLots = Array.isArray(product.stockLots) ? product.stockLots : [];
  if (rawLots.length > 0) {
    return rawLots
      .filter((l) => l && typeof l.quantity === "number" && l.quantity > 0)
      .map((l) => ({
        lotId: String(l.lotId || `lot-legacy-${l.purchasedAt || "initial"}`),
        purchasePrice: typeof l.purchasePrice === "number" ? l.purchasePrice : Number(product.purchasePrice || 0),
        quantity: l.quantity,
        purchasedAt: String(l.purchasedAt || "2000-01-01"),
      }));
  }
  const aggregateStock = typeof product.stock === "number" ? product.stock : 0;
  if (aggregateStock > 0) {
    return [{
      lotId: `lot-legacy-${product.id}`,
      purchasePrice: typeof product.purchasePrice === "number" ? product.purchasePrice : 0,
      quantity: aggregateStock,
      purchasedAt: "2000-01-01",
    }];
  }
  return [];
}

function totalStock(lots) {
  return lots.reduce((sum, l) => sum + (typeof l.quantity === "number" ? l.quantity : 0), 0);
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

async function runAudit() {
  console.log("================================================================================");
  console.log("               GAURAV MARBLES - DRY-RUN SYSTEM INTEGRITY AUDIT                  ");
  console.log("================================================================================");
  console.log("🛡️  READ-ONLY AUDIT MODE: 0 database writes will be executed.");
  console.log(`🌐 Project ID: ${firebaseConfig.projectId || "Local / Offline"}`);
  console.log("Timestamp:  " + new Date().toISOString() + "\n");

  let products = [];
  let sales = [];
  let purchases = [];
  let customers = [];
  let expenses = [];
  let payments = [];

  if (cliFile) {
    const filePath = path.resolve(process.cwd(), cliFile);
    console.log(`📂 Reading offline database dump from: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Dump file not found at: ${filePath}`);
      process.exit(1);
    }
    const dump = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    products = dump.products || [];
    sales = dump.sales || [];
    purchases = dump.purchases || [];
    customers = dump.customers || [];
    expenses = dump.expenses || [];
    payments = dump.payments || [];
  } else {
    if (!firebaseConfig.projectId) {
      console.error("❌ ERROR: Firebase projectId missing. Please verify .env.local configuration.");
      process.exit(1);
    }
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    if (authEmail && authPassword) {
      console.log(`🔑 Authenticating as ${authEmail}...`);
      try {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        console.log("✓ Authentication successful.\n");
      } catch (authErr) {
        console.error(`❌ Authentication failed: ${authErr.message}`);
        process.exit(1);
      }
    } else {
      console.log("ℹ️  No auth credentials supplied. Attempting unauthenticated read (may require sign-in rules)...");
    }

    try {
      console.log("📥 Loading collections from Firestore...");
      const [productsSnap, salesSnap, purchasesSnap, customersSnap, expensesSnap, paymentsSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "sales")),
        getDocs(collection(db, "purchases")),
        getDocs(collection(db, "customers")),
        getDocs(collection(db, "expenses")),
        getDocs(collection(db, "payments")),
      ]);

      products = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      sales = salesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      purchases = purchasesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      customers = customersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      payments = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      if (err.code === "permission-denied" || err.message?.includes("permissions")) {
        console.error("\n🔒 FIRESTORE PERMISSION DENIED:");
        console.error("Firestore security rules require authenticated access.");
        console.error("Please run with credentials or pass a local JSON dump:");
        console.error("   node scripts/dry_run_audit.mjs --email your@email.com --password yourpassword");
        console.error("   node scripts/dry_run_audit.mjs --file ./backup.json\n");
        process.exit(1);
      }
      throw err;
    }
  }

  const issues = [];
  function addIssue(severity, collection, id, message, remediation = "") {
    issues.push({ severity, collection, id, message, remediation });
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  console.log(`✓ Products loaded:  ${products.length}`);
  console.log(`✓ Sales loaded:     ${sales.length}`);
  console.log(`✓ Purchases loaded: ${purchases.length}`);
  console.log(`✓ Customers loaded: ${customers.length}`);
  console.log(`✓ Expenses loaded:  ${expenses.length}`);
  console.log(`✓ Payments loaded:  ${payments.length}\n`);

  // 2. Audit Products & Stock Lots
  console.log("🔍 [1/6] Auditing Products & Stock Lots...");
  for (const prod of products) {
    const declaredStock = typeof prod.stock === "number" ? prod.stock : 0;
    const lots = normaliseLots(prod);
    const lotStock = totalStock(lots);

    if (declaredStock < 0) {
      addIssue("ERROR", "products", prod.id, `Negative aggregate stock: ${declaredStock}`, "Reconcile inventory against physical stock.");
    }

    if (!Array.isArray(prod.stockLots)) {
      addIssue("WARNING", "products", prod.id, `Missing 'stockLots' array (legacy single-stock doc with stock=${declaredStock})`, "Edit or purchase to generate normalized stock lots.");
    } else {
      for (const lot of prod.stockLots) {
        if (!lot.lotId) {
          addIssue("WARNING", "products", prod.id, `Stock lot missing lotId (qty: ${lot.quantity})`, "Normalize lot IDs.");
        }
        if (typeof lot.quantity !== "number" || lot.quantity < 0) {
          addIssue("ERROR", "products", prod.id, `Invalid or negative lot quantity: ${lot.quantity}`, "Repair corrupted lot.");
        }
        if (typeof lot.purchasePrice !== "number" || isNaN(lot.purchasePrice) || lot.purchasePrice < 0) {
          addIssue("WARNING", "products", prod.id, `Invalid lot purchasePrice: ${lot.purchasePrice}`, "Verify purchase invoice price.");
        }
        if (lot.purchasedAt && !DATE_REGEX.test(lot.purchasedAt)) {
          addIssue("WARNING", "products", prod.id, `Invalid lot purchasedAt date format: '${lot.purchasedAt}'`, "Standardize to YYYY-MM-DD.");
        }
      }

      // Check for stock desync between aggregate field and lots sum
      if (Math.abs(declaredStock - lotStock) > 0.0001) {
        addIssue(
          "ERROR",
          "products",
          prod.id,
          `Stock desynchronization: declared stock=${declaredStock}, sum of lots=${lotStock} (diff: ${declaredStock - lotStock})`,
          "Align product.stock with sum of valid stockLots."
        );
      }
    }
  }

  // 3. Audit Purchases
  console.log("🔍 [2/5] Auditing Purchases & Lots...");
  for (const pur of purchases) {
    if (!pur.purchaseDate || !DATE_REGEX.test(pur.purchaseDate)) {
      addIssue("WARNING", "purchases", pur.id, `Missing or malformed purchaseDate: '${pur.purchaseDate}'`, "Set valid YYYY-MM-DD date.");
    }
    const items = Array.isArray(pur.items) ? pur.items : [];
    if (items.length === 0) {
      addIssue("WARNING", "purchases", pur.id, "Purchase has no line items", "Review empty purchase invoice.");
    }
    for (const item of items) {
      if (!item.productId) {
        addIssue("ERROR", "purchases", pur.id, "Purchase item missing productId", "Review item structure.");
        continue;
      }
      if (!productMap.has(item.productId)) {
        addIssue("ERROR", "purchases", pur.id, `Orphaned product reference: productId '${item.productId}' does not exist in products collection`, "Product was deleted without checking purchase history.");
      }
      if (typeof item.quantity !== "number" || item.quantity <= 0) {
        addIssue("ERROR", "purchases", pur.id, `Invalid item quantity: ${item.quantity}`, "Correct quantity.");
      }
      if (typeof item.purchasePrice !== "number" || item.purchasePrice < 0) {
        addIssue("WARNING", "purchases", pur.id, `Invalid item purchasePrice: ${item.purchasePrice}`, "Correct purchase price.");
      }
    }
  }

  // 4. Audit Sales & Cost Allocations
  console.log("🔍 [3/5] Auditing Sales & FIFO Cost Allocations...");
  for (const sale of sales) {
    if (!sale.saleDate || !DATE_REGEX.test(sale.saleDate)) {
      addIssue("WARNING", "sales", sale.id, `Missing or malformed saleDate: '${sale.saleDate}'`, "Set valid YYYY-MM-DD date.");
    }
    if (typeof sale.saleNumber !== "number") {
      addIssue("WARNING", "sales", sale.id, `Missing numeric saleNumber: '${sale.saleNumber}'`, "Assign sale invoice number.");
    }
    if (sale.customerId && !customerMap.has(sale.customerId)) {
      addIssue("INFO", "sales", sale.id, `Referenced customerId '${sale.customerId}' not found in customers collection (may be walk-in or legacy)`, "Safe if customer was guest / walk-in.");
    }

    const items = Array.isArray(sale.items) ? sale.items : [];
    for (const item of items) {
      if (!item.productId) {
        addIssue("ERROR", "sales", sale.id, "Sale item missing productId", "Inspect sale record.");
        continue;
      }
      if (!productMap.has(item.productId)) {
        addIssue("ERROR", "sales", sale.id, `Orphaned product reference: productId '${item.productId}' does not exist in products collection`, "Product was deleted without checking sales references.");
      }
      // Check FIFO allocations & historical cost
      if (item.costTotal === undefined || isNaN(Number(item.costTotal))) {
        addIssue("WARNING", "sales", sale.id, `Sale item '${item.productName || item.productId}' missing costTotal`, "Profit calculations will fallback to estimated current product purchasePrice.");
      }
      if (!Array.isArray(item.costAllocations) || item.costAllocations.length === 0) {
        addIssue("INFO", "sales", sale.id, `Sale item '${item.productName || item.productId}' has no costAllocations (created before lot system)`, "Legacy sale.");
      } else {
        const allocTotalQty = item.costAllocations.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
        if (Math.abs(allocTotalQty - Number(item.quantity)) > 0.001) {
          addIssue(
            "WARNING",
            "sales",
            sale.id,
            `Cost allocations quantity mismatch: allocated=${allocTotalQty}, sold=${item.quantity}`,
            "Inspect lot allocations for this sale."
          );
        }
      }
    }
  }

  // 5. Audit Customer Balances & Payments
  console.log("🔍 [4/6] Auditing Customer Balances & Ledger Reconciliation...");
  for (const cust of customers) {
    const custSales = sales.filter(
      (s) =>
        s.customerId === cust.id ||
        (s.customerName && s.customerName.toLowerCase() === (cust.name || "").toLowerCase())
    );
    const custPayments = payments.filter(
      (p) =>
        p.customerId === cust.id ||
        (p.customerName && p.customerName.toLowerCase() === (cust.name || "").toLowerCase())
    );

    // Map direct payments by saleId to prevent double-counting
    const paymentsBySaleId = {};
    let unallocatedPaymentsTotal = 0;
    for (const p of custPayments) {
      const amt = Math.max(0, Number(p.amount) || 0);
      if (p.saleId) {
        paymentsBySaleId[p.saleId] = (paymentsBySaleId[p.saleId] || 0) + amt;
      } else {
        unallocatedPaymentsTotal += amt;
      }
    }

    let actualInvoiced = 0;
    let actualPaidOnSales = 0;
    for (const s of custSales) {
      const invTotal = Math.max(0, Number(s.totalAmount) || 0);
      const saleRecordedPaid =
        s.receivedAmount !== undefined
          ? Number(s.receivedAmount)
          : (s.paidAmount !== undefined ? Number(s.paidAmount) : 0);
      const saleDirectPaid = paymentsBySaleId[s.id] || 0;
      const effectivePaid = Math.max(saleRecordedPaid, saleDirectPaid);

      actualInvoiced += invTotal;
      actualPaidOnSales += effectivePaid;
    }

    const actualReceived = actualPaidOnSales + unallocatedPaymentsTotal;
    const netBalance = actualInvoiced - actualReceived;
    const actualOutstanding = netBalance > 0 ? netBalance : 0;

    if (cust.totalPurchases !== undefined && Math.abs(Number(cust.totalPurchases) - actualInvoiced) > 0.01) {
      addIssue(
        "INFO",
        "customers",
        cust.id,
        `Customer '${cust.name}': cached totalPurchases (₹${cust.totalPurchases}) differs from actual historical sales sum (₹${actualInvoiced})`,
        "Cached balance out of sync with actual sales history."
      );
    }
    if (cust.outstandingBalance !== undefined && Math.abs(Number(cust.outstandingBalance) - actualOutstanding) > 0.01) {
      addIssue(
        "INFO",
        "customers",
        cust.id,
        `Customer '${cust.name}': cached outstandingBalance (₹${cust.outstandingBalance}) differs from actual calculated balance (₹${actualOutstanding})`,
        "Reconcile customer balance from sale records."
      );
    }
  }

  // 6. Audit Payments Collection
  console.log("🔍 [5/6] Auditing Direct Payment Receipts...");
  const saleIdSet = new Set(sales.map((s) => s.id));
  const customerIdSet = new Set(customers.map((c) => c.id));

  for (const pay of payments) {
    const amt = Number(pay.amount);
    if (typeof amt !== "number" || isNaN(amt) || !Number.isFinite(amt) || amt <= 0) {
      addIssue("ERROR", "payments", pay.id, `Invalid payment amount: '${pay.amount}'`, "Payment amount must be a finite positive number.");
    }
    if (!pay.paymentDate || !DATE_REGEX.test(pay.paymentDate)) {
      addIssue("WARNING", "payments", pay.id, `Invalid paymentDate: '${pay.paymentDate}'`, "Standardize paymentDate to YYYY-MM-DD.");
    }
    if (pay.customerId && !customerIdSet.has(pay.customerId)) {
      addIssue("WARNING", "payments", pay.id, `Payment references non-existent customerId: '${pay.customerId}'`, "Verify customer reference or link to valid customer.");
    }
    if (pay.saleId && !saleIdSet.has(pay.saleId)) {
      addIssue("WARNING", "payments", pay.id, `Payment references non-existent saleId: '${pay.saleId}'`, "Verify sale reference or unlink orphaned payment.");
    }
  }

  // 7. Audit Expenses
  console.log("🔍 [6/6] Auditing Expenses...");
  for (const exp of expenses) {
    if (typeof exp.amount !== "number" || isNaN(exp.amount) || !Number.isFinite(exp.amount) || exp.amount <= 0) {
      addIssue("ERROR", "expenses", exp.id, `Invalid expense amount: '${exp.amount}'`, "Expense amount must be a finite positive number.");
    }
    if (!exp.expenseDate || !DATE_REGEX.test(exp.expenseDate)) {
      addIssue("WARNING", "expenses", exp.id, `Invalid expenseDate: '${exp.expenseDate}'`, "Standardize to YYYY-MM-DD.");
    }
    if (!exp.title || !String(exp.title).trim()) {
      addIssue("WARNING", "expenses", exp.id, "Missing expense title", "Provide descriptive title.");
    }
  }

  // Final Summary Report
  console.log("\n================================================================================");
  console.log("                             AUDIT REPORT SUMMARY                               ");
  console.log("================================================================================");

  const errors = issues.filter((i) => i.severity === "ERROR");
  const warnings = issues.filter((i) => i.severity === "WARNING");
  const infos = issues.filter((i) => i.severity === "INFO");

  console.log(`🔴 Critical Errors:  ${errors.length}`);
  console.log(`🟡 Warnings:         ${warnings.length}`);
  console.log(`🔵 Info / Notices:   ${infos.length}`);
  console.log(`Total Findings:      ${issues.length}\n`);

  if (issues.length > 0) {
    console.log("DETAILED FINDINGS:");
    console.log("--------------------------------------------------------------------------------");
    for (const item of issues) {
      const icon = item.severity === "ERROR" ? "🔴 [ERROR]" : item.severity === "WARNING" ? "🟡 [WARN] " : "🔵 [INFO] ";
      console.log(`${icon} [${item.collection.toUpperCase()}] ID: ${item.id}`);
      console.log(`   Message:     ${item.message}`);
      if (item.remediation) {
        console.log(`   Remediation: ${item.remediation}`);
      }
      console.log("");
    }
  } else {
    console.log("✨ EXCELLENT! No integrity issues or discrepancies were detected.");
  }

  console.log("================================================================================");
  console.log("✅ Audit completed in READ-ONLY mode: 0 writes performed.");
  console.log("================================================================================");
}

runAudit().catch((err) => {
  console.error("Fatal error running audit script:", err);
  process.exit(1);
});
