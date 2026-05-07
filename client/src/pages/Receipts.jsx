import React, { useEffect, useState } from "react";
import axios from "axios";
import { Printer, X, Search, Eye, Calendar, User, CreditCard } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL;

const Receipts = () => {
  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/receipts`, {
        params: { search, from: fromDate, to: toDate }
      });
      setReceipts(res.data);
    } catch (err) {
      console.error("Receipts error:", err);
    }
    setLoading(false);
  };

  const viewReceipt = async (id) => {
    setModalLoading(true);
    setSelectedReceipt({ sale: null, items: [] }); // open modal immediately with loader
    try {
      const res = await axios.get(`${API_BASE_URL}/api/receipts/${id}`);
      setSelectedReceipt({
        sale: res.data.sale || {},
        items: res.data.items || []
      });
    } catch (err) {
      console.error("View receipt error:", err);
      alert("Failed to load receipt");
      setSelectedReceipt(null);
    }
    setModalLoading(false);
  };

  const closeModal = () => setSelectedReceipt(null);

  const printReceipt = () => {
    const printContent = document.getElementById("receipt-box");
    if (!printContent) return;
    const win = window.open("", "", "width=400,height=650");
    win.document.write(`
      <html>
        <head>
          <title>Receipt #${selectedReceipt?.sale?.id}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; padding: 20px; font-size: 13px; color: #000; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .row { display: flex; justify-content: space-between; margin: 4px 0; }
            .restaurant-name { font-size: 18px; font-weight: bold; letter-spacing: 2px; }
            .receipt-label { font-size: 11px; color: #555; }
            .grand-total { font-size: 15px; font-weight: bold; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    win.document.close();
  };

  const getPaymentBadgeColor = (method) => {
    const m = (method || "").toLowerCase();
    if (m.includes("cash")) return "#16a34a";
    if (m.includes("mpesa") || m.includes("m-pesa")) return "#2563eb";
    if (m.includes("credit")) return "#dc2626";
    if (m.includes("advance") || m.includes("wallet")) return "#7c3aed";
    if (m.includes("compliment")) return "#d97706";
    return "#6b7280";
  };

  const subtotal = selectedReceipt?.items?.reduce(
    (acc, item) => acc + parseFloat(item.price || 0) * parseInt(item.qty || 0), 0
  ) || 0;

  return (
    <div className="receipts-container">
      <h2 className="receipts-title">Receipts</h2>

      {/* FILTERS */}
      <div className="receipts-filters">
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            className="receipts-input"
            placeholder="Search customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <input className="receipts-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <input className="receipts-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        <button className="receipts-btn" onClick={fetchReceipts}>Filter</button>
      </div>

      {/* TABLE */}
      <div className="receipts-table-wrapper">
        {loading ? (
          <p style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>Loading receipts...</p>
        ) : receipts.length === 0 ? (
          <p style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>No receipts found.</p>
        ) : (
          <table className="receipts-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Total (Ksh)</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600, color: "#374151" }}>{r.id}</td>
                  <td>{r.client_name}</td>
                  <td style={{ fontWeight: 600 }}>{parseFloat(r.total_price).toLocaleString()}</td>
                  <td>
                    <span style={{
                      background: getPaymentBadgeColor(r.payment_method),
                      color: "white",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600
                    }}>
                      {r.payment_method || "—"}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      background: r.payment_status === "Completed" ? "#dcfce7" : r.payment_status === "Unpaid" ? "#fee2e2" : "#fef9c3",
                      color: r.payment_status === "Completed" ? "#15803d" : r.payment_status === "Unpaid" ? "#b91c1c" : "#92400e",
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600
                    }}>
                      {r.payment_status}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: "#6b7280" }}>
                    {new Date(r.sale_date).toLocaleString()}
                  </td>
                  <td>
                    <button
                      className="view-btn"
                      onClick={() => viewReceipt(r.id)}
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Eye size={14} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ===== RECEIPT MODAL ===== */}
      {selectedReceipt !== null && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
        >
          {/* Stop clicks inside the modal from closing it */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 12,
              width: "100%",
              maxWidth: 420,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 60px rgba(0,0,0,0.35)"
            }}
          >
            {/* Modal Header */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "16px 20px",
              borderBottom: "1px solid #e5e7eb"
            }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>
                Receipt #{selectedReceipt?.sale?.id || "..."}
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={printReceipt}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "#1d4ed8", color: "white",
                    border: "none", borderRadius: 6,
                    padding: "7px 14px", cursor: "pointer",
                    fontSize: 13, fontWeight: 600
                  }}
                >
                  <Printer size={15} /> Print
                </button>
                <button
                  onClick={closeModal}
                  style={{
                    background: "#f3f4f6", border: "none",
                    borderRadius: 6, padding: "7px 10px",
                    cursor: "pointer", display: "flex", alignItems: "center"
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            {modalLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading receipt...</div>
            ) : (
              <div style={{ padding: 20 }}>

                {/* ===== PRINTABLE RECEIPT AREA ===== */}
                <div id="receipt-box" style={{ fontFamily: "'Courier New', monospace", fontSize: 13, color: "#111" }}>

                  {/* Header */}
                  <div className="center" style={{ textAlign: "center", marginBottom: 12 }}>
                    <div className="restaurant-name bold" style={{ fontSize: 17, fontWeight: 700, letterSpacing: 2 }}>
                      FIRST CLASS LOGISTICS
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>Official Receipt</div>
                  </div>

                  <div className="divider" style={{ borderTop: "1px dashed #ccc", margin: "10px 0" }} />

                  {/* Sale Info */}
                  <div style={{ marginBottom: 10 }}>
                    <div className="row" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "#555", fontSize: 12 }}>Receipt #</span>
                      <span style={{ fontWeight: 600 }}>{selectedReceipt.sale?.id}</span>
                    </div>
                    <div className="row" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "#555", fontSize: 12 }}>Customer</span>
                      <span style={{ fontWeight: 600 }}>{selectedReceipt.sale?.client_name || "Guest"}</span>
                    </div>
                    <div className="row" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "#555", fontSize: 12 }}>Payment</span>
                      <span style={{ fontWeight: 600 }}>{selectedReceipt.sale?.payment_method || "—"}</span>
                    </div>
                    <div className="row" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "#555", fontSize: 12 }}>Status</span>
                      <span style={{ fontWeight: 600 }}>{selectedReceipt.sale?.payment_status}</span>
                    </div>
                    <div className="row" style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ color: "#555", fontSize: 12 }}>Date</span>
                      <span>{new Date(selectedReceipt.sale?.sale_date).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="divider" style={{ borderTop: "1px dashed #ccc", margin: "10px 0" }} />

                  {/* Items Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888", marginBottom: 6 }}>
                    <span style={{ flex: 2 }}>ITEM</span>
                    <span style={{ textAlign: "center", flex: 1 }}>QTY</span>
                    <span style={{ textAlign: "right", flex: 1 }}>PRICE</span>
                    <span style={{ textAlign: "right", flex: 1 }}>TOTAL</span>
                  </div>

                  {/* Items */}
                  {selectedReceipt.items?.length === 0 ? (
                    <p style={{ color: "#9ca3af", fontSize: 12, textAlign: "center" }}>No items found</p>
                  ) : (
                    selectedReceipt.items?.map((item, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13 }}>
                        <span style={{ flex: 2 }}>{item.product_name}</span>
                        <span style={{ textAlign: "center", flex: 1 }}>{item.qty}</span>
                        <span style={{ textAlign: "right", flex: 1 }}>{parseFloat(item.price).toLocaleString()}</span>
                        <span style={{ textAlign: "right", flex: 1, fontWeight: 600 }}>
                          {(parseFloat(item.price) * parseInt(item.qty)).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}

                  <div className="divider" style={{ borderTop: "1px dashed #ccc", margin: "10px 0" }} />

                  {/* Total */}
                  <div className="row grand-total" style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15 }}>
                    <span>TOTAL</span>
                    <span>Ksh {parseFloat(selectedReceipt.sale?.total_price || subtotal).toLocaleString()}</span>
                  </div>

                  <div className="divider" style={{ borderTop: "1px dashed #ccc", margin: "10px 0" }} />

                  {/* Footer */}
                  <div className="center" style={{ textAlign: "center", fontSize: 11, color: "#666", marginTop: 8 }}>
                    <p>Thank you for dining with us!</p>
                    <p style={{ marginTop: 4, fontSize: 10 }}>Powered by Codey Craft Africa</p>
                  </div>
                </div>
                {/* ===== END PRINTABLE AREA ===== */}

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Receipts;