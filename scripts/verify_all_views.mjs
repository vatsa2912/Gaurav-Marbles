// Verification script for view routes across the Marble Shop application
import fs from "fs";
import path from "path";

const requiredViewRoutes = [
  "app/dashboard/expenses/[id]/page.tsx",
  "app/dashboard/suppliers/[id]/page.tsx",
  "app/dashboard/suppliers/page.tsx",
  "app/dashboard/products/[id]/page.tsx",
  "app/dashboard/purchases/[id]/page.tsx",
  "app/dashboard/sales/[id]/page.tsx",
  "app/dashboard/customers/[id]/page.tsx",
  "app/dashboard/invoices/[id]/page.tsx",
  "app/dashboard/daily-maintain/page.tsx",
  "app/dashboard/accounts/parties/page.tsx",
  "app/dashboard/page.tsx"
];

console.log("Checking required View routes and pages...");
let allPassed = true;

for (const route of requiredViewRoutes) {
  const fullPath = path.resolve(process.cwd(), route);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing file: ${route}`);
    allPassed = false;
  } else {
    const content = fs.readFileSync(fullPath, "utf-8");
    // Check that it's a client component or server component with proper exports
    if (!content.includes("export default function")) {
      console.error(`❌ ${route} missing default export function`);
      allPassed = false;
    } else {
      console.log(`✓ ${route} exists and has default export`);
    }
  }
}

if (allPassed) {
  console.log("\nAll required View routes verified successfully!");
  process.exit(0);
} else {
  console.error("\nVerification failed.");
  process.exit(1);
}
