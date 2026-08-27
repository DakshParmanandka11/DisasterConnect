import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function ModeratorWallet() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutUpi, setPayoutUpi] = useState("");
  const [payoutMsg, setPayoutMsg] = useState(null);
  const [payoutErr, setPayoutErr] = useState(null);
  const [payoutBusy, setPayoutBusy] = useState(false);

  const isModerator = user && ["student_moderator", "senior_moderator", "admin"].includes(user.role);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (!isModerator) { navigate("/moderator"); return; }
    api.getModeratorWallet()
      .then((data) => {
        setWallet(data.wallet);
        setTransactions(data.transactions || []);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [user]);

  async function handlePayout(e) {
    e.preventDefault();
    setPayoutMsg(null); setPayoutErr(null);
    const amt = parseFloat(payoutAmount);
    if (isNaN(amt) || amt <= 0) { setPayoutErr("Enter a valid amount."); return; }
    if (!payoutUpi) { setPayoutErr("Enter your UPI ID."); return; }
    setPayoutBusy(true);
    try {
      const data = await api.requestPayout(amt, payoutUpi);
      setPayoutMsg(data.message);
      setPayoutAmount("");
      // Refresh wallet
      const refreshed = await api.getModeratorWallet();
      setWallet(refreshed.wallet);
      setTransactions(refreshed.transactions || []);
    } catch (err) {
      setPayoutErr(err.message);
    } finally {
      setPayoutBusy(false);
    }
  }

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}><div className="spinner" /></div>;
  }

  const typeColors = { credit: "#10b981", payout: "#ef4444", penalty: "#f59e0b" };
  const typeLabels = { credit: "Credit", payout: "Payout", penalty: "Penalty" };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px 64px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px 0" }}>Student Moderator Program</p>
          <h1 style={{ margin: 0 }}>Moderator Wallet</h1>
        </div>
        <Link to="/moderator" className="btn btn-outline btn-sm">← Dashboard</Link>
      </div>

      {/* Wallet summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total Earned", value: `₹${(wallet?.total_earned || 0).toFixed(2)}`, color: "#10b981", sub: "All time" },
          { label: "Available Balance", value: `₹${(wallet?.available || 0).toFixed(2)}`, color: "#14b8a6", sub: "Ready to withdraw" },
          { label: "Pending", value: `₹${(wallet?.pending || 0).toFixed(2)}`, color: "#f59e0b", sub: "Under audit" },
          { label: "Reviews Completed", value: wallet?.reviews_completed || 0, color: "var(--text-primary)", sub: `₹${wallet?.rate_per_review || 5}/review` },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "18px 20px" }}>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontWeight: 800, fontSize: "1.5rem", color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Payout box */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px 24px", marginBottom: 24 }}>
        <h2 style={{ marginTop: 0, fontSize: "1rem", marginBottom: 4 }}>Request UPI Payout</h2>
        <p style={{ margin: "0 0 16px 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
          Transfer your earnings to any UPI ID (GPay, PhonePe, Paytm, BHIM).
          <span style={{ display: "inline-block", background: "var(--amber-bg)", color: "var(--amber)", borderRadius: "var(--radius-xs)", padding: "1px 8px", fontSize: "0.75rem", fontWeight: 600, marginLeft: 8 }}>
            SIMULATED — Prototype Demo
          </span>
        </p>

        {payoutMsg && (
          <div style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981", padding: "10px 14px", borderRadius: "var(--radius-sm)", marginBottom: 16, fontSize: "0.88rem" }}>
            {payoutMsg}
          </div>
        )}
        {payoutErr && <div className="error-banner">{payoutErr}</div>}

        <form onSubmit={handlePayout} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ marginBottom: 0, flex: "0 0 140px" }}>
            <label>Amount (₹)</label>
            <input type="number" min={1} max={wallet?.available || 0} placeholder="e.g. 100" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 200px" }}>
            <label>UPI ID</label>
            <input type="text" placeholder="yourname@upi" value={payoutUpi} onChange={(e) => setPayoutUpi(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={payoutBusy || !wallet?.available}>
            {payoutBusy ? "Processing…" : "Withdraw"}
          </button>
        </form>
      </div>

      {/* Transaction history */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px 24px" }}>
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Transaction History</h2>
        {transactions.length === 0 ? (
          <p style={{ color: "var(--text-muted)", margin: 0 }}>No transactions yet. Start reviewing reports to earn.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Date</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Description</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Type</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Amount</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)", fontWeight: 600, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const color = typeColors[t.type] || "var(--text-primary)";
                  const isDebit = t.type === "payout" || t.type === "penalty";
                  return (
                    <tr key={t.id} style={{ borderBottom: "1px solid var(--border-muted)" }}>
                      <td style={{ padding: "10px 12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "10px 12px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.type === "payout" ? `Payout to ${t.payout_upi}` : t.report_title || "Transaction"}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ background: `${color}20`, color, padding: "2px 8px", borderRadius: "var(--radius-xs)", fontSize: "0.75rem", fontWeight: 600 }}>
                          {typeLabels[t.type] || t.type}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color, whiteSpace: "nowrap" }}>
                        {isDebit ? "−" : "+"}₹{t.amount.toFixed(2)}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.82rem", textTransform: "capitalize" }}>{t.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
