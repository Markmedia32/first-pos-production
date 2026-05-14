import { useState, useEffect, useCallback } from "react";

// ─── CONFIG ─────────────────────────────────────────────────────────────────
const API = "http://localhost:5000";

// ─── HELPERS ────────────────────────────────────────────────────────────────
const fmt  = (n, d = 2) => Number(n || 0).toFixed(d);
const fmtK = (n)        => Number(n || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const userRole = () => localStorage.getItem("userRole") || "";

// Status colour
const statusColor = (pct) => {
    if (pct <= 10)  return { bg: "#FCEBEB", text: "#A32D2D", label: "Critical" };
    if (pct <= 25)  return { bg: "#FAEEDA", text: "#854F0B", label: "Low" };
    if (pct <= 60)  return { bg: "#EAF3DE", text: "#3B6D11", label: "Adequate" };
    return             { bg: "#E1F5EE", text: "#0F6E56", label: "Good" };
};

// Plain‑English summary for one inventory item
const plainEnglish = (item) => {
    const closing  = Number(item.closing_balance);
    const opening  = Number(item.opening_stock);
    const added    = Number(item.added_stock);
    const used     = Number(item.units_sold);
    const unit     = item.unit_measure || "units";
    const pct      = item.stock_pct;
    const name     = item.item_name;

    let status = "";
    if (pct <= 10)       status = "⚠️ Critically low — restock immediately.";
    else if (pct <= 25)  status = "Stock is running low — consider restocking soon.";
    else if (pct <= 60)  status = "Stock is at an adequate level.";
    else                 status = "Stock levels are healthy.";

    return `${name} started the period with ${fmt(opening)} ${unit}. ` +
           `${added > 0 ? `An additional ${fmt(added)} ${unit} was received. ` : ""}` +
           `Sales consumed ${fmt(used)} ${unit}, leaving a closing balance of ${fmt(closing)} ${unit} ` +
           `(${fmt(pct, 1)}% of total available). ${status}`;
};

// ─── SUB‑COMPONENTS ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }) {
    return (
        <div style={{
            background: "var(--color-background-secondary)",
            borderRadius: 8,
            padding: "14px 18px",
            minWidth: 0,
        }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 500, color: color || "var(--color-text-primary)" }}>{value}</p>
            {sub && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>{sub}</p>}
        </div>
    );
}

function Badge({ label, bg, text }) {
    return (
        <span style={{
            background: bg, color: text,
            fontSize: 11, fontWeight: 500,
            padding: "2px 9px", borderRadius: 20,
            display: "inline-block", whiteSpace: "nowrap",
        }}>{label}</span>
    );
}

