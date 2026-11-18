// Domain types used throughout the app.
//
// The vitaltag-api speaks a Portuguese JSON contract (e.g. `nome`, `contatos_emergencia`).
// That wire format is confined to lib/api.ts, which maps it to/from the English types below.

// ─── Authentication ──────────────────────────────────────────────────────────

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  consent: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

// ─── Profile / Clinical data ─────────────────────────────────────────────────

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export const SEVERITIES = ["mild", "moderate", "severe", "fatal"] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface Allergy {
  description: string;
  /** One of SEVERITIES; unknown values from the API are passed through unchanged. */
  severity: Severity | (string & {});
}

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
}

export interface Condition {
  name: string;
  since: string; // YYYY-MM-DD or ""
}

export interface Surgery {
  procedure: string;
  date: string; // YYYY-MM-DD or ""
}

export interface ProfileRequest {
  firstName: string;
  lastName: string;
  birthDate: string; // YYYY-MM-DD
  bloodType: string;
  /** Password for emergency (public) access. Empty = keep the current one. */
  publicPassword: string;
  emergencyContacts: EmergencyContact[];
  allergies: Allergy[];
  medications: Medication[];
  conditions: Condition[];
  surgeries: Surgery[];
}

export interface Profile extends Omit<ProfileRequest, "publicPassword"> {
  slug: string;
  userId: string;
}

// ─── Public access ───────────────────────────────────────────────────────────

export interface PublicAccessRequest {
  password: string;
}
