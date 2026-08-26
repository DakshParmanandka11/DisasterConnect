import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import "./ModeratorDashboard.css";

export default function ModeratorDashboard() {
  const { user } = useAuth();
  const token = localStorage.getItem("dc_token");

  const [activeTab, setActiveTab] = useState("queue");
  const [queue, setQueue] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(true);

  const [stats, setStats] = useState({
    totalReviews: 0,
    totalEarned: 0,
    totalPaid: 0,
    walletBalance: 0,
    rewardPerPost: 5.0,
    actionBreakdown: {},
  });
  const [recentReviews, setRecentReviews] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);

  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutUpi, setPayoutUpi] = useState("student.mod@upi");
  const [payoutMsg, setPayoutMsg] = useState(null);
  const [payoutError, setPayoutError] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  useEffect(() => {
    fetchQueue();
    fetchStats();
    fetchLeaderboard();
  }, [token]);

  const fetchQueue = async () => {
    if (!token) return;
    setLoadingQueue(true);
    try {
      const res = await fetch("/api/moderator/queue?status=pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setQueue(data.queue || []);
      }
    } catch (e) {
      console.error("Failed to load queue", e);
    } finally {
      setLoadingQueue(false);
    }
  };

  const fetchStats = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/moderator/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
        setRecentReviews(data.recentReviews || []);
        setPayouts(data.payouts || []);
      }
    } catch (e) {
      console.error("Failed to load stats", e);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch("/api/moderator/leaderboard");
      const data = await res.json();
      if (res.ok) setLeaderboard(data.leaderboard || []);
    } catch (e) {
      console.error("Failed to load leaderboard", e);
    }
  };

  const handleReview = async (reportId, action) => {
    try {
      const res = await fetch(`/api/moderator/review/${reportId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();

      if (res.ok) {
        setFeedbackMsg(data.message);
        setTimeout(() => setFeedbackMsg(null), 3000);
        setQueue((prev) => prev.filter((item) => item.id !== reportId));
        fetchStats();
      } else {
        alert(data.error || "Review submission failed");
      }
    } catch (e) {
      alert("Network error submitting review");
    }
  };

  const handlePayoutSubmit = async (e) => {
    e.preventDefault();
    setPayoutMsg(null);
    setPayoutError(null);

    const amt = parseFloat(payoutAmount);
    if (isNaN(amt) || amt <= 0) {
      setPayoutError("Please enter a valid payout amount.");
      return;
    }

    try {
      const res = await fetch("/api/moderator/payout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: amt, upi_id: payoutUpi }),
      });
      const data = await res.json();

      if (res.ok) {
        setPayoutMsg(data.message);
        setPayoutAmount("");
        fetchStats();
      } else {
        setPayoutError(data.error || "Payout request failed");
      }
    } catch (e) {
      setPayoutError("Network error submitting payout request");
    }
  };

  return (
    <div className="mod-dashboard">
      <div className="mod-header">
        <div className="mod-header-top">
          <div className="mod-title">
            <h1>Calamity Report Moderation Queue</h1>
            <div className="mod-subtitle">
              Verify submitted disaster incidents for genuine calamity relevance and ground truth.
            </div>
          </div>
          <div className="mod-badge-role">
            {user?.name || "Moderator"} ({user?.role || "moderator"})
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div
          style={{
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            color: "#10b981",
            padding: "10px 14px",
            borderRadius: "6px",
            marginBottom: "16px",
            fontSize: "0.9rem",
            fontWeight: "600",
          }}
        >
          {feedbackMsg}
        </div>
      )}

      <div className="mod-tabs">
        <button
          className={`mod-tab-btn ${activeTab === "queue" ? "active" : ""}`}
          onClick={() => setActiveTab("queue")}
        >
          Review Queue ({queue.length})
        </button>
        <button
          className={`mod-tab-btn ${activeTab === "wallet" ? "active" : ""}`}
          onClick={() => setActiveTab("wallet")}
        >
          Earnings & Wallet (₹{stats.walletBalance.toFixed(2)})
        </button>
        <button
          className={`mod-tab-btn ${activeTab === "hub" ? "active" : ""}`}
          onClick={() => setActiveTab("hub")}
        >
          Guidelines & Leaderboard
        </button>
      </div>

      {activeTab === "queue" && (
        <div className="queue-container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Pending Reports ({queue.length})</h2>
            <button className="btn btn-outline btn-sm" onClick={fetchQueue}>
              Refresh List
            </button>
          </div>

          {loadingQueue ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Loading queue...
            </div>
          ) : queue.length === 0 ? (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px border var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "36px 20px",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              <h3>No pending reports in queue</h3>
              <p style={{ margin: 0 }}>All submitted incident reports have been reviewed.</p>
            </div>
          ) : (
            <div className="queue-grid">
              {queue.map((item) => (
                <div key={item.id} className="queue-card">
                  <div>
                    <div className="queue-meta">
                      <span className="category-tag">{item.category}</span>
                      <span className={`severity-pill ${item.severity}`}>{item.severity.toUpperCase()}</span>
                      <span style={{ color: "var(--text-muted)" }}>
                        Submitted by: <strong>{item.author?.name || "Citizen"}</strong>
                      </span>
                    </div>
                    <h3 style={{ margin: "8px 0 4px 0", fontSize: "1.1rem" }}>{item.title}</h3>
                    <p style={{ color: "var(--text-body)", margin: 0, fontSize: "0.92rem", lineHeight: "1.5" }}>
                      {item.description || <em>No text details provided.</em>}
                    </p>
                  </div>

                  {item.media && item.media.length > 0 && (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {item.media.map((m) => (
                        <a key={m.id} href={m.file_path} target="_blank" rel="noreferrer">
                          <img
                            src={m.file_path}
                            alt="Incident file"
                            style={{
                              width: "100px",
                              height: "75px",
                              objectFit: "cover",
                              borderRadius: "4px",
                              border: "1px solid var(--border)",
                            }}
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="assessment-box">
                    <div className="assessment-title">Automated Content Assessment</div>
                    <div className="assessment-scores">
                      <span className={`score-pill ${item.analysis.relevanceScore >= 60 ? "good" : "warning"}`}>
                        Relevance Score: {item.analysis.relevanceScore}/100
                      </span>
                      <span className={`score-pill ${item.analysis.isGibberish ? "warning" : "good"}`}>
                        {item.analysis.isGibberish ? "High Spam Risk" : "Valid Text Structure"}
                      </span>
                    </div>

                    {item.analysis.detectedKeywords && item.analysis.detectedKeywords.length > 0 && (
                      <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        Detected Keywords: {item.analysis.detectedKeywords.join(", ")}
                      </div>
                    )}
                  </div>

                  <div className="mod-action-bar">
                    <button className="btn-approve" onClick={() => handleReview(item.id, "approve")}>
                      Approve (Relevant Calamity) (+₹5)
                    </button>
                    <button className="btn-reject-gibberish" onClick={() => handleReview(item.id, "reject_gibberish")}>
                      Reject (Spam / Gibberish) (+₹5)
                    </button>
                    <button className="btn-reject-irrelevant" onClick={() => handleReview(item.id, "reject_irrelevant")}>
                      Reject (Off-Topic Content) (+₹5)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "wallet" && (
        <div>
          <div className="stats-cards-grid">
            <div className="stat-card">
              <div className="stat-info">
                <h3>Wallet Balance</h3>
                <p className="stat-value">₹{stats.walletBalance.toFixed(2)}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-info">
                <h3>Total Reviewed</h3>
                <p className="stat-value">{stats.totalReviews}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-info">
                <h3>Total Earnings</h3>
                <p className="stat-value">₹{stats.totalEarned.toFixed(2)}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-info">
                <h3>Stipend Rate</h3>
                <p className="stat-value">₹{stats.rewardPerPost.toFixed(2)}/post</p>
              </div>
            </div>
          </div>

          <div className="payout-box">
            <div>
              <h3 style={{ margin: "0 0 4px 0" }}>Request UPI Payout</h3>
              <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.88rem" }}>
                Transfer earnings directly to your UPI ID (PayTM, GPay, PhonePe, BHIM).
              </p>
            </div>

            <form onSubmit={handlePayoutSubmit} style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input
                type="number"
                placeholder="Amount (₹)"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                className="payout-input"
                style={{ width: "120px" }}
              />
              <input
                type="text"
                placeholder="UPI ID (e.g. name@upi)"
                value={payoutUpi}
                onChange={(e) => setPayoutUpi(e.target.value)}
                className="payout-input"
                style={{ width: "180px" }}
              />
              <button type="submit" className="btn-withdraw">
                Submit Request
              </button>
            </form>
          </div>

          {payoutMsg && (
            <div style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981", padding: "10px", borderRadius: "6px", marginBottom: "16px" }}>
              {payoutMsg}
            </div>
          )}
          {payoutError && (
            <div style={{ background: "rgba(239, 68, 68, 0.12)", color: "#ef4444", padding: "10px", borderRadius: "6px", marginBottom: "16px" }}>
              {payoutError}
            </div>
          )}

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px" }}>
            <h3 style={{ marginTop: 0 }}>Review History</h3>
            {recentReviews.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No reviews completed yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Report</th>
                      <th>Category</th>
                      <th>Verdict</th>
                      <th>Stipend</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentReviews.map((r) => (
                      <tr key={r.id}>
                        <td>{r.title}</td>
                        <td><span className="category-tag">{r.category}</span></td>
                        <td style={{ textTransform: "capitalize", fontWeight: "600" }}>{r.action.replace("_", " ")}</td>
                        <td style={{ color: "#10b981", fontWeight: "700" }}>+₹{r.reward_amount.toFixed(2)}</td>
                        <td style={{ color: "var(--text-muted)" }}>{new Date(r.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "hub" && (
        <div>
          <div className="info-banner">
            <h2>Community Moderation Program</h2>
            <p style={{ color: "var(--text-body)", lineHeight: "1.6" }}>
              DisasterConnect connects citizens and emergency responders during floods, fires, and natural disasters. 
              Community moderators ensure data quality by checking report relevance, preventing duplicate spam, and maintaining ground truth.
            </p>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px" }}>
            <h3 style={{ marginTop: 0 }}>Top Reviewers Leaderboard</h3>
            {leaderboard.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No entries on leaderboard yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {leaderboard.map((item, idx) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>#{idx + 1}</span>
                      <span>{item.name}</span>
                    </div>
                    <div style={{ fontWeight: 600, color: "#10b981" }}>
                      ₹{item.total_earned.toFixed(2)} ({item.reviews_completed} reviews)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
