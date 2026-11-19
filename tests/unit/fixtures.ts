// Shared test data.
//
// WIRE_PROFILE is exactly what vitaltag-api returns (Portuguese field names, Portuguese
// severity values). PROFILE is the same data as the app should see it after lib/api.ts maps it.
// Both are written out by hand on purpose: deriving one from the other would hide mapping bugs.

import type { Profile, ProfileRequest } from "@/types";

export const WIRE_PROFILE = {
  slug: "abc123",
  usuario_id: "00000000-0000-4000-8000-000000000042",
  nome: "Maria",
  sobrenome: "Silva",
  data_nascimento: "1990-01-02",
  tipo_sanguineo: "AB+",
  contatos_emergencia: [{ nome: "João Silva", telefone: "(11) 98765-4321", parentesco: "Spouse" }],
  alergias: [
    { descricao: "Penicillin", gravidade: "leve" },
    { descricao: "Dipyrone", gravidade: "moderada" },
    { descricao: "Shellfish", gravidade: "grave" },
    { descricao: "Bee sting", gravidade: "fatal" },
  ],
  medicamentos: [{ nome: "Losartan", dose: "50 mg", frequencia: "Once a day" }],
  doencas: [{ nome: "Hypertension", desde: "2015-06-01" }],
  cirurgias: [{ procedimento: "Appendectomy", data: "2010-09-20" }],
};

export const PROFILE: Profile = {
  slug: "abc123",
  userId: "00000000-0000-4000-8000-000000000042",
  firstName: "Maria",
  lastName: "Silva",
  birthDate: "1990-01-02",
  bloodType: "AB+",
  emergencyContacts: [{ name: "João Silva", phone: "(11) 98765-4321", relationship: "Spouse" }],
  allergies: [
    { description: "Penicillin", severity: "mild" },
    { description: "Dipyrone", severity: "moderate" },
    { description: "Shellfish", severity: "severe" },
    { description: "Bee sting", severity: "fatal" },
  ],
  medications: [{ name: "Losartan", dose: "50 mg", frequency: "Once a day" }],
  conditions: [{ name: "Hypertension", since: "2015-06-01" }],
  surgeries: [{ procedure: "Appendectomy", date: "2010-09-20" }],
};

/** What the profile form submits (English) … */
export const PROFILE_REQUEST: ProfileRequest = {
  firstName: "Maria",
  lastName: "Silva",
  birthDate: "1990-01-02",
  bloodType: "AB+",
  publicPassword: "4321",
  emergencyContacts: PROFILE.emergencyContacts,
  allergies: PROFILE.allergies,
  medications: PROFILE.medications,
  conditions: PROFILE.conditions,
  surgeries: PROFILE.surgeries,
};

/** … and the exact JSON body the API must receive for it. */
export const WIRE_PROFILE_REQUEST = {
  nome: "Maria",
  sobrenome: "Silva",
  data_nascimento: "1990-01-02",
  tipo_sanguineo: "AB+",
  senha_publica: "4321",
  contatos_emergencia: WIRE_PROFILE.contatos_emergencia,
  alergias: WIRE_PROFILE.alergias,
  medicamentos: WIRE_PROFILE.medicamentos,
  doencas: WIRE_PROFILE.doencas,
  cirurgias: WIRE_PROFILE.cirurgias,
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
