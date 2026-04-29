import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Banknote, Smartphone, Wallet, Gift } from 'lucide-react';
import { 
  BarChart3, Calendar, Download, Receipt, 
  MinusCircle, Plus, PieChart, CreditCard 
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

const Sales = () => {
  const [reportData, setReportData] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState({
  Cash: 0,
  MPesa: 0,
  Wallet: 0,
  Complimentary: 0
});
const [fromDate, setFromDate] = useState('');
const [toDate, setToDate] = useState('');
const [rangeData, setRangeData] = useState(null);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [totalCustomerCredit, setTotalCustomerCredit] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  
  const [expenses, setExpenses] = useState([]);
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const totalSales =
  (paymentMethods.Cash || 0) +
  (paymentMethods.MPesa || 0) +
  (paymentMethods.Wallet || 0) +
  (paymentMethods.Complimentary || 0);

  useEffect(() => {
    const fetchFinancialData = async () => {
      setLoading(true);
      try {
        const dailyRes = await axios.get(`${API}/api/reports/sales-summary?date=${selectedDate}`);
        
        if (dailyRes.data.itemized) {
            setReportData(dailyRes.data.itemized || []);
            setPaymentMethods(dailyRes.data.payments || {
  Cash: 0,
  MPesa: 0,
  Wallet: 0,
  Complimentary: 0
});
        }

        const monthYear = selectedDate.substring(0, 7); 
        const monthRes = await axios.get(`${API}/api/reports/monthly-cumulative?month=${monthYear}`);
        setMonthlyTotal(Number(monthRes.data?.total_revenue) || 0);

        const creditRes = await axios.get(`${API}/api/customers/total-credit`);
        setTotalCustomerCredit(Number(creditRes.data?.total_credit) || 0);

      } catch (err) {
        console.error("Financial Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFinancialData();
  }, [selectedDate]);

  // --- CALCULATIONS ---
  const totalExpenses = expenses.reduce((acc, exp) => acc + (parseFloat(exp.amount) || 0), 0);
  
  const actualCashInflow = (paymentMethods.Cash || 0) + (paymentMethods.MPesa || 0);

  const netCashAtHand = actualCashInflow - totalExpenses;
  const dailyRevenue = actualCashInflow;

  const menuSalesCash = reportData
    .filter(item => 
      !item.product_name?.toLowerCase().includes('deposit') && 
      (item.payment_method === 'Cash' || item.payment_method === 'MPesa')
    )
    .reduce((acc, item) => acc + (parseFloat(item.total_revenue) || 0), 0);

  // --- SMART AGGREGATION LOGIC (UPDATED FOR COMPLIMENTARY & PURPLE FEATURE) ---
 const getAggregatedData = () => {
    const grouped = {};

    reportData.forEach(item => {
        // --- ADD THIS FILTER TO HIDE DEPOSITS FROM THE TABLE ---
        if (item.payment_method === 'Topup' || item.product_name?.toLowerCase().includes('deposit')) {
            return; // Skip this iteration, don't add to the table
        }

        const isWallet = item.payment_method === 'Advance';
        const isCredit = item.payment_status === 'Unpaid' || item.payment_method === 'Credit';
        const isComp = item.payment_method === 'Complimentary' || item.payment_status === 'Complimentary' || parseFloat(item.price) === 0;
        
        const statusKey = isComp ? 'comp' : (isCredit ? 'credit' : (isWallet ? 'advance' : 'normal'));
        const personName = item.client_name || item.customer_name || 'Unknown';
        
        const groupKey = `${item.product_name}-${statusKey}-${statusKey === 'normal' ? 'standard' : personName}`;

        if (grouped[groupKey]) {
            grouped[groupKey].total_qty = parseInt(grouped[groupKey].total_qty) + parseInt(item.total_qty);
            grouped[groupKey].total_revenue = parseFloat(grouped[groupKey].total_revenue) + parseFloat(item.total_revenue);
        } else {
            grouped[groupKey] = { ...item, statusKey, personName };
        }
    });

    return Object.values(grouped);
};

  const displayData = getAggregatedData();
  
  const addExpense = () => {
    if (!expenseName || !expenseAmount) return;
    setExpenses([...expenses, { id: Date.now(), name: expenseName, amount: expenseAmount }]);
    setExpenseName(''); 
    setExpenseAmount('');
  };

  const removeExpense = (id) => {
    setExpenses(expenses.filter(exp => exp.id !== id));
  };

  const fetchDateRangeReport = async () => {
  if (!fromDate || !toDate) return alert("Select both dates");

  try {
    const res = await axios.get(
  `${API}/api/reports/date-range?from=${fromDate}&to=${toDate}`
);

    const data = res.data;
    setRangeData(data);

    const printWindow = window.open('', '_blank');

    printWindow.document.write(`
      <html>
        <head>
          <title>Financial Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 30px;
              background: white;
              color: #111;
            }

            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }

            .header h1 {
              margin: 0;
              font-size: 22px;
              letter-spacing: 1px;
            }

            .header p {
              margin: 5px 0;
              font-size: 13px;
              color: #555;
            }

            .summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin: 20px 0;
              text-align: center;
            }

            .card {
              border: 1px solid #ddd;
              padding: 10px;
              border-radius: 8px;
            }

            .card h3 {
              margin: 0;
              font-size: 14px;
              color: #666;
            }

            .card p {
              margin: 5px 0 0;
              font-size: 16px;
              font-weight: bold;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }

            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              font-size: 12px;
            }

            th {
              background: #f5f5f5;
            }

            .total {
              margin-top: 20px;
              text-align: right;
              font-size: 16px;
              font-weight: bold;
            }

            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 11px;
              color: #777;
            }
          </style>
        </head>

        <body>

          <div class="header">
            <h1>FIRST CLASS WORLD LOGISTICS</h1>
            <p>Financial Report</p>
            <p>From: ${fromDate} To: ${toDate}</p>
          </div>

          <div class="summary">
            <div class="card">
              <h3>Cash</h3>
              <p>Ksh ${data.payments.Cash.toLocaleString()}</p>
            </div>

            <div class="card">
              <h3>M-Pesa</h3>
              <p>Ksh ${data.payments.MPesa.toLocaleString()}</p>
            </div>

            <div class="card">
              <h3>Wallet</h3>
              <p>Ksh ${data.payments.Wallet.toLocaleString()}</p>
            </div>

            <div class="card">
              <h3>Complimentary</h3>
              <p>Ksh ${data.payments.Complimentary.toLocaleString()}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${data.itemized.map(item => `
                <tr>
                  <td>${item.product_name}</td>
                  <td>${item.total_qty}</td>
                  <td>${item.price}</td>
                  <td>${item.total_revenue}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="total">
            Total Revenue: Ksh ${data.totalRevenue.toLocaleString()}
          </div>

          <div class="footer">
            Generated by First Class POS System • CODEY CRAFT AFRICA
          </div>

          <script>
            window.print();
          </script>

        </body>
      </html>
    `);

    printWindow.document.close();

  } catch (err) {
    console.error("Date Range Error:", err);
  }
};

  return (
    <div className="sales-report-page">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { visibility: hidden; background: white !important; }
          .sales-container, .sales-container * { visibility: visible; }
          .sales-container { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print, .remove-btn, .export-btn, .expense-form-container { display: none !important; }
          .report-card { border: 1px solid #eee !important; box-shadow: none !important; break-inside: avoid; }
          .modern-table th { background: #f8f8f8 !important; -webkit-print-color-adjust: exact; border-bottom: 2px solid #ddd; }
          .stats-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 15px; }
        }

        .row-comp { 
            background-color: #f3e5f5 !important; 
            color: #6b21a8 !important; 
        }
        .row-danger { 
            background-color: #fef2f2 !important; 
            color: #dc2626 !important; 
        }
        
        .badge-comp { font-size: 0.75rem; font-weight: 800; color: #7e22ce; text-transform: uppercase; margin-top: 2px;}
        .badge-debt { font-size: 0.75rem; font-weight: 800; color: #b91c1c; text-transform: uppercase; margin-top: 2px;}

        .modern-table tr:hover { background-color: #f9fafb; }
      `}} />

      <div className="sales-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        <header className="report-card-header no-print" style={{ marginBottom: '20px', background: 'white', padding: '20px', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="title-group">
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: '#1d1d1f' }}>Financial Intelligence</h1>
            <p className="subtitle" style={{ color: '#86868b', margin: 0 }}>Operational Report for {new Date(selectedDate).toDateString()}</p>
          </div>
          
          <div className="sales-controls" style={{ display: 'flex', gap: '15px' }}>
            <div className="date-input-group" style={{ display: 'flex', alignItems: 'center', background: '#f5f5f7', padding: '5px 15px', borderRadius: '10px' }}>
              <Calendar size={18} color="#0071e3" style={{ marginRight: '10px' }} />
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)} 
                style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: '600' }} 
              />
            </div>
            <button className="export-btn" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1d1d1f', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>
              <Download size={18} /> PRINT DAILY REPORT
            </button>
          </div>
        </header>

        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
          <div className="report-card" style={{ padding: '20px', background: 'white', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <div className="label-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <PieChart size={16} color="#0071e3" />
              <span className="label" style={{ fontSize: '0.75rem', fontWeight: '700', color: '#86868b' }}>MONTHLY REVENUE</span>
            </div>
            <h2 className="value" style={{ margin: 0, fontSize: '1.8rem', color: '#1d1d1f' }}>Ksh {parseFloat(monthlyTotal).toLocaleString()}</h2>
          </div>

          <div className="report-card" style={{ padding: '20px', background: 'white', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', borderLeft: '4px solid #0071e3' }}>
            <div className="label-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Wallet size={16} color="#0071e3" />
              <span className="label" style={{ fontSize: '0.75rem', fontWeight: '700', color: '#86868b' }}>DAILY NET (CASH AT HAND)</span>
            </div>
            <h2 className="value" style={{ margin: 0, fontSize: '1.8rem', color: '#1d1d1f' }}>Ksh {netCashAtHand.toLocaleString()}</h2>
            <div className="cash-breakdown-small" style={{ fontSize: '0.75rem', marginTop: '8px', color: '#555', borderTop: '1px solid #eee', paddingTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Sales Cash:</span>
                <b>Ksh {menuSalesCash.toLocaleString()}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc3545' }}>
                <span>Expenses:</span>
                <b>- Ksh {totalExpenses.toLocaleString()}</b>
              </div>
            </div>
          </div>

          <div className="report-card" style={{ padding: '20px', background: 'white', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <div className="label-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <CreditCard size={16} color="#dc3545" />
              <span className="label" style={{ fontSize: '0.75rem', fontWeight: '700', color: '#86868b' }}>TOTAL CUSTOMER CREDIT</span>
            </div>
            <h2 className="value" style={{ margin: 0, fontSize: '1.8rem', color: '#dc3545' }}>Ksh {totalCustomerCredit.toLocaleString()}</h2>
          </div>
        </div>

        <div className="report-card" style={{ display: 'flex', gap: '30px', marginBottom: '30px', padding: '15px 30px', background: '#fafafa', borderRadius: '15px', border: '1px solid #eee' }}>
  <span>DAILY COLLECTION:</span>

<span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
  <BarChart3 size={16} />
  Total Sales: Ksh {totalSales.toLocaleString()}
</span>

  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
  <Banknote size={16} /> 
  Cash: <b>{paymentMethods.Cash?.toLocaleString()}</b>
</span>

<span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
  <Smartphone size={16} /> 
  M-Pesa: <b>{paymentMethods.MPesa?.toLocaleString()}</b>
</span>

<span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
  <Wallet size={16} /> 
  Wallet: <b>{paymentMethods.Wallet?.toLocaleString()}</b>
</span>

<span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#7e22ce' }}>
  <Gift size={16} /> 
  Complimentary: <b>{paymentMethods.Complimentary?.toLocaleString()}</b>
</span>

</div>

<div className="report-card range-card">
  <h3>📊 Custom Report (Date Range)</h3>

  <div className="range-controls">
    <input 
      type="date" 
      value={fromDate} 
      onChange={(e) => setFromDate(e.target.value)} 
    />

    <input 
      type="date" 
      value={toDate} 
      onChange={(e) => setToDate(e.target.value)} 
    />

    <button onClick={fetchDateRangeReport}>
      Generate Report
    </button>
  </div>

  {rangeData && (
    <div className="range-results">
      
      <div className="range-summary">
        <p>Cash: <b>Ksh {rangeData.payments.Cash}</b></p>
        <p>MPesa: <b>Ksh {rangeData.payments.MPesa}</b></p>
        <p>Wallet Used: <b>Ksh {rangeData.payments.Wallet}</b></p>
        <p style={{color:'#7e22ce'}}>
          Complimentary: <b>Ksh {rangeData.payments.Complimentary}</b>
        </p>
      </div>

      <h4>Total Revenue (Cash + MPesa)</h4>
      <h2>Ksh {rangeData.totalRevenue.toLocaleString()}</h2>

    </div>
  )} 
</div>

        <div className="report-card" style={{ background: 'white', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #eee', color: '#4b5563', fontWeight: '700' }}>Product & Beneficiary</th>
                <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #eee', color: '#4b5563', fontWeight: '700' }}>Qty</th>
                <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #eee', color: '#4b5563', fontWeight: '700' }}>Unit Price</th>
                <th style={{ padding: '15px', textAlign: 'right', borderBottom: '2px solid #eee', color: '#4b5563', fontWeight: '700' }}>Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((item, index) => {
                let rowClass = "";
                if (item.statusKey === 'comp') rowClass = "row-comp";
                if (item.statusKey === 'credit' || item.statusKey === 'advance') rowClass = "row-danger";

                return (
                  <tr key={index} className={rowClass}>
                    <td style={{ padding: '12px 15px', borderBottom: '1px solid #eee' }}>
                      <div style={{ fontWeight: '600' }}>{item.product_name}</div>
                      
                      {/* COMPLIMENTARY LABEL WITH PURPLE FEATURE */}
                      {item.statusKey === 'comp' && (
                        <div className="badge-comp">COMPLIMENTARY: {item.personName}</div>
                      )}
                      
                      {item.statusKey === 'credit' && (
                        <div className="badge-debt">DEBT: {item.personName}</div>
                      )}
                      {item.statusKey === 'advance' && (
                        <div className="badge-debt">ADVANCE/WALLET: {item.personName}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px 15px', borderBottom: '1px solid #eee', textAlign: 'center', fontWeight: '700' }}>{item.total_qty} units</td>
                    <td style={{ padding: '12px 15px', borderBottom: '1px solid #eee' }}>Ksh {parseFloat(item.price).toLocaleString()}</td>
                    <td style={{ padding: '12px 15px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: '700' }}>Ksh {parseFloat(item.total_revenue).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot style={{ background: '#f9fafb', fontWeight: 'bold' }}>
              <tr>
                <td colSpan="3" style={{ padding: '20px 15px', color: '#1d1d1f' }}>GROSS TOTAL (REALIZED CASH)</td>
                <td style={{ textAlign: 'right', padding: '20px 15px', fontSize: '1.2rem', color: '#0071e3' }}>Ksh {dailyRevenue.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="expense-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px', marginTop: '20px' }}>
          <div className="expense-form-container no-print" style={{ background: 'white', padding: '20px', borderRadius: '15px', border: '1px solid #eee', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><Receipt size={20} /> Record Expense</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input 
                  type="text" 
                  placeholder="Expense Description" 
                  value={expenseName} 
                  onChange={(e) => setExpenseName(e.target.value)} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' }} 
                />
                <input 
                  type="number" 
                  placeholder="Amount" 
                  value={expenseAmount} 
                  onChange={(e) => setExpenseAmount(e.target.value)} 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', outline: 'none' }} 
                />
                <button 
                  onClick={addExpense} 
                  style={{ width: '100%', background: '#1d1d1f', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700' }}
                >
                  Save Deduction
                </button>
            </div>
          </div>

          <div className="report-card" style={{ margin: 0, background: 'white', borderRadius: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
            <div className="report-card-header" style={{ padding: '15px 24px', borderBottom: '1px solid #eee' }}>
                <h3 style={{ margin: 0 }}>Today's Expenses</h3>
            </div>
            <div style={{ padding: '0 24px', maxHeight: '300px', overflowY: 'auto' }}>
              {expenses.length === 0 ? (
                <p style={{ color: '#86868b', textAlign: 'center', padding: '20px' }}>No expenses recorded yet.</p>
              ) : (
                expenses.map(exp => (
                  <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f5f5f7' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: '600', color: '#1d1d1f' }}>{exp.name}</p>
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#dc3545' }}>- Ksh {parseFloat(exp.amount).toLocaleString()}</p>
                    </div>
                    <button 
                      className="no-print remove-btn" 
                      onClick={() => removeExpense(exp.id)} 
                      style={{ background: 'none', border: 'none', color: '#d2d2d7', cursor: 'pointer' }}
                    >
                      <MinusCircle size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <footer style={{ textAlign: 'center', marginTop: '40px', paddingBottom: '40px', color: '#86868b', fontSize: '0.8rem' }}>
          <p>Automated financial summary by First Class World Logistics. A Product of CODEY CRAFT AFRICA</p>
        </footer>
      </div>
    </div>
  );
};

export default Sales;