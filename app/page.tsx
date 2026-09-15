import { redirect } from "next/navigation";

// Raiz → redireciona para login
export default function Home() {
  redirect("/auth/login");
}
