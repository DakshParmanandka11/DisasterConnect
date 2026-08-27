import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const SCENARIOS_DISPLAY = [
  { label: "Genuine flood report with GPS", verdict: "APPROVE", color: "#10b981" },
  { label: "\"OMG OMG HELP!!!!!!!\"", verdict: "REJECT", color: "#ef4444" },
  { label: "\"Check out my new shoes\"", verdict: "REJECT", color: "#ef4444" },
  { label: "Image from different location/date", verdict: "ESCALATE", color: "#f59e0b" },
  { label: "High AI score but no GPS or media", verdict: "ESCALATE", color: "#f59e0b" },
  { label: "Near-duplicate of approved report", verdict: "REJECT", color: "#ef4444" },
];

export default function ModeratorTraining() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState("intro"); // intro | quiz | result
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [trainingStatus, setTrainingStatus] = useState(null);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    api.getTrainingStatus()
      .then((data) => {
        setQuestions(data.questions || []);
        setTrainingStatus(data);
        if (data.passed && data.training_completed) {
          // already completed, redirect
          navigate("/moderator");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  function startQuiz() {
    setAnswers(new Array(questions.length).fill(null));
    setCurrentQ(0);
    setPhase("quiz");
    setResult(null);
  }

  function selectAnswer(idx) {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentQ] = idx;
      return next;
    });
  }

  async function submitQuiz() {
    if (answers.some((a) => a === null)) {
      setError("Please answer all questions before submitting.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.submitTraining(answers);
      setResult(data);
      setPhase("result");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  const q = questions[currentQ];
  const allAnswered = answers.length > 0 && answers.every((a) => a !== null);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 64px" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px 0" }}>
          Student Moderator Program
        </p>
        <h1 style={{ margin: "0 0 6px 0" }}>Moderator Training Centre</h1>
        <p style={{ color: "var(--text-muted)", margin: 0, fontSize: "0.9rem" }}>
          Complete this training to unlock access to the moderation queue. A minimum score of <strong style={{ color: "var(--text-primary)" }}>80%</strong> is required to pass.
        </p>
        {trainingStatus?.attempts > 0 && (
          <div style={{ marginTop: 10, fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Previous attempts: <strong>{trainingStatus.attempts}</strong>
            {trainingStatus.best_score !== null && (
              <> · Best score: <strong style={{ color: trainingStatus.passed ? "#10b981" : "var(--amber)" }}>{trainingStatus.best_score}%</strong></>
            )}
          </div>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* INTRO PHASE */}
      {phase === "intro" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* What makes a legitimate report */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px 24px" }}>
            <h2 style={{ marginTop: 0, fontSize: "1rem" }}>What Constitutes a Legitimate Disaster Report?</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                ["✓ Specific location", "GPS coordinates, address, or landmark"],
                ["✓ Clear incident description", "What happened, who is affected, urgency"],
                ["✓ Media evidence", "Photos or videos from the scene (not required, but increases credibility)"],
                ["✓ Calamity-relevant keywords", "Flood, fire, collapse, trapped, rescue, etc."],
                ["✓ Plausible time and context", "Recent event, not obviously recycled content"],
                ["✓ Consistent information", "Details are not internally contradictory"],
              ].map(([title, desc]) => (
                <div key={title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ color: "#10b981", fontWeight: 700, marginTop: 1, flexShrink: 0 }}>✓</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{title.replace("✓ ", "")}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* What to reject */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px 24px" }}>
            <h2 style={{ marginTop: 0, fontSize: "1rem" }}>What to Reject</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Spam", "Repetitive, promotional, or clearly automated content"],
                ["Gibberish", "Random keyboard typing, excessive punctuation with no coherent text"],
                ["Irrelevant", "Consumer topics, personal posts, social commentary unrelated to disasters"],
                ["Duplicates", "Reports clearly describing the same incident already in the system"],
                ["Abusive content", "Hate speech, threats, or harassment targeting individuals or groups"],
              ].map(([type, desc]) => (
                <div key={type} style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 12px", background: "var(--red-bg)", borderRadius: "var(--radius-sm)" }}>
                  <span style={{ color: "var(--red)", fontWeight: 700, fontSize: "0.85rem", minWidth: 80 }}>{type}</span>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-body)" }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* When to escalate */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px 24px" }}>
            <h2 style={{ marginTop: 0, fontSize: "1rem" }}>When to Escalate</h2>
            <div style={{ background: "rgba(245,158,11,0.10)", borderRadius: "var(--radius-sm)", padding: "12px 16px", marginBottom: 12, fontSize: "0.88rem", color: "var(--text-body)", lineHeight: 1.7 }}>
              Escalate when you are uncertain and the report could be a <strong>high-impact incident</strong>. It is better to escalate a potentially serious situation than to incorrectly reject it.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {["Conflicting evidence", "Missing media for critical incident", "Possibly misleading information", "Location doesn't match description", "Extremely high-impact claim with no verification"].map((item) => (
                <span key={item} style={{ background: "var(--amber-bg)", color: "var(--amber)", borderRadius: "var(--radius-xs)", padding: "3px 10px", fontSize: "0.82rem", fontWeight: 600 }}>
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Scenario previews */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px 24px" }}>
            <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Example Scenarios</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SCENARIOS_DISPLAY.map((s) => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-card-alt)", borderRadius: "var(--radius-sm)" }}>
                  <span style={{ fontSize: "0.88rem", color: "var(--text-body)" }}>{s.label}</span>
                  <span style={{ fontWeight: 700, fontSize: "0.82rem", color: s.color, minWidth: 70, textAlign: "right" }}>→ {s.verdict}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Golden rule */}
          <div style={{ background: "var(--primary-bg)", border: "1px solid var(--primary-border)", borderRadius: "var(--radius-md)", padding: "16px 20px" }}>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--primary)", fontSize: "0.92rem", lineHeight: 1.6 }}>
              Golden Rule: AI provides guidance. You make the final decision. Never blindly follow AI recommendations — use your judgment and the evidence in front of you.
            </p>
          </div>

          <button className="btn btn-primary" onClick={startQuiz} style={{ padding: "12px", fontSize: "1rem" }}>
            Start Training Quiz ({questions.length} questions)
          </button>
        </div>
      )}

      {/* QUIZ PHASE */}
      {phase === "quiz" && q && (
        <div>
          {/* Progress */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Question {currentQ + 1} of {questions.length}
            </span>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {answers.filter((a) => a !== null).length} answered
            </span>
          </div>
          <div style={{ background: "var(--border)", borderRadius: "var(--radius-full)", height: 4, marginBottom: 24 }}>
            <div
              style={{
                background: "var(--primary)",
                height: "100%",
                borderRadius: "var(--radius-full)",
                width: `${((currentQ + 1) / questions.length) * 100}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "24px 28px", marginBottom: 20 }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
              Scenario
            </div>
            <div style={{ background: "var(--bg-card-alt)", borderRadius: "var(--radius-sm)", padding: "14px 18px", fontSize: "0.95rem", color: "var(--text-primary)", lineHeight: 1.7, fontStyle: "italic", marginBottom: 20 }}>
              {q.scenario}
            </div>

            <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              What should you do?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {q.options.map((opt, i) => {
                const selected = answers[currentQ] === i;
                return (
                  <button
                    key={i}
                    onClick={() => selectAnswer(i)}
                    style={{
                      textAlign: "left",
                      padding: "12px 16px",
                      borderRadius: "var(--radius-sm)",
                      border: selected ? "2px solid var(--primary)" : "1px solid var(--border)",
                      background: selected ? "var(--primary-bg)" : "var(--bg-card-alt)",
                      color: selected ? "var(--primary)" : "var(--text-body)",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                      lineHeight: 1.5,
                      transition: "all 0.12s ease",
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
                    <span style={{ fontWeight: 700, marginRight: 8, opacity: 0.6 }}>{String.fromCharCode(65 + i)}.</span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
            <button
              className="btn btn-outline"
              disabled={currentQ === 0}
              onClick={() => setCurrentQ((p) => Math.max(0, p - 1))}
            >
              ← Previous
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              {currentQ < questions.length - 1 ? (
                <button
                  className="btn btn-primary"
                  onClick={() => setCurrentQ((p) => p + 1)}
                >
                  Next →
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  disabled={!allAnswered || submitting}
                  onClick={submitQuiz}
                >
                  {submitting ? "Submitting…" : "Submit Quiz"}
                </button>
              )}
            </div>
          </div>

          {/* Question navigator */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 20 }}>
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentQ(i)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "1px solid var(--border)",
                  background: i === currentQ ? "var(--primary)" : answers[i] !== null ? "var(--primary-bg)" : "var(--bg-card-alt)",
                  color: i === currentQ ? "#fff" : answers[i] !== null ? "var(--primary)" : "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RESULT PHASE */}
      {phase === "result" && result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Score banner */}
          <div style={{
            background: result.passed ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.10)",
            border: `1px solid ${result.passed ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.25)"}`,
            borderRadius: "var(--radius-md)",
            padding: "24px 28px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "3rem", fontWeight: 800, color: result.passed ? "#10b981" : "#ef4444", lineHeight: 1 }}>
              {result.score}%
            </div>
            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: result.passed ? "#10b981" : "#ef4444", margin: "8px 0 4px" }}>
              {result.passed ? "Training Passed!" : "Training Not Passed"}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
              {result.correct} / {result.total} correct · {result.passed ? "You may now access the moderation queue." : "Minimum 80% required. Please review and try again."}
            </div>
          </div>

          {/* Per-question breakdown */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px 24px" }}>
            <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Question Results</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {(result.results || []).map((r, i) => (
                <div key={i} style={{
                  background: r.is_correct ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
                  border: `1px solid ${r.is_correct ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding: "14px 16px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>Q{i + 1}</span>
                    <span style={{ fontWeight: 700, fontSize: "0.82rem", color: r.is_correct ? "#10b981" : "#ef4444" }}>
                      {r.is_correct ? "✓ Correct" : "✗ Incorrect"}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontStyle: "italic", marginBottom: 8, lineHeight: 1.5 }}>
                    {r.scenario}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-body)", lineHeight: 1.6 }}>
                    <strong>Explanation:</strong> {r.explanation}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {result.passed ? (
            <Link to="/moderator" className="btn btn-primary" style={{ textAlign: "center", padding: "12px" }}>
              Go to Moderation Queue →
            </Link>
          ) : (
            <button className="btn btn-outline" onClick={() => { setPhase("intro"); setResult(null); }}>
              Review Guidelines & Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
