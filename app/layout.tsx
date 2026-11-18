import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VitalTag — Emergency Data",
  description:
    "Register your clinical information and generate a QR Code for emergencies.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
