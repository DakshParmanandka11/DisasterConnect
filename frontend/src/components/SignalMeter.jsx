import "./SignalMeter.css";

// Horizontal gauge that reads like a signal-strength / VU meter.
// Fills left-to-right with the upvote percentage; a tick marks the
// verification threshold so it's visually obvious when a report crosses it.
export default function SignalMeter({ pct = 0, threshold = 40, totalVotes = 0, quorum = 10, size = "md" }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const crossed = totalVotes >= quorum && pct > threshold;

  return (
    <div className={`signal-meter signal-meter--${size} ${crossed ? "is-crossed" : ""}`}>
      <div className="signal-meter__track">
        <div className="signal-meter__fill" style={{ width: `${clamped}%` }} />
        <div className="signal-meter__threshold" style={{ left: `${threshold}%` }} />
      </div>
      <div className="signal-meter__readout">
        <span className="mono signal-meter__pct">{clamped.toFixed(1)}%</span>
        <span className="mono signal-meter__votes">
          {totalVotes}/{quorum} votes{totalVotes < quorum ? " (quorum pending)" : ""}
        </span>
      </div>
    </div>
  );
}
