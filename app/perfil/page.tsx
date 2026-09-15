"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { buscarPerfil, salvarPerfil, excluirPerfil, ApiError } from "@/lib/api";
import type {
  PerfilRequest,
  ContatoEmergencia,
  Alergia,
  Medicamento,
  Doenca,
  Cirurgia,
} from "@/types";

const TIPOS_SANGUINEOS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GRAVIDADES = ["leve", "moderada", "grave", "fatal"];

const PERFIL_VAZIO: PerfilRequest = {
  nome: "",
  sobrenome: "",
  data_nascimento: "",
  tipo_sanguineo: "",
  senha_publica: "",
  contatos_emergencia: [],
  alergias: [],
  medicamentos: [],
  doencas: [],
  cirurgias: [],
};

export default function PerfilPage() {
  const router = useRouter();
  const [form, setForm] = useState<PerfilRequest>(PERFIL_VAZIO);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [sucesso, setSucesso] = useState("");
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      const p = await buscarPerfil();
      setForm({
        nome: p.nome,
        sobrenome: p.sobrenome,
        data_nascimento: p.data_nascimento,
        tipo_sanguineo: p.tipo_sanguineo,
        senha_publica: "",
        contatos_emergencia: p.contatos_emergencia ?? [],
        alergias: p.alergias ?? [],
        medicamentos: p.medicamentos ?? [],
        doencas: p.doencas ?? [],
        cirurgias: p.cirurgias ?? [],
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/auth/login");
      }
      // 404 = ainda sem perfil, fica com PERFIL_VAZIO
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function setField<K extends keyof PerfilRequest>(key: K, value: PerfilRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErro("");
    setSucesso("");
  }

  // Helpers para listas dinâmicas
  function addItem<T>(key: keyof PerfilRequest, empty: T) {
    setForm((f) => ({ ...f, [key]: [...(f[key] as T[]), empty] }));
  }

  function removeItem(key: keyof PerfilRequest, idx: number) {
    setForm((f) => ({
      ...f,
      [key]: (f[key] as unknown[]).filter((_, i) => i !== idx),
    }));
  }

  function updateItem<T>(key: keyof PerfilRequest, idx: number, value: T) {
    setForm((f) => ({
      ...f,
      [key]: (f[key] as T[]).map((item, i) => (i === idx ? value : item)),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro("");
    setSucesso("");
    try {
      await salvarPerfil(form);
      setSucesso("Perfil salvo com sucesso!");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir() {
    if (!confirm("Tem certeza? Todos os seus dados serão excluídos permanentemente.")) return;
    setExcluindo(true);
    try {
      await excluirPerfil();
      localStorage.removeItem("vitaltag_token");
      router.push("/auth/registro");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao excluir.");
      setExcluindo(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500 animate-pulse">Carregando…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-600">
            ← Voltar
          </Link>
          <h1 className="font-bold text-slate-800 text-lg flex-1">Perfil Clínico</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados pessoais */}
          <Section title="Dados Pessoais">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nome">
                <input
                  className="input"
                  required
                  value={form.nome}
                  onChange={(e) => setField("nome", e.target.value)}
                />
              </Field>
              <Field label="Sobrenome">
                <input
                  className="input"
                  required
                  value={form.sobrenome}
                  onChange={(e) => setField("sobrenome", e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data de nascimento">
                <input
                  className="input"
                  type="date"
                  required
                  value={form.data_nascimento}
                  onChange={(e) => setField("data_nascimento", e.target.value)}
                />
              </Field>
              <Field label="Tipo sanguíneo">
                <select
                  className="input"
                  required
                  value={form.tipo_sanguineo}
                  onChange={(e) => setField("tipo_sanguineo", e.target.value)}
                >
                  <option value="">Selecionar…</option>
                  {TIPOS_SANGUINEOS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Senha pública (para acesso de emergência)" hint="Mínimo 4 caracteres. Não use a mesma senha da sua conta.">
              <input
                className="input"
                type="password"
                minLength={4}
                value={form.senha_publica}
                onChange={(e) => setField("senha_publica", e.target.value)}
                placeholder="Deixe em branco para manter a atual"
              />
            </Field>
          </Section>

          {/* Contatos de emergência */}
          <Section
            title="Contatos de Emergência"
            onAdd={() =>
              addItem<ContatoEmergencia>("contatos_emergencia", {
                nome: "",
                telefone: "",
                parentesco: "",
              })
            }
          >
            {form.contatos_emergencia.map((c, i) => (
              <ItemCard key={i} onRemove={() => removeItem("contatos_emergencia", i)}>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Nome">
                    <input
                      className="input"
                      value={c.nome}
                      onChange={(e) =>
                        updateItem("contatos_emergencia", i, { ...c, nome: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Telefone">
                    <input
                      className="input"
                      value={c.telefone}
                      onChange={(e) =>
                        updateItem("contatos_emergencia", i, { ...c, telefone: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Parentesco">
                    <input
                      className="input"
                      value={c.parentesco}
                      onChange={(e) =>
                        updateItem("contatos_emergencia", i, { ...c, parentesco: e.target.value })
                      }
                      placeholder="Cônjuge, filho…"
                    />
                  </Field>
                </div>
              </ItemCard>
            ))}
            {form.contatos_emergencia.length === 0 && (
              <Empty>Nenhum contato cadastrado.</Empty>
            )}
          </Section>

          {/* Alergias */}
          <Section
            title="Alergias"
            onAdd={() =>
              addItem<Alergia>("alergias", { descricao: "", gravidade: "leve" })
            }
          >
            {form.alergias.map((a, i) => (
              <ItemCard key={i} onRemove={() => removeItem("alergias", i)}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Descrição">
                    <input
                      className="input"
                      value={a.descricao}
                      onChange={(e) =>
                        updateItem("alergias", i, { ...a, descricao: e.target.value })
                      }
                      placeholder="Penicilina, frutos do mar…"
                    />
                  </Field>
                  <Field label="Gravidade">
                    <select
                      className="input"
                      value={a.gravidade}
                      onChange={(e) =>
                        updateItem("alergias", i, { ...a, gravidade: e.target.value })
                      }
                    >
                      {GRAVIDADES.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </ItemCard>
            ))}
            {form.alergias.length === 0 && <Empty>Nenhuma alergia cadastrada.</Empty>}
          </Section>

          {/* Medicamentos */}
          <Section
            title="Medicamentos em Uso"
            onAdd={() =>
              addItem<Medicamento>("medicamentos", {
                nome: "",
                dose: "",
                frequencia: "",
              })
            }
          >
            {form.medicamentos.map((m, i) => (
              <ItemCard key={i} onRemove={() => removeItem("medicamentos", i)}>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Medicamento">
                    <input
                      className="input"
                      value={m.nome}
                      onChange={(e) =>
                        updateItem("medicamentos", i, { ...m, nome: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Dose">
                    <input
                      className="input"
                      value={m.dose}
                      onChange={(e) =>
                        updateItem("medicamentos", i, { ...m, dose: e.target.value })
                      }
                      placeholder="500mg"
                    />
                  </Field>
                  <Field label="Frequência">
                    <input
                      className="input"
                      value={m.frequencia}
                      onChange={(e) =>
                        updateItem("medicamentos", i, { ...m, frequencia: e.target.value })
                      }
                      placeholder="2x ao dia"
                    />
                  </Field>
                </div>
              </ItemCard>
            ))}
            {form.medicamentos.length === 0 && (
              <Empty>Nenhum medicamento cadastrado.</Empty>
            )}
          </Section>

          {/* Doenças */}
          <Section
            title="Doenças / Condições"
            onAdd={() =>
              addItem<Doenca>("doencas", { nome: "", desde: "" })
            }
          >
            {form.doencas.map((d, i) => (
              <ItemCard key={i} onRemove={() => removeItem("doencas", i)}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Doença / Condição">
                    <input
                      className="input"
                      value={d.nome}
                      onChange={(e) =>
                        updateItem("doencas", i, { ...d, nome: e.target.value })
                      }
                      placeholder="Diabetes tipo 2…"
                    />
                  </Field>
                  <Field label="Desde (opcional)">
                    <input
                      className="input"
                      type="date"
                      value={d.desde}
                      onChange={(e) =>
                        updateItem("doencas", i, { ...d, desde: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </ItemCard>
            ))}
            {form.doencas.length === 0 && <Empty>Nenhuma doença cadastrada.</Empty>}
          </Section>

          {/* Cirurgias */}
          <Section
            title="Cirurgias"
            onAdd={() =>
              addItem<Cirurgia>("cirurgias", { procedimento: "", data: "" })
            }
          >
            {form.cirurgias.map((c, i) => (
              <ItemCard key={i} onRemove={() => removeItem("cirurgias", i)}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Procedimento">
                    <input
                      className="input"
                      value={c.procedimento}
                      onChange={(e) =>
                        updateItem("cirurgias", i, { ...c, procedimento: e.target.value })
                      }
                    />
                  </Field>
                  <Field label="Data (opcional)">
                    <input
                      className="input"
                      type="date"
                      value={c.data}
                      onChange={(e) =>
                        updateItem("cirurgias", i, { ...c, data: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </ItemCard>
            ))}
            {form.cirurgias.length === 0 && <Empty>Nenhuma cirurgia registrada.</Empty>}
          </Section>

          {/* Feedback */}
          {sucesso && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              ✅ {sucesso}
            </div>
          )}
          {erro && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {erro}
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center justify-between pt-2 pb-8">
            <button
              type="button"
              className="btn-danger text-sm"
              onClick={handleExcluir}
              disabled={excluindo}
            >
              {excluindo ? "Excluindo…" : "Excluir conta"}
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={salvando}
            >
              {salvando ? "Salvando…" : "Salvar perfil"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

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
            + Adicionar
          </button>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
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
        aria-label="Remover"
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
