import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL;

const Receipts = () => {
  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    setLoading(true);

    try {
      const res = await axios.get(`${API_BASE_URL}/api/receipts`, {
        params: {
          search,
          from: fromDate,
          to: toDate
        }
      });

      setReceipts(res.data);
    } catch (err) {
      console.error("Receipts error:", err);
    }

    setLoading(false);
  };

 const viewReceipt = async (id) => {

  console.log("Fetching receipt:", id);

  try {

    const res = await axios.get(`${API_BASE_URL}/api/receipts/${id}`);

    console.log("RESPONSE:", res.data);

    if (res.data.success) {

      setSelectedReceipt({
        sale: res.data.sale,
        items: res.data.items || []
      });

    } else {
      alert("Receipt not found");
    }

  } catch (err) {

    console.error("View receipt error:", err.response || err);

    alert("Failed to load receipt");
  }
};

  const printReceipt = () => {
  const printContent = document.getElementById("receipt-box");

  if (!printContent) return;

  const win = window.open("", "", "width=350,height=600");

  win.document.write(`
    <html>
      <head>
        <title>Receipt</title>
        <style>
          body { font-family: monospace; padding: 10px; }
          .center { text-align: center; }
          .line { border-top: 1px dashed #000; margin: 10px 0; }
          table { width: 100%; }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        ${printContent.outerHTML}
      </body>
    </html>
  `);

  win.document.close();
};

  return (
    <div className="receipts-container">

      <h2 className="receipts-title">Receipts</h2>

      {/* FILTERS */}
      <div className="receipts-filters">

        <input
          className="receipts-input"
          placeholder="Search customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

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
          <p>Loading...</p>
        ) : (
          <table className="receipts-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Method</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td>
  {r.id}
  {console.log("ROW:", r)}
</td>
                  <td>{r.client_name}</td>
                  <td>{r.total_price}</td>
                  <td>{r.payment_method}</td>
                  <td>{new Date(r.sale_date).toLocaleString()}</td>
                  <td>
                    <button
  className="view-btn"
  onClick={() => {
    console.log("CLICKED:", r.id);
    viewReceipt(r.id);
  }}
>
  View
</button>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        )}
      </div>

      {/* RECEIPT PREVIEW */}
      {selectedReceipt && (
        <div className="receipt-section">

          <div id="receipt-box" className="receipt-box">

            <h2 className="center">FIRST CLASS HOTEL</h2>
            <p className="center">Official Receipt</p>

            <div className="line"></div>

            <p><b>Receipt #:</b> {selectedReceipt.sale?.id}</p>
            <p><b>Customer:</b> {selectedReceipt.sale?.client_name}</p>
            <p><b>Method:</b> {selectedReceipt.sale?.payment_method}</p>
            <p><b>Date:</b> {selectedReceipt.sale?.sale_date && new Date(selectedReceipt.sale.sale_date).toLocaleString()}</p>

            <div className="line"></div>

            <table className="receipt-items">
              <tbody>
                {(selectedReceipt.items || []).map((item, i) => (
                  <tr key={i}>
                    <td>{item.product_name}</td>
                    <td>x{item.qty}</td>
                    <td className="right">{item.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="line"></div>

            <h3>Total: {selectedReceipt.sale?.total_price}</h3>

            <p className="center">Thank you 🙏</p>
          </div>

          <button className="print-btn" onClick={printReceipt}>
            Print Receipt
          </button>

        </div>
      )}

    </div>
  );
};

export default Receipts;