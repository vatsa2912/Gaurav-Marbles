"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ToastProvider } from "@/components/ui/ToastContext";
import { UserProfileProvider, useUserProfile } from "@/components/ui/UserProfileContext";
import {
  LayoutDashboard,
  CalendarCheck2,
  Package,
  ShoppingBag,
  ShoppingCart,
  FileText,
  Users,
  Truck,
  Receipt,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  LogOut,
  User,
  ShieldCheck,
  Search,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

const mainNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4 shrink-0" /> },
  { href: "/dashboard/daily-maintain", label: "Daily Maintain", icon: <CalendarCheck2 className="w-4 h-4 shrink-0" /> },
];

const operationsNav: NavItem[] = [
  { href: "/dashboard/products", label: "Products", icon: <Package className="w-4 h-4 shrink-0" /> },
  { href: "/dashboard/purchases", label: "Purchases", icon: <ShoppingBag className="w-4 h-4 shrink-0" /> },
  { href: "/dashboard/sales", label: "Sales", icon: <ShoppingCart className="w-4 h-4 shrink-0" /> },
  { href: "/dashboard/invoices", label: "Invoices", icon: <FileText className="w-4 h-4 shrink-0" /> },
];

const directoryNav: NavItem[] = [
  { href: "/dashboard/customers", label: "Customers", icon: <Users className="w-4 h-4 shrink-0" /> },
  { href: "/dashboard/suppliers", label: "Suppliers", icon: <Truck className="w-4 h-4 shrink-0" /> },
  { href: "/dashboard/expenses", label: "Expenses", icon: <Receipt className="w-4 h-4 shrink-0" /> },
];

