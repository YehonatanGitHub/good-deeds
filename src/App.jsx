import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  isConfigured, getClient,
  loadKids, loadLogs, loadCustomGoodDeeds, loadCustomBadDeeds,
  seedKids, upsertKid, insertLog, deleteLog, deleteLogsByIds,
  insertCustomGoodDeed, deleteCustomGoodDeed,
  insertCustomBadDeed, deleteCustomBadDeed,
  subscribeToAll,
} from "./sync";

// ─── CONFIG ─────────────────────────────────────────────────────────
const KIDS_DEFAULT = [
  { id: 1, name: "יוסף", age: 11, emoji: "🤠", color: "#FF6B6B", avatar: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA4KCw0LCQ4NDA0QDw4RFiQXFhQUFiwgIRokNC43NjMuMjI6QVNGOj1OPjIySGJJTlZYXV5dOEVmbWVabFNbXVn/2wBDAQ8QEBYTFioXFypZOzI7WVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVn/wAARCABQAFADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDs6patfjT7J5sAsOFB9au1y/jhiLS2XPDOc/gKBnJXl7NeTNPO5d29e1Njt3kTOKS3i86VVFdBbQKqBSKiTsaRVzm2hYE8UYA6da6eSxjfoMGqk+lEqWUc+lTzFchiZ2kE5FdN4R1OYXgsyd0LgkA/wn2rBntpEG11I9D61Y0vfY6pau2V+cZ+lUmiWmemUtJS1RmNrkvHR/dWY75b+ldbXJ+OlJtrVgpO1zk+nFAGBpEYLse4FbajHWszSYitm0n8TGo7qaNCd7SOR129qhq7NU7I30xUoAIrE06RWK7S4z2ar2oSGCDdvKe9S0WmW2iVuoBrD1UbL6HtyP51Hb3rM/y3Mmc9xxVm+jad7N2I3GTYTSSsxt3R3i/dH0paRPuilrY5hKxfE0KS6eu/oH/pW1WdrcHn2ODnCsGND2HHc5u1iCWioKa2moVO5Ac8mriDaACKlEgVeaybfQ3SXUzraz8uUHGAOlaN/Z/aI1BHbpVdp9r7iCTngCrC3vmts2ncBwcVEr7lq2xRg0mNU2EEDOever/2RS1tHn7sgNWI3Drk8GnIm+eI5+62RSu29QaSRuUUUV0nIJVe6AYwo33GkGfwBI/UCrFRXMIngaMkrnow6qexpgZusRYdJQOo2msWdiqEjnHat+5Zp9JLygCRPvAdMg4NYDnNZy3NYPQrR3IkPKEEdm4qwt3HDgspXPpzTTGT0AJqWFHU/Mox9KTtY1iSW1z5y7lyAa3tOiHleYR8x6GsS1iMs6ouBuNdHblfKVAeVGCO4NKC1uRUeliaiiitTASoTJI4xGhU/wB5xwPw706SRY1JPOPSqkl07HA+UY/GmBFqV1Bb2UluH3SsMY789zXPnkU68Ro7qQMc7juB9QaiDYrN7msVoLvZakjkduKaBup4O3gVLLRf04rHdRFiAM8k1vSRrI65AyOc965qP5hXS26kQRhuWCjOaIPoTUXUlooorUxP/9k=" },
  { id: 2, name: "שיראל", age: 9, emoji: "🧙‍♀️", color: "#4ECDC4", avatar: "data:image/jpeg;base64,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" },
  { id: 3, name: "יהודה", age: 6, emoji: "👮", color: "#FFD93D", avatar: "data:image/jpeg;base64,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" },
];

const GOOD_DEEDS_DEFAULT = [
  { label: "עזר/ה לאמא", emoji: "👩", weight: 1 },
  { label: "עזר/ה לאבא", emoji: "👨", weight: 1 },
  { label: "עזר/ה במטלות הבית", emoji: "🧹", weight: 1 },
  { label: "התנהג/ה יפה עם אחים", emoji: "🤗", weight: 1 },
  { label: "עשה/תה שיעורים בלי לבקש", emoji: "📚", weight: 1 },
  { label: "סידר/ה את החדר", emoji: "🛏️", weight: 1 },
  { label: "שיתף/ה יפה", emoji: "🤝", weight: 1 },
  { label: "נימוסים טובים", emoji: "⭐", weight: 1 },
  { label: "עזר/ה לחבר/ה", emoji: "💛", weight: 1 },
  { label: "היה/תה סבלני/ת", emoji: "🧘", weight: 1 },
  { label: "אמר/ה את האמת", emoji: "💎", weight: 1 },
  { label: "מאמץ מיוחד", emoji: "🏆", weight: 2 },
];

const BAD_DEEDS = [
  { label: "רב/ה עם אחים", emoji: "😤", weight: 1 },
  { label: "לא הקשיב/ה", emoji: "🙉", weight: 1 },
  { label: "השאיר/ה בלגן", emoji: "🗑️", weight: 1 },
  { label: "עבר/ה על זמן מסך", emoji: "📱", weight: 1 },
  { label: "נדנוד / היסטריה", emoji: "😫", weight: 1 },
  { label: "חוצפה", emoji: "😠", weight: 1 },
  { label: "לא עשה/תה שיעורים", emoji: "📝", weight: 1 },
  { label: "שיקר/ה", emoji: "🤥", weight: 1 },
  { label: "שבר/ה חוק", emoji: "⚠️", weight: 1 },
  { label: "התנהגות חמורה", emoji: "🚫", weight: 2 },
];

const BASE_TARGET = 40;
const BONUS_TARGET = 20;
const TARGET_DEEDS = BASE_TARGET + BONUS_TARGET;
const BASE_AMOUNT = 5;
const BONUS_AMOUNT = 2.5;
const MAX = BASE_AMOUNT + BONUS_AMOUNT;
const MIN = 0;

const CONFETTI_EMOJIS = ["🎉", "🪙", "💰", "⭐", "✨", "🎊", "💫", "🥇", "🪙", "💰"];

// ─── HELPERS ────────────────────────────────────────────────────────
const Store = {
  save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) { console.error(e); } },
  load(k, fb) { try { const d = localStorage.getItem(k); return d ? JSON.parse(d) : fb; } catch { return fb; } },
};


