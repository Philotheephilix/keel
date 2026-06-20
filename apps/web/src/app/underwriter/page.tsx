"use client";

import { useState } from "react";
import { ConnectButton, useSignAndExecuteTransaction } from "@/lib/testwallet";
import { useQueryClient } from "@tanstack/react-query";
import { api, KeelApiError } from "@/lib/fetcher";
import { useAddress, useVault, useLpPosition } from "@/hooks/useKeel";
import type { LpSupplyResp, LpWithdrawResp } from "@/hooks/types";
import { Card, Stat, Button, Field, inputStyle, Spinner, ErrorBox, ConnectPrompt } from "@/components/ui";
import { fmtUsd } from "@/components/format";

function errMsg(e: unknown) {
  return e instanceof KeelApiError ? e.message : (e as Error)?.message ?? "Something went wrong";
}

export default function UnderwriterPage() {
  const address = useAddress();
  const vault = useVault();
  const position = useLpPosition();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const qc = useQueryClient();

  const [supplyAmt, setSupplyAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [busy, setBusy] = useState<"supply" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["lp-position", address] }),
      qc.invalidateQueries({ queryKey: ["vault"] }),
    ]);
  }

  async function doSupply() {
    if (!address) return;
    const amount = Number(supplyAmt);
    if (!amount || amount <= 0) return setError("Enter a valid amount.");
    setBusy("supply");
    setError(null);
    setNotice(null);
    try {
      const built = await api.post<LpSupplyResp>("/lp/supply", { userAddress: address, amount });
      const res = await signAndExecute({ transaction: built.unsignedTxBytes });
      await api.post("/lp/record", { userAddress: address, type: "supply", amountUi: amount, txDigest: res.digest });
      setNotice(`Supplied ${fmtUsd(amount)}.`);
      setSupplyAmt("");
      await refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function doWithdraw() {
    if (!address) return;
    const plpAmount = Number(withdrawAmt);
    if (!plpAmount || plpAmount <= 0) return setError("Enter a valid amount.");
    setBusy("withdraw");
    setError(null);
    setNotice(null);
    try {
      const resp = await api.post<LpWithdrawResp>("/lp/withdraw", { userAddress: address, plpAmount });
      if ("blocked" in resp && resp.blocked) {
        setError(
          `Withdrawal currently limited. Max withdrawable now: ${resp.maxWithdrawableNow.toLocaleString()} PLP.`,
        );
        return;
      }
      const res = await signAndExecute({ transaction: resp.unsignedTxBytes });
      await api.post("/lp/record", {
        userAddress: address,
        type: "withdraw",
        amountUi: plpAmount,
        txDigest: res.digest,
      });
      setNotice(`Withdrawal of ${plpAmount.toLocaleString()} PLP submitted.`);
      setWithdrawAmt("");
      await refresh();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  if (!address) {
    return (
      <div>
        <h1 style={{ fontSize: 28 }}>Underwrite</h1>
        <ConnectPrompt>
          <div style={{ marginBottom: 16 }}>Connect your wallet to supply liquidity.</div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <ConnectButton />
          </div>
        </ConnectPrompt>
      </div>
    );
  }

  const pos = position.data;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 760 }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Underwrite</h1>
      <p style={{ color: "var(--muted)", margin: 0 }}>
        Supply dUSDC to the Keel vault to back cover policies and earn premiums.
      </p>

      <Card title="Your position">
        {position.isLoading ? (
          <Spinner />
        ) : position.isError ? (
          <ErrorBox message={errMsg(position.error)} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
            <Stat label="PLP balance" value={pos?.plpUiBalance.toLocaleString(undefined, { maximumFractionDigits: 4 }) ?? "0"} />
            <Stat label="Current value" value={fmtUsd(pos?.currentValueUsd ?? 0)} />
            <Stat
              label="Unrealized PnL"
              value={
                <span style={{ color: (pos?.unrealizedPnl ?? 0) >= 0 ? "var(--accent)" : "#f87171" }}>
                  {(pos?.unrealizedPnl ?? 0) >= 0 ? "+" : ""}
                  {fmtUsd(pos?.unrealizedPnl ?? 0)}
                </span>
              }
            />
            <Stat label="Share price" value={`$${(pos?.sharePrice ?? 1).toFixed(4)}`} />
          </div>
        )}
      </Card>

      <Card title="Vault">
        {vault.isLoading ? (
          <Spinner />
        ) : vault.isError ? (
          <ErrorBox message={errMsg(vault.error)} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
            <Stat label="Vault value" value={fmtUsd(vault.data!.vaultValue, 0)} />
            <Stat label="Share price" value={`$${vault.data!.plpSharePrice.toFixed(4)}`} />
            <Stat label="Utilization" value={`${vault.data!.utilizationPct.toFixed(2)}%`} />
            <Stat
              label="Withdrawal headroom"
              value={
                vault.data!.availableWithdrawal === null
                  ? "Unlimited"
                  : fmtUsd(vault.data!.availableWithdrawal, 0)
              }
              sub={vault.data!.limiterEnabled ? "limiter active" : "limiter off"}
            />
          </div>
        )}
      </Card>

      {error && <ErrorBox message={error} />}
      {notice && (
        <div
          style={{
            background: "rgba(74,222,128,.1)",
            border: "1px solid rgba(74,222,128,.4)",
            color: "var(--accent)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 13,
          }}
        >
          {notice}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card title="Supply">
          <Field label="Amount (dUSDC)">
            <input
              style={inputStyle}
              type="number"
              min={0}
              value={supplyAmt}
              onChange={(e) => setSupplyAmt(e.target.value)}
              placeholder="1000"
            />
          </Field>
          <Button onClick={doSupply} disabled={busy === "supply"}>
            {busy === "supply" ? "Supplying…" : "Supply"}
          </Button>
        </Card>

        <Card title="Withdraw">
          <Field label="PLP amount">
            <input
              style={inputStyle}
              type="number"
              min={0}
              value={withdrawAmt}
              onChange={(e) => setWithdrawAmt(e.target.value)}
              placeholder="500"
            />
          </Field>
          <Button variant="secondary" onClick={doWithdraw} disabled={busy === "withdraw"}>
            {busy === "withdraw" ? "Withdrawing…" : "Withdraw"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
