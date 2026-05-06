import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Package, Plus, AlertCircle, RefreshCcw, Edit, Save, X, ArrowUp, ArrowDown, BarChart3, Calendar } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL;

const Inventory = () => {
    const [stock, setStock] = useState([]);
    const [auditMessages, setAuditMessages] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    
    // Form States
    const [newItem, setNewItem] = useState({ item_name: '', unit_measure: '', stock_quantity: 0 });
    const [updateAmount, setUpdateAmount] = useState({ id: null, val: '' });
    const [editItem, setEditItem] = useState(null);
const [editForm, setEditForm] = useState({
    id: null,
    item_name: '',
    unit_measure: '',
    stock_quantity: 0,
    opening_stock: 0,
    added_stock: 0
});

const saveEdit = async () => {
    try {
        const payload = {
            ...editForm,
            stock_quantity: Number(editForm.stock_quantity),
            opening_stock: Number(editForm.opening_stock),
            added_stock: Number(editForm.added_stock)
        };

        await axios.put(`${API}/api/inventory/update-item`, payload, {
            headers: {
                "user-role": "Admin"
            }
        });

        setEditItem(null);
        loadData();
    } catch (err) {
        console.error(err.response?.data || err.message);
        alert("Failed to update item");
    }
};

    // Calculate the current week range for display (Sunday to Saturday)
    const getWeekRange = () => {
        const now = new Date();
        const start = new Date(now.setDate(now.getDate() - now.getDay()));
        const end = new Date(now.setDate(now.getDate() - now.getDay() + 6));
        return `${start.toLocaleDateString('en-GB', {day:'numeric', month:'short'})} - ${end.toLocaleDateString('en-GB', {day:'numeric', month:'short'})}`;
    };

    useEffect(() => {
        loadData();
    }, []);

  const loadData = async () => {
    try {
        const inv = await axios.get(`${API}/api/inventory`);
        const audit = await axios.get(`${API}/api/inventory/audit-report`);

        const processedStock = inv.data.map(item => {
            const closingUnits = parseFloat(item.stock_quantity) || 0;
            const opening = parseFloat(item.opening_stock) || 0;
            const added = parseFloat(item.added_stock) || 0;
            const sold = parseFloat(item.units_sold) || 0;

            const unit = item.unit_measure || "";

            const isWeightBased =
                unit.toLowerCase().includes("kg") ||
                unit.toLowerCase().includes("gram") ||
                unit.toLowerCase().includes("g");

            let displayStock = "";
            let displayOpening = "";

            if (isWeightBased) {
                displayStock = `${Math.floor(closingUnits)} ${unit}`;
                displayOpening = `${Math.floor(opening)} ${unit}`;
            } else {
                displayStock = `${Math.floor(closingUnits)} ${unit}`;
                displayOpening = `${Math.floor(opening)} ${unit}`;
            }

            return {
                ...item,
                displayStock,
                displayOpening,
                units_sold: Math.ceil(sold),
                stock_quantity: closingUnits
            };
        });

        setStock(processedStock);
        setAuditMessages(audit.data);

    } catch (err) {
        console.error("Fetch error", err);
    }
};

    const handleAddProduct = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API}/api/inventory/add-new`, newItem);
            setShowAddModal(false);
            loadData();
        } catch (err) { alert("Error adding product"); }
    };

    const handleQuickUpdate = async (id) => {
        try {
            await axios.post(`${API}/api/inventory/add-stock`, { 
                item_id: id, 
                quantity_to_add: updateAmount.val 
            });
            setUpdateAmount({ id: null, val: '' });
            loadData();
        } catch (err) { alert("Update failed"); }
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

    return (
        <div className="inventory-page" style={{ padding: '20px' }}>
            <header className="inventory-header">
                <div>
                    <h1><Package size={32} color="#0071e3" /> Digital Storehouse</h1>
                    <p className="inventory-subtitle">
                        <Calendar size={14} style={{ marginRight: '5px' }} /> 
                        Weekly Cycle: <strong>{getWeekRange()}</strong>
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-outline" onClick={loadData}><RefreshCcw size={16} /> Refresh Audit</button>
                    <button className="btn-primary" onClick={() => setShowAddModal(true)}><Plus size={18} /> Add New Item</button>
                </div>
            </header>

            {/* --- LIVE STOCK SUMMARY CARDS --- */}
            <div className="recon-grid" style={{ marginBottom: '25px' }}>
                <div className="audit-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <BarChart3 color="#0071e3" size={24} />
                        <div>
                            <h4 style={{ margin: 0, fontSize: '14px', color: '#666' }}>Active Items</h4>
                            <p style={{ margin: 0, fontSize: '22px', fontWeight: '800' }}>{stock.length}</p>
                        </div>
                    </div>
                </div>
                <div className="audit-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ArrowUp color="#2a9d8f" size={24} />
                        <div>
                            <h4 style={{ margin: 0, fontSize: '14px', color: '#666' }}>Total Restocks</h4>
                            <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#2a9d8f' }}>
                                {stock.reduce((acc, curr) => acc + (parseFloat(curr.added_stock) || 0), 0)}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="audit-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ArrowDown color="#e63946" size={24} />
                        <div>
                            <h4 style={{ margin: 0, fontSize: '14px', color: '#666' }}>Units Sold (Live)</h4>
                            <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#e63946' }}>
                                {stock.reduce((acc, curr) => acc + (curr.units_sold || 0), 0)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- RECONCILIATION / AUDIT SECTION --- */}
            <section className="recon-section">
                <h3><AlertCircle size={20} /> Today's Kitchen Audit</h3>
                <div className="recon-grid">
                    {auditMessages.map((msg, i) => {
                        const itemStock = stock.find(s => s.item_name === msg.item);
                        const hasVariance = itemStock && parseFloat(itemStock.stock_quantity) !== parseFloat(msg.shouldBe);

                        return (
                            <div key={i} className={`audit-card ${hasVariance ? 'variance-warning' : ''}`}>
                                <h4>{msg.item}</h4>
                                <p>{msg.message}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* --- STOCK TABLE --- */}
            <div className="stock-container">
                <div className="stock-table-header">
                    <h3>Current Inventory Levels</h3>
                </div>
                <table className="inventory-table">
                    <thead>
                        <tr>
                            <th>Material Name</th>
                            <th>Opening (Sun)</th>
                            <th>Added</th>
                            <th>Sold/Used</th>
                            <th>In Stock (Closing)</th>
                            <th>Status</th>
                            <th>Update Store</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stock.map((item) => {
                            const itemAudit = auditMessages.find(a => a.item === item.item_name);
                            const isMismatched = itemAudit && parseFloat(item.stock_quantity) !== parseFloat(itemAudit.shouldBe);
                            const isLow = item.stock_quantity < 5;

                            return (
                                <tr key={item.id} style={isMismatched ? { backgroundColor: '#fff5f5' } : {}}>
                                    <td className="item-name-cell">
                                        <strong>{item.item_name}</strong>
                                        {isMismatched && <span style={{color: '#e63946', fontSize: '10px', display: 'block'}}>⚠️ Stock Discrepancy</span>}
                                    </td>
                                    
                                    {/* These are the columns that were missing */}
                                    <td style={{ color: '#666' }}>{item.displayOpening}</td>
                                    <td style={{ color: '#2a9d8f' }}>+{item.added_stock}</td>
                                    <td style={{ color: '#e63946' }}>-{item.units_sold}</td>
                                    
                                    <td style={{ fontWeight: '800', fontSize: '1.1rem', color: (isLow || isMismatched) ? '#e63946' : '#2a9d8f' }}>
                                        {item.displayStock}
                                        {isMismatched && (
                                            <span style={{fontSize: '11px', fontWeight: '400', display: 'block', color: '#666'}}>
                                                Expected: {itemAudit.shouldBe}
                                            </span>
                                        )}
                                    </td>

                                    <td>
                                        <span className={`stock-badge ${ (isLow || isMismatched) ? 'stock-low' : 'stock-healthy'}`}>
                                            {isMismatched ? 'Check Usage' : isLow ? 'Low Stock' : 'Optimal'}
                                        </span>
                                    </td>
                                    <td>
                                        {updateAmount.id === item.id ? (
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <input 
                                                    type="number" 
                                                    style={{ width: '60px', padding: '5px' }} 
                                                    placeholder="Qty"
                                                    onChange={(e) => setUpdateAmount({...updateAmount, val: e.target.value})}
                                                />
                                                <button className="btn-primary" onClick={() => handleQuickUpdate(item.id)}><Save size={14}/></button>
                                                <button onClick={() => setUpdateAmount({id:null, val:''})}><X size={14}/></button>
                                            </div>
                                        ) : (
                                            <button className="btn-outline" onClick={() => setUpdateAmount({id: item.id, val: ''})}>
                                                <Edit size={14} /> Add Stock
                                            </button>
                                        )}
                                    </td>
                                    <td>
    <button className="edit-test-btn" onClick={() => openEdit(item)}>
    EDIT 
</button>
</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* --- ADD PRODUCT MODAL --- */}
            {showAddModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Add New Store Item</h3>
                        <form onSubmit={handleAddProduct}>
                            <label>Item Name</label>
                            <input 
                                type="text" 
                                placeholder="e.g. Wheat Flour"
                                required 
                                onChange={(e) => setNewItem({...newItem, item_name: e.target.value})} 
                            />
                            
                            <label>Unit Measure</label>
                            <input 
                                type="text" 
                                placeholder="e.g. 2kg Packet"
                                required 
                                onChange={(e) => setNewItem({...newItem, unit_measure: e.target.value})} 
                            />
                            
                            <label>Current Stock Quantity</label>
                            <input 
                                type="number" 
                                placeholder="0"
                                required 
                                onChange={(e) => setNewItem({...newItem, stock_quantity: e.target.value})} 
                            />
                            
                            <div className="modal-actions">
                                <button type="submit" className="btn-primary">Save to Store</button>
                                <button type="button" className="btn-outline" onClick={() => setShowAddModal(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )} 

            {editItem && (
    <div className="modal-overlay">
        <div className="modal-content">
            <h3>Edit Inventory Item</h3>

            <label>Item Name</label>
            <input
                value={editForm.item_name}
                onChange={(e) => setEditForm({ ...editForm, item_name: e.target.value })}
            />

            <label>Unit Measure</label>
            <input
                value={editForm.unit_measure}
                onChange={(e) => setEditForm({ ...editForm, unit_measure: e.target.value })}
            />

            <label>Stock Quantity</label>
            <input
                type="number"
                value={editForm.stock_quantity}
                onChange={(e) => setEditForm({ ...editForm, stock_quantity: e.target.value })}
            />

            <label>Opening Stock</label>
            <input
                type="number"
                value={editForm.opening_stock}
                onChange={(e) => setEditForm({ ...editForm, opening_stock: e.target.value })}
            />

            <label>Added Stock</label>
            <input
                type="number"
                value={editForm.added_stock}
                onChange={(e) => setEditForm({ ...editForm, added_stock: e.target.value })}
            />

            <div className="modal-actions">
                <button className="btn-primary" onClick={saveEdit}>
                    Save Changes
                </button>
                <button className="btn-outline" onClick={() => setEditItem(null)}>
                    Cancel
                </button>
            </div>
        </div>
    </div>
)}

            <footer className="inventory-footer">
                <span className="branding-tag">Property Flow POS • Codey Craft Africa</span>
            </footer>
        </div>
    );
};

export default Inventory;