function weekRange(offset = 0) {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const day = now.getDay();
  const s = new Date(now); s.setDate(now.getDate() - day); s.setHours(0, 0, 0, 0);
  const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23, 59, 59, 999);
  return { start: s, end: e };
}

function fmtDate(d) { return d.toLocaleDateString("he-IL", { month: "short", day: "numeric" }); }
function fmtTime(d) { return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }); }
function dayName(d) { return ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"][d.getDay()]; }

function calcAllowance(logs) {
  const goodW = logs.filter(l => l.type === "good").reduce((s, l) => s + l.weight, 0);
  const badW = logs.filter(l => l.type === "bad").reduce((s, l) => s + l.weight, 0);
  const net = Math.max(0, goodW - badW);
  const baseEarned = Math.min(1, net / BASE_TARGET) * BASE_AMOUNT;
  const bonusDeeds = Math.max(0, net - BASE_TARGET);
  const bonusEarned = Math.min(1, bonusDeeds / BONUS_TARGET) * BONUS_AMOUNT;
  const raw = baseEarned + bonusEarned;
  return Math.round(Math.max(MIN, Math.min(MAX, raw)) * 100) / 100;
}

function fmtNIS(v) { return v % 1 ? `₪${v.toFixed(2)}` : `₪${v}`; }

// ─── CONFETTI COMPONENT ─────────────────────────────────────────────
const Confetti = ({ active }) => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!active) return;
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: Date.now() + i,
      emoji: CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)],
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 1.5 + Math.random() * 1.5,
      size: 14 + Math.random() * 18,
      drift: (Math.random() - 0.5) * 60,
    }));
    setParticles(newParticles);
    const timer = setTimeout(() => setParticles([]), 3500);
    return () => clearTimeout(timer);
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 300, overflow: "hidden" }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: "absolute",
          left: `${p.x}%`,
          top: "-5%",
          fontSize: p.size,
          animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
          transform: `translateX(${p.drift}px)`,
        }}>{p.emoji}</div>
      ))}
    </div>
  );
};

