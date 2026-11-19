"use client";

import { cloneElement, useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getProfile, saveProfile, deleteProfile, ApiError } from "@/lib/api";
import { SEVERITIES } from "@/types";
import type {
  ProfileRequest,
  EmergencyContact,
  Allergy,
  Medication,
  Condition,
  Surgery,
} from "@/types";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const EMPTY_PROFILE: ProfileRequest = {
  firstName: "",
  lastName: "",
  birthDate: "",
  bloodType: "",
  publicPassword: "",
  emergencyContacts: [],
  allergies: [],
  medications: [],
  conditions: [],
  surgeries: [],
};

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileRequest>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const p = await getProfile();
      setForm({
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: p.birthDate,
        bloodType: p.bloodType,
        publicPassword: "",
        emergencyContacts: p.emergencyContacts,
        allergies: p.allergies,
        medications: p.medications,
        conditions: p.conditions,
        surgeries: p.surgeries,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/auth/login");
      }
      // 404 = no profile yet, keep EMPTY_PROFILE
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function setField<K extends keyof ProfileRequest>(key: K, value: ProfileRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
    setSuccess("");
  }

  // Helpers for dynamic lists
  function addItem<T>(key: keyof ProfileRequest, empty: T) {
    setForm((f) => ({ ...f, [key]: [...(f[key] as T[]), empty] }));
  }

  function removeItem(key: keyof ProfileRequest, idx: number) {
    setForm((f) => ({
      ...f,
      [key]: (f[key] as unknown[]).filter((_, i) => i !== idx),
    }));
  }

  function updateItem<T>(key: keyof ProfileRequest, idx: number, value: T) {
    setForm((f) => ({
      ...f,
      [key]: (f[key] as T[]).map((item, i) => (i === idx ? value : item)),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await saveProfile(form);
      setSuccess("Profile saved successfully!");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error saving.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure? All your data will be permanently deleted.")) return;
    setDeleting(true);
    try {
      await deleteProfile();
      localStorage.removeItem("vitaltag_token");
      router.push("/auth/register");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error deleting.");
      setDeleting(false);
    }
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
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-600">
            ← Back
          </Link>
          <h1 className="font-bold text-slate-800 text-lg flex-1">Clinical Profile</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal data */}
          <Section title="Personal Data">
            <div className="grid grid-cols-2 gap-4">
              <Field label="First name">
                <input
                  className="input"
                  required
                  value={form.firstName}
                  onChange={(e) => setField("firstName", e.target.value)}
                />
              </Field>
              <Field label="Last name">
                <input
                  className="input"
                  required
                  value={form.lastName}
                  onChange={(e) => setField("lastName", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date of birth">
                <input
                  className="input"
                  type="date"
                  required
                  value={form.birthDate}
                  onChange={(e) => setField("birthDate", e.target.value)}
                />
              </Field>
              <Field label="Blood type">
                <select
                  className="input"
                  required
                  value={form.bloodType}
                  onChange={(e) => setField("bloodType", e.target.value)}
                >
                  <option value="">Select…</option>
                  {BLOOD_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Public password (for emergency access)" hint="At least 4 characters. Don't reuse your account password.">
              <input
                className="input"
                type="password"
                minLength={4}
                value={form.publicPassword}
                onChange={(e) => setField("publicPassword", e.target.value)}
                placeholder="Leave blank to keep the current one"
              />
            </Field>
          </Section>

          {/* Emergency contacts */}
          <Section
            title="Emergency Contacts"
            onAdd={() =>
              addItem<EmergencyContact>("emergencyContacts", {
                name: "",
                phone: "",
                relationship: "",
              })
            }
          >
            {form.emergencyContacts.map((c, i) => (
              <ItemCard key={i} onRemove={() => removeItem("emergencyContacts", i)}>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Name">
                    <input
                      className="input"
                      value={c.name}
                      onChange={(e) =>
                        updateItem("emergencyContacts", i, { ...c, name: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      className="input"
                      value={c.phone}
                      onChange={(e) =>
                        updateItem("emergencyContacts", i, { ...c, phone: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Relationship">
                    <input
                      className="input"
                      value={c.relationship}
                      onChange={(e) =>
                        updateItem("emergencyContacts", i, { ...c, relationship: e.target.value })
                      }
                      placeholder="Spouse, child…"
                    />
                  </Field>
                </div>
              </ItemCard>
            ))}
            {form.emergencyContacts.length === 0 && (
              <Empty>No contacts added.</Empty>
            )}
          </Section>

          {/* Allergies */}
          <Section
            title="Allergies"
            onAdd={() =>
              addItem<Allergy>("allergies", { description: "", severity: "mild" })
            }
          >
            {form.allergies.map((a, i) => (
              <ItemCard key={i} onRemove={() => removeItem("allergies", i)}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Description">
                    <input
                      className="input"
                      value={a.description}
                      onChange={(e) =>
                        updateItem("allergies", i, { ...a, description: e.target.value })
                      }
                      placeholder="Penicillin, shellfish…"
                    />
                  </Field>
                  <Field label="Severity">
                    <select
                      className="input"
                      value={a.severity}
                      onChange={(e) =>
                        updateItem("allergies", i, { ...a, severity: e.target.value })
                      }
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </ItemCard>
            ))}
            {form.allergies.length === 0 && <Empty>No allergies added.</Empty>}
          </Section>

          {/* Medications */}
          <Section
            title="Current Medications"
            onAdd={() =>
              addItem<Medication>("medications", {
                name: "",
                dose: "",
                frequency: "",
              })
            }
          >
            {form.medications.map((m, i) => (
              <ItemCard key={i} onRemove={() => removeItem("medications", i)}>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Medication">
                    <input
                      className="input"
                      value={m.name}
                      onChange={(e) =>
                        updateItem("medications", i, { ...m, name: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Dose">
                    <input
                      className="input"
                      value={m.dose}
                      onChange={(e) =>
                        updateItem("medications", i, { ...m, dose: e.target.value })
                      }
                      placeholder="500mg"
                    />
                  </Field>
                  <Field label="Frequency">
                    <input
                      className="input"
                      value={m.frequency}
                      onChange={(e) =>
                        updateItem("medications", i, { ...m, frequency: e.target.value })
                      }
                      placeholder="Twice a day"
                    />
                  </Field>
                </div>
              </ItemCard>
            ))}
            {form.medications.length === 0 && (
              <Empty>No medications added.</Empty>
            )}
          </Section>

          {/* Conditions */}
          <Section
            title="Diseases / Conditions"
            onAdd={() =>
              addItem<Condition>("conditions", { name: "", since: "" })
            }
          >
            {form.conditions.map((d, i) => (
              <ItemCard key={i} onRemove={() => removeItem("conditions", i)}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Disease / Condition">
                    <input
                      className="input"
                      value={d.name}
                      onChange={(e) =>
                        updateItem("conditions", i, { ...d, name: e.target.value })
                      }
                      placeholder="Type 2 diabetes…"
                    />
                  </Field>
                  <Field label="Since (optional)">
                    <input
                      className="input"
                      type="date"
                      value={d.since}
                      onChange={(e) =>
                        updateItem("conditions", i, { ...d, since: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </ItemCard>
            ))}
            {form.conditions.length === 0 && <Empty>No conditions added.</Empty>}
          </Section>

          {/* Surgeries */}
          <Section
            title="Surgeries"
            onAdd={() =>
              addItem<Surgery>("surgeries", { procedure: "", date: "" })
            }
          >
            {form.surgeries.map((s, i) => (
              <ItemCard key={i} onRemove={() => removeItem("surgeries", i)}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Procedure">
                    <input
                      className="input"
                      value={s.procedure}
                      onChange={(e) =>
                        updateItem("surgeries", i, { ...s, procedure: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Date (optional)">
                    <input
                      className="input"
                      type="date"
                      value={s.date}
                      onChange={(e) =>
                        updateItem("surgeries", i, { ...s, date: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </ItemCard>
            ))}
            {form.surgeries.length === 0 && <Empty>No surgeries added.</Empty>}
          </Section>

          {/* Feedback */}
          {success && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              ✅ {success}
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 pb-8">
            <button
              type="button"
              className="btn-danger text-sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete account"}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({
  title,
  children,
  onAdd,
}: {
  title: string;
  children: React.ReactNode;
  onAdd?: () => void;
}) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add
          </button>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/** Label + one form control. Links them (htmlFor/id) and the hint (aria-describedby) so screen
 *  readers announce the field's name and hint; useId keeps ids unique across list items. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactElement<{ id?: string; "aria-describedby"?: string }>;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {cloneElement(children, { id, "aria-describedby": hint ? hintId : undefined })}
      {hint && (
        <p id={hintId} className="text-xs text-slate-400 mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}

function ItemCard({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove: () => void;
}) {
  return (
    <div className="relative rounded-lg border border-slate-200 bg-slate-50 p-4">
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 text-lg leading-none"
        aria-label="Remove"
      >
        ×
      </button>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400 italic">{children}</p>;
}
