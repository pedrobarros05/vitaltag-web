"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { login, ApiError } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [form, setForm] = useState({ email: "", senha: "" });
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (params.get("cadastrado")) setSucesso("Conta criada com sucesso! Faça login.");
  }, [params]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErro("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { token } = await login(form);
      localStorage.setItem("vitaltag_token", token);
      router.push("/dashboard");
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Erro ao fazer login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {sucesso && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          {sucesso}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
            value={form.senha}
            onChange={(e) => set("senha", e.target.value)}
            placeholder="Sua senha"
          />
        </div>

        {erro && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {erro}
          </p>
        )}

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={loading}
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white text-2xl font-bold mb-4 shadow-lg">
            ❤️
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Entrar</h1>
          <p className="text-sm text-slate-500 mt-1">VitalTag</p>
        </div>

        <div className="card">
          <Suspense fallback={<div className="text-slate-400 text-sm">Carregando…</div>}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Não tem conta?{" "}
          <Link href="/auth/registro" className="text-blue-600 font-medium hover:underline">
            Criar conta grátis
          </Link>
        </p>
      </div>
    </main>
  );
}
