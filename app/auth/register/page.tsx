"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { register, ApiError } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    consent: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.consent) {
      setError("You must consent to the use of your data.");
      return;
    }
    setLoading(true);
    try {
      await register(form);
      router.push("/auth/login?registered=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error creating account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white text-2xl font-bold mb-4 shadow-lg">
            ❤️
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Create account</h1>
          <p className="text-sm text-slate-500 mt-1">
            VitalTag — your emergency data, always accessible
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First name</label>
                <input
                  className="input"
                  required
                  value={form.firstName}
                  onChange={(e) => set("firstName", e.target.value)}
                  placeholder="John"
                />
              </div>
              <div>
                <label className="label">Last name</label>
                <input
                  className="input"
                  required
                  value={form.lastName}
                  onChange={(e) => set("lastName", e.target.value)}
                  placeholder="Smith"
                />
              </div>
            </div>

            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>

            {/* LGPD consent */}
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={form.consent}
                  onChange={(e) => set("consent", e.target.checked)}
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  I consent to the storage and use of my health data for medical
                  emergency purposes, in accordance with Brazil&apos;s{" "}
                  <strong>General Data Protection Law (LGPD)</strong>. I can
                  delete my account and data at any time.
                </span>
              </label>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary w-full mt-2"
              disabled={loading}
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-blue-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
