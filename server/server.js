const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const datetime = require('node-datetime');
const db = require('./db');
require('dotenv').config();

// ─────────────────────────────────────────
// PORTIONS MAP BUILDER — single source of truth for combo expansion
// Used by inventory, audit report, and weekly reset
// ─────────────────────────────────────────

const buildPortionsMap = (salesRows) => {
    const portionsMap = {};

    salesRows.forEach(row => {
        const name = (row.product_name || '').toLowerCase().trim();
        const qty  = Number(row.total_qty || 0);

        if (name.includes("chapati beans")) {
            portionsMap["Chapati"] = (portionsMap["Chapati"] || 0) + qty * 2;
            portionsMap["Beans"]   = (portionsMap["Beans"]   || 0) + qty;

        } else if (name.includes("chapati ndengu")) {
            portionsMap["Chapati"] = (portionsMap["Chapati"] || 0) + qty * 2;
            portionsMap["Ndengu"]  = (portionsMap["Ndengu"]  || 0) + qty;

        } else if (name.includes("ndengu rice") || name.includes("rice ndengu")) {
            portionsMap["Rice"]   = (portionsMap["Rice"]   || 0) + qty;
            portionsMap["Ndengu"] = (portionsMap["Ndengu"] || 0) + qty;

        } else if (name === "smocha") {
    portionsMap["Chapati"] = (portionsMap["Chapati"] || 0) + qty;
    portionsMap["Smokies"] = (portionsMap["Smokies"] || 0) + qty;

        } else {
            // Normal item — use product_name as-is
            portionsMap[row.product_name] = (portionsMap[row.product_name] || 0) + qty;
        }
    });

    return portionsMap;
};

// ─────────────────────────────────────────
// COMBO HELPERS
// ─────────────────────────────────────────

const splitComboItems = (items) => {
    const expanded = [];
    items.forEach(item => {
        const name = item.product_name.toLowerCase();
        if (name.includes("chapati beans")) {
            expanded.push({ product_name: "Chapati", qty: item.qty * 2, price: 0 });
            expanded.push({ product_name: "Beans",   qty: item.qty,     price: 0 });
        } else if (name.includes("chapati ndengu")) {
            expanded.push({ product_name: "Chapati", qty: item.qty * 2, price: 0 });
            expanded.push({ product_name: "Ndengu",  qty: item.qty,     price: 0 });
        } else if (name.includes("ndengu rice") || name.includes("rice ndengu")) {
            expanded.push({ product_name: "Rice",   qty: item.qty, price: 0 });
            expanded.push({ product_name: "Ndengu", qty: item.qty, price: 0 });
        } else if (name === "smocha") {
    expanded.push({ product_name: "Chapati", qty: item.qty, price: 0 });
    expanded.push({ product_name: "Smokies", qty: item.qty, price: 0 });
} else {
    expanded.push(item);
}
    });
    return expanded;
};

const expandComboForReports = async (items) => {
    return new Promise((resolve, reject) => {
        db.query("SELECT product_name, price FROM menu_items", (err, menu) => {
            if (err) return reject(err);
            const priceMap = {};
            menu.forEach(m => { priceMap[m.product_name.toLowerCase()] = Number(m.price); });

            const expanded = [];
            items.forEach(item => {
                const name = item.product_name.toLowerCase();
                const qty  = Number(item.total_qty || 0);

                if (name.includes("chapati beans")) {
                    expanded.push({ product_name: "Chapati", total_qty: qty * 2, price: priceMap["chapati"] || 0, total_revenue: (priceMap["chapati"] || 0) * qty * 2 });
                    expanded.push({ product_name: "Beans",   total_qty: qty,     price: priceMap["beans"]   || 0, total_revenue: (priceMap["beans"]   || 0) * qty });
                } else if (name.includes("chapati ndengu")) {
                    expanded.push({ product_name: "Chapati", total_qty: qty * 2, price: priceMap["chapati"] || 0, total_revenue: (priceMap["chapati"] || 0) * qty * 2 });
                    expanded.push({ product_name: "Ndengu",  total_qty: qty,     price: priceMap["ndengu"]  || 0, total_revenue: (priceMap["ndengu"]  || 0) * qty });
                } else if (name.includes("ndengu rice") || name.includes("rice ndengu")) {
                    expanded.push({ product_name: "Rice",   total_qty: qty, price: priceMap["rice"]   || 0, total_revenue: (priceMap["rice"]   || 0) * qty });
                    expanded.push({ product_name: "Ndengu", total_qty: qty, price: priceMap["ndengu"] || 0, total_revenue: (priceMap["ndengu"] || 0) * qty });
                } else if (name === "smocha") {
                    expanded.push({ product_name: "Chapati", total_qty: qty, price: priceMap["chapati"] || 0, total_revenue: (priceMap["chapati"] || 0) * qty });
                    expanded.push({ product_name: "Smokies", total_qty: qty, price: priceMap["smokies"] || 0, total_revenue: (priceMap["smokies"] || 0) * qty });
                } else {
                    expanded.push(item);
                }
            });
            resolve(expanded);
        });
    });
};

