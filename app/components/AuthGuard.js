"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      if (!supabase) {
        router.replace("/login");
        return;
      }

      try {
        const { data, error } = await supabase.auth.getUser();

        if (!active) return;

        if (error || !data?.user) {
          setAuthorized(false);
          router.replace("/login");
        } else {
          setAuthorized(true);
        }
      } catch {
        if (active) router.replace("/login");
      }
    }

    checkAccess();

    const { data: listener } = supabase
      ? supabase.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_OUT") {
            setAuthorized(false);
            router.replace("/login");
          }
        })
      : { data: null };

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, [router]);

  if (!authorized) {
    return (
      <main style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        Verificando acesso à JENIOS...
      </main>
    );
  }

  return children;
}
