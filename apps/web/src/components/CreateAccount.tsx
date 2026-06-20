"use client";

import { useState } from "react";
import { useSignAndExecuteTransaction } from "@/lib/wallet";
import { useQueryClient } from "@tanstack/react-query";
import { api, KeelApiError } from "@/lib/fetcher";
import type { ManagerResp } from "@/hooks/types";
import { Button, ErrorBox } from "./ui";

/** One-time "Create your Keel account" flow: signs creationTxBytes then caches the manager id. */
export function CreateAccount({
  address,
  creationTxBytes,
  onCreated,
}: {
  address: string;
  creationTxBytes: string;
  onCreated?: (managerId: string | null) => void;
}) {
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await signAndExecute({ transaction: creationTxBytes });
      // Re-POST /manager: the indexer will now find the freshly created manager.
      const resp = await api.post<ManagerResp>("/manager", { userAddress: address });
      await qc.invalidateQueries({ queryKey: ["manager", address] });
      onCreated?.(resp.managerId);
    } catch (e) {
      setError(e instanceof KeelApiError ? e.message : (e as Error).message ?? "Failed to create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 14, color: "var(--muted)" }}>
        You need a one-time Keel account object before buying cover.
      </div>
      <div>
        <Button onClick={create} disabled={busy}>
          {busy ? "Creating…" : "Create your Keel account"}
        </Button>
      </div>
      {error && <ErrorBox message={error} />}
    </div>
  );
}
