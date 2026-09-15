"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { buscarPerfil, gerarQRCode, ApiError } from "@/lib/api";
import type { PerfilCompleto } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrLoading, setQrLoading] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    try {
      const p = await buscarPerfil();
      setPerfil(p);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/auth/login");
      } else if (err instanceof ApiError && err.status === 404) {
        // Sem perfil cadastrado ainda — tudo ok
        setPerfil(null);
      } else {
        setErro("Erro ao carregar perfil.");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function baixarQR() {
    setQrLoading(true);
    try {
      const blob = await gerarQRCode();
      const url = URL.createObjectURL(blob);
      setQrUrl(url);
    } catch {
      setErro("Erro ao gerar QR Code.");
    } finally {
      setQrLoading(false);
    }
  }

  function sair() {
    localStorage.removeItem("vitaltag_token");
    router.push("/auth/login");
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
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">❤️</span>
            <span className="font-bold text-slate-800 text-lg">VitalTag</span>
          </div>
          <button onClick={sair} className="btn-secondary text-sm">
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {erro && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        {/* Boas-vindas */}
        <div className="card">
          <h2 className="text-xl font-bold text-slate-800 mb-1">
            {perfil
              ? `Olá, ${perfil.nome}! 👋`
              : "Bem-vindo ao VitalTag! 👋"}
          </h2>
          <p className="text-sm text-slate-500">
            {perfil
              ? "Seu perfil de emergência está configurado."
              : "Configure seu perfil clínico para receber um QR Code de emergência."}
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/perfil" className="btn-primary">
              {perfil ? "Editar perfil" : "Configurar perfil"}
            </Link>
            {perfil && (
              <button
                onClick={baixarQR}
                className="btn-secondary"
                disabled={qrLoading}
              >
                {qrLoading ? "Gerando…" : "Gerar QR Code"}
              </button>
            )}
          </div>
        </div>

        {/* QR Code */}
        {qrUrl && (
          <div className="card text-center">
            <h3 className="text-base font-semibold text-slate-700 mb-4">
              Seu QR Code de Emergência
            </h3>
            <img
              src={qrUrl}
              alt="QR Code de emergência"
              className="mx-auto w-48 h-48 rounded-lg border border-slate-200"
            />
            <p className="text-xs text-slate-500 mt-3 max-w-xs mx-auto">
              Imprima e carregue com você. Em uma emergência, qualquer pessoa
              pode escanear e acessar seus dados clínicos.
            </p>
            <a
              href={qrUrl}
              download="vitaltag-qrcode.png"
              className="btn-primary mt-4 inline-flex"
            >
              Baixar PNG
            </a>
          </div>
        )}

        {/* Resumo do perfil */}
        {perfil && (
          <div className="card">
            <h3 className="text-base font-semibold text-slate-700 mb-4">
              Resumo do perfil
            </h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <InfoRow label="Nome" value={`${perfil.nome} ${perfil.sobrenome}`} />
              <InfoRow label="Nascimento" value={perfil.data_nascimento || "—"} />
              <InfoRow label="Tipo sanguíneo" value={perfil.tipo_sanguineo || "—"} />
              <InfoRow
                label="Alergias"
                value={
                  perfil.alergias?.length
                    ? `${perfil.alergias.length} registrada(s)`
                    : "Nenhuma"
                }
              />
              <InfoRow
                label="Medicamentos"
                value={
                  perfil.medicamentos?.length
                    ? `${perfil.medicamentos.length} registrado(s)`
                    : "Nenhum"
                }
              />
              <InfoRow
                label="Contatos"
                value={
                  perfil.contatos_emergencia?.length
                    ? `${perfil.contatos_emergencia.length} registrado(s)`
                    : "Nenhum"
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
