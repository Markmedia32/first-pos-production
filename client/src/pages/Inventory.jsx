import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Package, Plus, AlertCircle, RefreshCcw, Edit, Save, X,
  ArrowUp, ArrowDown, BarChart3, Calendar, ChevronLeft,
  ChevronRight, TrendingDown, TrendingUp, Clock, Filter,
  Eye, Activity, Layers, AlertTriangle, CheckCircle2,
  History, Boxes
} from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL;

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtISO = (d) => {
  const dt = new Date(d);
  const offset = dt.getTimezoneOffset();
  return new Date(dt.getTime() - offset * 60000).toISOString().split('T')[0];
};
const today = () => fmtISO(new Date());

const getWeekDays = (refDate = new Date()) => {
  const d = new Date(refDate);
  const day = d.getDay();
  const sunday = new Date(d.setDate(d.getDate() - day));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(sunday);
    dd.setDate(sunday.getDate() + i);
    return fmtISO(dd);
  });
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ─────────────────────────────────────────
   MINI COMPONENTS
───────────────────────────────────────── */
const Badge = ({ children, color = 'green' }) => {
  const map = {
    green: { bg: '#d1fae5', fg: '#065f46' },
    red:   { bg: '#fee2e2', fg: '#991b1b' },
    amber: { bg: '#fef3c7', fg: '#92400e' },
    blue:  { bg: '#dbeafe', fg: '#1e40af' },
    gray:  { bg: '#f3f4f6', fg: '#374151' },
  };
  const c = map[color] || map.green;
  return (
    <span style={{
      background: c.bg, color: c.fg,
      fontSize: 10, fontWeight: 700, padding: '3px 8px',
      borderRadius: 20, letterSpacing: '0.5px', whiteSpace: 'nowrap'
    }}>{children}</span>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, color = '#0071e3', trend }) => (
  <div style={{
    background: '#fff', borderRadius: 16, padding: '20px 24px',
    boxShadow: '0 1px 3px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.04)',
    display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 160
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Icon size={18} color={color} />
      </div>
      {trend !== undefined && (
        <span style={{ fontSize: 12, color: trend >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}
        </span>
      )}
    </div>
    <div>
      <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#111', lineHeight: 1 }}>{value}</p>
      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888', fontWeight: 500 }}>{label}</p>
      {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>{sub}</p>}
    </div>
  </div>
);

/* ─────────────────────────────────────────
   DATE NAVIGATOR
───────────────────────────────────────── */
const DateNavigator = ({ selectedDate, onDateChange }) => {
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDays = getWeekDays(new Date(
    new Date().setDate(new Date().getDate() + weekOffset * 7)
  ));

  const weekLabel = () => {
    const start = new Date(weekDays[0]);
    const end = new Date(weekDays[6]);
    if (weekOffset === 0) return 'This Week';
    if (weekOffset === -1) return 'Last Week';
    return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  };

  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '16px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.04)',
      marginBottom: 24
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Calendar size={16} color="#666" />
        <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{weekLabel()}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setWeekOffset(o => o - 1)} style={navBtnStyle}>
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => { setWeekOffset(0); onDateChange(today()); }}
            style={{ ...navBtnStyle, fontSize: 11, padding: '4px 10px', fontWeight: 700 }}
          >
            Today
          </button>
          <button
            onClick={() => setWeekOffset(o => Math.min(o + 1, 0))}
            disabled={weekOffset >= 0}
            style={{ ...navBtnStyle, opacity: weekOffset >= 0 ? 0.3 : 1 }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {weekDays.map((d, i) => {
          const isSelected = d === selectedDate;
          const isTod = d === today();
          const isFuture = d > today();
          return (
            <button
              key={d}
              disabled={isFuture}
              onClick={() => onDateChange(d)}
              style={{
                border: isSelected ? '2px solid #0071e3' : '2px solid transparent',
                borderRadius: 10,
                padding: '8px 4px',
                background: isSelected ? '#0071e3' : isTod ? '#eff6ff' : '#f9fafb',
                cursor: isFuture ? 'not-allowed' : 'pointer',
                opacity: isFuture ? 0.35 : 1,
                textAlign: 'center',
                transition: 'all .15s',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: isSelected ? '#fff' : '#888', marginBottom: 2 }}>
                {DAYS[i]}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: isSelected ? '#fff' : '#111' }}>
                {new Date(d + 'T12:00:00').getDate()}
              </div>
              {isTod && !isSelected && (
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#0071e3', margin: '3px auto 0' }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const navBtnStyle = {
  border: '1px solid #e5e7eb', borderRadius: 8, padding: '4px 8px',
  background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#374151'
};

/* ─────────────────────────────────────────
   AUDIT CARD (Redesigned)
───────────────────────────────────────── */
const AuditCard = ({ msg }) => {
  const [open, setOpen] = useState(false);
  const isShortage = msg.hasShortage || msg.shouldBe < 0;
  const hasSales = msg.totalSold > 0;
  const status = isShortage ? 'red' : hasSales ? 'amber' : 'green';
  const statusText = isShortage ? 'SHORTAGE' : hasSales ? 'IN USE' : 'FULL';

  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      border: `1px solid ${isShortage ? '#fca5a5' : hasSales ? '#fcd34d' : '#d1fae5'}`,
      overflow: 'hidden',
      boxShadow: isShortage ? '0 0 0 3px #fef2f2' : '0 1px 3px rgba(0,0,0,.06)'
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
        borderBottom: open ? '1px solid #f3f4f6' : 'none',
        cursor: 'pointer', userSelect: 'none'
      }} onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isShortage ? <AlertTriangle size={16} color="#ef4444" /> :
           hasSales ? <Activity size={16} color="#f59e0b" /> :
           <CheckCircle2 size={16} color="#10b981" />}
          <span style={{ fontWeight: 700, fontSize: 14 }}>{msg.item}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge color={status}>{statusText}</Badge>
          <span style={{ fontSize: 11, color: '#999' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Quick Summary (always visible) */}
      <div style={{ padding: '10px 16px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 80 }}>
          <p style={{ margin: 0, fontSize: 10, color: '#999', fontWeight: 600, textTransform: 'uppercase' }}>Should Have</p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: isShortage ? '#ef4444' : '#10b981' }}>
            {Math.max(0, msg.shouldBe)} <span style={{ fontSize: 12, fontWeight: 500 }}>{msg.unit}</span>
          </p>
        </div>
        <div style={{ flex: 1, minWidth: 80 }}>
          <p style={{ margin: 0, fontSize: 10, color: '#999', fontWeight: 600, textTransform: 'uppercase' }}>Sold Today</p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#e63946' }}>
            {msg.totalSold} <span style={{ fontSize: 12, fontWeight: 500 }}>portions</span>
          </p>
        </div>
      </div>

      {/* Expandable Details */}
      {open && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid #f3f4f6' }}>
          {msg.soldBreakdown?.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Sold Breakdown
              </p>
              {msg.soldBreakdown.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 0', borderBottom: idx < msg.soldBreakdown.length - 1 ? '1px dashed #f3f4f6' : 'none'
                }}>
                  <span style={{ fontSize: 13, color: '#374151' }}>{item.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: '#888' }}>×</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#e63946' }}>{item.qty}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 12 }}>No sales recorded for this day yet.</p>
          )}

          {isShortage && (
            <div style={{
              marginTop: 12, padding: '10px 12px',
              background: '#fef2f2', borderRadius: 8, border: '1px solid #fca5a5'
            }}>
              <p style={{ margin: 0, fontSize: 12, color: '#991b1b', fontWeight: 600 }}>
                ⚠️ Stock deficit detected — physical recount required
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────
   STOCK ROW
───────────────────────────────────────── */
const StockRow = ({ item, auditMessages, updateAmount, setUpdateAmount, handleQuickUpdate, openEdit }) => {
  const itemAudit = auditMessages.find(a => a.item === item.item_name);
  const isMismatched = itemAudit && parseFloat(item.stock_quantity) !== parseFloat(itemAudit.shouldBe);
  const isLow = item.stock_quantity < 5;
  const isEditing = updateAmount.id === item.id;

  return (
    <tr style={{
      background: isMismatched ? '#fff5f5' : '#fff',
      transition: 'background .2s',
    }}>
      <td style={{ padding: '14px 16px' }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{item.item_name}</span>
          {isMismatched && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <AlertTriangle size={11} color="#ef4444" />
              <span style={{ color: '#ef4444', fontSize: 10, fontWeight: 600 }}>DISCREPANCY</span>
            </div>
          )}
        </div>
      </td>
      <td style={{ padding: '14px 16px', color: '#888', fontSize: 13 }}>{item.displayOpening}</td>
      <td style={{ padding: '14px 16px' }}>
        <span style={{ color: '#10b981', fontWeight: 700, fontSize: 13 }}>+{item.added_stock}</span>
      </td>
      <td style={{ padding: '14px 16px' }}>
        <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>−{item.units_sold}</span>
      </td>
      <td style={{ padding: '14px 16px' }}>
        <div>
          <span style={{
            fontWeight: 800, fontSize: 16,
            color: (isLow || isMismatched) ? '#ef4444' : '#111'
          }}>
            {item.displayStock}
          </span>
          {isMismatched && itemAudit && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
              Expected: {itemAudit.shouldBe} {itemAudit.unit}
            </div>
          )}
        </div>
      </td>
      <td style={{ padding: '14px 16px' }}>
        <Badge color={isMismatched ? 'red' : isLow ? 'amber' : 'green'}>
          {isMismatched ? 'Check Usage' : isLow ? 'Low Stock' : 'Optimal'}
        </Badge>
      </td>
      <td style={{ padding: '14px 16px' }}>
        {isEditing ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number"
              autoFocus
              placeholder="Qty"
              style={{
                width: 70, padding: '6px 10px', border: '2px solid #0071e3',
                borderRadius: 8, fontSize: 13, fontWeight: 600, outline: 'none'
              }}
              onChange={(e) => setUpdateAmount({ ...updateAmount, val: e.target.value })}
            />
            <button
              onClick={() => handleQuickUpdate(item.id)}
              style={{ ...btnPrimary, padding: '6px 10px' }}
            >
              <Save size={13} />
            </button>
            <button
              onClick={() => setUpdateAmount({ id: null, val: '' })}
              style={{ ...btnOutline, padding: '6px 10px' }}
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setUpdateAmount({ id: item.id, val: '' })}
            style={btnOutline}
          >
            <ArrowUp size={13} /> Add Stock
          </button>
        )}
      </td>
      <td style={{ padding: '14px 16px' }}>
        <button onClick={() => openEdit(item)} style={{ ...btnOutline, color: '#6366f1', borderColor: '#c7d2fe' }}>
          <Edit size={13} /> Edit
        </button>
      </td>
    </tr>
  );
};

const btnPrimary = {
  display: 'flex', alignItems: 'center', gap: 5,
  background: '#0071e3', color: '#fff', border: 'none',
  borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap'
};
const btnOutline = {
  display: 'flex', alignItems: 'center', gap: 5,
  background: '#fff', color: '#374151', border: '1px solid #e5e7eb',
  borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap'
};

/* ─────────────────────────────────────────
   MODAL
───────────────────────────────────────── */
const Modal = ({ title, onClose, children }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 20
  }}>
    <div style={{
      background: '#fff', borderRadius: 20, padding: 28,
      width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto',
      boxShadow: '0 20px 60px rgba(0,0,0,.2)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{title}</h3>
        <button onClick={onClose} style={{ border: 'none', background: '#f3f4f6', borderRadius: 8, padding: '6px', cursor: 'pointer' }}>
          <X size={16} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {label}
    </label>
    <input
      style={{
        width: '100%', padding: '10px 14px', border: '2px solid #e5e7eb',
        borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box',
        transition: 'border-color .15s'
      }}
      onFocus={e => e.target.style.borderColor = '#0071e3'}
      onBlur={e => e.target.style.borderColor = '#e5e7eb'}
      {...props}
    />
  </div>
);

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
const Inventory = () => {
  const [stock, setStock] = useState([]);
  const [auditMessages, setAuditMessages] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // overview | audit | history
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [updateAmount, setUpdateAmount] = useState({ id: null, val: '' });
  const [weekHistory, setWeekHistory] = useState({}); // { date: { stock, audit } }

  const [newItem, setNewItem] = useState({ item_name: '', unit_measure: '', stock_quantity: 0 });
  const [editForm, setEditForm] = useState({ id: null, item_name: '', unit_measure: '', stock_quantity: 0, opening_stock: 0, added_stock: 0 });

  /* ── DATA LOADING ─────────────── */
  const loadData = useCallback(async (date = selectedDate) => {
    setLoading(true);
    try {
      // Always load current stock (live from DB)
      const [inv, audit] = await Promise.all([
        axios.get(`${API}/api/inventory`),
        axios.get(`${API}/api/inventory/audit-report`)
      ]);

      const processedStock = inv.data.map(item => {
        const closingUnits = parseFloat(item.stock_quantity) || 0;
        const opening = parseFloat(item.opening_stock) || 0;
        const sold = parseFloat(item.units_sold) || 0;
        const unit = item.unit_measure || '';
        return {
          ...item,
          displayStock: `${Math.floor(closingUnits)} ${unit}`,
          displayOpening: `${Math.floor(opening)} ${unit}`,
          units_sold: Math.ceil(sold),
          stock_quantity: closingUnits
        };
      });

      setStock(processedStock);
      setAuditMessages(audit.data);

      // Load daily sales summary for selected date (for history view)
      try {
        const daySales = await axios.get(`${API}/api/reports/sales-summary?date=${date}`);
        setWeekHistory(prev => ({
          ...prev,
          [date]: {
            itemized: daySales.data.itemized || [],
            payments: daySales.data.payments || {}
          }
        }));
      } catch (e) {
        // sales summary might not exist for all dates, that's ok
      }
    } catch (err) {
      console.error('Load error', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { loadData(selectedDate); }, [selectedDate]);

  /* ── HANDLERS ─────────────────── */
  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/api/inventory/add-new`, newItem);
      setShowAddModal(false);
      loadData(selectedDate);
    } catch { alert('Error adding product'); }
  };

  const handleQuickUpdate = async (id) => {
    try {
      await axios.post(`${API}/api/inventory/add-stock`, { item_id: id, quantity_to_add: updateAmount.val });
      setUpdateAmount({ id: null, val: '' });
      loadData(selectedDate);
    } catch { alert('Update failed'); }
  };

  const openEdit = (item) => {
    setEditItem(item.id);
    setEditForm({
      id: item.id,
      item_name: item.item_name,
      unit_measure: item.unit_measure,
      stock_quantity: item.stock_quantity,
      opening_stock: item.opening_stock,
      added_stock: item.added_stock
    });
  };

  const saveEdit = async () => {
    try {
      await axios.put(`${API}/api/inventory/update-item`, {
        ...editForm,
        stock_quantity: Number(editForm.stock_quantity),
        opening_stock: Number(editForm.opening_stock),
        added_stock: Number(editForm.added_stock)
      }, { headers: { 'user-role': 'Admin' } });
      setEditItem(null);
      loadData(selectedDate);
    } catch (err) {
      alert('Failed to update item');
    }
  };

  /* ── DERIVED DATA ─────────────── */
  const totalActive = stock.length;
  const totalAdded = stock.reduce((a, c) => a + (parseFloat(c.added_stock) || 0), 0);
  const totalSold = stock.reduce((a, c) => a + (c.units_sold || 0), 0);
  const shortageCount = auditMessages.filter(m => m.hasShortage).length;
  const todayHistory = weekHistory[selectedDate];
  const isToday = selectedDate === today();

  const tabs = [
    { id: 'overview', label: 'Live Stock', icon: Boxes },
    { id: 'audit', label: 'Kitchen Audit', icon: AlertCircle, badge: shortageCount > 0 ? shortageCount : null },
    { id: 'history', label: 'Daily Sales', icon: History },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      {/* ── TOP HEADER ─── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '20px 32px', position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #0071e3, #5e5ce6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Package size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111', letterSpacing: '-0.3px' }}>
              Digital Storehouse
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
              {isToday ? 'Viewing today' : `Viewing ${fmt(selectedDate)}`}
              {loading && ' · Refreshing…'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => loadData(selectedDate)} style={btnOutline}>
            <RefreshCcw size={14} /> Refresh
          </button>
          <button onClick={() => setShowAddModal(true)} style={btnPrimary}>
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      {/* ── BODY ─── */}
      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>

        {/* STAT CARDS */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard icon={Boxes} label="Active Materials" value={totalActive} color="#0071e3" />
          <StatCard icon={ArrowUp} label="Restocked This Week" value={totalAdded} color="#10b981" />
          <StatCard icon={ArrowDown} label="Units Sold (Live)" value={totalSold} color="#ef4444" />
          <StatCard
            icon={AlertTriangle}
            label="Stock Alerts"
            value={shortageCount}
            color={shortageCount > 0 ? '#f59e0b' : '#10b981'}
            sub={shortageCount > 0 ? 'Items need recount' : 'All stocked OK'}
          />
        </div>

        {/* DATE NAVIGATOR */}
        <DateNavigator selectedDate={selectedDate} onDateChange={setSelectedDate} />

        {/* TABS */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '10px 16px', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', transition: 'all .15s', position: 'relative',
                background: activeTab === tab.id ? '#fff' : 'transparent',
                color: activeTab === tab.id ? '#0071e3' : '#666',
                boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,.1)' : 'none'
              }}
            >
              <tab.icon size={14} />
              {tab.label}
              {tab.badge && (
                <span style={{
                  position: 'absolute', top: 6, right: 8,
                  background: '#ef4444', color: '#fff', borderRadius: 10,
                  fontSize: 10, fontWeight: 800, padding: '1px 5px', lineHeight: 1.4
                }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB: OVERVIEW (Live Stock Table) ─── */}
        {activeTab === 'overview' && (
          <div style={{
            background: '#fff', borderRadius: 16,
            boxShadow: '0 1px 3px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.04)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Current Inventory Levels</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#888' }}>
                  Live stock — reflects all transactions for the current weekly cycle (Sun–Sat)
                </p>
              </div>
              <Badge color="blue">{stock.length} items</Badge>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb' }}>
                    {['Material', 'Opening (Sun)', 'Added', 'Sold/Used', 'In Stock', 'Status', 'Update Store', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stock.map((item, i) => (
                    <React.Fragment key={item.id}>
                      {i > 0 && <tr><td colSpan={8} style={{ padding: 0, borderTop: '1px solid #f3f4f6' }} /></tr>}
                      <StockRow
                        item={item}
                        auditMessages={auditMessages}
                        updateAmount={updateAmount}
                        setUpdateAmount={setUpdateAmount}
                        handleQuickUpdate={handleQuickUpdate}
                        openEdit={openEdit}
                      />
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              {stock.length === 0 && !loading && (
                <div style={{ padding: 48, textAlign: 'center', color: '#aaa' }}>
                  <Boxes size={32} style={{ opacity: .3, marginBottom: 8 }} />
                  <p style={{ margin: 0 }}>No inventory items found.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: AUDIT ─── */}
        {activeTab === 'audit' && (
          <div>
            <div style={{ marginBottom: 16, padding: '14px 18px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertTriangle size={16} color="#d97706" style={{ marginTop: 1, flexShrink: 0 }} />
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#92400e' }}>How Kitchen Audit Works</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#78350f' }}>
                  This compares your <strong>recorded stock</strong> against what the system <strong>calculates should remain</strong> based on actual sales and yield rules. A discrepancy means either a counting error, wastage, or unrecorded use.
                </p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {auditMessages.map((msg, i) => <AuditCard key={i} msg={msg} />)}
            </div>
            {auditMessages.length === 0 && (
              <div style={{ padding: 48, textAlign: 'center', color: '#aaa' }}>
                <CheckCircle2 size={32} style={{ opacity: .3, marginBottom: 8 }} />
                <p style={{ margin: 0 }}>No audit data available.</p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: HISTORY (Daily Sales) ─── */}
        {activeTab === 'history' && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Calendar size={16} color="#666" />
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                Sales for {isToday ? 'Today' : fmt(selectedDate)}
              </span>
            </div>

            {/* Payment breakdown */}
            {todayHistory?.payments && Object.values(todayHistory.payments).some(v => v > 0) ? (
              <>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                  {Object.entries(todayHistory.payments).filter(([, v]) => v > 0).map(([method, amount]) => (
                    <div key={method} style={{
                      background: '#fff', borderRadius: 12, padding: '14px 20px',
                      border: '1px solid #e5e7eb', flex: 1, minWidth: 130
                    }}>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>{method}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800 }}>
                        KES {amount.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Itemized sales table */}
                <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Items Sold</h4>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        {['Item', 'Qty Sold', 'Unit Price', 'Revenue'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(todayHistory?.itemized || []).sort((a, b) => b.total_qty - a.total_qty).map((item, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 14 }}>{item.product_name}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontWeight: 700, color: '#e63946' }}>{item.total_qty}</span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#666', fontSize: 13 }}>
                            KES {Number(item.price).toFixed(0)}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: '#10b981' }}>
                            KES {Number(item.total_revenue).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f9fafb', borderTop: '2px solid #e5e7eb' }}>
                        <td colSpan={2} style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13 }}>Total</td>
                        <td />
                        <td style={{ padding: '12px 16px', fontWeight: 800, fontSize: 15, color: '#0071e3' }}>
                          KES {(todayHistory?.itemized || []).reduce((a, c) => a + Number(c.total_revenue), 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            ) : (
              <div style={{
                background: '#fff', borderRadius: 16, padding: 48,
                textAlign: 'center', border: '1px dashed #e5e7eb'
              }}>
                <History size={32} color="#d1d5db" style={{ marginBottom: 12 }} />
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#374151' }}>
                  {loading ? 'Loading sales data…' : `No sales recorded for ${isToday ? 'today' : fmt(selectedDate)}`}
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#9ca3af' }}>
                  Use the week navigator above to browse different days
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ADD ITEM MODAL ─── */}
      {showAddModal && (
        <Modal title="Add New Store Item" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAddProduct}>
            <Field label="Item Name" type="text" placeholder="e.g. Wheat Flour" required onChange={e => setNewItem({ ...newItem, item_name: e.target.value })} />
            <Field label="Unit Measure" type="text" placeholder="e.g. 2kg Packet" required onChange={e => setNewItem({ ...newItem, unit_measure: e.target.value })} />
            <Field label="Current Stock Quantity" type="number" placeholder="0" required onChange={e => setNewItem({ ...newItem, stock_quantity: e.target.value })} />
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button type="submit" style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: 12 }}>Save to Store</button>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ ...btnOutline, flex: 1, justifyContent: 'center', padding: 12 }}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── EDIT MODAL ─── */}
      {editItem && (
        <Modal title="Edit Inventory Item" onClose={() => setEditItem(null)}>
          <Field label="Item Name" value={editForm.item_name} onChange={e => setEditForm({ ...editForm, item_name: e.target.value })} />
          <Field label="Unit Measure" value={editForm.unit_measure} onChange={e => setEditForm({ ...editForm, unit_measure: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Stock Quantity" type="number" value={editForm.stock_quantity} onChange={e => setEditForm({ ...editForm, stock_quantity: e.target.value })} />
            <Field label="Opening Stock" type="number" value={editForm.opening_stock} onChange={e => setEditForm({ ...editForm, opening_stock: e.target.value })} />
          </div>
          <Field label="Added Stock" type="number" value={editForm.added_stock} onChange={e => setEditForm({ ...editForm, added_stock: e.target.value })} />
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button onClick={saveEdit} style={{ ...btnPrimary, flex: 1, justifyContent: 'center', padding: 12 }}>Save Changes</button>
            <button onClick={() => setEditItem(null)} style={{ ...btnOutline, flex: 1, justifyContent: 'center', padding: 12 }}>Cancel</button>
          </div>
        </Modal>
      )}

      <div style={{ padding: '16px 32px', textAlign: 'center' }}>
        <span style={{ fontSize: 11, color: '#c4c9d4', fontWeight: 600, letterSpacing: '0.5px' }}>
          First Class POS · CODEY CRAFT AFRICA
        </span>
      </div>
    </div>
  );
};

export default Inventory;