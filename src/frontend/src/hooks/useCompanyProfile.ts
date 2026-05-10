import { useEffect, useState } from "react";
import type { CompanyProfile } from "../backend.d";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";

export function useCompanyProfile(): {
  companyProfile: CompanyProfile | null;
  loading: boolean;
} {
  const { session } = useAuthStore();
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.token) {
      setLoading(false);
      return;
    }
    api
      .getCompanyProfile(session.token)
      .then((profile) => {
        setCompanyProfile(profile ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session?.token]);

  return { companyProfile, loading };
}
