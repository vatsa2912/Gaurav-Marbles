"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/ui/ToastContext";

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();

  const customerId = params.id as string;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCustomer = async () => {
      try {
        const customerRef = doc(db, "customers", customerId);
        const customerSnap = await getDoc(customerRef);

        if (!customerSnap.exists()) {
          showToast("Customer not found.", "error");
          router.push("/dashboard/customers");
          return;
        }

        const data = customerSnap.data();

        setName(data.name || "");
        setPhone(data.phone || "");
        setAddress(data.address || "");
      } catch (error) {
        console.error("Error loading customer:", error);
        showToast("Could not load customer.", "error");
      } finally {
        setLoading(false);
      }
    };

    if (customerId) {
      loadCustomer();
    }
  }, [customerId, router, showToast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      showToast("Customer name is required.", "error");
      return;
    }

    try {
      setSaving(true);

      const customerRef = doc(db, "customers", customerId);

      await updateDoc(customerRef, {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });

      showToast("Customer details updated successfully.", "success");
      router.push(`/dashboard/customers/${customerId}`);
    } catch (error) {
      console.error("Error updating customer:", error);
      showToast("Could not update customer.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="page-main">
        <div className="page-content">
          <p>Loading customer...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-main">
      <header className="site-header">
        <h1 className="text-xl">
          Gaurav Marbles
        </h1>

        <p className="text-muted">
          Customer Management
        </p>
      </header>

      <div className="page-content">

        <div className="mb-6">
          <h2 className="text-2xl">
            Edit Customer
          </h2>

          <p className="text-muted mt-1">
            Update customer contact details
          </p>
        </div>

        <div className="card">
          <form
            onSubmit={handleSave}
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            <div className="form-field">
              <label>Customer Name</label>

              <input
                type="text"
                placeholder="Enter customer name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Phone Number</label>

              <input
                type="tel"
                placeholder="Enter phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>Address</label>

              <input
                type="text"
                placeholder="Enter address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="md:col-span-3 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(`/dashboard/customers/${customerId}`)
                }
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

      </div>
    </main>
  );
}