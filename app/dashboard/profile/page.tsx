"use client";

import { useState, useEffect } from "react";
import { useUserProfile, POSITION_OPTIONS } from "@/components/ui/UserProfileContext";
import { useToast } from "@/components/ui/ToastContext";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Store,
  MapPin,
  Save,
  ShieldCheck,
  Building,
} from "lucide-react";

export default function ProfilePage() {
  const { profile, loading: profileLoading, updateProfile } = useUserProfile();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("Administrator");
  const [shopName, setShopName] = useState("Gaurav Marbles");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || "");
      setPhone(profile.phone || "");
      setPosition(profile.position || "Administrator");
      setShopName(profile.shopName || "Gaurav Marbles");
      setAddress(profile.address || "");
      setCity(profile.city || "");
      setState(profile.state || "");
      setPinCode(profile.pinCode || "");
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast("Full name cannot be empty", "error");
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        position: position.trim(),
        shopName: shopName.trim() || "Gaurav Marbles",
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pinCode: pinCode.trim(),
      });
      showToast("Profile details updated successfully", "success");
    } catch (err) {
      console.error("Failed to save profile:", err);
      showToast("Failed to save profile. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return "GM";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  if (profileLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-500">Loading user profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Account & User Profile</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your personal details, shop role, and business location settings.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Card Preview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white flex items-center justify-center text-2xl font-bold mx-auto shadow-md shadow-slate-900/10">
              {getInitials(fullName || profile?.fullName || "")}
            </div>

            <h2 className="text-lg font-bold text-slate-900 mt-4 tracking-tight">
              {fullName || "Administrator"}
            </h2>
            <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>{position || "Administrator"}</span>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 text-left space-y-3 text-xs">
              <div className="flex items-center gap-2.5 text-slate-600">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{profile?.email || "No email available"}</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-600">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{phone || "No phone added"}</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-600">
                <Store className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-800">{shopName || "Gaurav Marbles"}</span>
              </div>
              {(city || state) && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    {[city, state].filter(Boolean).join(", ")}
                    {pinCode ? ` - ${pinCode}` : ""}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 text-xs text-slate-600 space-y-2">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Building className="w-4 h-4 text-slate-500" />
              Role & Permissions
            </h3>
            <p className="leading-relaxed">
              Your role is displayed across invoices, transaction logs, and the application header.
              Any profile changes are automatically synchronized with Firestore in real-time.
            </p>
          </div>
        </div>

        {/* Right Column: Edit Profile Form */}
        <div className="lg:col-span-2">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6"
          >
            <div>
              <h3 className="text-base font-bold text-slate-900">Personal Information</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Update how your name and contact details appear in the system.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Gaurav Mittal"
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Position / Role *
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition bg-white"
                  >
                    {POSITION_OPTIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="email"
                    value={profile?.email || ""}
                    disabled
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Managed via Firebase Authentication</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Shop / Business Information</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Default location and enterprise identity details.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Shop Name
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Gaurav Marbles"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Street Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Industrial Area, Marble Market"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Kishangarh"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    State
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Rajasthan"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Pin Code
                  </label>
                  <input
                    type="text"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="305801"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 sm:gap-3">
              <button
                type="submit"
                disabled={saving}
                className="py-2.5 px-6 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition shadow-md shadow-slate-900/10 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Profile</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