const normalizePaymentMethod = (method) => {
    if (!method) return '';
    const m = method.toLowerCase();
    if (m.includes('mpesa') || m.includes('m-pesa')) return 'MPesa';
    if (m.includes('cash'))        return 'Cash';
    if (m.includes('advance'))     return 'Advance';
    if (m.includes('credit'))      return 'Credit';
    if (m.includes('compliment'))  return 'Complimentary';
    return method;
};

// ─────────────────────────────────────────
// APP SETUP
// ─────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

db.getConnection((err, connection) => {
    if (err) console.error('Error connecting to MySQL:', err.message);
    else { console.log('Connected to First Class Logistics Database successfully.'); connection.release(); }
});

const getLocalDate = () => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};

// ─────────────────────────────────────────
// STOCK HELPERS
// ─────────────────────────────────────────

const logStockUsage = (items, reason = 'Sale') => {
    items.forEach(item => {
        db.query(
            `SELECT material_name, yield_per_unit FROM yield_rules WHERE menu_item_name = ?`,
            [item.product_name],
            (err, rules) => {
                if (err) return console.error(err);
                rules.forEach(rule => {
                    const kgUsed = item.qty / parseFloat(rule.yield_per_unit);
                    db.query(
                        `INSERT INTO inventory_logs (item_name, qty, reason, created_at) VALUES (?, ?, ?, NOW())`,
                        [rule.material_name, kgUsed, reason]
                    );
                });
            }
        );
    });
};

// ─────────────────────────────────────────
// MPESA HELPERS
// ─────────────────────────────────────────

const generateToken = async (req, res, next) => {
    const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
    try {
        const { data } = await axios.get(
            "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
            { headers: { Authorization: `Basic ${auth}` } }
        );
        req.token = data.access_token;
        next();
    } catch (err) {
        console.error("Token Generation Error:", err.response?.data || err.message);
        res.status(500).json({ message: "Failed to generate M-Pesa token" });
    }
};

// ─────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.query(
        `SELECT users.id, users.username, roles.role_name FROM users JOIN roles ON users.role_id = roles.id WHERE users.username = ? AND users.password = ?`,
        [username, password],
        (err, results) => {
            if (err) return res.status(500).json({ success: false });
            if (results.length > 0) res.json({ success: true, user: { id: results[0].id, username: results[0].username, role: results[0].role_name } });
            else res.status(401).json({ success: false });
        }
    );
});