const accountsNav: NavItem[] = [
  { href: "/dashboard/accounts/customer-ledger", label: "Customer Ledger", icon: <BookOpen className="w-4 h-4 shrink-0" /> },
  { href: "/dashboard/accounts/supplier-ledger", label: "Supplier Ledger", icon: <BookOpen className="w-4 h-4 shrink-0" /> },
  { href: "/dashboard/accounts/parties", label: "All Parties", icon: <Users className="w-4 h-4 shrink-0" /> },
  { href: "/dashboard/accounts/reports", label: "Ledger Reports", icon: <FileText className="w-4 h-4 shrink-0" /> },
];

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, loading } = useUserProfile();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [accountsExpanded, setAccountsExpanded] = useState(
    pathname.startsWith("/dashboard/accounts")
  );

  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    if (pathname.startsWith("/dashboard/accounts")) {
      setAccountsExpanded(true);
    }
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "GM";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Breadcrumbs builder
  const getBreadcrumbs = () => {
    const parts = pathname.split("/").filter(Boolean);
    const crumbs = [];
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      currentPath += `/${parts[i]}`;
      let label = parts[i];
      if (label === "dashboard") label = "Dashboard";
      else if (label === "daily-maintain") label = "Daily Maintain";
      else if (label === "customer-ledger") label = "Customer Ledger";
      else if (label === "supplier-ledger") label = "Supplier Ledger";
      else {
        label = label.charAt(0).toUpperCase() + label.slice(1);
      }
      crumbs.push({ href: currentPath, label, isLast: i === parts.length - 1 });
    }
    return crumbs;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-4" />
        <p className="text-xs font-semibold tracking-wider uppercase text-slate-500">
          Loading Gaurav Marbles ERP...
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isNavActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen flex bg-slate-100/70 font-sans text-slate-900">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-slate-900 text-slate-300 border-r border-slate-800 shrink-0 sticky top-0 h-screen select-none z-30 no-print">
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800 bg-slate-950/40">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-300 text-slate-900 flex items-center justify-center font-black text-sm tracking-wider shadow-sm">
            GM
          </div>
          <div className="leading-tight overflow-hidden">
            <span className="font-bold text-sm text-white tracking-tight block truncate">
              {profile?.shopName || "Gaurav Marbles"}
            </span>
            <span className="text-[11px] font-medium text-slate-400 block tracking-wide">
              Marble ERP & POS
            </span>
          </div>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 text-xs">
          {/* Main Group */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Overview
            </div>
            <div className="space-y-1">
              {mainNav.map((item) => {
                const active = isNavActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition ${
                      active
                        ? "bg-slate-800 text-white font-semibold shadow-sm"
                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Operations Group */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Operations & Inventory
            </div>
            <div className="space-y-1">
              {operationsNav.map((item) => {
                const active = isNavActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition ${
                      active
                        ? "bg-slate-800 text-white font-semibold shadow-sm"
                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Directory Group */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Directory & Expenses
            </div>
            <div className="space-y-1">
              {directoryNav.map((item) => {
                const active = isNavActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition ${
                      active
                        ? "bg-slate-800 text-white font-semibold shadow-sm"
                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Accounts & Ledgers (Collapsible) */}
          <div>
            <button
              type="button"
              onClick={() => setAccountsExpanded(!accountsExpanded)}
              className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition"
            >
              <span>Accounts & Ledgers</span>
              {accountsExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
            {accountsExpanded && (
              <div className="mt-1 space-y-1 pl-1">
                {accountsNav.map((item) => {
                  const active = isNavActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition ${
                        active
                          ? "bg-slate-800 text-white font-semibold shadow-sm"
                          : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Footer User Profile */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40">
          <Link
            href="/dashboard/profile"
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800 transition group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center font-bold text-xs group-hover:border-slate-500">
              {getInitials(profile?.fullName)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {profile?.fullName || "Administrator"}
              </p>
              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                {profile?.position || "Administrator"}
              </p>
            </div>
          </Link>
        </div>
      </aside>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex no-print">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 text-slate-300 z-10 shadow-2xl">
            <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white text-slate-900 flex items-center justify-center font-black text-xs">
                  GM
                </div>
                <span className="font-bold text-white text-sm">Gaurav Marbles</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 text-xs">
              <div>
                <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Overview
                </p>
                <div className="space-y-1">
                  {mainNav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition ${
                        isNavActive(item.href)
                          ? "bg-slate-800 text-white font-semibold"
                          : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Operations & Inventory
                </p>
                <div className="space-y-1">
                  {operationsNav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition ${
                        isNavActive(item.href)
                          ? "bg-slate-800 text-white font-semibold"
                          : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Directory & Expenses
                </p>
                <div className="space-y-1">
                  {directoryNav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition ${
                        isNavActive(item.href)
                          ? "bg-slate-800 text-white font-semibold"
                          : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <p className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Accounts & Ledgers
                </p>
                <div className="space-y-1">
                  {accountsNav.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition ${
                        isNavActive(item.href)
                          ? "bg-slate-800 text-white font-semibold"
                          : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/40">
              <Link
                href="/dashboard/profile"
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800 transition"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 flex items-center justify-center font-bold text-xs">
                  {getInitials(profile?.fullName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {profile?.fullName || "Administrator"}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {profile?.position || "Administrator"}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-rose-600/10 text-rose-400 hover:bg-rose-600/20 text-xs font-semibold transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-xs flex items-center justify-between px-4 sm:px-6 lg:px-8 no-print">
          {/* Left: Mobile Toggle & Breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumbs */}
            <nav className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-slate-500">
              {getBreadcrumbs().map((crumb) => (
                <React.Fragment key={crumb.href}>
                  {crumb.isLast ? (
                    <span className="text-slate-900 font-semibold">{crumb.label}</span>
                  ) : (
                    <>
                      <Link href={crumb.href} className="hover:text-slate-900 transition">
                        {crumb.label}
                      </Link>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </>
                  )}
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* Right: Search + User Profile Dropdown */}
          <div className="flex items-center gap-3">
            {/* Quick Filter / Search visual pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200/60 text-xs text-slate-500">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Gaurav Marbles ERP</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white rounded border border-slate-200 text-slate-400">
                v2.0
              </kbd>
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-100 transition border border-transparent hover:border-slate-200 cursor-pointer"
                aria-expanded={profileDropdownOpen}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {getInitials(profile?.fullName)}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-xs font-bold text-slate-900 truncate max-w-[130px]">
                    {profile?.fullName || "Administrator"}
                  </div>
                  <div className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-slate-400" />
                    <span className="truncate max-w-[120px]">{profile?.position || "Administrator"}</span>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {/* Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl py-1.5 z-50 animate-scaleUp">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {profile?.fullName || "Administrator"}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{profile?.email}</p>
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-semibold text-slate-700">
                      {profile?.position || "Administrator"}
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/dashboard/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition font-medium"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>My Profile & Settings</span>
                    </Link>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition font-medium cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <UserProfileProvider>
        <DashboardShell>{children}</DashboardShell>
      </UserProfileProvider>
    </ToastProvider>
  );
}
