import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// ── Helpers ──────────────────────────────────────────────────────────────────
const n   = (v) => parseFloat(v) || 0;
const f2  = (v) => n(v).toFixed(2);
const remainPct = (item) => {
  const total = n(item.opening_stock) + n(item.added_stock);
  const used  = n(item.units_sold);
  return total > 0 ? Math.min(100, Math.max(0, ((total - used) / total) * 100)) : 0;
};

const statusOf = (pct) => {
  if (pct <= 10) return { label: "Critical", pill: "#FEE2E2", pillText: "#991B1B", bar: "#EF4444" };
  if (pct <= 30) return { label: "Low",      pill: "#FEF3C7", pillText: "#92400E", bar: "#F59E0B" };
  if (pct <= 65) return { label: "Adequate", pill: "#DBEAFE", pillText: "#1E40AF", bar: "#3B82F6" };
  return             { label: "Good",     pill: "#D1FAE5", pillText: "#065F46", bar: "#10B981" };
};

const plainEnglish = (item, pct) => {
  const opening = n(item.opening_stock);
  const added   = n(item.added_stock);
  const used    = n(item.units_sold);
  const closing = n(item.stock_quantity);
  const unit    = item.unit_measure || "units";
  let verdict   = pct <= 10 ? "⚠️ Critically low — restock immediately."
                : pct <= 30 ? "Running low — consider restocking soon."
                : pct <= 65 ? "Stock is at an adequate level."
                :             "Stock levels are healthy.";
  return `${item.item_name} opened with ${f2(opening)} ${unit}.`
    + (added > 0 ? ` ${f2(added)} ${unit} was received.` : "")
    + ` Sales consumed ${f2(used)} ${unit}, leaving ${f2(closing)} ${unit} (${pct.toFixed(1)}% remaining). ${verdict}`;
};

// ── UI primitives ─────────────────────────────────────────────────────────────
const Pill = ({ label, pill, pillText }) => (
  <span style={{ background: pill, color: pillText, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 99 }}>{label}</span>
);

const Bar = ({ pct, color }) => (
  <div style={{ height: 6, borderRadius: 4, background: "#E5E7EB", overflow: "hidden", margin: "10px 0 0" }}>
    <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width .5s" }} />
  </div>
);

const Cell = ({ label, value, bold }) => (
  <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 14px" }}>
    <div style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: bold ? 600 : 400, color: bold ? "#111827" : "#374151" }}>{value}</div>
  </div>
);

const StatCard = ({ label, value, color }) => (
  <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, padding: "16px 20px", textAlign: "center" }}>
    <div style={{ fontSize: 11, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 700, color: color || "#111827" }}>{value}</div>
  </div>
);

const Btn = ({ onClick, children, variant = "ghost", disabled }) => {
  const styles = {
    ghost:   { padding: "8px 16px", border: "1px solid #D1D5DB", background: "#fff",     color: "#374151" },
    primary: { padding: "8px 18px", border: "none",               background: "#2563EB",  color: "#fff", fontWeight: 600 },
    green:   { padding: "8px 18px", border: "none",               background: "#059669",  color: "#fff", fontWeight: 600 },
    red:     { padding: "8px 18px", border: "none",               background: "#B91C1C",  color: "#fff", fontWeight: 600 },
    blue:    { padding: "6px 12px", border: "1px solid #BFDBFE",  background: "#EFF6FF",  color: "#1D4ED8", fontWeight: 500, fontSize: 12 },
    sm:      { padding: "6px 12px", border: "1px solid #D1D5DB",  background: "#F9FAFB",  color: "#374151", fontSize: 12 },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...styles[variant], borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", fontSize: 13, opacity: disabled ? .65 : 1 }}>
      {children}
    </button>
  );
};

// ── Modal shell ───────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children, width = 380 }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: "#fff", borderRadius: 14, padding: "28px 30px", width, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,.22)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9CA3AF", lineHeight: 1 }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, value, onChange, type = "text" }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 13, color: "#374151", display: "block", marginBottom: 5 }}>{label}</label>
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14, outline: "none" }} />
  </div>
);

