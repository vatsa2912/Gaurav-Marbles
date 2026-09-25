"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  position: string;
  shopName: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  updatedAt?: string;
}

export const POSITION_OPTIONS = [
  "Owner / Director",
  "Administrator",
  "Store Manager",
  "Inventory Manager",
  "Sales Executive",
  "Accountant",
  "Billing Specialist",
];

interface UserProfileContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

function deriveDefaultName(email?: string | null, displayName?: string | null): string {
  if (displayName && displayName.trim()) return displayName.trim();
  if (!email) return "Store Administrator";
  const namePart = email.split("@")[0];
  return namePart
    .replace(/[._\-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (currentUser: User) => {
    try {
      const userDocRef = doc(db, "users", currentUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const data = userDocSnap.data() as UserProfile;
        setProfile({
          uid: currentUser.uid,
          email: currentUser.email || data.email || "",
          fullName: data.fullName || deriveDefaultName(currentUser.email, currentUser.displayName),
          phone: data.phone || "",
          position: data.position || "Administrator",
          shopName: data.shopName || "Gaurav Marbles",
          address: data.address || "",
          city: data.city || "",
          state: data.state || "",
          pinCode: data.pinCode || "",
          updatedAt: data.updatedAt,
        });
      } else {
        // Initialize default profile
        const defaultProfile: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email || "",
          fullName: deriveDefaultName(currentUser.email, currentUser.displayName),
          phone: "",
          position: "Administrator",
          shopName: "Gaurav Marbles",
          address: "",
          city: "",
          state: "",
          pinCode: "",
          updatedAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, defaultProfile, { merge: true });
        setProfile(defaultProfile);
      }
    } catch (err) {
      console.error("Failed to load user profile:", err);
      // Fallback local state if firestore fails
      setProfile({
        uid: currentUser.uid,
        email: currentUser.email || "",
        fullName: deriveDefaultName(currentUser.email, currentUser.displayName),
        phone: "",
        position: "Administrator",
        shopName: "Gaurav Marbles",
      });
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchProfile]);

  const updateProfile = useCallback(
    async (data: Partial<UserProfile>) => {
      if (!user) throw new Error("No authenticated user");
      const userDocRef = doc(db, "users", user.uid);
      const updatedData = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, updatedData, { merge: true });
      setProfile((prev) => (prev ? { ...prev, ...updatedData } : null));
    },
    [user]
  );

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user);
    }
  }, [user, fetchProfile]);

  return (
    <UserProfileContext.Provider
      value={{
        user,
        profile,
        loading,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }
  return context;
}
