"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/daily-maintain", label: "Daily Maintain" },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/purchases", label: "Purchases" },
  { href: "/dashboard/sales", label: "Sales" },
  { href: "/dashboard/invoices", label: "Invoices" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/expenses", label: "Expenses" },
];

const accountLinks = [
  { href: "/dashboard/accounts/customer-ledger", label: "Customer Ledger" },
  { href: "/dashboard/accounts/supplier-ledger", label: "Supplier Ledger" },
  { href: "/dashboard/accounts/parties", label: "All Parties" },
  { href: "/dashboard/accounts/reports", label: "Ledger Reports" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountsOpen, setAccountsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
      } else {
        setUser(currentUser);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-gray-800">
        <div className="w-10 h-10 border-4 border-gray-300 border-t-black rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium tracking-wide">Checking authentication...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isAccountsActive = pathname.startsWith("/dashboard/accounts");

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Top Application Bar */}
      <header className="bg-gray-900 text-white sticky top-0 z-50 shadow-md no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white hover:text-gray-200 transition">
                  Gaurav Marbles
                </span>
              </Link>

              {/* Navigation Links */}
              <nav className="hidden md:flex items-center gap-1">
                {navLinks
                  .filter((l) => l.href !== "/dashboard/expenses")
                  .map((link) => {
                  const isActive =
                    link.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                        isActive
                          ? "bg-gray-800 text-white"
                          : "text-gray-300 hover:bg-gray-800 hover:text-white"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}

                {/* Accounts Dropdown Menu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAccountsOpen(!accountsOpen)}
                    onMouseEnter={() => setAccountsOpen(true)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition inline-flex items-center gap-1 cursor-pointer ${
                      isAccountsActive
                        ? "bg-gray-800 text-white font-semibold"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    <span>Accounts</span>
                    <span className="text-xs opacity-70">▾</span>
                  </button>

                  {accountsOpen && (
                    <div
                      onMouseLeave={() => setAccountsOpen(false)}
                      className="absolute left-0 mt-1 w-48 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1.5 z-50 animate-fadeIn"
                    >
                      {accountLinks.map((sub) => {
                        const isSubActive = pathname.startsWith(sub.href);
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={() => setAccountsOpen(false)}
                            className={`block px-4 py-2 text-xs transition ${
                              isSubActive
                                ? "bg-gray-800 text-white font-semibold"
                                : "text-gray-300 hover:bg-gray-800 hover:text-white"
                            }`}
                          >
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Expenses */}
                <Link
                  href="/dashboard/expenses"
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                    pathname.startsWith("/dashboard/expenses")
                      ? "bg-gray-800 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  Expenses
                </Link>
              </nav>
            </div>

            {/* User & Sign Out */}
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block text-xs text-gray-300 font-mono bg-gray-800 px-2 py-1 rounded border border-gray-700">
                {user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-md transition shadow-sm cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Mobile Navigation Scrollbar */}
          <div className="md:hidden flex items-center gap-1 overflow-x-auto pb-2 pt-1 border-t border-gray-800 text-xs">
            {navLinks
              .filter((l) => l.href !== "/dashboard/expenses")
              .map((link) => {
              const isActive =
                link.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2.5 py-1 rounded whitespace-nowrap ${
                    isActive
                      ? "bg-gray-800 text-white font-semibold"
                      : "text-gray-300 hover:bg-gray-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            {/* Mobile Accounts Links */}
            <Link
              href="/dashboard/accounts/customer-ledger"
              className={`px-2.5 py-1 rounded whitespace-nowrap ${
                pathname.startsWith("/dashboard/accounts/customer-ledger")
                  ? "bg-gray-800 text-white font-semibold"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              Cust Ledger
            </Link>
            <Link
              href="/dashboard/accounts/supplier-ledger"
              className={`px-2.5 py-1 rounded whitespace-nowrap ${
                pathname.startsWith("/dashboard/accounts/supplier-ledger")
                  ? "bg-gray-800 text-white font-semibold"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              Supp Ledger
            </Link>
            <Link
              href="/dashboard/accounts/parties"
              className={`px-2.5 py-1 rounded whitespace-nowrap ${
                pathname.startsWith("/dashboard/accounts/parties")
                  ? "bg-gray-800 text-white font-semibold"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              Parties
            </Link>
            <Link
              href="/dashboard/accounts/reports"
              className={`px-2.5 py-1 rounded whitespace-nowrap ${
                pathname.startsWith("/dashboard/accounts/reports")
                  ? "bg-gray-800 text-white font-semibold"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              Reports
            </Link>

            <Link
              href="/dashboard/expenses"
              className={`px-2.5 py-1 rounded whitespace-nowrap ${
                pathname.startsWith("/dashboard/expenses")
                  ? "bg-gray-800 text-white font-semibold"
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              Expenses
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