// ─── MAIN ───────────────────────────────────────────────────────────
export default function App() {
  const [kids, setKids] = useState(() => Store.load("kids", KIDS_DEFAULT));
  const [logs, setLogs] = useState(() => Store.load("logs", []));
  const [customGoodDeeds, setCustomGoodDeeds] = useState(() => Store.load("customGoodDeeds", []));
  const [view, setView] = useState("dashboard");
  const [selKid, setSelKid] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [wkOff, setWkOff] = useState(0);
  const [editNames, setEditNames] = useState(false);
  const [tmpNames, setTmpNames] = useState({});
  const [confettiKey, setConfettiKey] = useState(0);
  const [customBadDeeds, setCustomBadDeeds] = useState(() => Store.load("customBadDeeds", []));
  const [syncStatus, setSyncStatus] = useState(() => isConfigured() ? "connecting" : "offline");
  const skipNextRealtime = useRef(false);

  // Save to localStorage (always)
  useEffect(() => { Store.save("logs", logs); }, [logs]);
  useEffect(() => { Store.save("kids", kids); }, [kids]);
  useEffect(() => { Store.save("customGoodDeeds", customGoodDeeds); }, [customGoodDeeds]);
  useEffect(() => { Store.save("customBadDeeds", customBadDeeds); }, [customBadDeeds]);

  // Merge DB kids with local avatars (avatars are too large for DB)
  const mergeKidsWithAvatars = useCallback((dbKids) => {
    return dbKids.map(k => {
      const def = KIDS_DEFAULT.find(d => d.id === k.id);
      return { ...k, avatar: def?.avatar || k.avatar };
    });
  }, []);

  // Reload helpers
  const reloadKids = useCallback(async () => {
    const data = await loadKids();
    if (data.length > 0) setKids(mergeKidsWithAvatars(data));
  }, [mergeKidsWithAvatars]);

  const reloadLogs = useCallback(async () => {
    const data = await loadLogs();
    setLogs(data);
  }, []);

  const reloadCustomGoodDeeds = useCallback(async () => {
    const data = await loadCustomGoodDeeds();
    setCustomGoodDeeds(data);
  }, []);

  const reloadCustomBadDeeds = useCallback(async () => {
    const data = await loadCustomBadDeeds();
    setCustomBadDeeds(data);
  }, []);

  // Connect to Supabase on mount
  useEffect(() => {
    if (!isConfigured()) return;
    let channel = null;
    const connect = async () => {
      try {
        setSyncStatus("syncing");
        // Load kids — seed if empty
        const remoteKids = await loadKids();
        if (remoteKids.length > 0) {
          setKids(mergeKidsWithAvatars(remoteKids));
        } else {
          await seedKids(KIDS_DEFAULT);
          // kids state already has defaults
        }
        // Load logs and custom deeds
        const [remoteLogs, remoteGoodDeeds, remoteBadDeeds] = await Promise.all([
          loadLogs(), loadCustomGoodDeeds(), loadCustomBadDeeds(),
        ]);
        setLogs(remoteLogs);
        setCustomGoodDeeds(remoteGoodDeeds);
        setCustomBadDeeds(remoteBadDeeds);
        setSyncStatus("synced");
        // Subscribe to realtime
        channel = subscribeToAll({
          onKids: () => { if (!skipNextRealtime.current) reloadKids(); else skipNextRealtime.current = false; },
          onLogs: () => { if (!skipNextRealtime.current) reloadLogs(); else skipNextRealtime.current = false; },
          onCustomGoodDeeds: () => { if (!skipNextRealtime.current) reloadCustomGoodDeeds(); else skipNextRealtime.current = false; },
          onCustomBadDeeds: () => { if (!skipNextRealtime.current) reloadCustomBadDeeds(); else skipNextRealtime.current = false; },
        });
      } catch (e) {
        console.error("Sync error:", e);
        setSyncStatus("offline");
      }
    };
    connect();
    return () => { if (channel) getClient()?.removeChannel(channel); };
  }, [mergeKidsWithAvatars, reloadKids, reloadLogs, reloadCustomGoodDeeds, reloadCustomBadDeeds]);

  const GOOD_DEEDS = useMemo(() => [
    ...GOOD_DEEDS_DEFAULT,
    ...customGoodDeeds.map(d => ({ label: d.label, emoji: d.emoji || "✨", weight: 1 })),
  ], [customGoodDeeds]);

  const ALL_BAD_DEEDS = useMemo(() => [
    ...BAD_DEEDS,
    ...customBadDeeds.map(d => ({ label: d.label, emoji: d.emoji || "💢", weight: 1 })),
  ], [customBadDeeds]);

  const wk = useMemo(() => weekRange(wkOff), [wkOff]);

  const kidLogs = useCallback((kidId) =>
    logs.filter(l => l.kidId === kidId && new Date(l.ts) >= wk.start && new Date(l.ts) <= wk.end),
    [logs, wk]
  );

  const flash = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2000);
  };

  const addDeed = (kidId, deed, type) => {
    const log = {
      id: Date.now() + Math.random(), kidId, type,
      label: deed.label, emoji: deed.emoji, weight: deed.weight,
      ts: new Date().toISOString(),
    };
    setLogs(p => [...p, log]);
    if (isConfigured()) { skipNextRealtime.current = true; insertLog(log).catch(console.error); }
    const kid = kids.find(k => k.id === kidId);
    flash(`${deed.emoji} ${deed.label} ← ${kid.name}`, type === "good" ? "success" : "warning");
    if (type === "good") setConfettiKey(k => k + 1);
    setModal(null);
  };

  const removeDeed = (id) => {
    setLogs(p => p.filter(l => l.id !== id));
    if (isConfigured()) { skipNextRealtime.current = true; deleteLog(id).catch(console.error); }
    flash("הוסר", "info");
  };

  const resetWeek = () => {
    const r = weekRange(0);
    const toRemove = logs.filter(l => { const d = new Date(l.ts); return d >= r.start && d <= r.end; });
    setLogs(p => p.filter(l => !toRemove.some(r => r.id === l.id)));
    if (isConfigured() && toRemove.length > 0) {
      skipNextRealtime.current = true;
      deleteLogsByIds(toRemove.map(l => l.id)).catch(console.error);
    }
    flash("!השבוע אופס", "info");
  };

  // ─── GAUGE ────────────────────────────────────────────────────────
  const Gauge = ({ value, max, color, size = 96 }) => {
    const pct = Math.max(0, Math.min(1, value / max));
    const r = size / 2 - 7;
    const circ = 2 * Math.PI * r;
    const arc = circ * 0.75;
    return (
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(135deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7} strokeDasharray={`${arc} ${circ}`} strokeDashoffset={arc * (1 - pct)} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1), stroke 0.4s", filter: `drop-shadow(0 0 8px ${color}44)` }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 2 }}>
          <span style={{ fontSize: size * 0.26, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums", direction: "ltr" }}>{fmtNIS(value)}</span>
          <span style={{ fontSize: size * 0.095, color: "rgba(255,255,255,0.35)", fontWeight: 500, direction: "ltr" }}>מתוך {fmtNIS(max)}</span>
        </div>
      </div>
    );
  };

  const Badge = ({ type, count }) => (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: type === "good" ? "rgba(52,199,89,0.12)" : "rgba(255,69,58,0.12)",
      color: type === "good" ? "#30D158" : "#FF453A",
    }}>{count} {type === "good" ? "⭐" : "⚡"}</span>
  );

  const ProgressBar = ({ good, bad }) => {
    const net = Math.max(0, good - bad);
    const basePct = Math.min(100, (Math.min(net, BASE_TARGET) / BASE_TARGET) * 66.7);
    const bonusDeeds = Math.max(0, net - BASE_TARGET);
    const bonusPct = Math.min(100, 66.7 + (bonusDeeds / BONUS_TARGET) * 33.3);
    const pct = net <= BASE_TARGET ? basePct : bonusPct;
    const inBonus = net > BASE_TARGET;
    return (
      <div style={{ position: "relative", width: "100%" }}>
        <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", right: 0, top: 0, height: "100%", width: `${pct}%`, borderRadius: 3, background: inBonus ? "linear-gradient(270deg, #FFD60A, #30D158)" : "linear-gradient(270deg, #30D158, #34C759)", transition: "width 0.5s ease" }} />
          <div style={{ position: "absolute", right: "66.7%", top: -2, width: 1.5, height: 10, background: "rgba(255,255,255,0.2)", borderRadius: 1 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>₪0</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", position: "absolute", right: "64%", marginTop: 0 }}>₪5</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>₪7.50</span>
        </div>
      </div>
    );
  };

  // ─── DASHBOARD ────────────────────────────────────────────────────
  const Dashboard = () => (
    <div>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>השבוע</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2, direction: "ltr" }}>{fmtDate(wk.start)} – {fmtDate(wk.end)}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {kids.map((kid, i) => {
          const kl = kidLogs(kid.id);
          const goodW = kl.filter(l => l.type === "good").reduce((s, l) => s + l.weight, 0);
          const badW = kl.filter(l => l.type === "bad").reduce((s, l) => s + l.weight, 0);
          const goodCount = kl.filter(l => l.type === "good").length;
          const badCount = kl.filter(l => l.type === "bad").length;
          const allowance = calcAllowance(kl);
          const gc = allowance > BASE_AMOUNT ? "#FFD60A" : "#30D158";

          return (
            <div key={kid.id} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 20, padding: "18px 20px", border: "1px solid rgba(255,255,255,0.06)", animation: `slideIn 0.4s ease ${i * 0.08}s both` }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <Gauge value={allowance} max={MAX} color={gc} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 13, background: `linear-gradient(140deg, ${kid.color}30, ${kid.color}10)`, border: `1.5px solid ${kid.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, overflow: "hidden" }}>{kid.avatar ? <img src={kid.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : kid.emoji}</div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: -0.3 }}>{kid.name}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>גיל {kid.age}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <Badge type="good" count={goodCount} />
                    <Badge type="bad" count={badCount} />
                  </div>
                  <ProgressBar good={goodW} bad={badW} />
                  {wkOff === 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                      <button onClick={() => setModal({ kidId: kid.id, type: "good" })} style={{ ...actBtn, background: "rgba(52,199,89,0.12)", color: "#30D158" }}>+ טוב</button>
                      <button onClick={() => setModal({ kidId: kid.id, type: "bad" })} style={{ ...actBtn, background: "rgba(255,69,58,0.12)", color: "#FF453A" }}>− לא טוב</button>
                      <button onClick={() => { setSelKid(kid.id); setView("history"); }} style={{ ...actBtn, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>יומן</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div style={{ marginTop: 20, padding: "16px 20px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 }}>סיכום דמי כיס</div>
        <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end" }}>
          {kids.map(kid => {
            const a = calcAllowance(kidLogs(kid.id));
            return (
              <div key={kid.id} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>{kid.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: kid.color, fontVariantNumeric: "tabular-nums", direction: "ltr" }}>{fmtNIS(a)}</div>
              </div>
            );
          })}
          <div style={{ textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.06)", paddingRight: 18 }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>סה״כ</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums", direction: "ltr" }}>
              {fmtNIS(kids.reduce((s, k) => s + calcAllowance(kidLogs(k.id)), 0))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.7 }}>
            מתחילים מ-₪0 · 40 מעשים טובים → ₪5 · 20 נוספים → ₪7.50 · מעשים לא טובים מפחיתים · 🏆🚫 כפול 2
          </div>
        </div>
      </div>
    </div>
  );

  // ─── HISTORY ──────────────────────────────────────────────────────
  const History = () => {
    const kid = kids.find(k => k.id === selKid);
    if (!kid) return null;
    const kl = kidLogs(kid.id).sort((a, b) => new Date(b.ts) - new Date(a.ts));
    const allowance = calcAllowance(kl);

    return (
      <div>
        <button onClick={() => setView("dashboard")} style={backBtn}>לוח בקרה →</button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          {kid.avatar ? <img src={kid.avatar} style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }} /> : <span style={{ fontSize: 30 }}>{kid.emoji}</span>}
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, color: "#fff" }}>היומן של {kid.name}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>השבוע · {fmtNIS(allowance)} הרוויח</div>
          </div>
        </div>
        {kl.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "rgba(255,255,255,0.25)", fontSize: 14 }}>אין רשומות השבוע</div>
        ) : (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            {kl.map(log => {
              const d = new Date(log.ts);
              return (
                <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: 19 }}>{log.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{log.label}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>יום {dayName(d)} · {fmtTime(d)}{log.weight > 1 ? " · משקל כפול" : ""}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: log.type === "good" ? "rgba(52,199,89,0.12)" : "rgba(255,69,58,0.12)", color: log.type === "good" ? "#30D158" : "#FF453A", direction: "ltr" }}>
                    {log.type === "good" ? "+" : "−"}{log.weight}
                  </span>
                  {wkOff === 0 && (
                    <button onClick={() => removeDeed(log.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 14, padding: "2px 4px" }}>✕</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ─── SETTINGS ─────────────────────────────────────────────────────
  const CustomDeedsManager = () => {
    const [newDeed, setNewDeed] = useState("");
    const [newEmoji, setNewEmoji] = useState("✨");

    const addCustom = async () => {
      if (!newDeed.trim()) return;
      const deed = { label: newDeed.trim(), emoji: newEmoji };
      if (isConfigured()) {
        try {
          skipNextRealtime.current = true;
          const saved = await insertCustomGoodDeed(deed);
          setCustomGoodDeeds(p => [...p, saved]);
        } catch (e) { console.error(e); }
      } else {
        setCustomGoodDeeds(p => [...p, { id: Date.now(), ...deed }]);
      }
      setNewDeed("");
      setNewEmoji("✨");
      flash("!מעשה טוב נוסף");
    };

    const removeCustom = (id) => {
      setCustomGoodDeeds(p => p.filter(d => d.id !== id));
      if (isConfigured()) { skipNextRealtime.current = true; deleteCustomGoodDeed(id).catch(console.error); }
      flash("הוסר", "info");
    };

    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 12 }}>⭐ מעשים טובים מותאמים</div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 12, marginTop: 0 }}>הוסף מעשים טובים שיופיעו תמיד ברשימה.</p>

        {/* Existing custom deeds */}
        {customGoodDeeds.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {customGoodDeeds.map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 16 }}>{d.emoji}</span>
                <span style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{d.label}</span>
                <button onClick={() => removeCustom(d.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Add new */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select value={newEmoji} onChange={e => setNewEmoji(e.target.value)} style={{ ...inputStyle, width: 50, padding: "8px 4px", textAlign: "center", flex: "none" }}>
            {["✨", "🌟", "💪", "🎯", "📖", "🧹", "🍽️", "🐕", "🌱", "🎨", "🏃", "🙏"].map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <input value={newDeed} onChange={e => setNewDeed(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustom()}
            style={{ ...inputStyle, textAlign: "right" }} placeholder="שם המעשה הטוב..." />
          <button onClick={addCustom} style={{ ...actBtn, background: "rgba(52,199,89,0.15)", color: "#30D158", whiteSpace: "nowrap", flexShrink: 0 }}>הוסף</button>
        </div>
      </div>
    );
  };

  const CustomBadDeedsManager = () => {
    const [newDeed, setNewDeed] = useState("");
    const [newEmoji, setNewEmoji] = useState("💢");

    const addCustom = async () => {
      if (!newDeed.trim()) return;
      const deed = { label: newDeed.trim(), emoji: newEmoji };
      if (isConfigured()) {
        try {
          skipNextRealtime.current = true;
          const saved = await insertCustomBadDeed(deed);
          setCustomBadDeeds(p => [...p, saved]);
        } catch (e) { console.error(e); }
      } else {
        setCustomBadDeeds(p => [...p, { id: Date.now(), ...deed }]);
      }
      setNewDeed("");
      setNewEmoji("💢");
      flash("!מעשה לא טוב נוסף");
    };

    const removeCustom = (id) => {
      setCustomBadDeeds(p => p.filter(d => d.id !== id));
      if (isConfigured()) { skipNextRealtime.current = true; deleteCustomBadDeed(id).catch(console.error); }
      flash("הוסר", "info");
    };

    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 12 }}>⚡ מעשים לא טובים מותאמים</div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 12, marginTop: 0 }}>הוסף מעשים לא טובים שיופיעו תמיד ברשימה.</p>

        {customBadDeeds.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {customBadDeeds.map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 16 }}>{d.emoji}</span>
                <span style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{d.label}</span>
                <button onClick={() => removeCustom(d.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <select value={newEmoji} onChange={e => setNewEmoji(e.target.value)} style={{ ...inputStyle, width: 50, padding: "8px 4px", textAlign: "center", flex: "none" }}>
            {["💢", "😤", "🙉", "📱", "😫", "😠", "🤥", "⚠️", "🚫", "👎"].map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <input value={newDeed} onChange={e => setNewDeed(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustom()}
            style={{ ...inputStyle, textAlign: "right" }} placeholder="שם המעשה הלא טוב..." />
          <button onClick={addCustom} style={{ ...actBtn, background: "rgba(255,69,58,0.15)", color: "#FF453A", whiteSpace: "nowrap", flexShrink: 0 }}>הוסף</button>
        </div>
      </div>
    );
  };

  const Settings = () => (
    <div>
      <div style={{ fontSize: 19, fontWeight: 700, color: "#fff", marginBottom: 20 }}>הגדרות</div>
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 12 }}>👨‍👧‍👦 שמות הילדים</div>
        {editNames ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {kids.map(kid => (
              <div key={kid.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>{kid.emoji}</span>
                <input value={tmpNames[kid.id] || ""} onChange={e => setTmpNames(p => ({ ...p, [kid.id]: e.target.value }))} style={inputStyle} placeholder={`שם (גיל ${kid.age})`} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button onClick={() => {
                const updated = kids.map(k => ({ ...k, name: tmpNames[k.id] || k.name }));
                setKids(updated);
                if (isConfigured()) { skipNextRealtime.current = true; updated.forEach(k => upsertKid(k).catch(console.error)); }
                setEditNames(false); flash("!השמות נשמרו");
              }} style={{ ...actBtn, background: "rgba(52,199,89,0.15)", color: "#30D158" }}>שמור</button>
              <button onClick={() => setEditNames(false)} style={{ ...actBtn, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>ביטול</button>
            </div>
          </div>
        ) : (
          <div>
            {kids.map(kid => (
              <div key={kid.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span>{kid.emoji}</span>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{kid.name} (גיל {kid.age})</span>
              </div>
            ))}
            <button onClick={() => { const n = {}; kids.forEach(k => n[k.id] = k.name); setTmpNames(n); setEditNames(true); }}
              style={{ ...actBtn, marginTop: 8, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>ערוך שמות</button>
          </div>
        )}
      </div>

      <CustomDeedsManager />
      <CustomBadDeedsManager />

      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 10 }}>📋 איך זה עובד</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.9 }}>
          כל ילד מתחיל מ-<b style={{ color: "#FF453A" }}>₪0</b> כל שבוע (ראשון–שבת) וצריך להרוויח את דמי הכיס!<br /><br />
          <b style={{ color: "#30D158" }}>40 מעשים טובים ראשונים</b> → מרוויחים עד <b style={{ color: "#FFD60A" }}>₪5</b> (~6 ביום)<br /><br />
          <b style={{ color: "#FFD60A" }}>20 מעשים נוספים</b> → בונוס עד <b style={{ color: "#30D158" }}>₪7.50</b> (~3 ביום)<br /><br />
          מעשים לא טובים <b style={{ color: "#FF453A" }}>מפחיתים</b> מהמעשים הטובים (נטו).<br /><br />
          <b>דוגמה:</b> 30 טוב − 5 לא טוב = 25 נטו → 25/40 × ₪5 = <b style={{ color: "#30D158" }}>₪3.13</b><br /><br />
          🏆 מאמץ מיוחד ו-🚫 התנהגות חמורה נספרים <b style={{ color: "#FFD60A" }}>כפול 2</b>.<br /><br />
          טווח: ₪0 – ₪7.50 לילד.
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 6 }}>🔄 איפוס שבוע</div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", marginBottom: 12, marginTop: 4 }}>מחיקת כל הרשומות של השבוע הנוכחי.</p>
        <button onClick={() => { if (confirm("לאפס את כל הנקודות של השבוע?")) resetWeek(); }}
          style={{ ...actBtn, background: "rgba(255,69,58,0.12)", color: "#FF453A" }}>איפוס השבוע</button>
      </div>

      {isConfigured() && (
        <div style={cardStyle}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 10 }}>🔗 סנכרון</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
            {syncStatus === "synced" && "🟢 מסונכרן"}
            {syncStatus === "syncing" && "🟡 מסנכרן..."}
            {syncStatus === "connecting" && "🟡 מתחבר..."}
            {syncStatus === "offline" && "⚪ לא מחובר"}
          </div>
        </div>
      )}
    </div>
  );

  // ─── DEED MODAL ───────────────────────────────────────────────────
  const DeedModalInner = () => {
    const [type, setType] = useState(modal.type);
    const [customText, setCustomText] = useState("");
    const [showCustom, setShowCustom] = useState(false);
    const kid = kids.find(k => k.id === modal.kidId);
    const deeds = type === "good" ? GOOD_DEEDS : ALL_BAD_DEEDS;

    const addCustomDeed = () => {
      if (!customText.trim()) return;
      addDeed(modal.kidId, { label: customText.trim(), emoji: type === "good" ? "✨" : "💢", weight: 1 }, type);
      setCustomText("");
      setShowCustom(false);
    };

    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(12px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100, padding: 12, animation: "fadeIn 0.15s ease" }}
        onClick={() => setModal(null)}>
        <div style={{ background: "#1C1C1E", borderRadius: 22, padding: "20px 20px 24px", width: "100%", maxWidth: 400, maxHeight: "75vh", overflowY: "auto", border: "1px solid rgba(255,255,255,0.08)", animation: "slideUp 0.25s ease" }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <button onClick={() => setModal(null)} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", width: 30, height: 30, borderRadius: 15, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>רישום מעשה</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>עבור {kid?.name}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 3, marginBottom: 14, padding: 3, background: "rgba(255,255,255,0.05)", borderRadius: 10 }}>
            {[["good", "⭐ טוב"], ["bad", "⚡ לא טוב"]].map(([t, lbl]) => (
              <button key={t} onClick={() => setType(t)} style={{
                flex: 1, padding: "8px 0", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer",
                background: type === t ? (t === "good" ? "rgba(52,199,89,0.18)" : "rgba(255,69,58,0.18)") : "transparent",
                color: type === t ? (t === "good" ? "#30D158" : "#FF453A") : "rgba(255,255,255,0.3)", transition: "all 0.15s",
              }}>{lbl}</button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {deeds.map((deed, i) => (
              <button key={i} onClick={() => addDeed(modal.kidId, deed, type)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", borderRadius: 12,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)",
                color: "#fff", cursor: "pointer", textAlign: "right", transition: "background 0.12s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: type === "good" ? "rgba(52,199,89,0.1)" : "rgba(255,69,58,0.1)", color: type === "good" ? "#30D158" : "#FF453A", direction: "ltr" }}>
                  {deed.weight > 1 ? `${deed.weight}×` : "1×"}
                </span>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 500, textAlign: "right" }}>{deed.label}</span>
                <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>{deed.emoji}</span>
              </button>
            ))}

            {showCustom ? (
              <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 8, textAlign: "right" }}>
                  {type === "good" ? "מעשה טוב חד-פעמי:" : "מעשה לא טוב מותאם אישית:"}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addCustomDeed} style={{ ...actBtn, background: type === "good" ? "rgba(52,199,89,0.15)" : "rgba(255,69,58,0.15)", color: type === "good" ? "#30D158" : "#FF453A", whiteSpace: "nowrap" }}>הוסף</button>
                  <input value={customText} onChange={e => setCustomText(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustomDeed()}
                    style={{ ...inputStyle, textAlign: "right" }} placeholder="תאר/י את המעשה..." autoFocus />
                </div>
              </div>
            ) : (
              <button onClick={() => setShowCustom(true)} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "13px 14px", borderRadius: 12,
                background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "background 0.12s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}>
                ✏️ מעשה חד-פעמי
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── STYLES ───────────────────────────────────────────────────────
  const navBtn = { background: "rgba(255,255,255,0.06)", border: "none", color: "#fff", width: 34, height: 34, borderRadius: 17, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" };
  const actBtn = { padding: "8px 14px", borderRadius: 10, border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.12s" };
  const backBtn = { background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: 0, marginBottom: 16 };
  const cardStyle = { background: "rgba(255,255,255,0.03)", borderRadius: 16, padding: "16px 18px", marginBottom: 12, border: "1px solid rgba(255,255,255,0.05)" };
  const inputStyle = { flex: 1, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontSize: 14, outline: "none", fontFamily: "inherit" };
  const tabStyle = (active) => ({
    background: "none", border: "none", padding: "10px 0", flex: 1,
    color: active ? "#fff" : "rgba(255,255,255,0.25)", fontWeight: active ? 700 : 500,
    fontSize: 12, cursor: "pointer",
    borderBottom: active ? "2px solid #fff" : "2px solid transparent", transition: "all 0.15s",
  });

  return (
    <div dir="rtl" style={{ minHeight: "100vh", maxWidth: 480, margin: "0 auto", background: "linear-gradient(175deg, #08080A 0%, #0F0F14 40%, #0A0A0E 100%)", color: "#fff", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; font-family: 'Heebo', -apple-system, sans-serif; }
        @keyframes slideIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes slideUp { from { transform:translateY(50px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
          50% { opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg) scale(0.5); opacity: 0; }
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        button { font-family: inherit; }
        input, select { font-family: inherit; }
      `}</style>

      <div style={{ position: "absolute", top: -120, left: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ padding: "16px 24px 4px", textAlign: "center" }}>
        <div style={{ width: 120, height: 120, borderRadius: "50%", margin: "0 auto 12px", overflow: "hidden", border: "3px solid rgba(255,255,255,0.15)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
          <img src="data:image/jpeg;base64,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" alt="משפחת רומני" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>⭐ מעשים טובים</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4, fontWeight: 500 }}>
          מעקב דמי כיס · משפחת רומני
          {isConfigured() && <span style={{ marginRight: 8 }}>{syncStatus === "synced" ? " 🟢" : syncStatus === "syncing" ? " 🟡" : " ⚪"}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", padding: "0 24px", marginTop: 12, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <button onClick={() => setView("dashboard")} style={tabStyle(view === "dashboard")}>לוח בקרה</button>
        <button onClick={() => setView("settings")} style={tabStyle(view === "settings")}>הגדרות</button>
      </div>

      {/* Content */}
      <div style={{ padding: "0 20px 100px" }}>
        {view === "dashboard" && <Dashboard />}
        {view === "history" && <History />}
        {view === "settings" && <Settings />}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          padding: "10px 20px", borderRadius: 14,
          background: toast.type === "success" ? "rgba(52,199,89,0.9)" : toast.type === "warning" ? "rgba(255,69,58,0.9)" : "rgba(100,100,110,0.9)",
          color: "#fff", fontSize: 14, fontWeight: 600, zIndex: 200, backdropFilter: "blur(10px)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)", animation: "fadeIn 0.2s ease",
        }}>{toast.msg}</div>
      )}

      {/* Confetti */}
      <Confetti active={confettiKey} />

      {modal && <DeedModalInner />}
    </div>
  );
}
