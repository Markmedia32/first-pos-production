import React, { useEffect, useState } from "react";
import axios from "axios";
import { Printer, X, Search, Eye, Pencil, Trash2, Plus } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL;

const Receipts = () => {
  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState([]);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuItems, setMenuItems] = useState([]);

  // FIX 1: Use state for isAdmin so it re-renders when localStorage changes
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // FIX 2: Read the role inside useEffect so it always catches the current value
    const role = localStorage.getItem("userRole") || "";
    console.log("=== RECEIPTS DEBUG ===");
    console.log("userRole from localStorage:", JSON.stringify(role));
    console.log("isAdmin result:", role === "Admin");
    setIsAdmin(role === "Admin");

    fetchReceipts();
    axios
      .get(`${API_BASE_URL}/api/menu`)
      .then((res) => setMenuItems(res.data || []))
      .catch(() => {});
  }, []);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/receipts`, {
        params: { search, from: fromDate, to: toDate },
      });
      setReceipts(res.data);
    } catch (err) {
      console.error("Receipts error:", err);
    }
    setLoading(false);
  };

  const viewReceipt = async (id) => {
    setModalLoading(true);
    setEditMode(false);
    setSelectedReceipt({ sale: null, items: [] });
    try {
      const res = await axios.get(`${API_BASE_URL}/api/receipts/${id}`);
      setSelectedReceipt({
        sale: res.data.sale || {},
        items: res.data.items || [],
      });
      setEditItems(res.data.items?.map((i) => ({ ...i })) || []);
    } catch (err) {
      alert("Failed to load receipt");
      setSelectedReceipt(null);
    }
    setModalLoading(false);
  };

  const closeModal = () => {
    setSelectedReceipt(null);
    setEditMode(false);
    setEditItems([]);
  };

  const updateItem = (index, field, value) => {
    setEditItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeItem = (index) => {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setEditItems((prev) => [...prev, { product_name: "", qty: 1, price: 0 }]);
  };

  const editTotal = editItems.reduce(
    (acc, item) =>
      acc + (parseFloat(item.price) || 0) * (parseInt(item.qty) || 0),
    0
  );

  const saveEdits = async () => {
    if (editItems.length === 0)
      return alert("Cannot save a sale with no items.");
    if (editItems.some((i) => !i.product_name))
      return alert("All items must have a product name.");

    setSaving(true);
    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/receipts/${selectedReceipt.sale.id}/edit`,
        { items: editItems, total_price: editTotal },
        {
          headers: {
            "user-role": localStorage.getItem("userRole") || "",
          },
        }
      );
      if (res.data.success) {
        await viewReceipt(selectedReceipt.sale.id);
        setEditMode(false);
        fetchReceipts();
      } else {
        alert(res.data.message || "Failed to save.");
      }
    } catch (err) {
      alert("Network error saving changes.");
    }
    setSaving(false);
  };

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

  const subtotal =
    selectedReceipt?.items?.reduce(
      (acc, item) =>
        acc + parseFloat(item.price || 0) * parseInt(item.qty || 0),
      0
    ) || 0;

  return (
    <div className="receipts-container">
      <h2 className="receipts-title">Receipts</h2>

      {/* FIX 3: Temporary debug badge — remove after confirming it works */}
      <div
        style={{
          marginBottom: 12,
          padding: "6px 12px",
          background: isAdmin ? "#dcfce7" : "#fee2e2",
          border: `1px solid ${isAdmin ? "#16a34a" : "#dc2626"}`,
          borderRadius: 6,
          fontSize: 13,
          color: isAdmin ? "#15803d" : "#b91c1c",
          display: "inline-block",
        }}
      >
        Role: <strong>{localStorage.getItem("userRole") || "(none)"}</strong>{" "}
        — Edit button: <strong>{isAdmin ? "VISIBLE" : "HIDDEN"}</strong>
      </div>

      {/* FILTERS */}
      <div className="receipts-filters">
        <div style={{ position: "relative", flex: 1 }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9ca3af",
            }}
          />
          <input
            className="receipts-input"
            placeholder="Search customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <input
          className="receipts-input"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <input
          className="receipts-input"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        <button className="receipts-btn" onClick={fetchReceipts}>
          Filter
        </button>
      </div>

      {/* TABLE */}
      <div className="receipts-table-wrapper">
        {loading ? (
          <p style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>
            Loading receipts...
          </p>
        ) : receipts.length === 0 ? (
          <p style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>
            No receipts found.
          </p>
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
                  <td style={{ fontWeight: 600 }}>
                    {parseFloat(r.total_price).toLocaleString()}
                  </td>
                  <td>
                    <span
                      style={{
                        background: getPaymentBadgeColor(r.payment_method),
                        color: "white",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {r.payment_method || "—"}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        background:
                          r.payment_status === "Completed"
                            ? "#dcfce7"
                            : r.payment_status === "Unpaid"
                            ? "#fee2e2"
                            : "#fef9c3",
                        color:
                          r.payment_status === "Completed"
                            ? "#15803d"
                            : r.payment_status === "Unpaid"
                            ? "#b91c1c"
                            : "#92400e",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
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
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 12,
              width: "100%",
              maxWidth: editMode ? 560 : 420,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
              transition: "max-width 0.2s",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>
                {editMode
                  ? `✏️ Editing Sale #${selectedReceipt?.sale?.id}`
                  : `Receipt #${selectedReceipt?.sale?.id || "..."}`}
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                {!editMode && (
                  <button
                    onClick={printReceipt}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#1d4ed8",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      padding: "7px 14px",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <Printer size={15} /> Print
                  </button>
                )}

                {/* FIX 4: isAdmin is now reactive state — this will correctly show/hide */}
                {isAdmin && !editMode && (
                  <button
                    onClick={() => setEditMode(true)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#f59e0b",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      padding: "7px 14px",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    <Pencil size={15} /> Edit Sale
                  </button>
                )}

                <button
                  onClick={closeModal}
                  style={{
                    background: "#f3f4f6",
                    border: "none",
                    borderRadius: 6,
                    padding: "7px 10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            {modalLoading ? (
              <div
                style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}
              >
                Loading receipt...
              </div>
            ) : editMode ? (
              /* ── EDIT MODE ── */
              <div style={{ padding: 20 }}>
                <p
                  style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}
                >
                  Make corrections below. Changes will update the sale record
                  and total.
                </p>

                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    overflow: "hidden",
                    marginBottom: 14,
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f9fafb" }}>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            borderBottom: "1px solid #e5e7eb",
                            fontWeight: 600,
                            color: "#374151",
                          }}
                        >
                          Product
                        </th>
                        <th
                          style={{
                            padding: "10px 8px",
                            textAlign: "center",
                            borderBottom: "1px solid #e5e7eb",
                            fontWeight: 600,
                            color: "#374151",
                            width: 60,
                          }}
                        >
                          Qty
                        </th>
                        <th
                          style={{
                            padding: "10px 8px",
                            textAlign: "right",
                            borderBottom: "1px solid #e5e7eb",
                            fontWeight: 600,
                            color: "#374151",
                            width: 80,
                          }}
                        >
                          Price
                        </th>
                        <th
                          style={{
                            padding: "10px 8px",
                            textAlign: "center",
                            borderBottom: "1px solid #e5e7eb",
                            width: 40,
                          }}
                        ></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editItems.map((item, i) => (
                        <tr
                          key={i}
                          style={{ borderBottom: "1px solid #f3f4f6" }}
                        >
                          <td style={{ padding: "8px 12px" }}>
                            <select
                              value={item.product_name}
                              onChange={(e) => {
                                const selected = menuItems.find(
                                  (m) => m.product_name === e.target.value
                                );
                                updateItem(i, "product_name", e.target.value);
                                if (selected)
                                  updateItem(i, "price", selected.price);
                              }}
                              style={{
                                width: "100%",
                                padding: "6px 8px",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                fontSize: 13,
                                outline: "none",
                              }}
                            >
                              <option value="">— Select item —</option>
                              {menuItems.map((m) => (
                                <option key={m.id} value={m.product_name}>
                                  {m.product_name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: "8px" }}>
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) =>
                                updateItem(i, "qty", e.target.value)
                              }
                              style={{
                                width: "100%",
                                padding: "6px",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                fontSize: 13,
                                textAlign: "center",
                                outline: "none",
                              }}
                            />
                          </td>
                          <td style={{ padding: "8px" }}>
                            <input
                              type="number"
                              min="0"
                              value={item.price}
                              onChange={(e) =>
                                updateItem(i, "price", e.target.value)
                              }
                              style={{
                                width: "100%",
                                padding: "6px",
                                borderRadius: 6,
                                border: "1px solid #d1d5db",
                                fontSize: 13,
                                textAlign: "right",
                                outline: "none",
                              }}
                            />
                          </td>
                          <td style={{ padding: "8px", textAlign: "center" }}>
                            <button
                              onClick={() => removeItem(i)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#ef4444",
                                padding: 4,
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={addItem}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "none",
                    border: "1px dashed #d1d5db",
                    borderRadius: 8,
                    padding: "8px 14px",
                    cursor: "pointer",
                    color: "#6b7280",
                    fontSize: 13,
                    width: "100%",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <Plus size={14} /> Add item
                </button>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: 700,
                    fontSize: 15,
                    padding: "12px 4px",
                    borderTop: "2px solid #e5e7eb",
                  }}
                >
                  <span>New Total</span>
                  <span style={{ color: "#2563eb" }}>
                    Ksh {editTotal.toLocaleString()}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 16,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={() => setEditMode(false)}
                    style={{
                      padding: "9px 18px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      background: "#fff",
                      color: "#374151",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdits}
                    disabled={saving}
                    style={{
                      padding: "9px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: saving ? "#9ca3af" : "#059669",
                      color: "white",
                      cursor: saving ? "not-allowed" : "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </div>
            ) : (
              /* ── VIEW MODE ── */
              <div style={{ padding: 20 }}>
                <div
                  id="receipt-box"
                  style={{
                    fontFamily: "'Courier New', monospace",
                    fontSize: 13,
                    color: "#111",
                  }}
                >
                  <div style={{ textAlign: "center", marginBottom: 12 }}>
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 700,
                        letterSpacing: 2,
                      }}
                    >
                      FIRST CLASS LOGISTICS
                    </div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                      Official Receipt
                    </div>
                  </div>
                  <div
                    style={{ borderTop: "1px dashed #ccc", margin: "10px 0" }}
                  />
                  <div style={{ marginBottom: 10 }}>
                    {[
                      ["Receipt #", selectedReceipt.sale?.id],
                      [
                        "Customer",
                        selectedReceipt.sale?.client_name || "Guest",
                      ],
                      [
                        "Payment",
                        selectedReceipt.sale?.payment_method || "—",
                      ],
                      ["Status", selectedReceipt.sale?.payment_status],
                      [
                        "Date",
                        new Date(
                          selectedReceipt.sale?.sale_date
                        ).toLocaleString(),
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ color: "#555", fontSize: 12 }}>
                          {label}
                        </span>
                        <span style={{ fontWeight: 600 }}>{value}</span>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{ borderTop: "1px dashed #ccc", margin: "10px 0" }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: "#888",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ flex: 2 }}>ITEM</span>
                    <span style={{ textAlign: "center", flex: 1 }}>QTY</span>
                    <span style={{ textAlign: "right", flex: 1 }}>PRICE</span>
                    <span style={{ textAlign: "right", flex: 1 }}>TOTAL</span>
                  </div>
                  {selectedReceipt.items?.length === 0 ? (
                    <p
                      style={{
                        color: "#9ca3af",
                        fontSize: 12,
                        textAlign: "center",
                      }}
                    >
                      No items found
                    </p>
                  ) : (
                    selectedReceipt.items?.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 5,
                          fontSize: 13,
                        }}
                      >
                        <span style={{ flex: 2 }}>{item.product_name}</span>
                        <span style={{ textAlign: "center", flex: 1 }}>
                          {item.qty}
                        </span>
                        <span style={{ textAlign: "right", flex: 1 }}>
                          {parseFloat(item.price).toLocaleString()}
                        </span>
                        <span
                          style={{
                            textAlign: "right",
                            flex: 1,
                            fontWeight: 600,
                          }}
                        >
                          {(
                            parseFloat(item.price) * parseInt(item.qty)
                          ).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                  <div
                    style={{ borderTop: "1px dashed #ccc", margin: "10px 0" }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    <span>TOTAL</span>
                    <span>
                      Ksh{" "}
                      {parseFloat(
                        selectedReceipt.sale?.total_price || subtotal
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div
                    style={{ borderTop: "1px dashed #ccc", margin: "10px 0" }}
                  />
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: 11,
                      color: "#666",
                      marginTop: 8,
                    }}
                  >
                    <p>Thank you for dining with us!</p>
                    <p style={{ marginTop: 4, fontSize: 10 }}>
                      Powered by Codey Craft Africa
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Receipts;