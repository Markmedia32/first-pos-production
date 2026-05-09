import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Users, Plus, Search, Wallet, CreditCard, TrendingDown,
  TrendingUp, ChevronRight, X, ArrowUpRight, ArrowDownRight,
  Clock, UtensilsCrossed, Receipt, Phone, Tag, CheckCircle,
  AlertCircle, RefreshCcw, Banknote, Smartphone
} from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL;

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
const kes = (n) => `KES ${parseFloat(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (d) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const TYPE_CONFIG = {
  Regular:  { color: '#0071e3', bg: '#dbeafe', label: 'Regular' },
  Staff:    { color: '#7c3aed', bg: '#ede9fe', label: 'Staff' },
  Owner:    { color: '#b45309', bg: '#fef3c7', label: 'Owner' },
};

/* ─────────────────────────────────────────
   AVATAR
───────────────────────────────────────── */
const Avatar = ({ name, size = 44, type = 'Regular' }) => {
  const initials = name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??';
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.Regular;
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3,
      background: cfg.bg, color: cfg.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 800, flexShrink: 0,
      fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.5px'
    }}>{initials}</div>
  );
};

/* ─────────────────────────────────────────
   TYPE BADGE
───────────────────────────────────────── */
const TypeBadge = ({ type }) => {
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.Regular;
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      fontSize: 10, fontWeight: 700, padding: '3px 9px',
      borderRadius: 20, letterSpacing: '0.4px', textTransform: 'uppercase'
    }}>{cfg.label}</span>
  );
};

/* ─────────────────────────────────────────
   STAT CARD
───────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, color, sub }) => (
  <div style={{
    background: '#fff', borderRadius: 18, padding: '22px 26px',
    boxShadow: '0 1px 4px rgba(0,0,0,.07), 0 0 0 1px rgba(0,0,0,.04)',
    flex: 1, minWidth: 160
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Icon size={19} color={color} />
      </div>
    </div>
    <p style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#0d0d0d', letterSpacing: '-1px', lineHeight: 1 }}>{value}</p>
    <p style={{ margin: '5px 0 0', fontSize: 12, color: '#888', fontWeight: 500 }}>{label}</p>
    {sub && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#bbb' }}>{sub}</p>}
  </div>
);

/* ─────────────────────────────────────────
   MODAL SHELL
───────────────────────────────────────── */
const Modal = ({ title, subtitle, onClose, children, wide }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: 20
  }} onClick={onClose}>
    <div
      style={{
        background: '#fff', borderRadius: 22, padding: 30,
        width: '100%', maxWidth: wide ? 680 : 460,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 24px 80px rgba(0,0,0,.22)',
        animation: 'fadeUp .2s ease'
      }}
      onClick={e => e.stopPropagation()}
    >
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: '-0.4px' }}>{title}</h3>
          {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>{subtitle}</p>}
        </div>
        <button onClick={onClose} style={{
          border: 'none', background: '#f3f4f6', borderRadius: 10,
          padding: 7, cursor: 'pointer', display: 'flex', color: '#666'
        }}>
          <X size={16} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

/* ─────────────────────────────────────────
   FIELD
───────────────────────────────────────── */
const Field = ({ label, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {label}
    </label>
    <input style={{
      width: '100%', padding: '11px 14px', border: '2px solid #e5e7eb',
      borderRadius: 11, fontSize: 14, outline: 'none', boxSizing: 'border-box',
      fontFamily: 'inherit', transition: 'border-color .15s'
    }}
      onFocus={e => e.target.style.borderColor = '#0071e3'}
      onBlur={e => e.target.style.borderColor = '#e5e7eb'}
      {...props}
    />
  </div>
);

/* ─────────────────────────────────────────
   TRANSACTION ROW
───────────────────────────────────────── */
const TxRow = ({ type, label, amount, date, sub }) => {
  const isCredit = type === 'DEPOSIT' || type === 'in';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 0', borderBottom: '1px solid #f3f4f6'
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: isCredit ? '#d1fae5' : '#fee2e2',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {isCredit
          ? <ArrowDownRight size={16} color="#10b981" />
          : <ArrowUpRight size={16} color="#ef4444" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</p>
        {sub && <p style={{ margin: '1px 0 0', fontSize: 11, color: '#999' }}>{sub}</p>}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: isCredit ? '#10b981' : '#ef4444' }}>
          {isCredit ? '+' : '−'}{kes(amount)}
        </p>
        <p style={{ margin: '1px 0 0', fontSize: 10, color: '#bbb' }}>{date ? fmtDateTime(date) : ''}</p>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   CUSTOMER CARD
───────────────────────────────────────── */
const CustomerCard = ({ customer, onTopUp, onViewStatement }) => {
  const credit = parseFloat(customer.credit_balance || 0);
  const wallet = parseFloat(customer.wallet_balance || 0);
  const hasDebt = credit > 0;
  const hasWallet = wallet > 0;

  return (
    <div style={{
      background: '#fff', borderRadius: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,.07), 0 0 0 1px rgba(0,0,0,.05)',
      overflow: 'hidden', transition: 'box-shadow .2s',
      display: 'flex', flexDirection: 'column'
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,.1), 0 0 0 1px rgba(0,0,0,.05)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.07), 0 0 0 1px rgba(0,0,0,.05)'}
    >
      {/* Card Header */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <Avatar name={customer.full_name} type={customer.customer_type} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0d0d0d', letterSpacing: '-0.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {customer.full_name}
          </h3>
          <div style={{ display: 'flex', gap: 8, marginTop: 5, alignItems: 'center', flexWrap: 'wrap' }}>
            <TypeBadge type={customer.customer_type} />
            {customer.phone_number && (
              <span style={{ fontSize: 11, color: '#888', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Phone size={10} /> {customer.phone_number}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Balance Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ padding: '14px 20px', borderRight: '1px solid #f3f4f6' }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Wallet
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 900, color: hasWallet ? '#10b981' : '#d1d5db', letterSpacing: '-0.5px' }}>
            {kes(wallet)}
          </p>
        </div>
        <div style={{ padding: '14px 20px' }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Credit Owed
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 900, color: hasDebt ? '#ef4444' : '#d1d5db', letterSpacing: '-0.5px' }}>
            {kes(credit)}
          </p>
        </div>
      </div>

      {/* Status bar */}
      {hasDebt && (
        <div style={{ padding: '8px 20px', background: '#fef2f2', display: 'flex', alignItems: 'center', gap: 7 }}>
          <AlertCircle size={12} color="#ef4444" />
          <span style={{ fontSize: 11, color: '#991b1b', fontWeight: 600 }}>Outstanding balance — collect before serving</span>
        </div>
      )}
      {!hasDebt && hasWallet && (
        <div style={{ padding: '8px 20px', background: '#f0fdf4', display: 'flex', alignItems: 'center', gap: 7 }}>
          <CheckCircle size={12} color="#10b981" />
          <span style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>Wallet funded — ready for advance meals</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: '14px 20px', display: 'flex', gap: 10, marginTop: 'auto' }}>
        <button
          onClick={() => onTopUp(customer)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: '#0071e3', color: '#fff', border: 'none',
            borderRadius: 11, padding: '10px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.1px'
          }}
        >
          <Wallet size={13} /> Top Up
        </button>
        <button
          onClick={() => onViewStatement(customer)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb',
            borderRadius: 11, padding: '10px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          <Receipt size={13} /> Statement
        </button>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   STATEMENT DRAWER (Full account history)
───────────────────────────────────────── */
const StatementModal = ({ customer, onClose }) => {
  const [tab, setTab] = useState('meals');
  const [meals, setMeals] = useState([]);
  const [wallet, setWallet] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [mRes, wRes] = await Promise.all([
          axios.get(`${API}/api/customers/${customer.customer_id}/statement`),
          axios.get(`${API}/api/customers/${customer.customer_id}/wallet-history`)
        ]);
        setMeals(mRes.data || []);
        setWallet(wRes.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [customer.customer_id]);

  const totalSpent = meals.reduce((a, m) => a + parseFloat(m.qty || 0) * parseFloat(m.price || 0), 0);
  const totalTopUps = wallet.filter(w => w.type === 'DEPOSIT').reduce((a, w) => a + parseFloat(w.amount || 0), 0);

  return (
    <Modal
      title={customer.full_name}
      subtitle="Full account statement"
      onClose={onClose}
      wide
    >
      {/* Mini Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
        {[
          { label: 'Wallet Balance', value: kes(customer.wallet_balance), color: '#10b981' },
          { label: 'Credit Owed', value: kes(customer.credit_balance), color: '#ef4444' },
          { label: 'Total Spent', value: kes(totalSpent), color: '#0071e3' },
        ].map(s => (
          <div key={s.label} style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px' }}>
            <p style={{ margin: 0, fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 900, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 11, padding: 4, marginBottom: 20 }}>
        {[
          { id: 'meals', label: 'Meal History', icon: UtensilsCrossed },
          { id: 'wallet', label: 'Wallet Transactions', icon: Wallet },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', transition: 'all .15s',
            background: tab === t.id ? '#fff' : 'transparent',
            color: tab === t.id ? '#0071e3' : '#777',
            boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,.1)' : 'none'
          }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>
          <RefreshCcw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <p style={{ margin: 0, fontSize: 13 }}>Loading history…</p>
        </div>
      ) : tab === 'meals' ? (
        <div>
          {meals.length > 0 ? (
            <>
              {/* Group by date */}
              {Object.entries(
                meals.reduce((groups, meal) => {
                  const day = new Date(meal.sale_date).toDateString();
                  if (!groups[day]) groups[day] = [];
                  groups[day].push(meal);
                  return groups;
                }, {})
              ).map(([day, items]) => (
                <div key={day} style={{ marginBottom: 16 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {new Date(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </p>
                  {items.map((meal, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', marginBottom: 6, borderRadius: 10,
                      background: '#f9fafb', border: '1px solid #f3f4f6'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <UtensilsCrossed size={14} color="#7c3aed" />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{meal.product_name}</p>
                          <p style={{ margin: '1px 0 0', fontSize: 11, color: '#888' }}>
                            {meal.qty} × {kes(meal.price)} · <span style={{
                              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                              background: meal.payment_method === 'Credit' ? '#fee2e2' : '#dbeafe',
                              color: meal.payment_method === 'Credit' ? '#b91c1c' : '#1e40af'
                            }}>{meal.payment_method}</span>
                          </p>
                        </div>
                      </div>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#111' }}>
                        {kes(parseFloat(meal.qty) * parseFloat(meal.price))}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </>
          ) : (
            <EmptyState icon={UtensilsCrossed} message="No meals recorded yet" />
          )}
        </div>
      ) : (
        <div>
          {wallet.length > 0 ? (
            wallet.map((tx, i) => (
              <TxRow
                key={i}
                type={tx.type}
                label={tx.type === 'DEPOSIT' ? 'Wallet Top-Up' : tx.reference || 'Purchase'}
                amount={tx.amount}
                date={tx.created_at}
                sub={`Balance after: ${kes(tx.balance_after)}`}
              />
            ))
          ) : (
            <EmptyState icon={Wallet} message="No wallet transactions yet" />
          )}
        </div>
      )}
    </Modal>
  );
};

const EmptyState = ({ icon: Icon, message }) => (
  <div style={{ padding: '40px 20px', textAlign: 'center', color: '#ccc' }}>
    <Icon size={28} style={{ marginBottom: 10, opacity: .4 }} />
    <p style={{ margin: 0, fontSize: 13, color: '#aaa' }}>{message}</p>
  </div>
);

/* ─────────────────────────────────────────
   TOPUP MODAL
───────────────────────────────────────── */
const TopUpModal = ({ customer, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const debt = parseFloat(customer.credit_balance || 0);
  const wallet = parseFloat(customer.wallet_balance || 0);
  const topupNum = parseFloat(amount) || 0;
  const debtCleared = Math.min(debt, topupNum);
  const walletGain = topupNum - debtCleared;

  const handleSubmit = async () => {
    if (!amount || topupNum <= 0) return;
    setLoading(true);
    try {
      await axios.put(`${API}/api/customers/topup`, {
        customer_id: customer.customer_id,
        amount: topupNum,
        clientName: customer.full_name,
        payment_method: 'Topup'
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('Top-up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [500, 1000, 2000, 5000];

  return (
    <Modal title="Top Up Wallet" subtitle={`Adding funds for ${customer.full_name}`} onClose={onClose}>
      {/* Current state */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
        <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '14px 16px' }}>
          <p style={{ margin: 0, fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Wallet Balance</p>
          <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 900, color: '#10b981' }}>{kes(wallet)}</p>
        </div>
        <div style={{ background: debt > 0 ? '#fef2f2' : '#f9fafb', borderRadius: 12, padding: '14px 16px' }}>
          <p style={{ margin: 0, fontSize: 10, color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>Credit Owed</p>
          <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 900, color: debt > 0 ? '#ef4444' : '#d1d5db' }}>{kes(debt)}</p>
        </div>
      </div>

      {/* Quick amounts */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Quick Select
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {quickAmounts.map(qa => (
            <button key={qa} onClick={() => setAmount(String(qa))} style={{
              padding: '8px 14px', border: `2px solid ${amount === String(qa) ? '#0071e3' : '#e5e7eb'}`,
              borderRadius: 10, background: amount === String(qa) ? '#dbeafe' : '#fff',
              color: amount === String(qa) ? '#0071e3' : '#374151',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .15s'
            }}>
              {kes(qa)}
            </button>
          ))}
        </div>
      </div>

      <Field label="Or Enter Amount (KES)" type="number" placeholder="e.g. 3500" value={amount} onChange={e => setAmount(e.target.value)} />

      {/* Preview */}
      {topupNum > 0 && (
        <div style={{ background: '#f9fafb', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#374151' }}>Payment Preview</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {debtCleared > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#666' }}>Debt cleared first</span>
                <span style={{ fontWeight: 700, color: '#ef4444' }}>−{kes(debtCleared)}</span>
              </div>
            )}
            {walletGain > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#666' }}>Added to wallet</span>
                <span style={{ fontWeight: 700, color: '#10b981' }}>+{kes(walletGain)}</span>
              </div>
            )}
            <div style={{ borderTop: '1px dashed #e5e7eb', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ fontWeight: 700 }}>New wallet balance</span>
              <span style={{ fontWeight: 900, color: '#0071e3' }}>{kes(wallet + walletGain)}</span>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || topupNum <= 0}
        style={{
          width: '100%', padding: '13px', border: 'none',
          borderRadius: 12, fontSize: 14, fontWeight: 800,
          background: loading || topupNum <= 0 ? '#d1d5db' : '#0071e3',
          color: '#fff', cursor: loading || topupNum <= 0 ? 'not-allowed' : 'pointer',
          transition: 'background .15s', letterSpacing: '0.1px'
        }}
      >
        {loading ? 'Processing…' : `Confirm ${topupNum > 0 ? kes(topupNum) : ''} Payment`}
      </button>
    </Modal>
  );
};

/* ─────────────────────────────────────────
   REGISTER MODAL
───────────────────────────────────────── */
const RegisterModal = ({ onClose, onSuccess }) => {
  const [form, setForm] = useState({ full_name: '', customer_type: 'Regular', phone_number: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/api/customers/create`, form);
      onSuccess();
    } catch {
      alert('Error creating account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Register Account" subtitle="Create a new customer, staff, or owner profile" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Full Name" type="text" required placeholder="e.g. John Kamau" onChange={e => setForm({ ...form, full_name: e.target.value })} />
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Account Type
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <button type="button" key={key} onClick={() => setForm({ ...form, customer_type: key })} style={{
                padding: '10px', border: `2px solid ${form.customer_type === key ? cfg.color : '#e5e7eb'}`,
                borderRadius: 11, background: form.customer_type === key ? cfg.bg : '#fff',
                color: form.customer_type === key ? cfg.color : '#555',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .15s'
              }}>
                {cfg.label}
              </button>
            ))}
          </div>
        </div>
        <Field label="Phone Number" type="text" placeholder="e.g. 0712 345 678" onChange={e => setForm({ ...form, phone_number: e.target.value })} />
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button type="submit" disabled={loading} style={{
            flex: 1, padding: 13, border: 'none', borderRadius: 12,
            background: loading ? '#d1d5db' : '#0071e3', color: '#fff',
            fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer'
          }}>
            {loading ? 'Saving…' : 'Create Account'}
          </button>
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: 13, border: '1px solid #e5e7eb', borderRadius: 12,
            background: '#fff', color: '#374151', fontSize: 14, fontWeight: 700, cursor: 'pointer'
          }}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