const ErrMsg = ({ msg }) => msg ? <p style={{ color: "#DC2626", fontSize: 12, margin: "6px 0 0" }}>{msg}</p> : null;

const ModalFooter = ({ onClose, onSave, saveLabel, busy, saveColor = "primary" }) => (
  <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
    <Btn onClick={onClose}>Cancel</Btn>
    <Btn onClick={onSave} variant={saveColor} disabled={busy}>{busy ? "Saving…" : saveLabel}</Btn>
  </div>
);

// ── Restock modal ─────────────────────────────────────────────────────────────
function RestockModal({ item, onClose, onDone }) {
  const [qty, setQty]   = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");

  const save = async () => {
    const amount = parseFloat(qty);
    if (!amount || amount <= 0) { setErr("Enter a positive quantity."); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/inventory/add-stock`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.id, quantity_to_add: amount }),
      });
      const d = await r.json();
      if (d.success) { onDone(); onClose(); } else setErr("Server error.");
    } catch { setErr("Network error."); }
    setBusy(false);
  };

  return (
    <Modal title={`Restock — ${item.item_name}`} onClose={onClose}>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "#6B7280" }}>
        Current balance: <strong style={{ color: "#111827" }}>{f2(item.stock_quantity)} {item.unit_measure}</strong>
      </p>
      <Field label={`Quantity to add (${item.unit_measure})`} value={qty} onChange={v => { setQty(v); setErr(""); }} type="number" />
      <ErrMsg msg={err} />
      <ModalFooter onClose={onClose} onSave={save} saveLabel="Confirm restock" busy={busy} />
    </Modal>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditModal({ item, onClose, onDone }) {
  const [form, setForm] = useState({ item_name: item.item_name, unit_measure: item.unit_measure || "", opening_stock: item.opening_stock, added_stock: item.added_stock });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/inventory/update-item`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "user-role": localStorage.getItem("userRole") || "" },
        body: JSON.stringify({ id: item.id, ...form, opening_stock: Number(form.opening_stock), added_stock: Number(form.added_stock) }),
      });
      const d = await r.json();
      if (d.success) { onDone(); onClose(); } else setErr(d.message || "Error.");
    } catch { setErr("Network error."); }
    setBusy(false);
  };

  return (
    <Modal title={`Edit — ${item.item_name}`} onClose={onClose}>
      <Field label="Item name"     value={form.item_name}     onChange={set("item_name")} />
      <Field label="Unit measure"  value={form.unit_measure}  onChange={set("unit_measure")} />
      <Field label="Opening stock" value={form.opening_stock} onChange={set("opening_stock")} type="number" />
      <Field label="Added stock"   value={form.added_stock}   onChange={set("added_stock")}   type="number" />
      <ErrMsg msg={err} />
      <ModalFooter onClose={onClose} onSave={save} saveLabel="Save changes" busy={busy} />
    </Modal>
  );
}