function ProgressBar({ pct, color }) {
    return (
        <div style={{ height: 5, background: "#E5E7EB", borderRadius: 4, marginTop: 4, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.4s" }} />
        </div>
    );
}

function Spinner() {
    return (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--color-text-secondary)", fontSize: 14 }}>
            Loading inventory…
        </div>
    );
}

// ─── MODAL: RESTOCK ──────────────────────────────────────────────────────────
function RestockModal({ item, onClose, onSuccess }) {
    const [qty, setQty]     = useState("");
    const [busy, setBusy]   = useState(false);
    const [error, setError] = useState("");

    const submit = async () => {
        const amount = parseFloat(qty);
        if (!amount || amount <= 0) { setError("Enter a valid quantity."); return; }
        setBusy(true);
        try {
            const r = await fetch(`${API}/api/inventory/add-stock`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ item_id: item.id, quantity_to_add: amount }),
            });
            const d = await r.json();
            if (d.success) { onSuccess(); onClose(); }
            else setError("Server error — try again.");
        } catch { setError("Network error."); }
        setBusy(false);
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: "28px 32px", width: 360, border: "0.5px solid var(--color-border-tertiary)" }}>
                <h3 style={{ margin: "0 0 4px", fontWeight: 500, fontSize: 17 }}>Add stock — {item.item_name}</h3>
                <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--color-text-secondary)" }}>
                    Current closing balance: <strong>{fmt(item.closing_balance)} {item.unit_measure}</strong>
                </p>
                <label style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Quantity to add ({item.unit_measure})</label>
                <input
                    type="number" min="0" step="0.01"
                    value={qty} onChange={e => { setQty(e.target.value); setError(""); }}
                    style={{ display: "block", width: "100%", marginTop: 6, marginBottom: 4, boxSizing: "border-box" }}
                    placeholder={`e.g. 5`}
                    autoFocus
                />
                {error && <p style={{ color: "#A32D2D", fontSize: 12, margin: "4px 0 0" }}>{error}</p>}
                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                    <button onClick={onClose} style={{ background: "transparent" }}>Cancel</button>
                    <button onClick={submit} disabled={busy} style={{ background: "#185FA5", color: "#fff", border: "none", padding: "8px 22px", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>
                        {busy ? "Saving…" : "Confirm restock"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── MODAL: EDIT ITEM (Admin only) ───────────────────────────────────────────
function EditModal({ item, onClose, onSuccess }) {
    const [form, setForm] = useState({
        item_name:     item.item_name,
        unit_measure:  item.unit_measure,
        opening_stock: item.opening_stock,
        added_stock:   item.added_stock,
    });
    const [busy, setBusy]   = useState(false);
    const [error, setError] = useState("");

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const submit = async () => {
        setBusy(true);
        try {
            const r = await fetch(`${API}/api/inventory/update-item`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "user-role": userRole() },
                body: JSON.stringify({ id: item.id, ...form, opening_stock: Number(form.opening_stock), added_stock: Number(form.added_stock) }),
            });
            const d = await r.json();
            if (d.success) { onSuccess(); onClose(); }
            else setError(d.message || "Server error.");
        } catch { setError("Network error."); }
        setBusy(false);
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: "28px 32px", width: 400, border: "0.5px solid var(--color-border-tertiary)" }}>
                <h3 style={{ margin: "0 0 20px", fontWeight: 500 }}>Edit — {item.item_name}</h3>
                {[
                    { label: "Item name",     key: "item_name",     type: "text"   },
                    { label: "Unit",          key: "unit_measure",  type: "text"   },
                    { label: "Opening stock", key: "opening_stock", type: "number" },
                    { label: "Added stock",   key: "added_stock",   type: "number" },
                ].map(f => (
                    <div key={f.key} style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>{f.label}</label>
                        <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                            style={{ width: "100%", boxSizing: "border-box" }} />
                    </div>
                ))}
                {error && <p style={{ color: "#A32D2D", fontSize: 12 }}>{error}</p>}
                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                    <button onClick={onClose}>Cancel</button>
                    <button onClick={submit} disabled={busy} style={{ background: "#185FA5", color: "#fff", border: "none", padding: "8px 22px", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>
                        {busy ? "Saving…" : "Save changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── MODAL: ADD NEW ITEM ─────────────────────────────────────────────────────
function AddItemModal({ onClose, onSuccess }) {
    const [form, setForm] = useState({ item_name: "", unit_measure: "kg", stock_quantity: "" });
    const [busy, setBusy]   = useState(false);
    const [error, setError] = useState("");

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const submit = async () => {
        if (!form.item_name || !form.stock_quantity) { setError("All fields are required."); return; }
        setBusy(true);
        try {
            const r = await fetch(`${API}/api/inventory/add-new`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, stock_quantity: Number(form.stock_quantity) }),
            });
            const d = await r.json();
            if (d.success) { onSuccess(); onClose(); }
            else setError("Server error.");
        } catch { setError("Network error."); }
        setBusy(false);
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: "28px 32px", width: 380, border: "0.5px solid var(--color-border-tertiary)" }}>
                <h3 style={{ margin: "0 0 20px", fontWeight: 500 }}>Add new inventory item</h3>
                {[
                    { label: "Item name",          key: "item_name",      type: "text"   },
                    { label: "Unit of measure",     key: "unit_measure",   type: "text"   },
                    { label: "Opening stock qty",   key: "stock_quantity", type: "number" },
                ].map(f => (
                    <div key={f.key} style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 13, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>{f.label}</label>
                        <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                            style={{ width: "100%", boxSizing: "border-box" }} />
                    </div>
                ))}
                {error && <p style={{ color: "#A32D2D", fontSize: 12 }}>{error}</p>}
                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                    <button onClick={onClose}>Cancel</button>
                    <button onClick={submit} disabled={busy} style={{ background: "#0F6E56", color: "#fff", border: "none", padding: "8px 22px", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>
                        {busy ? "Adding…" : "Add item"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── MODAL: YIELD RULES ──────────────────────────────────────────────────────
function YieldRulesModal({ onClose }) {
    const [rules, setRules]   = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API}/api/inventory/yield-rules`)
            .then(r => r.json())
            .then(d => { setRules(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "var(--color-background-primary)", borderRadius: 12, padding: "28px 32px", width: 560, maxHeight: "80vh", overflow: "auto", border: "0.5px solid var(--color-border-tertiary)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontWeight: 500 }}>Yield rules</h3>
                    <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 20, color: "var(--color-text-secondary)" }}>✕</button>
                </div>
                <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 0, marginBottom: 16 }}>
                    These rules define how many portions of a menu item are produced per unit of raw material.
                    For example: "1 kg of Beans → 4 portions of Beans dish".
                </p>
                {loading ? <Spinner /> : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                                {["Menu item", "Raw material", "Portions per unit"].map(h => (
                                    <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontWeight: 500, color: "var(--color-text-secondary)" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rules.map((r, i) => (
                                <tr key={i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                                    <td style={{ padding: "8px 10px" }}>{r.menu_item_name}</td>
                                    <td style={{ padding: "8px 10px", color: "var(--color-text-secondary)" }}>{r.material_name}</td>
                                    <td style={{ padding: "8px 10px" }}>{fmt(r.yield_per_unit)} portions / {r.unit || "unit"}</td>
                                </tr>
                            ))}
                            {rules.length === 0 && (
                                <tr><td colSpan={3} style={{ padding: "16px 10px", color: "var(--color-text-secondary)", textAlign: "center" }}>No rules found.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function InventoryPage() {
    const [items, setItems]           = useState([]);
    const [loading, setLoading]       = useState(true);
    const [search, setSearch]         = useState("");
    const [filter, setFilter]         = useState("all");   // all | critical | low | adequate | good
    const [restock, setRestock]       = useState(null);    // item being restocked
    const [editing, setEditing]       = useState(null);    // item being edited
    const [showAdd, setShowAdd]       = useState(false);
    const [showYield, setShowYield]   = useState(false);
    const [expanded, setExpanded]     = useState({});      // plain-English toggled rows
    const [lastUpdated, setLastUpdated] = useState(null);

    const isAdmin = userRole() === "Admin";

    // Derive closing balance from what the API returns
    const processItems = (raw) => raw.map(item => {
        const opening  = Number(item.opening_stock  || 0);
        const added    = Number(item.added_stock    || 0);
        const sold     = Number(item.units_sold     || 0);
        const total    = opening + added;
        const closing  = Math.max(0, total - sold);
        const pct      = total > 0 ? (closing / total) * 100 : 0;
        return { ...item, closing_balance: closing, total_available: total, stock_pct: pct };
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch(`${API}/api/inventory`);
            const d = await r.json();
            setItems(processItems(d));
            setLastUpdated(new Date());
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Filtered + searched list
    const visible = items.filter(item => {
        const matchSearch = item.item_name.toLowerCase().includes(search.toLowerCase());
        if (!matchSearch) return false;
        if (filter === "all") return true;
        const { label } = statusColor(item.stock_pct);
        return label.toLowerCase() === filter;
    });

    // Summary stats
    const critical = items.filter(i => i.stock_pct <= 10).length;
    const low      = items.filter(i => i.stock_pct > 10 && i.stock_pct <= 25).length;
    const adequate = items.filter(i => i.stock_pct > 25 && i.stock_pct <= 60).length;
    const good     = items.filter(i => i.stock_pct > 60).length;

    const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

    return (
        <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto", fontFamily: "var(--font-sans)" }}>
            <h2 aria-hidden="true" style={{ display: "none" }}>Inventory management</h2>

            {/* ── Header ── */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h2 style={{ margin: 0, fontWeight: 500, fontSize: 22 }}>Inventory</h2>
                    {lastUpdated && (
                        <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--color-text-secondary)" }}>
                            Last refreshed {lastUpdated.toLocaleTimeString()}
                        </p>
                    )}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={() => setShowYield(true)}>
                        📋 Yield rules
                    </button>
                    {isAdmin && (
                        <button onClick={() => setShowAdd(true)} style={{ background: "#0F6E56", color: "#fff", border: "none", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>
                            + Add item
                        </button>
                    )}
                    <button onClick={load} style={{ background: "transparent" }}>
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {/* ── Stat cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
                <StatCard label="Total items"     value={items.length}  />
                <StatCard label="Critical (≤10%)" value={critical}  color={critical  > 0 ? "#A32D2D" : undefined} />
                <StatCard label="Low (≤25%)"      value={low}       color={low       > 0 ? "#854F0B" : undefined} />
                <StatCard label="Adequate"        value={adequate}  />
                <StatCard label="Good (>60%)"     value={good}      color="#0F6E56" />
            </div>

            {/* ── Filters + search ── */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
                <input
                    type="text"
                    placeholder="Search item…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: 220 }}
                />
                {["all", "critical", "low", "adequate", "good"].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            background: filter === f ? "#185FA5" : "transparent",
                            color: filter === f ? "#fff" : "var(--color-text-secondary)",
                            border: filter === f ? "none" : "0.5px solid var(--color-border-tertiary)",
                            borderRadius: 20,
                            padding: "5px 16px",
                            cursor: "pointer",
                            fontSize: 13,
                            textTransform: "capitalize",
                        }}
                    >
                        {f}
                    </button>
                ))}
                {(search || filter !== "all") && (
                    <button onClick={() => { setSearch(""); setFilter("all"); }} style={{ fontSize: 13, color: "var(--color-text-secondary)", background: "transparent", border: "none", cursor: "pointer" }}>
                        Clear
                    </button>
                )}
            </div>

            {/* ── Item list ── */}
            {loading ? <Spinner /> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {visible.length === 0 && (
                        <p style={{ color: "var(--color-text-secondary)", textAlign: "center", padding: "2rem 0" }}>No items match your filter.</p>
                    )}
                    {visible.map(item => {
                        const sc  = statusColor(item.stock_pct);
                        const exp = expanded[item.id];
                        return (
                            <div key={item.id} style={{
                                background: "var(--color-background-primary)",
                                border: "0.5px solid var(--color-border-tertiary)",
                                borderRadius: 12,
                                padding: "16px 20px",
                            }}>
                                {/* Row 1 — name + badge + actions */}
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                    <span style={{ fontWeight: 500, fontSize: 15, flex: 1 }}>{item.item_name}</span>
                                    <Badge label={sc.label} bg={sc.bg} text={sc.text} />
                                    <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{item.unit_measure}</span>
                                    <button onClick={() => toggleExpand(item.id)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, color: "#185FA5" }}>
                                        {exp ? "Hide summary ▲" : "View summary ▼"}
                                    </button>
                                    <button onClick={() => setRestock(item)} style={{ background: "transparent", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontSize: 13 }}>
                                        + Restock
                                    </button>
                                    {isAdmin && (
                                        <button onClick={() => setEditing(item)} style={{ background: "transparent", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontSize: 13 }}>
                                            Edit
                                        </button>
                                    )}
                                </div>

                                {/* Row 2 — progress bar */}
                                <ProgressBar pct={item.stock_pct} color={sc.text} />

                                {/* Row 3 — number columns */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8, marginTop: 14 }}>
                                    {[
                                        { label: "Opening",  value: fmt(item.opening_stock) },
                                        { label: "Received", value: fmt(item.added_stock)   },
                                        { label: "Total in", value: fmt(item.total_available) },
                                        { label: "Sold/Used",value: fmt(item.units_sold)    },
                                        { label: "Closing",  value: fmt(item.closing_balance), bold: true },
                                        { label: "% left",   value: `${fmt(item.stock_pct, 1)}%` },
                                    ].map(col => (
                                        <div key={col.label} style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "8px 12px" }}>
                                            <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{col.label}</p>
                                            <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: col.bold ? 500 : 400 }}>{col.value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Row 4 — plain English (expandable) */}
                                {exp && (
                                    <div style={{
                                        marginTop: 14,
                                        background: "#F1EFE8",
                                        borderRadius: 8,
                                        padding: "12px 16px",
                                        fontSize: 13,
                                        lineHeight: 1.7,
                                        color: "#2C2C2A",
                                    }}>
                                        <strong style={{ display: "block", marginBottom: 4, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "#5F5E5A" }}>Summary</strong>
                                        {plainEnglish(item)}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Admin: Weekly reset ── */}
            {isAdmin && !loading && (
                <div style={{ marginTop: 32, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 20 }}>
                    <h3 style={{ fontWeight: 500, fontSize: 15, margin: "0 0 8px" }}>Admin actions</h3>
                    <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 12px" }}>
                        The weekly reset rolls closing balances forward as new opening stock for the next week, then zeroes out the "added stock" column. Run this every Sunday night.
                    </p>
                    <WeeklyResetButton />
                </div>
            )}

            {/* ── Modals ── */}
            {restock   && <RestockModal  item={restock}  onClose={() => setRestock(null)}  onSuccess={load} />}
            {editing   && <EditModal     item={editing}  onClose={() => setEditing(null)}  onSuccess={load} />}
            {showAdd   && <AddItemModal                  onClose={() => setShowAdd(false)}  onSuccess={load} />}
            {showYield && <YieldRulesModal               onClose={() => setShowYield(false)} />}
        </div>
    );
}

// ─── WEEKLY RESET BUTTON ─────────────────────────────────────────────────────
function WeeklyResetButton() {
    const [busy, setBusy]     = useState(false);
    const [result, setResult] = useState("");

    const run = async () => {
        if (!window.confirm("This will roll over opening stock for all items. Continue?")) return;
        setBusy(true); setResult("");
        try {
            const r = await fetch(`${API}/api/inventory/weekly-reset`, {
                method: "POST",
                headers: { "user-role": localStorage.getItem("userRole") || "" },
            });
            const d = await r.json();
            setResult(d.success ? "✅ Weekly reset completed successfully." : `❌ ${d.message || "Error"}`);
        } catch { setResult("❌ Network error."); }
        setBusy(false);
    };

    return (
        <div>
            <button onClick={run} disabled={busy} style={{ background: "#712B13", color: "#fff", border: "none", padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>
                {busy ? "Running reset…" : "Run weekly stock reset"}
            </button>
            {result && <p style={{ marginTop: 8, fontSize: 13, color: "var(--color-text-secondary)" }}>{result}</p>}
        </div>
    );
}