const Accounts = () => {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(false);

  // Modals
  const [registerOpen, setRegisterOpen] = useState(false);
  const [topUpCustomer, setTopUpCustomer] = useState(null);
  const [statementCustomer, setStatementCustomer] = useState(null);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/customers`);
      setCustomers(res.data || []);
    } catch (err) {
      console.error('Error fetching customers', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // Derived stats
  const totalDebt = customers.reduce((a, c) => a + parseFloat(c.credit_balance || 0), 0);
  const totalWallet = customers.reduce((a, c) => a + parseFloat(c.wallet_balance || 0), 0);
  const debtors = customers.filter(c => parseFloat(c.credit_balance) > 0).length;
  const netDebt = totalDebt - totalWallet;

  // Filtered list
  const filtered = customers.filter(c => {
    const matchSearch = c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone_number || '').includes(search);
    const matchFilter = filter === 'All' || c.customer_type === filter;
    return matchSearch && matchFilter;
  });

  const FILTERS = ['All', 'Regular', 'Staff', 'Owner'];

  return (
    <div style={{
      minHeight: '100vh', background: '#f8fafc',
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif"
    }}>
      {/* ── HEADER ── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '20px 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #7c3aed, #0071e3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Users size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#0d0d0d', letterSpacing: '-0.4px' }}>
              Accounts Manager
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
              {customers.length} accounts · Net exposure: <strong style={{ color: netDebt > 0 ? '#ef4444' : '#10b981' }}>{kes(Math.abs(netDebt))}</strong>
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={fetchCustomers} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
            border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151'
          }}>
            <RefreshCcw size={13} /> Refresh
          </button>
          <button onClick={() => setRegisterOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px',
            border: 'none', borderRadius: 10, background: '#0071e3', color: '#fff',
            fontSize: 12, fontWeight: 700, cursor: 'pointer'
          }}>
            <Plus size={14} /> Register Account
          </button>
        </div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
        {/* STAT CARDS */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <StatCard icon={Users} label="Total Accounts" value={customers.length} color="#0071e3" sub={`${debtors} with outstanding balance`} />
          <StatCard icon={Wallet} label="Total Wallet Funds" value={kes(totalWallet)} color="#10b981" sub="Ready for advance meals" />
          <StatCard icon={CreditCard} label="Credit Outstanding" value={kes(totalDebt)} color="#ef4444" sub={`${debtors} account${debtors !== 1 ? 's' : ''} with debt`} />
          <StatCard icon={TrendingDown} label="Net Exposure" value={kes(Math.abs(netDebt))} color={netDebt > 0 ? '#f59e0b' : '#10b981'} sub={netDebt > 0 ? 'Owed to you' : 'Surplus in wallets'} />
        </div>

        {/* SEARCH + FILTER */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={14} color="#999" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '11px 14px 11px 38px',
                border: '2px solid #e5e7eb', borderRadius: 12, fontSize: 13,
                outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                transition: 'border-color .15s'
              }}
              onFocus={e => e.target.style.borderColor = '#0071e3'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, background: '#f1f5f9', borderRadius: 11, padding: 4 }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '8px 16px', border: 'none', borderRadius: 8,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                background: filter === f ? '#fff' : 'transparent',
                color: filter === f ? '#0071e3' : '#666',
                boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,.1)' : 'none'
              }}>
                {f}
                {f !== 'All' && (
                  <span style={{ marginLeft: 6, fontSize: 10, opacity: .7 }}>
                    {customers.filter(c => c.customer_type === f).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* OUTSTANDING DEBTORS BANNER */}
        {debtors > 0 && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12,
            padding: '13px 18px', marginBottom: 22,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'
          }}>
            <AlertCircle size={16} color="#ef4444" />
            <span style={{ fontSize: 13, color: '#991b1b', fontWeight: 600 }}>
              {debtors} account{debtors !== 1 ? 's have' : ' has'} outstanding credit totalling {kes(totalDebt)}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {customers.filter(c => parseFloat(c.credit_balance) > 0).slice(0, 3).map(c => (
                <span key={c.customer_id} style={{
                  background: '#fee2e2', color: '#b91c1c', borderRadius: 8,
                  padding: '3px 10px', fontSize: 11, fontWeight: 700
                }}>{c.full_name}: {kes(c.credit_balance)}</span>
              ))}
              {debtors > 3 && <span style={{ fontSize: 11, color: '#888' }}>+{debtors - 3} more</span>}
            </div>
          </div>
        )}

        {/* GRID */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#bbb' }}>
            <RefreshCcw size={28} style={{ animation: 'spin 1s linear infinite', marginBottom: 10 }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <p style={{ margin: 0 }}>Loading accounts…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#bbb' }}>
            <Users size={32} style={{ opacity: .3, marginBottom: 12 }} />
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#888' }}>
              {search ? `No accounts match "${search}"` : 'No accounts registered yet'}
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 18
          }}>
            {filtered.map(c => (
              <CustomerCard
                key={c.customer_id}
                customer={c}
                onTopUp={setTopUpCustomer}
                onViewStatement={setStatementCustomer}
              />
            ))}
          </div>
        )}
      </div>

      {/* MODALS */}
      {registerOpen && (
        <RegisterModal
          onClose={() => setRegisterOpen(false)}
          onSuccess={() => { setRegisterOpen(false); fetchCustomers(); }}
        />
      )}
      {topUpCustomer && (
        <TopUpModal
          customer={topUpCustomer}
          onClose={() => setTopUpCustomer(null)}
          onSuccess={() => { setTopUpCustomer(null); fetchCustomers(); }}
        />
      )}
      {statementCustomer && (
        <StatementModal
          customer={statementCustomer}
          onClose={() => setStatementCustomer(null)}
        />
      )}

      <div style={{ padding: '16px 32px', textAlign: 'center' }}>
        <span style={{ fontSize: 11, color: '#d1d5db', fontWeight: 600, letterSpacing: '0.5px' }}>
          PROPERTY FLOW POS · CODEY CRAFT AFRICA
        </span>
      </div>
    </div>
  );
};

export default Accounts;