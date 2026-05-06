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

    console.log("FULL RESPONSE:", res.data);

    setSelectedReceipt({
      sale: res.data.sale || {},
      items: res.data.items || []
    });

  } catch (err) {

    console.error("View receipt error:", err);

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
  <div
    style={{
      background: "white",
      border: "5px solid red",
      padding: "20px",
      marginTop: "20px",
      color: "black",
      zIndex: 9999
    }}
  >
    <h1>RECEIPT IS WORKING</h1>

    <p>ID: {selectedReceipt.sale?.id}</p>

    <p>Customer: {selectedReceipt.sale?.client_name}</p>

    <pre>
      {JSON.stringify(selectedReceipt, null, 2)}
    </pre>
  </div>
)}

    </div>
  );
};

export default Receipts;