"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { token, cargando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (cargando) return;
    router.replace(token ? "/dashboard" : "/login");
  }, [cargando, token, router]);

  return null;
}
