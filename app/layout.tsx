import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VitalTag — Dados de Emergência",
  description:
    "Registre suas informações clínicas e gere um QR Code para situações de emergência.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