// ── Add new item modal ────────────────────────────────────────────────────────
function AddModal({ onClose, onDone }) {
  const [form, setForm] = useState({ item_name: "", unit_measure: "kg", stock_quantity: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState("");
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.item_name.trim() || !form.stock_quantity) { setErr("All fields are required."); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API}/api/inventory/add-new`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, stock_quantity: Number(form.stock_quantity) }),
      });
      const d = await r.json();
      if (d.success) { onDone(); onClose(); } else setErr("Error adding item.");
    } catch { setErr("Network error."); }
    setBusy(false);
  };

  return (
    <Modal title="Add new inventory item" onClose={onClose}>
      <Field label="Item name"         value={form.item_name}      onChange={set("item_name")} />
      <Field label="Unit of measure"   value={form.unit_measure}   onChange={set("unit_measure")} />
      <Field label="Opening stock qty" value={form.stock_quantity} onChange={set("stock_quantity")} type="number" />
      <ErrMsg msg={err} />
      <ModalFooter onClose={onClose} onSave={save} saveLabel="Add item" busy={busy} saveColor="green" />
    </Modal>
  );
}

// ── Audit modal ───────────────────────────────────────────────────────────────
function AuditModal({ onClose }) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/inventory/audit-report`)
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <Modal title="Full audit report" onClose={onClose} width={620}>
      {loading ? (
        <p style={{ color: "#6B7280", textAlign: "center", padding: "2rem 0" }}>Loading audit…</p>
      ) : data.length === 0 ? (
        <p style={{ color: "#6B7280", textAlign: "center" }}>No audit data found.</p>
      ) : data.map((row, i) => (
        <div key={i} style={{ borderBottom: "1px solid #F3F4F6", padding: "14px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{row.item}</span>
            <Pill label={row.hasShortage ? "⚠ Shortage" : `Should have: ${row.shouldBe} ${row.unit}`}
                  pill={row.hasShortage ? "#FEE2E2" : "#D1FAE5"}
                  pillText={row.hasShortage ? "#991B1B" : "#065F46"} />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280", lineHeight: 1.65 }}>{row.message}</p>
        </div>
      ))}
    </Modal>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function InventoryPage() {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState("All");
  const [expanded, setExpanded]   = useState({});
  const [restock, setRestock]     = useState(null);
  const [editing, setEditing]     = useState(null);
  const [showAdd, setShowAdd]     = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [lastUpdated, setLast]    = useState(null);
  const [resetMsg, setResetMsg]   = useState("");

  const isAdmin = (localStorage.getItem("userRole") || "") === "Admin";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/api/inventory`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      if (!Array.isArray(raw)) throw new Error("API did not return an array");
      setItems(raw);
      setLast(new Date());
    } catch (e) {
      setError(`Could not load inventory: ${e.message}`);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Enrich with computed pct + status
  const enriched = items.map(item => {
    const rp = remainPct(item);
    return { ...item, _pct: rp, _status: statusOf(rp) };
  });

  const counts = {
    critical: enriched.filter(i => i._pct <= 10).length,
    low:      enriched.filter(i => i._pct > 10 && i._pct <= 30).length,
    adequate: enriched.filter(i => i._pct > 30 && i._pct <= 65).length,
    good:     enriched.filter(i => i._pct > 65).length,
  };

  const FILTERS = ["All", "Critical", "Low", "Adequate", "Good"];
  const visible = enriched.filter(item =>
    item.item_name.toLowerCase().includes(search.toLowerCase()) &&
    (filter === "All" || item._status.label === filter)
  );

  const toggle    = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const runReset = async () => {
    if (!window.confirm("Roll over opening stock for all items? This cannot be undone.")) return;
    setResetMsg("Running…");
    try {
      const r = await fetch(`${API}/api/inventory/weekly-reset`, {
        method: "POST", headers: { "user-role": localStorage.getItem("userRole") || "" },
      });
      const d = await r.json();
      setResetMsg(d.success ? "✅ Weekly reset done." : `❌ ${d.message || "Error"}`);
      if (d.success) load();
    } catch { setResetMsg("❌ Network error."); }
  };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1080, margin: "0 auto", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: "#111827" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#111827" }}>Inventory</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9CA3AF" }}>
            {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : "Fetching data…"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn onClick={() => setShowAudit(true)}>📋 Audit report</Btn>
          {isAdmin && <Btn onClick={() => setShowAdd(true)} variant="green">+ Add item</Btn>}
          <Btn onClick={load}>↻ Refresh</Btn>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "14px 18px", marginBottom: 20, color: "#991B1B", fontSize: 14 }}>
          {error} &mdash; <button onClick={load} style={{ background: "none", border: "none", color: "#2563EB", cursor: "pointer", fontSize: 14, padding: 0, textDecoration: "underline" }}>Retry</button>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 28 }}>
        <StatCard label="Total items"   value={items.length} />
        <StatCard label="Critical ≤10%" value={counts.critical} color={counts.critical > 0 ? "#DC2626" : "#111827"} />
        <StatCard label="Low ≤30%"      value={counts.low}      color={counts.low > 0 ? "#D97706" : "#111827"} />
        <StatCard label="Adequate"      value={counts.adequate} color="#2563EB" />
        <StatCard label="Good >65%"     value={counts.good}     color="#059669" />
      </div>

      {/* ── Search + filter row ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap", alignItems: "center" }}>
        <input type="text" placeholder="Search item…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 14, width: 220, outline: "none" }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "7px 16px", borderRadius: 20, fontSize: 13, cursor: "pointer",
              border: filter === f ? "none" : "1px solid #D1D5DB",
              background: filter === f ? "#2563EB" : "#fff",
              color: filter === f ? "#fff" : "#374151",
              fontWeight: filter === f ? 600 : 400,
            }}>{f}</button>
          ))}
        </div>
        {(search || filter !== "All") && (
          <button onClick={() => { setSearch(""); setFilter("All"); }}
            style={{ background: "none", border: "none", color: "#6B7280", cursor: "pointer", fontSize: 13 }}>
            Clear
          </button>
        )}
      </div>

      {/* ── Item cards ── */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "5rem 0", color: "#9CA3AF", fontSize: 15 }}>Loading inventory…</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: "5rem 0", color: "#9CA3AF", fontSize: 15 }}>
          {items.length === 0 ? "No items found. Make sure your API is reachable and VITE_API_URL is set." : "No items match your search/filter."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {visible.map(item => {
            const st  = item._status;
            const exp = expanded[item.id];
            return (
              <div key={item.id} style={{
                background: "#fff",
                border: `1px solid ${item._pct <= 10 ? "#FECACA" : "#E5E7EB"}`,
                borderRadius: 12, padding: "18px 22px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}>
                {/* Top row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 16, flex: 1, minWidth: 100 }}>{item.item_name}</span>
                  <Pill {...st} />
                  <span style={{ fontSize: 12, color: "#9CA3AF", background: "#F3F4F6", padding: "2px 8px", borderRadius: 6 }}>{item.unit_measure}</span>
                  <Btn variant="sm" onClick={() => toggle(item.id)}>{exp ? "▲ Hide" : "▼ Summary"}</Btn>
                  <Btn variant="blue" onClick={() => setRestock(item)}>+ Restock</Btn>
                  {isAdmin && <Btn variant="sm" onClick={() => setEditing(item)}>Edit</Btn>}
                </div>

                {/* Progress bar */}
                <Bar pct={item._pct} color={st.bar} />

                {/* Numbers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))", gap: 8, marginTop: 14 }}>
                  <Cell label="Opening"       value={`${f2(item.opening_stock)} ${item.unit_measure}`} />
                  <Cell label="Received"      value={`${f2(item.added_stock)} ${item.unit_measure}`} />
                  <Cell label="Sold / used"   value={`${f2(item.units_sold)} ${item.unit_measure}`} />
                  <Cell label="Closing"       value={`${f2(item.stock_quantity)} ${item.unit_measure}`} bold />
                  <Cell label="% remaining"   value={`${item._pct.toFixed(1)}%`} bold />
                </div>

                {/* Plain English */}
                {exp && (
                  <div style={{ marginTop: 14, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "13px 16px", fontSize: 13, lineHeight: 1.8, color: "#14532D" }}>
                    <strong style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: ".07em", color: "#15803D", marginBottom: 5 }}>Plain English Summary</strong>
                    {plainEnglish(item, item._pct)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Admin reset ── */}
      {isAdmin && !loading && (
        <div style={{ marginTop: 36, paddingTop: 24, borderTop: "1px solid #F3F4F6" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700 }}>Weekly stock reset</h3>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6B7280" }}>
            Rolls current closing balances into next week's opening stock and zeros added stock. Run every Sunday night.
          </p>
          <Btn variant="red" onClick={runReset}>Run weekly reset</Btn>
          {resetMsg && <p style={{ marginTop: 10, fontSize: 13, color: "#374151" }}>{resetMsg}</p>}
        </div>
      )}

      {/* ── Modals ── */}
      {restock   && <RestockModal item={restock}  onClose={() => setRestock(null)}   onDone={load} />}
      {editing   && <EditModal    item={editing}  onClose={() => setEditing(null)}   onDone={load} />}
      {showAdd   && <AddModal                     onClose={() => setShowAdd(false)}   onDone={load} />}
      {showAudit && <AuditModal                   onClose={() => setShowAudit(false)} />}
    </div>
  );
}