"use client";

import { useState } from "react";
import { use } from "react";
import { accessPublicProfile, ApiError } from "@/lib/api";
import type { Profile } from "@/types";

export default function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAccess(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const p = await accessPublicProfile(slug, { password });
      setProfile(p);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError("⛔ Too many incorrect attempts. Try again in 15 minutes.");
        } else if (err.status === 401) {
          setError("Incorrect password. Please try again.");
        } else if (err.status === 404) {
          setError("Profile not found.");
        } else {
          setError("Error accessing profile.");
        }
      } else {
        setError("Network error.");
      }
    } finally {
      setLoading(false);
    }
  }

  /* ── Password screen ── */
  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-red-50 px-4">
        <div className="w-full max-w-sm">
          {/* Emergency header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-600 text-white text-3xl mb-4 shadow-lg">
              🚨
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              Emergency Data
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              This page contains a person&apos;s medical information.
            </p>
          </div>

          <div className="card">
            <p className="text-sm text-slate-600 mb-4">
              Enter the emergency password to access the clinical data:
            </p>
            <form onSubmit={handleAccess} className="space-y-4">
              <div>
                <label className="label" htmlFor="public-password">Emergency password</label>
                <input
                  id="public-password"
                  className="input text-center text-lg tracking-widest"
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="••••"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="btn-primary w-full bg-red-600 hover:bg-red-700"
                disabled={loading}
              >
                {loading ? "Verifying…" : "Access data"}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-400 mt-4">
            In a medical emergency call{" "}
            <a href="tel:192" className="font-semibold text-red-600">
              192 (SAMU)
            </a>{" "}
            or{" "}
            <a href="tel:193" className="font-semibold text-red-600">
              193 (Fire Department)
            </a>
          </p>
        </div>
      </main>
    );
  }

  /* ── Clinical data ── */
  return (
    <main className="min-h-screen bg-red-50 pb-12">
      {/* Emergency banner */}
      <div className="bg-red-600 text-white px-4 py-4 text-center">
        <p className="font-bold text-lg">🚨 MEDICAL EMERGENCY DATA</p>
        <p className="text-sm opacity-90 mt-0.5">
          In an emergency call: SAMU 192 · Fire Department 193
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-5">
        {/* Identification */}
        <div className="card">
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            {profile.firstName} {profile.lastName}
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <DataRow label="Date of birth" value={formatDate(profile.birthDate)} />
            <DataRow
              label="Blood type"
              value={profile.bloodType}
              highlight
            />
          </dl>
        </div>

        {/* Allergies — highlighted */}
        {profile.allergies.length > 0 && (
          <div className="card border-red-300 bg-red-50">
            <h3 className="font-semibold text-red-700 mb-3">⚠️ Allergies</h3>
            <div className="space-y-2">
              {profile.allergies.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-red-200"
                >
                  <span className="text-sm font-medium text-slate-800">
                    {a.description}
                  </span>
                  <SeverityBadge severity={a.severity} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Medications */}
        {profile.medications.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-3">💊 Current medications</h3>
            <div className="space-y-2">
              {profile.medications.map((m, i) => (
                <div key={i} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                  <span className="font-medium text-slate-800">{m.name}</span>
                  <span className="text-slate-500">
                    {m.dose} — {m.frequency}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Conditions */}
        {profile.conditions.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-3">🏥 Health conditions</h3>
            <ul className="space-y-1">
              {profile.conditions.map((d, i) => (
                <li key={i} className="text-sm text-slate-700">
                  • {d.name}
                  {d.since && (
                    <span className="text-slate-400"> since {formatDate(d.since)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Surgeries */}
        {profile.surgeries.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-3">🔪 Previous surgeries</h3>
            <ul className="space-y-1">
              {profile.surgeries.map((s, i) => (
                <li key={i} className="text-sm text-slate-700">
                  • {s.procedure}
                  {s.date && (
                    <span className="text-slate-400"> ({formatDate(s.date)})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Emergency contacts */}
        {profile.emergencyContacts.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-3">📞 Emergency contacts</h3>
            <div className="space-y-3">
              {profile.emergencyContacts.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.relationship}</p>
                  </div>
                  <a
                    href={`tel:${c.phone.replace(/\D/g, "")}`}
                    className="btn-primary text-sm py-1.5 px-3 bg-green-600 hover:bg-green-700"
                  >
                    📲 {c.phone}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 pt-2">
          Data provided by the owner via VitalTag. Generated on{" "}
          {new Date().toLocaleDateString("en-GB")}.
        </p>
      </div>
    </main>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// en-GB keeps the day-first DD/MM/YYYY format the app has always used.
function formatDate(d: string) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-GB");
  } catch {
    return d;
  }
}

function DataRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-400 uppercase tracking-wide">{label}</dt>
      <dd
        className={`font-semibold mt-0.5 ${
          highlight ? "text-red-700 text-lg" : "text-slate-800"
        }`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    mild: "bg-yellow-100 text-yellow-800",
    moderate: "bg-orange-100 text-orange-800",
    severe: "bg-red-100 text-red-800",
    fatal: "bg-red-700 text-white",
  };
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
        map[severity] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {severity}
    </span>
  );
}
