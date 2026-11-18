"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getProfile, getQRCode, ApiError } from "@/lib/api";
import type { Profile } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const p = await getProfile();
      setProfile(p);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/auth/login");
      } else if (err instanceof ApiError && err.status === 404) {
        // No profile registered yet — that's fine
        setProfile(null);
      } else {
        setError("Error loading profile.");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function generateQR() {
    setQrLoading(true);
    try {
      const blob = await getQRCode();
      const url = URL.createObjectURL(blob);
      setQrUrl(url);
    } catch {
      setError("Error generating QR Code.");
    } finally {
      setQrLoading(false);
    }
  }

  function signOut() {
    localStorage.removeItem("vitaltag_token");
    router.push("/auth/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500 animate-pulse">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">❤️</span>
            <span className="font-bold text-slate-800 text-lg">VitalTag</span>
          </div>
          <button onClick={signOut} className="btn-secondary text-sm">
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Welcome */}
        <div className="card">
          <h2 className="text-xl font-bold text-slate-800 mb-1">
            {profile
              ? `Hi, ${profile.firstName}! 👋`
              : "Welcome to VitalTag! 👋"}
          </h2>
          <p className="text-sm text-slate-500">
            {profile
              ? "Your emergency profile is set up."
              : "Set up your clinical profile to get an emergency QR Code."}
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/profile" className="btn-primary">
              {profile ? "Edit profile" : "Set up profile"}
            </Link>
            {profile && (
              <button
                onClick={generateQR}
                className="btn-secondary"
                disabled={qrLoading}
              >
                {qrLoading ? "Generating…" : "Generate QR Code"}
              </button>
            )}
          </div>
        </div>

        {/* QR Code */}
        {qrUrl && (
          <div className="card text-center">
            <h3 className="text-base font-semibold text-slate-700 mb-4">
              Your Emergency QR Code
            </h3>
            <img
              src={qrUrl}
              alt="Emergency QR Code"
              className="mx-auto w-48 h-48 rounded-lg border border-slate-200"
            />
            <p className="text-xs text-slate-500 mt-3 max-w-xs mx-auto">
              Print it and carry it with you. In an emergency, anyone can scan
              it and access your clinical data.
            </p>
            <a
              href={qrUrl}
              download="vitaltag-qrcode.png"
              className="btn-primary mt-4 inline-flex"
            >
              Download PNG
            </a>
          </div>
        )}

        {/* Profile summary */}
        {profile && (
          <div className="card">
            <h3 className="text-base font-semibold text-slate-700 mb-4">
              Profile summary
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <InfoRow label="Name" value={`${profile.firstName} ${profile.lastName}`} />
              <InfoRow label="Date of birth" value={profile.birthDate || "—"} />
              <InfoRow label="Blood type" value={profile.bloodType || "—"} />
              <InfoRow
                label="Allergies"
                value={
                  profile.allergies.length
                    ? `${profile.allergies.length} registered`
                    : "None"
                }
              />
              <InfoRow
                label="Medications"
                value={
                  profile.medications.length
                    ? `${profile.medications.length} registered`
                    : "None"
                }
              />
              <InfoRow
                label="Contacts"
                value={
                  profile.emergencyContacts.length
                    ? `${profile.emergencyContacts.length} registered`
                    : "None"
                }
              />
            </dl>
          </div>
        )}
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400 uppercase tracking-wide">{label}</dt>
      <dd className="font-medium text-slate-700 mt-0.5">{value}</dd>
    </div>
  );
}
