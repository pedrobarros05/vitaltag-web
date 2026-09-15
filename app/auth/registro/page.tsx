"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registrar, ApiError } from "@/lib/api";

export default function RegistroPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "",
    sobrenome: "",
    email: "",
    senha: "",
    consentimento: false,
  });
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
    setErro("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.consentimento) {
      setErro("Você precisa aceitar o uso dos seus dados.");
      return;
    }
    setLoading(true);
    try {
      await registrar(form);
      router.push("/auth/login?cadastrado=1");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white text-2xl font-bold mb-4 shadow-lg">
            ❤️
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Criar conta</h1>
          <p className="text-sm text-slate-500 mt-1">
            VitalTag — seus dados de emergência, sempre acessíveis
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nome</label>
                <input
                  className="input"
                  required
                  value={form.nome}
                  onChange={(e) => set("nome", e.target.value)}
                  placeholder="João"
                />
              </div>
              <div>
                <label className="label">Sobrenome</label>
                <input
                  className="input"
                  required
                  value={form.sobrenome}
                  onChange={(e) => set("sobrenome", e.target.value)}
                  placeholder="Silva"
                />
              </div>
            </div>

            <div>
              <label className="label">E-mail</label>
              <input
                className="input"
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="joao@exemplo.com"
              />
            </div>

            <div>
              <label className="label">Senha</label>
              <input
                className="input"
                type="password"
                required
                minLength={8}
                value={form.senha}
                onChange={(e) => set("senha", e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>

            {/* Consentimento LGPD */}
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={form.consentimento}
                  onChange={(e) => set("consentimento", e.target.checked)}
                />
                <span className="text-xs text-slate-600 leading-relaxed">
                  Concordo com o armazenamento e uso dos meus dados de saúde
                  para fins de emergência médica, conforme a{" "}
                  <strong>Lei Geral de Proteção de Dados (LGPD)</strong>. Posso
                  excluir minha conta e dados a qualquer momento.
                </span>
              </label>
            </div>

            {erro && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {erro}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary w-full mt-2"
              disabled={loading}
            >
              {loading ? "Criando conta…" : "Criar conta"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Já tem conta?{" "}
          <Link href="/auth/login" className="text-blue-600 font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