app.get('/api/admin/users', (req, res) => {
    if (req.headers['user-role'] !== 'Admin') return res.status(403).json({ message: "Access Denied" });
    db.query(`SELECT users.id, users.username, roles.role_name FROM users JOIN roles ON users.role_id = roles.id`, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.post('/api/admin/create-user', (req, res) => {
    const { username, password, role_id } = req.body;
    db.query("INSERT INTO users (username, password, role_id) VALUES (?, ?, ?)", [username, password, role_id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, message: "User created!" });
    });
});

app.put('/api/admin/reset-password', (req, res) => {
    if (req.headers['user-role'] !== 'Admin') return res.status(403).json("Unauthorized");
    db.query("UPDATE users SET password = ? WHERE id = ?", [req.body.newPassword, req.body.userId], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

app.delete('/api/admin/delete-user/:id', (req, res) => {
    if (req.headers['user-role'] !== 'Admin') return res.status(403).json("Unauthorized");
    db.query("DELETE FROM users WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// ─────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────

app.get('/api/customers', (req, res) => {
    db.query("SELECT * FROM customers ORDER BY full_name ASC", (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.post('/api/customers/create', (req, res) => {
    const { full_name, customer_type, phone_number } = req.body;
    db.query("INSERT INTO customers (full_name, customer_type, phone_number) VALUES (?, ?, ?)", [full_name, customer_type, phone_number], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, id: result.insertId });
    });
});

app.put('/api/customers/topup', (req, res) => {
    const { customer_id, amount, clientName } = req.body;
    const topupAmount = parseFloat(amount);
    db.query("SELECT credit_balance, wallet_balance FROM customers WHERE customer_id = ?", [customer_id], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ error: "Customer not found" });
        const debt        = parseFloat(results[0].credit_balance || 0);
        const wallet      = parseFloat(results[0].wallet_balance || 0);
        const debtCleared = Math.min(debt, topupAmount);
        const newDebt     = debt - debtCleared;
        const newWallet   = wallet + (topupAmount - debtCleared);
        db.query(`UPDATE customers SET credit_balance = ?, wallet_balance = ? WHERE customer_id = ?`, [newDebt, newWallet, customer_id], (err2) => {
            if (err2) return res.status(500).json(err2);
            db.query(
                `INSERT INTO wallet_transactions (customer_id, customer_name, type, amount, balance_after, reference) VALUES (?, ?, 'DEPOSIT', ?, ?, ?)`,
                [customer_id, clientName, topupAmount, newWallet, 'Wallet Topup'],
                (err3) => {
                    if (err3) return res.status(500).json(err3);
                    res.json({ success: true, wallet_balance: newWallet, credit_balance: newDebt });
                }
            );
        });
    });
});

app.get('/api/customers/total-credit', (req, res) => {
    db.query("SELECT SUM(credit_balance) as total_credit FROM customers", (err, results) => {
        if (err) return res.status(500).json(err);
        res.json({ total_credit: results[0].total_credit || 0 });
    });
});

app.get('/api/customers/:id/statement', (req, res) => {
    db.query(
        `SELECT s.id as sale_id, s.sale_date, s.payment_method, s.payment_status, si.product_name, si.qty, si.price FROM sales s JOIN sales_items si ON s.id = si.sale_id WHERE s.customer_id = ? ORDER BY s.sale_date DESC LIMIT 100`,
        [req.params.id], (err, results) => {
            if (err) return res.status(500).json(err);
            res.json(results);
        }
    );
});

app.get('/api/customers/:id/wallet-history', (req, res) => {
    db.query(
        `SELECT id, customer_id, customer_name, type, amount, balance_after, reference, created_at FROM wallet_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50`,
        [req.params.id], (err, results) => {
            if (err) { console.warn("wallet_transactions error:", err.message); return res.json([]); }
            res.json(results);
        }
    );
});

// ─────────────────────────────────────────
// MENU
// ─────────────────────────────────────────

app.get('/api/menu', (req, res) => {
    db.query("SELECT * FROM menu_items", (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// ─────────────────────────────────────────
// MPESA
// ─────────────────────────────────────────

app.post('/api/pay/stk', generateToken, async (req, res) => {
    const { phone, amount, clientName, items } = req.body;
    const shortCode = process.env.MPESA_SHORTCODE || "174379";
    const timestamp = datetime.create().format('YmdHMS');
    const password  = Buffer.from(shortCode + process.env.MPESA_PASSKEY + timestamp).toString('base64');
    try {
        const { data } = await axios.post(
            "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            { BusinessShortCode: shortCode, Password: password, Timestamp: timestamp, TransactionType: "CustomerPayBillOnline", Amount: amount, PartyA: phone, PartyB: shortCode, PhoneNumber: phone, CallBackURL: process.env.CALLBACK_URL, AccountReference: "FirstClassHotels", TransactionDesc: `Food for ${clientName}` },
            { headers: { Authorization: `Bearer ${req.token}` } }
        );
        db.query(
            `INSERT INTO sales (client_name, total_price, payment_status, mpesa_checkout_id, sale_date) VALUES (?, ?, 'Pending', ?, NOW())`,
            [clientName, amount, data.CheckoutRequestID],
            (err, result) => {
                if (err) return console.error("DB Insert Error:", err);
                const itemValues = items.map(item => [result.insertId, item.product_name, item.qty, item.price]);
                db.query(`INSERT INTO sales_items (sale_id, product_name, qty, price) VALUES ?`, [itemValues]);
                res.json(data);
            }
        );
    } catch (err) {
        console.error("STK Error:", err.response?.data || err.message);
        res.status(500).json({ message: "STK Push Failed" });
    }
});

app.get('/api/check-payment/:checkoutID', (req, res) => {
    db.query("SELECT payment_status FROM sales WHERE mpesa_checkout_id = ?", [req.params.checkoutID], (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!results.length) return res.status(404).json({ status: "Not Found" });
        res.json({ status: results[0].payment_status });
    });
});

// ─────────────────────────────────────────
// CASH PAYMENT
// ─────────────────────────────────────────

app.post('/api/pay/cash', (req, res) => {
    const { clientName, amount, items } = req.body;
    db.query(
        "INSERT INTO sales (client_name, total_price, payment_status, sale_date) VALUES (?, ?, 'Completed', NOW())",
        [clientName, amount],
        (err, result) => {
            if (err) return res.status(500).json({ success: false });
            const itemValues = items.map(item => [result.insertId, item.product_name, item.qty, item.price]);
            db.query(`INSERT INTO sales_items (sale_id, product_name, qty, price) VALUES ?`, [itemValues], (itemErr) => {
                if (itemErr) return res.status(500).json({ success: false });
                logStockUsage(splitComboItems(items), 'Cash Sale');
                res.json({ success: true });
            });
        }
    );
});

// ─────────────────────────────────────────
// UNIFIED PAYMENT
// ─────────────────────────────────────────

app.post('/api/pay/unified', (req, res) => {
    const { clientName, amount, items, paymentMethod, customerId } = req.body;

    let method = paymentMethod || "";
    if (method.toLowerCase().includes('mpesa') || method.toLowerCase().includes('m-pesa')) method = 'MPesa';

    const finalPrice    = amount;
    const paymentStatus = method === 'Credit' ? 'Unpaid' : 'Completed';
    const cleanedItems  = Array.isArray(items) ? items : [];
    const stockItems    = splitComboItems(cleanedItems);

    db.query(
        `INSERT INTO sales (client_name, total_price, payment_status, payment_method, customer_id, sale_date) VALUES (?, ?, ?, ?, ?, NOW())`,
        [clientName, finalPrice, paymentStatus, method, customerId || null],
        (err, result) => {
            if (err) return res.status(500).json({ success: false, error: err.message });

            const saleId     = result.insertId;
            const itemValues = cleanedItems.filter(i => i && i.product_name).map(item => [saleId, item.product_name, item.qty || 0, item.price || 0]);

            db.query(`INSERT INTO sales_items (sale_id, product_name, qty, price) VALUES ?`, [itemValues], (itemErr) => {
                if (itemErr) return res.status(500).json({ success: false });

                if (method === 'Advance' && customerId) {
                    db.query("UPDATE customers SET wallet_balance = wallet_balance - ? WHERE customer_id = ?", [amount, customerId], (walletErr) => {
                        if (walletErr) console.error(walletErr);
                        db.query("SELECT wallet_balance FROM customers WHERE customer_id = ?", [customerId], (balErr, balResult) => {
                            if (!balErr && balResult.length > 0) {
                                db.query(
                                    `INSERT INTO wallet_transactions (customer_id, customer_name, type, amount, balance_after, reference) VALUES (?, ?, 'WITHDRAWAL', ?, ?, ?)`,
                                    [customerId, clientName, amount, balResult[0].wallet_balance, 'Food Purchase']
                                );
                            }
                        });
                    });
                }

                if (method === 'Credit' && customerId) {
                    db.query("UPDATE customers SET credit_balance = credit_balance + ? WHERE customer_id = ?", [amount, customerId]);
                }

                logStockUsage(stockItems, `Sale (${method})`);
                res.json({ success: true, saleId });
            });
        }
    );
});

// ─────────────────────────────────────────
// MPESA CALLBACK
// ─────────────────────────────────────────

app.post('/api/callback', (req, res) => {
    const callbackData = req.body.Body.stkCallback;
    const checkoutID   = callbackData.CheckoutRequestID;
    const finalStatus  = callbackData.ResultCode === 0 ? 'Completed' : 'Failed';

    db.query("UPDATE sales SET payment_status = ? WHERE mpesa_checkout_id = ?", [finalStatus, checkoutID]);

    if (finalStatus === 'Completed') {
        db.query(
            `SELECT si.product_name, si.qty FROM sales_items si JOIN sales s ON si.sale_id = s.id WHERE s.mpesa_checkout_id = ?`,
            [checkoutID],
            (err, items) => {
                if (err || !items || !items.length) return;
                logStockUsage(splitComboItems(items), 'Mpesa Sale');
            }
        );
    }
    res.json("Received");
});

// ─────────────────────────────────────────
// RECEIPTS
// ─────────────────────────────────────────

app.get('/api/receipts', (req, res) => {
    const { search, from, to } = req.query;
    let sql = `SELECT s.id, s.client_name, s.total_price, s.payment_method, s.payment_status, s.sale_date FROM sales s WHERE 1=1`;
    const params = [];
    if (search) { sql += " AND s.client_name LIKE ?"; params.push(`%${search}%`); }
    if (from && to) { sql += " AND DATE(s.sale_date) BETWEEN ? AND ?"; params.push(from, to); }
    sql += " ORDER BY s.sale_date DESC";
    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.get('/api/receipts/:id', (req, res) => {
    db.query("SELECT * FROM sales WHERE id = ? LIMIT 1", [req.params.id], (saleErr, saleResult) => {
        if (saleErr) return res.status(500).json({ success: false, error: saleErr.message });
        if (!saleResult || !saleResult.length) return res.status(404).json({ success: false, error: "Receipt not found" });
        db.query("SELECT id, sale_id, product_name, qty, price FROM sales_items WHERE sale_id = ?", [req.params.id], (itemsErr, itemsResult) => {
            if (itemsErr) return res.status(500).json({ success: false, error: itemsErr.message });
            res.json({ success: true, sale: saleResult[0], items: itemsResult || [] });
        });
    });
});

app.put('/api/receipts/:id/edit', (req, res) => {
    if (req.headers['user-role'] !== 'Admin') return res.status(403).json({ success: false, message: "Unauthorized" });
    const saleId = req.params.id;
    const { items, total_price } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: "No items provided" });

    db.query("DELETE FROM sales_items WHERE sale_id = ?", [saleId], (delErr) => {
        if (delErr) return res.status(500).json({ success: false, error: delErr.message });
        const itemValues = items.map(item => [saleId, item.product_name, item.qty, item.price]);
        db.query("INSERT INTO sales_items (sale_id, product_name, qty, price) VALUES ?", [itemValues], (insErr) => {
            if (insErr) return res.status(500).json({ success: false, error: insErr.message });
            db.query("UPDATE sales SET total_price = ? WHERE id = ?", [total_price, saleId], (updErr) => {
                if (updErr) return res.status(500).json({ success: false, error: updErr.message });
                res.json({ success: true, message: "Sale updated successfully" });
            });
        });
    });
});

// ─────────────────────────────────────────
// INVENTORY
// ─────────────────────────────────────────

app.get('/api/inventory', (req, res) => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const formattedStart = startOfWeek.toISOString().split('T')[0];

    const salesSql = `
        SELECT si.product_name, SUM(si.qty) as total_qty
        FROM sales_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.payment_status = 'Completed'
        AND s.sale_date >= ?
        GROUP BY si.product_name
    `;

    db.query(salesSql, [formattedStart], (salesErr, salesRows) => {
        if (salesErr) return res.status(500).json(salesErr);

        const portionsMap = buildPortionsMap(salesRows);

        const portionsMapLower = {};
Object.keys(portionsMap).forEach(k => {
    portionsMapLower[k.toLowerCase().trim()] = portionsMap[k];
});

        db.query(
            `SELECT i.id, i.item_name, i.unit_measure, i.opening_stock, i.added_stock,
                    y.menu_item_name, y.yield_per_unit
             FROM inventory i
             LEFT JOIN yield_rules y ON i.item_name = y.material_name`,
            (invErr, invRows) => {
                if (invErr) return res.status(500).json(invErr);

                const inventoryMap = {};
                invRows.forEach(row => {
                    const key = row.id;
                    if (!inventoryMap[key]) {
                        inventoryMap[key] = {
                            id:               row.id,
                            item_name:        row.item_name,
                            unit_measure:     row.unit_measure,
                            opening_stock:    row.opening_stock,
                            added_stock:      row.added_stock,
                            total_units_used: 0
                        };
                    }
                    if (row.menu_item_name && row.yield_per_unit > 0) {
    // Case-insensitive lookup — finds "Big soda" even if rule says "Big Soda"
    const ruleKey = row.menu_item_name.toLowerCase().trim();
    const portionsSold = portionsMapLower[ruleKey] || 0;
    inventoryMap[key].total_units_used += portionsSold / row.yield_per_unit;
}
                });

                const result = Object.values(inventoryMap).map(item => {
                    const opening   = parseFloat(item.opening_stock)    || 0;
                    const added     = parseFloat(item.added_stock)      || 0;
                    const unitsUsed = parseFloat(item.total_units_used) || 0;
                    const closing   = opening + added - unitsUsed;
                    return {
                        ...item,
                        stock_quantity: parseFloat(closing.toFixed(2)),
                        units_sold:     parseFloat(unitsUsed.toFixed(2))
                    };
                });

                res.json(result);
            }
        );
    });
});

app.put('/api/inventory/update-item', (req, res) => {
    if (req.headers['user-role'] !== 'Admin') return res.status(403).json({ success: false, message: "Unauthorized" });
    const { id, item_name, unit_measure, opening_stock, added_stock } = req.body;
    db.query(
        `UPDATE inventory SET item_name = ?, unit_measure = ?, opening_stock = ?, added_stock = ? WHERE id = ?`,
        [item_name, unit_measure, Number(opening_stock), Number(added_stock), id],
        (err) => {
            if (err) return res.status(500).json({ success: false, error: err });
            res.json({ success: true, message: "Inventory item updated successfully" });
        }
    );
});

app.post('/api/inventory/add-stock', (req, res) => {
    const { item_id, quantity_to_add } = req.body;
    db.query(
        "UPDATE inventory SET added_stock = added_stock + ? WHERE id = ?",
        [quantity_to_add, item_id],
        (err) => {
            if (err) return res.status(500).json(err);
            res.json({ success: true });
        }
    );
});

app.post('/api/inventory/add-new', (req, res) => {
    const { item_name, unit_measure, stock_quantity } = req.body;
    db.query(
        "INSERT INTO inventory (item_name, unit_measure, stock_quantity, opening_stock, added_stock) VALUES (?, ?, ?, ?, 0)",
        [item_name, unit_measure, stock_quantity, stock_quantity],
        (err) => {
            if (err) return res.status(500).json(err);
            res.json({ success: true });
        }
    );
});

// ─────────────────────────────────────────
// WEEKLY RESET
// ─────────────────────────────────────────

app.post('/api/inventory/weekly-reset', (req, res) => {
    if (req.headers['user-role'] !== 'Admin') return res.status(403).json({ message: "Unauthorized" });

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const formattedStart = startOfWeek.toISOString().split('T')[0];

    db.query(
        `SELECT si.product_name, SUM(si.qty) as total_qty
         FROM sales_items si JOIN sales s ON si.sale_id = s.id
         WHERE s.payment_status = 'Completed' AND s.sale_date >= ?
         GROUP BY si.product_name`,
        [formattedStart],
        (salesErr, salesRows) => {
            if (salesErr) return res.status(500).json(salesErr);

            const portionsMap = buildPortionsMap(salesRows);

            // Build a lowercase version for case-insensitive matching
const portionsMapLower = {};
Object.keys(portionsMap).forEach(k => {
    portionsMapLower[k.toLowerCase().trim()] = portionsMap[k];
});

            db.query(
                `SELECT i.id, i.opening_stock, i.added_stock, y.menu_item_name, y.yield_per_unit
                 FROM inventory i
                 LEFT JOIN yield_rules y ON i.item_name = y.material_name`,
                (invErr, invRows) => {
                    if (invErr) return res.status(500).json(invErr);

                    const inventoryMap = {};
                    invRows.forEach(row => {
                        const key = row.id;
                        if (!inventoryMap[key]) {
                            inventoryMap[key] = { id: row.id, opening_stock: row.opening_stock, added_stock: row.added_stock, total_units_used: 0 };
                        }
                        if (row.menu_item_name && row.yield_per_unit > 0) {
                            inventoryMap[key].total_units_used += (portionsMapLower[row.menu_item_name.toLowerCase().trim()] || 0) / row.yield_per_unit;
                        }
                    });

                    Object.values(inventoryMap).forEach(item => {
                        const opening    = parseFloat(item.opening_stock)    || 0;
                        const added      = parseFloat(item.added_stock)      || 0;
                        const unitsUsed  = parseFloat(item.total_units_used) || 0;
                        const newOpening = parseFloat((opening + added - unitsUsed).toFixed(2));
                        db.query("UPDATE inventory SET opening_stock = ?, added_stock = 0 WHERE id = ?", [Math.max(0, newOpening), item.id]);
                    });

                    res.json({ success: true, message: "Weekly stock rolled over successfully" });
                }
            );
        }
    );
});

// ─────────────────────────────────────────
// AUDIT REPORT
// ─────────────────────────────────────────

app.get('/api/inventory/audit-report', (req, res) => {
    db.query(
        `SELECT si.product_name, SUM(si.qty) as total_qty
         FROM sales_items si JOIN sales s ON si.sale_id = s.id
         WHERE s.payment_status = 'Completed'
         GROUP BY si.product_name`,
        (salesErr, salesRows) => {
            if (salesErr) return res.status(500).json(salesErr);

            const portionsMap = buildPortionsMap(salesRows);

            const portionsMapLower = {};
Object.keys(portionsMap).forEach(k => {
    portionsMapLower[k.toLowerCase().trim()] = portionsMap[k];
});


            db.query(
                `SELECT i.item_name, i.unit_measure, i.opening_stock, i.added_stock,
                        y.menu_item_name, y.yield_per_unit
                 FROM inventory i
                 LEFT JOIN yield_rules y ON i.item_name = y.material_name`,
                (invErr, invRows) => {
                    if (invErr) return res.status(500).json(invErr);

                    const groupedAudit = {};
                    invRows.forEach(row => {
                        const key = row.item_name;
                        if (!groupedAudit[key]) {
                            groupedAudit[key] = {
                                name:            row.item_name,
                                unit:            row.unit_measure,
                                totalStartStore: (parseFloat(row.opening_stock) || 0) + (parseFloat(row.added_stock) || 0),
                                soldMap:         {}
                            };
                        }
                        if (row.menu_item_name && row.yield_per_unit > 0) {
                            const menuKey = row.menu_item_name;
                            if (!groupedAudit[key].soldMap[menuKey]) {
                                groupedAudit[key].soldMap[menuKey] = {
                                    name:  menuKey,
                                    qty: portionsMapLower[menuKey.toLowerCase().trim()] || 0,
                                    yield: parseFloat(row.yield_per_unit) || 1
                                };
                            }
                        }
                    });

                    const finalReport = Object.values(groupedAudit).map(mat => {
                        const soldItems        = Object.values(mat.soldMap);
                        let totalUnitsUsed     = 0;
                        soldItems.forEach(item => { totalUnitsUsed += item.qty / item.yield; });

                        const exactRemaining    = mat.totalStartStore - totalUnitsUsed;
                        const wholeUnitsInStore = Math.floor(exactRemaining);
                        const unitDisplay       = mat.unit || 'unit';
                        const totalPortionsSold = soldItems.reduce((acc, i) => acc + i.qty, 0);

                        let soldDetails = '';
                        if (soldItems.length === 1) {
                            soldDetails = `${soldItems[0].qty} portions of ${soldItems[0].name}`;
                        } else if (soldItems.length > 1) {
                            soldDetails = soldItems.map(si => `${si.qty} × ${si.name}`).join(', ') + ` (${totalPortionsSold} total)`;
                        }

                        const openUnitPortions   = soldItems[0]?.yield || 1;
                        const fractionalUsed     = totalUnitsUsed % 1;
                        const portionsLeftInOpen = fractionalUsed > 0 ? Math.round((1 - fractionalUsed) * openUnitPortions) : 0;

                        let message = '';
                        if (soldItems.length > 0 && totalPortionsSold > 0) {
                            if (wholeUnitsInStore < 0) {
                                message = `Stock shortage! Sold: ${soldDetails}. Calculations show a deficit — please recount.`;
                            } else if (portionsLeftInOpen > 0) {
                                message = `Sold: ${soldDetails}. ~${portionsLeftInOpen} portions remain in open ${unitDisplay}. Store should have ${wholeUnitsInStore} full ${unitDisplay}.`;
                            } else {
                                message = `Sold: ${soldDetails}. Store should have ${wholeUnitsInStore} full ${unitDisplay}.`;
                            }
                        } else {
                            message = `No sales recorded. Store should have ${mat.totalStartStore} ${unitDisplay}.`;
                        }

                        return { item: mat.name, unit: unitDisplay, totalSold: totalPortionsSold, soldBreakdown: soldItems, shouldBe: Math.max(0, wholeUnitsInStore), hasShortage: wholeUnitsInStore < 0, message };
                    });

                    res.json(finalReport);
                }
            );
        }
    );
});

// ─────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────

app.get('/api/reports/sales-summary', async (req, res) => {
    const selectedDate = req.query.date || getLocalDate();
    db.query(
        `SELECT product_name, SUM(qty) as total_qty, MAX(price) as price, SUM(qty * price) as total_revenue
         FROM sales_items si JOIN sales s ON si.sale_id = s.id
         WHERE DATE(s.sale_date) = ?
         GROUP BY si.product_name ORDER BY total_qty DESC`,
        [selectedDate],
        async (err, itemResults) => {
            if (err) return res.status(500).json(err);
            const expandedItems = await expandComboForReports(itemResults);

            db.query(
                `SELECT s.payment_method, SUM(si.qty * si.price) as total
                 FROM sales s JOIN sales_items si ON s.id = si.sale_id
                 WHERE DATE(s.sale_date) = ? AND s.payment_status != 'Pending' AND s.payment_method != 'InternalAdjustment'
                 GROUP BY s.payment_method`,
                [selectedDate],
                (err2, payResults) => {
                    if (err2) return res.status(500).json(err2);
                    const payments = { Cash: 0, MPesa: 0, Wallet: 0, Complimentary: 0, Credit: 0, CreditCard: 0 };
                    payResults.forEach(row => {
                        const method = normalizePaymentMethod(row.payment_method);
                        const amount = parseFloat(row.total || 0);
                        if (method === 'Cash') payments.Cash += amount;
                        else if (method === 'MPesa') payments.MPesa += amount;
                        else if (method === 'Advance') payments.Wallet += amount;
                        else if (method === 'Complimentary') payments.Complimentary += amount;
                        else if (method === 'Credit') payments.Credit += amount;
                        else if (method === 'CreditCard') payments.CreditCard += amount;
                    });
                    const grouped = {};
                    expandedItems.forEach(item => {
                        const key = item.product_name;
                        if (!grouped[key]) grouped[key] = { product_name: item.product_name, total_qty: 0, total_revenue: 0, price: item.price };
                        grouped[key].total_qty     += Number(item.total_qty || 0);
                        grouped[key].total_revenue += Number(item.total_revenue || 0);
                        if (grouped[key].total_qty > 0) grouped[key].price = grouped[key].total_revenue / grouped[key].total_qty;
                    });
                    res.json({ itemized: Object.values(grouped), payments });
                }
            );
        }
    );
});

app.get('/api/reports/advanced-summary', (req, res) => {
    db.query(
        `SELECT DATE(sale_date) as date, SUM(total_price) as total FROM sales WHERE payment_status = 'Completed' AND (LOWER(payment_method) LIKE '%cash%' OR LOWER(payment_method) LIKE '%mpesa%') GROUP BY DATE(sale_date) ORDER BY date DESC LIMIT 30`,
        (err, results) => { if (err) return res.status(500).json(err); res.json(results); }
    );
});

app.get('/api/reports/payment-breakdown', (req, res) => {
    db.query("SELECT payment_method, SUM(total_price) as total FROM sales WHERE DATE(sale_date) = ? GROUP BY payment_method",
        [req.query.date], (err, results) => { if (err) return res.status(500).json(err); res.json(results); });
});

app.get('/api/reports/top-items', (req, res) => {
    db.query(
        `SELECT si.product_name, SUM(si.qty) as total_qty FROM sales_items si JOIN sales s ON si.sale_id = s.id WHERE DATE(s.sale_date) = ? AND s.payment_status = 'Completed' GROUP BY si.product_name ORDER BY total_qty DESC LIMIT 5`,
        [req.query.date], (err, results) => { if (err) return res.status(500).json(err); res.json(results); }
    );
});

app.get('/api/reports/hourly-sales', (req, res) => {
    db.query(
        `SELECT HOUR(s.sale_date) as hour, SUM(s.total_price) as total FROM sales s WHERE DATE(s.sale_date) = ? AND s.payment_status = 'Completed' GROUP BY hour ORDER BY hour`,
        [req.query.date], (err, results) => { if (err) return res.status(500).json(err); res.json(results); }
    );
});

app.get('/api/reports/monthly-cumulative', (req, res) => {
    db.query(
        `SELECT COALESCE(SUM(total_price), 0) as total_revenue FROM sales WHERE DATE_FORMAT(sale_date, '%Y-%m') = ? AND payment_status != 'Pending' AND payment_method != 'InternalAdjustment' AND (LOWER(payment_method) LIKE '%cash%' OR LOWER(payment_method) LIKE '%mpesa%' OR LOWER(payment_method) LIKE '%advance%' OR LOWER(payment_method) LIKE '%wallet%')`,
        [req.query.month], (err, results) => { if (err) return res.status(500).json(err); res.json({ total_revenue: parseFloat(results[0].total_revenue) }); }
    );
});

app.get('/api/reports/date-range', async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: "Missing date range" });

    db.query(
        `SELECT si.product_name, SUM(si.qty) as total_qty, MAX(si.price) as price, SUM(si.qty * si.price) as total_revenue
         FROM sales_items si JOIN sales s ON si.sale_id = s.id
         WHERE DATE(s.sale_date) BETWEEN ? AND ? GROUP BY si.product_name ORDER BY total_qty DESC`,
        [from, to],
        async (err, items) => {
            if (err) return res.status(500).json({ error: "Item query failed" });
            const expandedItems = await expandComboForReports(items);

            db.query(
                `SELECT payment_method, SUM(total_price) as total FROM sales WHERE DATE(sale_date) BETWEEN ? AND ? AND payment_status = 'Completed' AND payment_method != 'InternalAdjustment' GROUP BY payment_method`,
                [from, to],
                (err2, paymentsRaw) => {
                    if (err2) return res.status(500).json({ error: "Payment query failed" });
                    const payments = { Cash: 0, MPesa: 0, Wallet: 0, Complimentary: 0, Credit: 0, CreditCard: 0 };
                    (paymentsRaw || []).forEach(row => {
                        const method = normalizePaymentMethod(row.payment_method);
                        const amount = parseFloat(row.total || 0);
                        if (method === 'Cash') payments.Cash += amount;
                        else if (method === 'MPesa') payments.MPesa += amount;
                        else if (method === 'Advance') payments.Wallet += amount;
                        else if (method === 'Complimentary') payments.Complimentary += amount;
                        else if (method === 'Credit') payments.Credit += amount;
                        else if (method === 'CreditCard') payments.CreditCard += amount;
                    });
                    const grouped = {};
                    (expandedItems || []).forEach(item => {
                        const key = item.product_name.trim().toLowerCase();
                        if (!grouped[key]) grouped[key] = { product_name: item.product_name, total_qty: 0, total_revenue: 0, price: Number(item.price || 0) };
                        grouped[key].total_qty     += Number(item.total_qty || 0);
                        grouped[key].total_revenue += Number(item.total_revenue || 0);
                        if (grouped[key].total_qty > 0) grouped[key].price = grouped[key].total_revenue / grouped[key].total_qty;
                    });
                    const totalRevenue = Object.values(payments).reduce((a, b) => a + b, 0);
                    res.json({ itemized: Object.values(grouped), payments, totalRevenue });
                }
            );
        }
    );
});

app.get('/api/reports/customer-orders/:id', (req, res) => {
    db.query(
        `SELECT si.product_name, SUM(si.qty) as total_qty, MAX(si.price) as price, SUM(si.qty * si.price) as total_revenue, MAX(s.sale_date) as created_at, s.payment_method FROM sales s JOIN sales_items si ON s.id = si.sale_id WHERE s.customer_id = ? GROUP BY si.product_name, s.payment_method ORDER BY total_revenue DESC`,
        [req.params.id], (err, results) => { if (err) return res.status(500).json(err); res.json(results); }
    );
});

// ── TEMPORARY DEBUG — remove after fixing ──
app.get('/api/debug/yield-check', (req, res) => {
    db.query(
        `SELECT DISTINCT si.product_name,
                yr.menu_item_name,
                yr.material_name,
                yr.yield_per_unit
         FROM sales_items si
         LEFT JOIN yield_rules yr ON LOWER(TRIM(si.product_name)) = LOWER(TRIM(yr.menu_item_name))
         ORDER BY si.product_name`,
        (err, results) => {
            if (err) return res.status(500).json(err);
            const broken = results.filter(r => !r.menu_item_name);
            const working = results.filter(r => r.menu_item_name);
            res.json({
                broken_no_rule_found: broken.map(r => r.product_name),
                working_matched: working
            });
        }
    );
});

app.get('/', (req, res) => { res.send("POS API running..."); });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => { console.log(`Server running on http://localhost:${PORT}`); });