import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  isConfigured, getClient,
  loadKids, loadLogs, loadCustomGoodDeeds, loadCustomBadDeeds, loadSettings,
  upsertKid, deleteKid, insertLog, deleteLog, deleteLogsByIds,
  insertCustomGoodDeed, deleteCustomGoodDeed,
  insertCustomBadDeed, deleteCustomBadDeed,
  upsertSetting, subscribeToAll,
} from "./sync";

// ─── CONFIG ─────────────────────────────────────────────────────────
const KIDS_DEFAULT = [];

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

function calcAllowance(logs, max) {
  const STEP = max / TARGET_DEEDS;
  const sorted = [...logs].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  let balance = 0;
  for (const log of sorted) {
    const delta = (log.weight || 1) * STEP;
    if (log.type === "good") {
      balance = Math.min(max, balance + delta);
    } else {
      balance = Math.max(0, balance - delta);
    }
  }
  return Math.round(balance * 100) / 100;
}

function fmtNIS(v) { return v % 1 ? `₪${v.toFixed(2)}` : `₪${v}`; }
const stripQuotes = (v) => typeof v === "string" ? v.replace(/^"|"$/g, "") : v;

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

const FAMILY_IMAGE_DEFAULT = "data:image/jpeg;base64,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";

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
  const [goodDeedsConfig, setGoodDeedsConfig] = useState(() => Store.load("goodDeedsConfig", GOOD_DEEDS_DEFAULT));
  const [badDeedsConfig, setBadDeedsConfig] = useState(() => Store.load("badDeedsConfig", BAD_DEEDS));
  const [allowanceConfig, setAllowanceConfig] = useState(() => Store.load("allowanceConfig", { baseAmount: 5, bonusAmount: 2.5 }));
  const [familyImage, setFamilyImage] = useState(() => Store.load("familyImage", FAMILY_IMAGE_DEFAULT));
  const [familyName, setFamilyName] = useState(() => Store.load("familyName", "רומני"));
  const [syncStatus, setSyncStatus] = useState(() => isConfigured() ? "connecting" : "offline");
  const skipNextRealtime = useRef(false);
  const kidsRef = useRef(Store.load("kids", KIDS_DEFAULT));

  const BASE_AMOUNT = allowanceConfig.baseAmount;
  const BONUS_AMOUNT = allowanceConfig.bonusAmount;
  const MAX = BASE_AMOUNT + BONUS_AMOUNT;

  // Save to localStorage (always)
  useEffect(() => { Store.save("logs", logs); }, [logs]);
  useEffect(() => { Store.save("kids", kids); kidsRef.current = kids; }, [kids]);
  useEffect(() => { Store.save("customGoodDeeds", customGoodDeeds); }, [customGoodDeeds]);
  useEffect(() => { Store.save("customBadDeeds", customBadDeeds); }, [customBadDeeds]);
  useEffect(() => { Store.save("goodDeedsConfig", goodDeedsConfig); }, [goodDeedsConfig]);
  useEffect(() => { Store.save("badDeedsConfig", badDeedsConfig); }, [badDeedsConfig]);
  useEffect(() => { Store.save("allowanceConfig", allowanceConfig); }, [allowanceConfig]);
  useEffect(() => { Store.save("familyImage", familyImage); }, [familyImage]);
  useEffect(() => { Store.save("familyName", familyName); }, [familyName]);

  // Merge DB kids with local avatars (base64 file uploads stay local; URL avatars come from DB)
  const mergeKidsWithAvatars = useCallback((dbKids) => {
    return dbKids.map(k => {
      const local = kidsRef.current.find(d => d.id === k.id);
      return { ...k, avatar: local?.avatar || k.avatar || null };
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

  const reloadSettings = useCallback(async () => {
    const data = await loadSettings();
    const merged = { baseAmount: Number(data.baseAmount ?? 5), bonusAmount: Number(data.bonusAmount ?? 2.5) };
    setAllowanceConfig(merged);
    Store.save("allowanceConfig", merged);
    if (data.familyName) { const v = stripQuotes(data.familyName); setFamilyName(v); Store.save("familyName", v); }
    if (data.goodDeedsConfig) { setGoodDeedsConfig(data.goodDeedsConfig); Store.save("goodDeedsConfig", data.goodDeedsConfig); }
    if (data.badDeedsConfig) { setBadDeedsConfig(data.badDeedsConfig); Store.save("badDeedsConfig", data.badDeedsConfig); }
  }, []);

  // Connect to Supabase on mount
  useEffect(() => {
    if (!isConfigured()) return;
    let channel = null;
    const connect = async () => {
      try {
        setSyncStatus("syncing");
        // Load kids from DB
        const remoteKids = await loadKids();
        if (remoteKids.length > 0) {
          setKids(mergeKidsWithAvatars(remoteKids));
        } else {
          setKids([]);
        }
        // Load logs, custom deeds, and settings
        const [remoteLogs, remoteGoodDeeds, remoteBadDeeds, remoteSettings] = await Promise.all([
          loadLogs(), loadCustomGoodDeeds(), loadCustomBadDeeds(), loadSettings(),
        ]);
        setLogs(remoteLogs);
        setCustomGoodDeeds(remoteGoodDeeds);
        setCustomBadDeeds(remoteBadDeeds);
        if (remoteSettings.baseAmount !== undefined || remoteSettings.bonusAmount !== undefined) {
          const merged = { baseAmount: Number(remoteSettings.baseAmount ?? 5), bonusAmount: Number(remoteSettings.bonusAmount ?? 2.5) };
          setAllowanceConfig(merged);
          Store.save("allowanceConfig", merged);
        }
        if (remoteSettings.familyName) { const v = stripQuotes(remoteSettings.familyName); setFamilyName(v); Store.save("familyName", v); }
        if (remoteSettings.goodDeedsConfig) { setGoodDeedsConfig(remoteSettings.goodDeedsConfig); Store.save("goodDeedsConfig", remoteSettings.goodDeedsConfig); }
        if (remoteSettings.badDeedsConfig) { setBadDeedsConfig(remoteSettings.badDeedsConfig); Store.save("badDeedsConfig", remoteSettings.badDeedsConfig); }
        setSyncStatus("synced");
        // Subscribe to realtime
        channel = subscribeToAll({
          onKids: () => { if (!skipNextRealtime.current) reloadKids(); else skipNextRealtime.current = false; },
          onLogs: () => { if (!skipNextRealtime.current) reloadLogs(); else skipNextRealtime.current = false; },
          onCustomGoodDeeds: () => { if (!skipNextRealtime.current) reloadCustomGoodDeeds(); else skipNextRealtime.current = false; },
          onCustomBadDeeds: () => { if (!skipNextRealtime.current) reloadCustomBadDeeds(); else skipNextRealtime.current = false; },
          onSettings: () => { if (!skipNextRealtime.current) reloadSettings(); else skipNextRealtime.current = false; },
        });
      } catch (e) {
        console.error("Sync error:", e);
        setSyncStatus("offline");
      }
    };
    connect();
    return () => { if (channel) getClient()?.removeChannel(channel); };
  }, [mergeKidsWithAvatars, reloadKids, reloadLogs, reloadCustomGoodDeeds, reloadCustomBadDeeds, reloadSettings]);

  const GOOD_DEEDS = useMemo(() => [
    ...goodDeedsConfig,
    ...customGoodDeeds.map(d => ({ label: d.label, emoji: d.emoji || "✨", weight: d.weight || 1 })),
  ], [goodDeedsConfig, customGoodDeeds]);

  const ALL_BAD_DEEDS = useMemo(() => [
    ...badDeedsConfig,
    ...customBadDeeds.map(d => ({ label: d.label, emoji: d.emoji || "💢", weight: d.weight || 1 })),
  ], [badDeedsConfig, customBadDeeds]);

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

  const removeKid = (kid) => {
    if (!confirm(`למחוק את ${kid.name}? כל הרשומות שלו/ה יימחקו גם כן.`)) return;
    setKids(p => p.filter(k => k.id !== kid.id));
    setLogs(p => p.filter(l => l.kidId !== kid.id));
    if (isConfigured()) {
      skipNextRealtime.current = true;
      deleteKid(kid.id).catch(console.error); // logs cascade-deleted in DB
    }
    flash(`${kid.name} הוסר`);
  };

  const addKid = (newKid) => {
    const id = Math.max(0, ...kids.map(k => k.id)) + 1;
    const kid = { id, ...newKid };
    setKids(p => [...p, kid]);
    if (isConfigured()) { skipNextRealtime.current = true; upsertKid(kid).catch(console.error); }
    flash(`!${kid.name} נוסף`);
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
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", position: "absolute", right: "64%", marginTop: 0 }}>{fmtNIS(BASE_AMOUNT)}</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>{fmtNIS(MAX)}</span>
        </div>
      </div>
    );
  };

  // ─── DASHBOARD ────────────────────────────────────────────────────
  const Dashboard = () => (
    <div>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <button onClick={() => setWkOff(wkOff - 1)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: 20, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}>‹</button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{wkOff === 0 ? "השבוע" : wkOff === -1 ? "שבוע שעבר" : `לפני ${Math.abs(wkOff)} שבועות`}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2, direction: "ltr" }}>{fmtDate(wk.start)} – {fmtDate(wk.end)}</div>
          </div>
          <button onClick={() => setWkOff(wkOff + 1)} disabled={wkOff >= 0} style={{ background: "none", border: "none", color: wkOff >= 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)", fontSize: 20, cursor: wkOff >= 0 ? "default" : "pointer", padding: "0 4px", lineHeight: 1 }}>›</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {kids.map((kid, i) => {
          const kl = kidLogs(kid.id);
          const goodW = kl.filter(l => l.type === "good").reduce((s, l) => s + l.weight, 0);
          const badW = kl.filter(l => l.type === "bad").reduce((s, l) => s + l.weight, 0);
          const goodCount = kl.filter(l => l.type === "good").length;
          const badCount = kl.filter(l => l.type === "bad").length;
          const allowance = calcAllowance(kl, MAX);
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
            const a = calcAllowance(kidLogs(kid.id), MAX);
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
              {fmtNIS(kids.reduce((s, k) => s + calcAllowance(kidLogs(k.id), MAX), 0))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.7 }}>
            מתחילים מ-₪0 · 40 מעשים טובים → {fmtNIS(BASE_AMOUNT)} · 20 נוספים → {fmtNIS(MAX)} · מעשים לא טובים מפחיתים מהכסף · 🏆🚫 כפול 2
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
    const allowance = calcAllowance(kl, MAX);

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
  const FamilyImageEditor = ({ familyImage, setFamilyImage, familyImageDefault, familyName, setFamilyName, flash }) => {
    const [nameInput, setNameInput] = useState(familyName);
    const isCustom = familyImage !== familyImageDefault;
    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 12 }}>👨‍👩‍👧‍👦 משפחה</div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>שם משפחה</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>משפחת</span>
            <input
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="רומני..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={() => { const n = nameInput.trim() || familyName; setFamilyName(n); if (isConfigured()) { skipNextRealtime.current = true; upsertSetting("familyName", n).catch(console.error); } flash("!השם נשמר"); }}
              style={{ ...actBtn, background: "rgba(99,102,241,0.15)", color: "#818CF8" }}>שמור</button>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>תמונה</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,0.15)", flexShrink: 0 }}>
            <img src={familyImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <label style={{ ...actBtn, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
                העלה קובץ
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => { setFamilyImage(ev.target.result); flash("!התמונה נשמרה"); };
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }} />
              </label>
              {isCustom && (
                <button onClick={() => { setFamilyImage(familyImageDefault); flash("התמונה אופסה"); }}
                  style={{ ...actBtn, background: "rgba(255,69,58,0.12)", color: "#FF453A" }}>אפס</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const GoodDeedsEditor = () => {
    const [editIdx, setEditIdx] = useState(null);
    const [editLabel, setEditLabel] = useState("");
    const [newDeed, setNewDeed] = useState("");
    const [newEmoji, setNewEmoji] = useState("✨");
    const [newWeight, setNewWeight] = useState(1);

    const togglePredefinedWeight = (i) => {
      const updated = goodDeedsConfig.map((d, idx) => idx === i ? { ...d, weight: d.weight === 2 ? 1 : 2 } : d);
      setGoodDeedsConfig(updated);
      if (isConfigured()) { skipNextRealtime.current = true; upsertSetting("goodDeedsConfig", updated).catch(console.error); }
    };

    const savePredefinedLabel = (i) => {
      if (editLabel.trim()) {
        const updated = goodDeedsConfig.map((d, idx) => idx === i ? { ...d, label: editLabel.trim() } : d);
        setGoodDeedsConfig(updated);
        if (isConfigured()) { skipNextRealtime.current = true; upsertSetting("goodDeedsConfig", updated).catch(console.error); }
      }
      setEditIdx(null);
    };

    const toggleCustomWeight = (id) => {
      setCustomGoodDeeds(prev => prev.map(d => d.id === id ? { ...d, weight: (d.weight || 1) === 2 ? 1 : 2 } : d));
    };

    const addCustom = async () => {
      if (!newDeed.trim()) return;
      const deed = { label: newDeed.trim(), emoji: newEmoji, weight: newWeight };
      if (isConfigured()) {
        try {
          skipNextRealtime.current = true;
          const saved = await insertCustomGoodDeed(deed);
          setCustomGoodDeeds(p => [...p, { ...saved, weight: newWeight }]);
        } catch (e) { console.error(e); }
      } else {
        setCustomGoodDeeds(p => [...p, { id: Date.now(), ...deed }]);
      }
      setNewDeed("");
      setNewEmoji("✨");
      setNewWeight(1);
      flash("!מעשה טוב נוסף");
    };

    const removeCustom = (id) => {
      setCustomGoodDeeds(p => p.filter(d => d.id !== id));
      if (isConfigured()) { skipNextRealtime.current = true; deleteCustomGoodDeed(id).catch(console.error); }
      flash("הוסר", "info");
    };

    const WeightBtn = ({ weight, onToggle }) => (
      <button onClick={onToggle} title="החלף בין 1× ל-2×" style={{
        background: weight === 2 ? "rgba(255,214,10,0.18)" : "rgba(255,255,255,0.06)",
        border: weight === 2 ? "1px solid rgba(255,214,10,0.35)" : "1px solid rgba(255,255,255,0.1)",
        color: weight === 2 ? "#FFD60A" : "rgba(255,255,255,0.35)",
        borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", minWidth: 30,
      }}>{weight}×</button>
    );

    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 4 }}>⭐ מעשים טובים</div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 12, marginTop: 0 }}>לחץ על שם המעשה לעריכה · לחץ על ×/2× להחלפת נקודות</p>

        {/* Predefined deeds */}
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginBottom: 5, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>ברירת מחדל</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
          {goodDeedsConfig.map((deed, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: 16 }}>{deed.emoji}</span>
              {editIdx === i ? (
                <input
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  onBlur={() => savePredefinedLabel(i)}
                  onKeyDown={e => { if (e.key === "Enter") savePredefinedLabel(i); if (e.key === "Escape") setEditIdx(null); }}
                  style={{ ...inputStyle, flex: 1, padding: "3px 8px", fontSize: 13 }}
                  autoFocus
                />
              ) : (
                <span
                  onClick={() => { setEditIdx(i); setEditLabel(deed.label); }}
                  style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.7)", cursor: "text" }}
                >{deed.label}</span>
              )}
              <WeightBtn weight={deed.weight} onToggle={() => togglePredefinedWeight(i)} />
            </div>
          ))}
        </div>

        {/* Custom deeds */}
        {customGoodDeeds.length > 0 && (
          <>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginBottom: 5, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>מותאמים אישית</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
              {customGoodDeeds.map(d => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: 16 }}>{d.emoji}</span>
                  <span style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{d.label}</span>
                  <WeightBtn weight={d.weight || 1} onToggle={() => toggleCustomWeight(d.id)} />
                  <button onClick={() => removeCustom(d.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 14 }}>✕</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Add new */}
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginBottom: 5, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>הוסף חדש</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <select value={newEmoji} onChange={e => setNewEmoji(e.target.value)} style={{ ...inputStyle, width: 50, padding: "8px 4px", textAlign: "center", flex: "none" }}>
            {["✨", "🌟", "💪", "🎯", "📖", "🧹", "🍽️", "🐕", "🌱", "🎨", "🏃", "🙏", "🏅", "🥇", "🎁", "🌈", "🦋", "💝", "🌺", "🍀", "🦸", "🎓", "🌞", "🤲", "👑", "💫", "🎵", "🏊", "⚽", "🎮", "🧠", "🔬", "🌍", "🐾", "🎤", "🍎", "🥦", "🛁", "🎪", "🌻"].map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <input value={newDeed} onChange={e => setNewDeed(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustom()}
            style={{ ...inputStyle, textAlign: "right", flex: 1, minWidth: 100 }} placeholder="שם המעשה הטוב..." />
          <button onClick={() => setNewWeight(w => w === 1 ? 2 : 1)} title="בחר נקודות" style={{
            background: newWeight === 2 ? "rgba(255,214,10,0.18)" : "rgba(255,255,255,0.06)",
            border: newWeight === 2 ? "1px solid rgba(255,214,10,0.35)" : "1px solid rgba(255,255,255,0.1)",
            color: newWeight === 2 ? "#FFD60A" : "rgba(255,255,255,0.35)",
            borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>{newWeight}×</button>
          <button onClick={addCustom} style={{ ...actBtn, background: "rgba(52,199,89,0.15)", color: "#30D158", whiteSpace: "nowrap", flexShrink: 0 }}>הוסף</button>
        </div>

        <button onClick={() => { setGoodDeedsConfig(GOOD_DEEDS_DEFAULT); if (isConfigured()) { skipNextRealtime.current = true; upsertSetting("goodDeedsConfig", GOOD_DEEDS_DEFAULT).catch(console.error); } flash("!המעשים אופסו"); }}
          style={{ ...actBtn, marginTop: 10, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
          ↺ אפס לברירת מחדל
        </button>
      </div>
    );
  };

  const BadDeedsEditor = () => {
    const [editIdx, setEditIdx] = useState(null);
    const [editLabel, setEditLabel] = useState("");
    const [newDeed, setNewDeed] = useState("");
    const [newEmoji, setNewEmoji] = useState("💢");
    const [newWeight, setNewWeight] = useState(1);

    const togglePredefinedWeight = (i) => {
      const updated = badDeedsConfig.map((d, idx) => idx === i ? { ...d, weight: d.weight === 2 ? 1 : 2 } : d);
      setBadDeedsConfig(updated);
      if (isConfigured()) { skipNextRealtime.current = true; upsertSetting("badDeedsConfig", updated).catch(console.error); }
    };

    const savePredefinedLabel = (i) => {
      if (editLabel.trim()) {
        const updated = badDeedsConfig.map((d, idx) => idx === i ? { ...d, label: editLabel.trim() } : d);
        setBadDeedsConfig(updated);
        if (isConfigured()) { skipNextRealtime.current = true; upsertSetting("badDeedsConfig", updated).catch(console.error); }
      }
      setEditIdx(null);
    };

    const toggleCustomWeight = (id) => {
      setCustomBadDeeds(prev => prev.map(d => d.id === id ? { ...d, weight: (d.weight || 1) === 2 ? 1 : 2 } : d));
    };

    const addCustom = async () => {
      if (!newDeed.trim()) return;
      const deed = { label: newDeed.trim(), emoji: newEmoji, weight: newWeight };
      if (isConfigured()) {
        try {
          skipNextRealtime.current = true;
          const saved = await insertCustomBadDeed(deed);
          setCustomBadDeeds(p => [...p, { ...saved, weight: newWeight }]);
        } catch (e) { console.error(e); }
      } else {
        setCustomBadDeeds(p => [...p, { id: Date.now(), ...deed }]);
      }
      setNewDeed("");
      setNewEmoji("💢");
      setNewWeight(1);
      flash("!מעשה לא טוב נוסף");
    };

    const removeCustom = (id) => {
      setCustomBadDeeds(p => p.filter(d => d.id !== id));
      if (isConfigured()) { skipNextRealtime.current = true; deleteCustomBadDeed(id).catch(console.error); }
      flash("הוסר", "info");
    };

    const WeightBtn = ({ weight, onToggle }) => (
      <button onClick={onToggle} title="החלף בין 1× ל-2×" style={{
        background: weight === 2 ? "rgba(255,69,58,0.18)" : "rgba(255,255,255,0.06)",
        border: weight === 2 ? "1px solid rgba(255,69,58,0.35)" : "1px solid rgba(255,255,255,0.1)",
        color: weight === 2 ? "#FF453A" : "rgba(255,255,255,0.35)",
        borderRadius: 8, padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", minWidth: 30,
      }}>{weight}×</button>
    );

    return (
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 4 }}>⚡ מעשים לא טובים</div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 12, marginTop: 0 }}>לחץ על שם המעשה לעריכה · לחץ על ×/2× להחלפת נקודות</p>

        {/* Predefined deeds */}
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginBottom: 5, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>ברירת מחדל</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
          {badDeedsConfig.map((deed, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize: 16 }}>{deed.emoji}</span>
              {editIdx === i ? (
                <input
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  onBlur={() => savePredefinedLabel(i)}
                  onKeyDown={e => { if (e.key === "Enter") savePredefinedLabel(i); if (e.key === "Escape") setEditIdx(null); }}
                  style={{ ...inputStyle, flex: 1, padding: "3px 8px", fontSize: 13 }}
                  autoFocus
                />
              ) : (
                <span
                  onClick={() => { setEditIdx(i); setEditLabel(deed.label); }}
                  style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.7)", cursor: "text" }}
                >{deed.label}</span>
              )}
              <WeightBtn weight={deed.weight} onToggle={() => togglePredefinedWeight(i)} />
            </div>
          ))}
        </div>

        {/* Custom deeds */}
        {customBadDeeds.length > 0 && (
          <>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginBottom: 5, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>מותאמים אישית</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
              {customBadDeeds.map(d => (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: 16 }}>{d.emoji}</span>
                  <span style={{ flex: 1, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{d.label}</span>
                  <WeightBtn weight={d.weight || 1} onToggle={() => toggleCustomWeight(d.id)} />
                  <button onClick={() => removeCustom(d.id)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontSize: 14 }}>✕</button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Add new */}
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginBottom: 5, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>הוסף חדש</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <select value={newEmoji} onChange={e => setNewEmoji(e.target.value)} style={{ ...inputStyle, width: 50, padding: "8px 4px", textAlign: "center", flex: "none" }}>
            {["💢", "😤", "🙉", "📱", "😫", "😠", "🤥", "⚠️", "🚫", "👎", "😡", "🤬", "😒", "🙄", "💔", "🤦", "😭", "😩", "🥱", "💥", "🔇", "🛑", "🗣️", "🤮", "😈", "👊", "🕹️", "🍬", "🧃", "🔊"].map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <input value={newDeed} onChange={e => setNewDeed(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustom()}
            style={{ ...inputStyle, textAlign: "right", flex: 1, minWidth: 100 }} placeholder="שם המעשה הלא טוב..." />
          <button onClick={() => setNewWeight(w => w === 1 ? 2 : 1)} title="בחר נקודות" style={{
            background: newWeight === 2 ? "rgba(255,69,58,0.18)" : "rgba(255,255,255,0.06)",
            border: newWeight === 2 ? "1px solid rgba(255,69,58,0.35)" : "1px solid rgba(255,255,255,0.1)",
            color: newWeight === 2 ? "#FF453A" : "rgba(255,255,255,0.35)",
            borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>{newWeight}×</button>
          <button onClick={addCustom} style={{ ...actBtn, background: "rgba(255,69,58,0.15)", color: "#FF453A", whiteSpace: "nowrap", flexShrink: 0 }}>הוסף</button>
        </div>

        <button onClick={() => { setBadDeedsConfig(BAD_DEEDS); if (isConfigured()) { skipNextRealtime.current = true; upsertSetting("badDeedsConfig", BAD_DEEDS).catch(console.error); } flash("!המעשים אופסו"); }}
          style={{ ...actBtn, marginTop: 10, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
          ↺ אפס לברירת מחדל
        </button>
      </div>
    );
  };

  const PRESET_COLORS = ["#FF6B6B","#4ECDC4","#FFD93D","#A78BFA","#34D399","#FB923C","#F472B6","#60A5FA"];
  const PRESET_EMOJIS = ["😊","🤠","🧙‍♀️","👮","🦁","🐯","🐸","🌟","🎯","🚀","👑","🎨"];

  const Settings = () => {
    const [addOpen, setAddOpen] = useState(false);
    const [newKidData, setNewKidData] = useState({ name: "", age: "", emoji: "😊", color: "#A78BFA" });
    return (
    <div>
      <div style={{ fontSize: 19, fontWeight: 700, color: "#fff", marginBottom: 20 }}>הגדרות</div>
      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 4 }}>👨‍👧‍👦 ילדים</div>
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
              <div key={kid.id} style={{ display: "flex", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: "rgba(255,255,255,0.1)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                  {kid.avatar ? <img src={kid.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : kid.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, flex: 1 }}>{kid.name} (גיל {kid.age})</span>
                    <button onClick={() => removeKid(kid)}
                      style={{ background: "none", border: "none", color: "rgba(255,69,58,0.7)", cursor: "pointer", fontSize: 16, padding: "0 4px", lineHeight: 1 }}>✕</button>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <label style={{ ...actBtn, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", cursor: "pointer" }}>
                      העלה קובץ
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = ev => {
                          setKids(prev => prev.map(k => k.id === kid.id ? { ...k, avatar: ev.target.result } : k));
                          flash("!התמונה נשמרה");
                        };
                        reader.readAsDataURL(file);
                        e.target.value = "";
                      }} />
                    </label>
                    {kid.avatar && (
                      <button onClick={() => { setKids(prev => prev.map(k => k.id === kid.id ? { ...k, avatar: null } : k)); flash("התמונה הוסרה"); }}
                        style={{ ...actBtn, background: "rgba(255,69,58,0.12)", color: "#FF453A" }}>הסר</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <button onClick={() => { const n = {}; kids.forEach(k => n[k.id] = k.name); setTmpNames(n); setEditNames(true); }}
                style={{ ...actBtn, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>ערוך שמות</button>
              <button onClick={() => setAddOpen(o => !o)}
                style={{ ...actBtn, background: "rgba(52,199,89,0.12)", color: "#30D158" }}>+ הוסף ילד</button>
            </div>
          </div>
        )}
        {addOpen && !editNames && (
          <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={newKidData.emoji} onChange={e => setNewKidData(p => ({ ...p, emoji: e.target.value }))}
                style={{ ...inputStyle, width: 52, textAlign: "center", fontSize: 20 }} maxLength={2} />
              <input value={newKidData.name} onChange={e => setNewKidData(p => ({ ...p, name: e.target.value }))}
                style={{ ...inputStyle, flex: 1 }} placeholder="שם" />
              <input value={newKidData.age} onChange={e => setNewKidData(p => ({ ...p, age: e.target.value }))}
                style={{ ...inputStyle, width: 56 }} placeholder="גיל" type="number" min="1" max="18" />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PRESET_EMOJIS.map(em => (
                <button key={em} onClick={() => setNewKidData(p => ({ ...p, emoji: em }))}
                  style={{ background: newKidData.emoji === em ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)", border: "none", borderRadius: 8, padding: "4px 6px", cursor: "pointer", fontSize: 18 }}>{em}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setNewKidData(p => ({ ...p, color: c }))}
                  style={{ width: 26, height: 26, borderRadius: "50%", background: c, border: newKidData.color === c ? "3px solid #fff" : "2px solid transparent", cursor: "pointer" }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => {
                const name = newKidData.name.trim();
                const age = parseInt(newKidData.age);
                if (!name || !age) return;
                addKid({ name, age, emoji: newKidData.emoji, color: newKidData.color, avatar: null });
                setNewKidData({ name: "", age: "", emoji: "😊", color: "#A78BFA" });
                setAddOpen(false);
              }} style={{ ...actBtn, background: "rgba(52,199,89,0.15)", color: "#30D158" }}>שמור</button>
              <button onClick={() => setAddOpen(false)} style={{ ...actBtn, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>ביטול</button>
            </div>
          </div>
        )}
      </div>

      {/* Family Image Settings */}
      <FamilyImageEditor familyImage={familyImage} setFamilyImage={setFamilyImage} familyImageDefault={FAMILY_IMAGE_DEFAULT} familyName={familyName} setFamilyName={setFamilyName} flash={flash} />

      <GoodDeedsEditor />
      <BadDeedsEditor />

      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 12 }}>💰 דמי כיס שבועיים</div>
        <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>סכום בסיס (₪)</div>
            <input
              type="number" min="0" step="0.5"
              value={allowanceConfig.baseAmount}
              onChange={e => setAllowanceConfig(p => ({ ...p, baseAmount: Number(e.target.value) }))}
              onBlur={e => { if (isConfigured()) { skipNextRealtime.current = true; upsertSetting("baseAmount", Number(e.target.value)).catch(console.error); } }}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>בונוס (₪)</div>
            <input
              type="number" min="0" step="0.5"
              value={allowanceConfig.bonusAmount}
              onChange={e => setAllowanceConfig(p => ({ ...p, bonusAmount: Number(e.target.value) }))}
              onBlur={e => { if (isConfigured()) { skipNextRealtime.current = true; upsertSetting("bonusAmount", Number(e.target.value)).catch(console.error); } }}
              style={inputStyle}
            />
          </div>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
          מקסימום: {fmtNIS(MAX)} לילד · ערך לנקודה: ₪{(MAX / TARGET_DEEDS).toFixed(3)}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 10 }}>📋 איך זה עובד</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.9 }}>
          כל ילד מתחיל מ-<b style={{ color: "#FF453A" }}>₪0</b> כל שבוע (ראשון–שבת) וצריך להרוויח את דמי הכיס!<br /><br />
          <b style={{ color: "#30D158" }}>40 מעשים טובים ראשונים</b> → מרוויחים עד <b style={{ color: "#FFD60A" }}>{fmtNIS(BASE_AMOUNT)}</b> (~6 ביום)<br /><br />
          <b style={{ color: "#FFD60A" }}>20 מעשים נוספים</b> → בונוס עד <b style={{ color: "#30D158" }}>{fmtNIS(MAX)}</b> (~3 ביום)<br /><br />
          מעשים לא טובים <b style={{ color: "#FF453A" }}>מפחיתים מהכסף</b> שנצבר (₪{(MAX / TARGET_DEEDS).toFixed(3)} לכל מעשה), אבל לא מתחת ל-₪0.<br /><br />
          🏆 מאמץ מיוחד ו-🚫 התנהגות חמורה נספרים <b style={{ color: "#FFD60A" }}>כפול 2</b>.<br /><br />
          טווח: ₪0 – {fmtNIS(MAX)} לילד.
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
  );};

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
          <img src={familyImage} alt={`משפחת ${familyName}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>⭐ מעשים טובים</div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4, fontWeight: 500 }}>
          מעקב דמי כיס · משפחת {familyName}
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
