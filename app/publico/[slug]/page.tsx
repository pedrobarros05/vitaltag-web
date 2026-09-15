"use client";

import { useState } from "react";
import { use } from "react";
import { acessarPublico, ApiError } from "@/lib/api";
import type { PerfilCompleto } from "@/types";

export default function PublicoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAcessar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");
    try {
      const p = await acessarPublico(slug, { senha });
      setPerfil(p);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setErro("⛔ Muitas tentativas incorretas. Tente novamente em 15 minutos.");
        } else if (err.status === 401) {
          setErro("Senha incorreta. Tente novamente.");
        } else if (err.status === 404) {
          setErro("Perfil não encontrado.");
        } else {
          setErro("Erro ao acessar perfil.");
        }
      } else {
        setErro("Erro de rede.");
      }
    } finally {
      setLoading(false);
    }
  }

  /* ── Tela de senha ── */
  if (!perfil) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-red-50 px-4">
        <div className="w-full max-w-sm">
          {/* Cabeçalho de emergência */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-600 text-white text-3xl mb-4 shadow-lg">
              🚨
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              Dados de Emergência
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Esta página contém informações médicas de uma pessoa.
            </p>
          </div>

          <div className="card">
            <p className="text-sm text-slate-600 mb-4">
              Insira a senha de emergência para acessar os dados clínicos:
            </p>
            <form onSubmit={handleAcessar} className="space-y-4">
              <div>
                <label className="label">Senha de emergência</label>
                <input
                  className="input text-center text-lg tracking-widest"
                  type="password"
                  required
                  autoFocus
                  value={senha}
                  onChange={(e) => {
                    setSenha(e.target.value);
                    setErro("");
                  }}
                  placeholder="••••"
                />
              </div>
              {erro && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {erro}
                </p>
              )}
              <button
                type="submit"
                className="btn-primary w-full bg-red-600 hover:bg-red-700"
                disabled={loading}
              >
                {loading ? "Verificando…" : "Acessar dados"}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-400 mt-4">
            Em caso de emergência médica ligue{" "}
            <a href="tel:192" className="font-semibold text-red-600">
              192 (SAMU)
            </a>{" "}
            ou{" "}
            <a href="tel:193" className="font-semibold text-red-600">
              193 (Bombeiros)
            </a>
          </p>
        </div>
      </main>
    );
  }

  /* ── Dados clínicos ── */
  return (
    <main className="min-h-screen bg-red-50 pb-12">
      {/* Banner de emergência */}
      <div className="bg-red-600 text-white px-4 py-4 text-center">
        <p className="font-bold text-lg">🚨 DADOS DE EMERGÊNCIA MÉDICA</p>
        <p className="text-sm opacity-90 mt-0.5">
          Em caso de emergência ligue: SAMU 192 · Bombeiros 193
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-5">
        {/* Identificação */}
        <div className="card">
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            {perfil.nome} {perfil.sobrenome}
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <DataRow label="Data de nascimento" value={formatDate(perfil.data_nascimento)} />
            <DataRow
              label="Tipo sanguíneo"
              value={perfil.tipo_sanguineo}
              highlight
            />
          </dl>
        </div>

        {/* Alergias — destaque */}
        {perfil.alergias?.length > 0 && (
          <div className="card border-red-300 bg-red-50">
            <h3 className="font-semibold text-red-700 mb-3">⚠️ Alergias</h3>
            <div className="space-y-2">
              {perfil.alergias.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-red-200"
                >
                  <span className="text-sm font-medium text-slate-800">
                    {a.descricao}
                  </span>
                  <GravidadeBadge g={a.gravidade} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Medicamentos */}
        {perfil.medicamentos?.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-3">💊 Medicamentos em uso</h3>
            <div className="space-y-2">
              {perfil.medicamentos.map((m, i) => (
                <div key={i} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                  <span className="font-medium text-slate-800">{m.nome}</span>
                  <span className="text-slate-500">
                    {m.dose} — {m.frequencia}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Doenças */}
        {perfil.doencas?.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-3">🏥 Condições de saúde</h3>
            <ul className="space-y-1">
              {perfil.doencas.map((d, i) => (
                <li key={i} className="text-sm text-slate-700">
                  • {d.nome}
                  {d.desde && (
                    <span className="text-slate-400"> desde {formatDate(d.desde)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cirurgias */}
        {perfil.cirurgias?.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-3">🔪 Cirurgias anteriores</h3>
            <ul className="space-y-1">
              {perfil.cirurgias.map((c, i) => (
                <li key={i} className="text-sm text-slate-700">
                  • {c.procedimento}
                  {c.data && (
                    <span className="text-slate-400"> ({formatDate(c.data)})</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Contatos de emergência */}
        {perfil.contatos_emergencia?.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-slate-700 mb-3">📞 Contatos de emergência</h3>
            <div className="space-y-3">
              {perfil.contatos_emergencia.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.nome}</p>
                    <p className="text-xs text-slate-500">{c.parentesco}</p>
                  </div>
                  <a
                    href={`tel:${c.telefone.replace(/\D/g, "")}`}
                    className="btn-primary text-sm py-1.5 px-3 bg-green-600 hover:bg-green-700"
                  >
                    📲 {c.telefone}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 pt-2">
          Dados fornecidos pelo titular via VitalTag. Gerado em{" "}
          {new Date().toLocaleDateString("pt-BR")}.
        </p>
      </div>
    </main>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("pt-BR");
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

function GravidadeBadge({ g }: { g: string }) {
  const map: Record<string, string> = {
    leve: "bg-yellow-100 text-yellow-800",
    moderada: "bg-orange-100 text-orange-800",
    grave: "bg-red-100 text-red-800",
    fatal: "bg-red-700 text-white",
  };
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
        map[g] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {g}
    </span>
  );
}
