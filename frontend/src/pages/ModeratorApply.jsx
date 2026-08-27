import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

const STATUS_INFO = {
  pending: {
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    label: "Application Pending",
    desc: "Your application has been submitted and is awaiting admin review. This typically takes 2–3 business days.",
  },
  under_review: {
    color: "#14b8a6",
    bg: "rgba(20,184,166,0.10)",
    label: "Under Review",
    desc: "Our team is reviewing your application. You will be notified of the outcome soon.",
  },
  training_required: {
    color: "#6366f1",
    bg: "rgba(99,102,241,0.10)",
    label: "Training Required",
    desc: "Your application has been conditionally approved. Please complete the mandatory training module before accessing the moderation queue.",
  },
  approved: {
    color: "#10b981",
    bg: "rgba(16,185,129,0.10)",
    label: "Application Approved",
    desc: "Your application has been approved. Please complete training to start moderating.",
  },
  rejected: {
    color: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    label: "Application Rejected",
    desc: "Your application was not approved at this time. You may re-apply after 90 days.",
  },
  suspended: {
    color: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    label: "Account Suspended",
    desc: "Your moderator access has been suspended. Please contact support.",
  },
};

export default function ModeratorApply() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [form, setForm] = useState({
    full_name: user?.name || "",
    college: "",
    student_id: "",
    course: "",
    academic_year: "",
    college_email: "",
    phone: "",
    city: "",
    preferred_hours: "",
    reason: "",
  });

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    // Already a moderator
    if (["student_moderator", "senior_moderator", "admin"].includes(user.role)) {
      navigate("/moderator");
      return;
    }
    api.getApplicationStatus()
      .then((data) => {
        setApplication(data.application);
        setProfile(data.profile);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await api.applyModerator(form);
      setApplication(data.application);
      setSuccess(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", color: "var(--text-muted)" }}>
        <div className="spinner" />
      </div>
    );
  }

  // Show existing application status
  if (application) {
    const info = STATUS_INFO[application.status] || STATUS_INFO.pending;
    const approved = application.status === "approved";

    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 520 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px 0" }}>
            Student Moderator Program
          </p>
          <h1 style={{ margin: "0 0 20px 0" }}>Application Status</h1>

          <div style={{ background: info.bg, border: `1px solid ${info.color}30`, borderRadius: "var(--radius-md)", padding: "16px 20px", marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: info.color, marginBottom: 6 }}>
              {info.label}
            </div>
            <p style={{ margin: 0, color: "var(--text-body)", fontSize: "0.88rem", lineHeight: 1.6 }}>
              {info.desc}
            </p>
          </div>

          <div style={{ background: "var(--bg-card-alt)", borderRadius: "var(--radius-sm)", padding: "14px 16px", marginBottom: 20, fontSize: "0.88rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
              <div><span style={{ color: "var(--text-muted)" }}>Name</span><br /><strong>{application.full_name}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>College</span><br /><strong>{application.college}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Course</span><br /><strong>{application.course}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Year</span><br /><strong>{application.academic_year}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>City</span><br /><strong>{application.city}</strong></div>
              <div><span style={{ color: "var(--text-muted)" }}>Applied</span><br /><strong>{new Date(application.created_at).toLocaleDateString()}</strong></div>
            </div>
          </div>

          {approved && !profile?.training_completed && (
            <Link to="/moderator/training" className="btn btn-primary" style={{ display: "block", textAlign: "center", marginBottom: 12 }}>
              Start Mandatory Training →
            </Link>
          )}
          {approved && profile?.training_completed && (
            <Link to="/moderator" className="btn btn-primary" style={{ display: "block", textAlign: "center", marginBottom: 12 }}>
              Go to Moderation Queue →
            </Link>
          )}
          <Link to="/" style={{ display: "block", textAlign: "center", color: "var(--text-muted)", fontSize: "0.88rem" }}>
            Return to Feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page" style={{ alignItems: "flex-start", paddingTop: 32 }}>
      <div className="auth-card" style={{ maxWidth: 580 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px 0" }}>
          DisasterConnect
        </p>
        <h1 style={{ margin: "0 0 4px 0" }}>Become a Student Moderator</h1>
        <p className="auth-card__sub" style={{ marginBottom: 20 }}>
          Help verify disaster reports, improve information quality, and earn micro-payments for legitimate moderation work.
        </p>

        {/* Value prop */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
          {[
            ["₹5 per review", "Earn for each verified decision"],
            ["Flexible hours", "Work on your own schedule"],
            ["Real impact", "Help NGOs respond to genuine crises"],
            ["Build skills", "Develop analytical and civic-tech expertise"],
          ].map(([title, desc]) => (
            <div key={title} style={{ background: "var(--bg-card-alt)", borderRadius: "var(--radius-sm)", padding: "10px 12px", border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--primary)", marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{desc}</div>
            </div>
          ))}
        </div>

        {success && (
          <div style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)", color: "#10b981", padding: "12px 16px", borderRadius: "var(--radius-sm)", marginBottom: 20, fontSize: "0.9rem" }}>
            {success}
          </div>
        )}
        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <div className="field">
              <label htmlFor="apply-name">Full Name *</label>
              <input id="apply-name" name="full_name" required value={form.full_name} onChange={handleChange} placeholder="Your full name" />
            </div>
            <div className="field">
              <label htmlFor="apply-college">College / University *</label>
              <input id="apply-college" name="college" required value={form.college} onChange={handleChange} placeholder="e.g. Delhi Technological University" />
            </div>
            <div className="field">
              <label htmlFor="apply-sid">Student ID *</label>
              <input id="apply-sid" name="student_id" required value={form.student_id} onChange={handleChange} placeholder="e.g. DTU/2022/0341" />
            </div>
            <div className="field">
              <label htmlFor="apply-course">Course *</label>
              <input id="apply-course" name="course" required value={form.course} onChange={handleChange} placeholder="e.g. B.Tech Computer Science" />
            </div>
            <div className="field">
              <label htmlFor="apply-year">Academic Year *</label>
              <select id="apply-year" name="academic_year" required value={form.academic_year} onChange={handleChange}>
                <option value="">Select year</option>
                <option>1st Year</option>
                <option>2nd Year</option>
                <option>3rd Year</option>
                <option>4th Year</option>
                <option>1st Year M.Sc / M.Tech</option>
                <option>2nd Year M.Sc / M.Tech</option>
                <option>Ph.D</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="apply-cemail">College Email *</label>
              <input id="apply-cemail" name="college_email" type="email" required value={form.college_email} onChange={handleChange} placeholder="you@college.edu.in" />
            </div>
            <div className="field">
              <label htmlFor="apply-phone">Phone *</label>
              <input id="apply-phone" name="phone" type="tel" required value={form.phone} onChange={handleChange} placeholder="+91-XXXXXXXXXX" />
            </div>
            <div className="field">
              <label htmlFor="apply-city">City / Region *</label>
              <input id="apply-city" name="city" required value={form.city} onChange={handleChange} placeholder="e.g. New Delhi" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="apply-hours">Preferred Working Hours</label>
            <input id="apply-hours" name="preferred_hours" value={form.preferred_hours} onChange={handleChange} placeholder="e.g. Evenings and weekends, 2–3 hours/day" />
          </div>

          <div className="field">
            <label htmlFor="apply-reason">Why do you want to become a moderator? *</label>
            <textarea
              id="apply-reason"
              name="reason"
              required
              rows={4}
              value={form.reason}
              onChange={handleChange}
              placeholder="Describe your motivation and any relevant skills or experience..."
            />
          </div>

          <div style={{ background: "var(--amber-bg)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 20, fontSize: "0.84rem", color: "var(--text-body)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--amber)" }}>Important:</strong> By applying, you agree to maintain accuracy and impartiality in your moderation decisions. Fraudulent or biased moderation will result in suspension and earnings clawback.
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ width: "100%", padding: "10px" }}
          >
            {submitting ? "Submitting…" : "Submit Application"}
          </button>
        </form>

        <div className="auth-card__footer">
          Already a citizen? <Link to="/">Return to Feed</Link>
        </div>
      </div>
    </div>
  );
}
