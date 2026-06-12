import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

const API = 'https://safe-to-spend-api-gfdkgefahpfpf6ce.centralindia-01.azurewebsites.net';

// Colors
const COLORS = {
  bg: '#0f0f14',
  card: '#16161e',
  cardLight: '#1a1a24',
  border: '#2a2a38',
  accent: '#7c6af7',
  accent2: '#4ecdc4',
  accent3: '#ff6b6b',
  accent4: '#ffd93d',
  text: '#e8e8f0',
  muted: '#6b6b80',
  success: '#4ecdc4',
  danger: '#ff6b6b',
  warning: '#ffd93d',
};

const CAT_COLORS = ['#7c6af7', '#4ecdc4', '#ff6b6b', '#ffd93d', '#a78bfa', '#34d399', '#fb923c', '#60a5fa'];
const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Fixed Bills', 'Health', 'Education', 'Other'];
const CAT_EMOJI = { Food: '🍜', Transport: '🚇', Shopping: '🛍️', Entertainment: '🎬', 'Fixed Bills': '⚡', Health: '💊', Education: '📚', Other: '💼' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Utilities
const fmt = (n) => '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const today = () => new Date().toISOString().split('T')[0];

const seedTransactions = []; // Cleared seed data so it relies on your backend

// ─── Shared modal input style ───────────────────────────────────────────────
const inputStyle = {
  background: '#0f0f14',
  border: '1px solid #2a2a38',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#e8e8f0',
  width: '100%',
  boxSizing: 'border-box',
  fontSize: 16, // FIXED: Changed to 16 to prevent iOS Safari zoom lock
};

export default function SafeToSpendApp() {
  const [tab, setTab] = useState('dashboard');
  const [txns, setTxns] = useState(seedTransactions);
  const [formData, setFormData] = useState({ desc: '', amount: '', cat: 'Food', type: 'expense', date: today() });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Keep Railway alive
  useEffect(() => {
    const keepAlive = setInterval(() => {
      fetch(`${API}/health`, { mode: 'cors', credentials: 'omit' }).catch(() => {});
    }, 3 * 60 * 1000);
    return () => clearInterval(keepAlive);
  }, []);

  const [showBillModal, setShowBillModal] = useState(false);
  const [billForm, setBillForm] = useState({ name: '', amount: '' });
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState({ name: '', target: '', months: '3' });
  const [showFundModal, setShowFundModal] = useState(false);
  const [fundForm, setFundForm] = useState({ goalId: null, goalName: '', amount: '' });
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', onConfirm: null });
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetForm, setTargetForm] = useState({ category: '', amount: '' });

  const showConfirm = (message) =>
    new Promise((resolve) => {
      setConfirmModal({ show: true, message, onConfirm: resolve });
    });

  // ─── DATA LOADING (With Mobile CORS bypass) ──────────────────────────────
  const loadRealData = async () => {
    try {
      const response = await fetch(`${API}/api/user-data`, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.history) {
        const realTxns = data.history.map(tx => ({
          id: tx.id,
          date: tx.date || new Date().toISOString().split('T')[0],
          desc: tx.description,
          amount: tx.amount,
          cat: tx.category || 'Other',
          type: tx.type || 'expense'
        }));
        setTxns(realTxns);
      }
      if (data.income !== undefined) {
        setMonthlyIncome(data.income);
        setExtraIncome(data.extra_income || 0);
      }
    } catch (error) {
      console.error("Python Brain disconnected:", error);
    }
  };

  const [bills, setBills] = useState([]);
  const loadBills = async () => {
    try {
      const res = await fetch(`${API}/api/bills`, { mode: 'cors', credentials: 'omit' });
      const data = await res.json();
      setBills(data);
      const total = data.reduce((s, b) => s + b.amount, 0);
      setFixedBills(total);
      setBudgets(prev => ({ ...prev, 'Fixed Bills': total }));
    } catch (error) {
      console.error("Failed to load bills:", error);
    }
  };

  const [customCategories, setCustomCategories] = useState([]);
  const loadCategories = async () => {
    try {
      const res = await fetch(`${API}/api/categories`, { mode: 'cors', credentials: 'omit' });
      const data = await res.json();
      setCustomCategories(data);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const loadGoals = async () => {
    try {
      const res = await fetch(`${API}/api/goals`, { mode: 'cors', credentials: 'omit' });
      const data = await res.json();
      setGoals(data.map(g => ({ ...g, months: g.months || 3 })));
    } catch (error) {
      console.error("Failed to load goals:", error);
    }
  };

  const loadTargets = async () => {
    try {
      const res = await fetch(`${API}/api/targets`, { mode: 'cors', credentials: 'omit' });
      const data = await res.json();
      if (Object.keys(data).length > 0) {
        setBudgets(prev => ({ ...prev, ...data }));
      }
    } catch (error) {
      console.error("Target fetch failed:", error);
    }
  };

  // ─── ACTION SUBMISSIONS ──────────────────────────────────────────────────
  const addNewBill = () => {
    setBillForm({ name: '', amount: '' });
    setShowBillModal(true);
  };

  const submitNewBill = async () => {
    const name = billForm.name.trim();
    const amount = parseFloat(billForm.amount);
    if (!name || isNaN(amount) || amount <= 0) return;
    setShowBillModal(false);

    // Optimistic: add bill to local state instantly
    const tempId = Date.now();
    const newBill = { id: tempId, name, amount };
    setBills(prev => {
      const updated = [...prev, newBill];
      const total = updated.reduce((s, b) => s + b.amount, 0);
      setFixedBills(total);
      setBudgets(p => ({ ...p, 'Fixed Bills': total }));
      return updated;
    });

    try {
      await fetch(`${API}/api/bills`, {
        method: 'POST',
        mode: 'cors', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, amount })
      });
      loadBills(); // sync real ID in background
    } catch (error) {
      // Rollback
      setBills(prev => {
        const updated = prev.filter(b => b.id !== tempId);
        const total = updated.reduce((s, b) => s + b.amount, 0);
        setFixedBills(total);
        return updated;
      });
      console.error("Failed to save bill:", error);
      alert("Failed to save bill: " + error.message);
    }
  };

  const deleteBill = async (id) => {
    const confirmed = await showConfirm("Delete this bill?");
    if (!confirmed) return;

    // Optimistic: remove instantly
    const removed = bills.find(b => b.id === id);
    setBills(prev => {
      const updated = prev.filter(b => b.id !== id);
      const total = updated.reduce((s, b) => s + b.amount, 0);
      setFixedBills(total);
      setBudgets(p => ({ ...p, 'Fixed Bills': total }));
      return updated;
    });

    try {
      await fetch(`${API}/api/bills/${id}`, { method: 'DELETE', mode: 'cors', credentials: 'omit' });
    } catch (error) {
      // Rollback
      setBills(prev => {
        const updated = [...prev, removed];
        const total = updated.reduce((s, b) => s + b.amount, 0);
        setFixedBills(total);
        return updated;
      });
      console.error("Failed to delete bill:", error);
    }
  };

  const addNewCategory = () => {
    setCategoryForm({ name: '' });
    setShowCategoryModal(true);
  };

  const submitNewCategory = async () => {
    const name = categoryForm.name.trim();
    if (!name) return;
    setShowCategoryModal(false);
    const emoji = "🏷️";
    try {
      await fetch(`${API}/api/categories`, {
        method: 'POST',
        mode: 'cors', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji })
      });
      await loadCategories();
      setFormData(prev => ({ ...prev, cat: name }));
    } catch (error) {
      console.error("Failed to save category:", error);
      alert("Mobile Error: " + error.message);
    }
  };

  const allCategories = [...CATEGORIES, ...customCategories.map(c => c.name)];
  const getEmoji = (catName) => {
    const custom = customCategories.find(c => c.name === catName);
    return custom ? custom.emoji : (CAT_EMOJI[catName] || '🏷️');
  };

  const [settingsForm, setSettingsForm] = useState({ income: '' });
  const saveSettings = async () => {
    const newIncome = parseFloat(settingsForm.income);
    if (isNaN(newIncome) || newIncome <= 0) return;
    setShowSettingsModal(false);
    try {
      const currentBillsTotal = bills.reduce((s, b) => s + b.amount, 0);
      await fetch(`${API}/api/settings`, {
        method: 'POST',
        mode: 'cors', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income: newIncome, bills: currentBillsTotal })
      });
      setMonthlyIncome(newIncome);
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Mobile Error: " + error.message);
    }
  };

  // State vars
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [monthlyIncome, setMonthlyIncome] = useState(25000);
  const [extraIncome, setExtraIncome] = useState(0);
  const [fixedBills, setFixedBills] = useState(8000);
  const [budgets, setBudgets] = useState({
    Food: 0, Transport: 0, Shopping: 0, Entertainment: 0, 'Fixed Bills': fixedBills, Health: 0, Education: 0, Other: 0,
  });
  const [goals, setGoals] = useState([]);
  const [coachAdvice, setCoachAdvice] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);

  // Calculations
  const currentMonthTxns = useMemo(() => txns.filter((t) => new Date(t.date).getMonth() === filterMonth), [txns, filterMonth]);
  const expenses = useMemo(() => currentMonthTxns.filter((t) => t.type === 'expense'), [currentMonthTxns]);
  const incomes = useMemo(() => currentMonthTxns.filter((t) => t.type === 'income'), [currentMonthTxns]);
  const totalExpense = useMemo(() => expenses.reduce((s, t) => s + t.amount, 0), [expenses]);
  
  const daysLeft = useMemo(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return lastDay - now.getDate();
  }, []);

  const safeToSpend = useMemo(() => {
    const budgetTotal = Object.values(budgets).reduce((a, b) => a + b, 0);
    const available = (monthlyIncome + extraIncome) - budgetTotal - totalExpense;
    return Math.max(0, available);
  }, [monthlyIncome, extraIncome, budgets, totalExpense]);

  const dailySafeSpend = useMemo(() => (daysLeft > 0 ? Math.floor(safeToSpend / daysLeft) : 0), [safeToSpend, daysLeft]);

  const safeColor = useMemo(() => {
    if (safeToSpend <= 0) return COLORS.danger;
    const pct = (totalExpense / monthlyIncome) * 100;
    if (pct > 90) return COLORS.danger;
    if (pct > 70) return COLORS.warning;
    return COLORS.success;
  }, [safeToSpend, totalExpense, monthlyIncome]);

  const byCategory = useMemo(() => {
    const map = {};
    expenses.forEach((t) => { map[t.cat] = (map[t.cat] || 0) + t.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const dailyData = useMemo(() => {
    const result = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTxns = txns.filter(t => t.date === dateStr);
      result.push({
        day: `${d.getDate()}/${d.getMonth() + 1}`,
        expense: dayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        income: dayTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      });
    }
    return result;
  }, [txns]);

  const monthlyData = useMemo(() => {
    const currentMonthIndex = new Date().getMonth();
    return MONTHS.map((m, i) => {
      const mt = txns.filter((t) => new Date(t.date).getMonth() === i);
      const baseIncome = i === currentMonthIndex ? monthlyIncome : 0;
      const extraInc = mt.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      return {
        month: m,
        income: baseIncome + extraInc,
        expense: mt.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      };
    });
  }, [txns, monthlyIncome]);

  useEffect(() => {
    loadRealData();
    loadGoals();
    loadCategories();
    loadBills();
    loadTargets();
  }, []);

  const fetchCoachAdvice = async () => {
    setCoachLoading(true);
    try {
      const res = await fetch(`${API}/api/coach`, { mode: 'cors', credentials: 'omit' });
      const data = await res.json();
      setCoachAdvice(data.advice);
    } catch (error) {
      console.error("Coach error:", error);
      setCoachAdvice("Failed to reach the AI Coach.");
    }
    setCoachLoading(false);
  };

  const addNewGoal = () => {
    setGoalForm({ name: '', target: '', months: '3' });
    setShowGoalModal(true);
  };

  const submitNewGoal = async () => {
    const name = goalForm.name.trim();
    const target = parseFloat(goalForm.target);
    const months = parseInt(goalForm.months) || 3;
    if (!name || isNaN(target) || target <= 0) return;
    setShowGoalModal(false);

    // Optimistic: add goal instantly
    const tempId = Date.now();
    const newGoal = { id: tempId, name, target, current: 0, emoji: "", months };
    setGoals(prev => [...prev, newGoal]);

    try {
      await fetch(`${API}/api/goals`, {
        method: 'POST',
        mode: 'cors', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, target, current: 0, emoji: "", months })
      });
      loadGoals(); // sync real ID in background
    } catch (error) {
      setGoals(prev => prev.filter(g => g.id !== tempId)); // rollback
      console.error("Failed to add goal:", error);
      alert("Failed to add goal: " + error.message);
    }
  };

  const addFundsToGoal = (goal) => {
    setFundForm({ goalId: goal.id, goalName: goal.name, amount: '' });
    setShowFundModal(true);
  };

  const submitFundGoal = async () => {
    const amount = parseFloat(fundForm.amount);
    if (isNaN(amount) || amount <= 0) return;
    setShowFundModal(false);

    // Optimistic: update goal progress instantly
    setGoals(prev => prev.map(g =>
      g.id === fundForm.goalId ? { ...g, current: g.current + amount } : g
    ));

    try {
      await fetch(`${API}/api/goals/${fundForm.goalId}`, {
        method: 'PUT',
        mode: 'cors', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
    } catch (error) {
      // Rollback
      setGoals(prev => prev.map(g =>
        g.id === fundForm.goalId ? { ...g, current: g.current - amount } : g
      ));
      console.error("Failed to add funds:", error);
      alert("Failed to deposit: " + error.message);
    }
  };

  const deleteGoal = async (id) => {
    const confirmed = await showConfirm("Are you sure you want to delete this goal?");
    if (!confirmed) return;

    // Optimistic: remove instantly
    const removed = goals.find(g => g.id === id);
    setGoals(prev => prev.filter(g => g.id !== id));

    try {
      await fetch(`${API}/api/goals/${id}`, { method: 'DELETE', mode: 'cors', credentials: 'omit' });
    } catch (error) {
      setGoals(prev => [...prev, removed]); // rollback
      console.error("Failed to delete goal:", error);
    }
  };

  const setCategoryGoal = (category) => {
    setTargetForm({ category, amount: String(budgets[category] || '') });
    setShowTargetModal(true);
  };

  const submitCategoryTarget = async () => {
    const newAmt = parseFloat(targetForm.amount);
    if (isNaN(newAmt)) return;
    setShowTargetModal(false);
    const updatedBudgets = { ...budgets, [targetForm.category]: newAmt };
    setBudgets(updatedBudgets);
    try {
      await fetch(`${API}/api/targets`, {
        method: 'POST',
        mode: 'cors', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: updatedBudgets })
      });
    } catch (error) {
      console.error("Failed to save target:", error);
      alert("Mobile Error: " + error.message);
    }
  };

  // FIXED ADD TRANSACTION
  const addTransaction = async () => {
    if (!formData.desc || !formData.amount) return;

    setShowAddModal(false);

    const txData = {
      desc: formData.desc.trim(),
      amount: parseFloat(formData.amount),
      cat: formData.cat,
      type: formData.type,
      date: formData.date || new Date().toISOString().split('T')[0]
    };

    setFormData({ desc: '', amount: '', cat: 'Food', type: 'expense', date: today() });

    // Optimistic: add transaction to local state instantly
    const tempId = Date.now();
    setTxns(prev => [{ id: tempId, ...txData }, ...prev]);

    try {
      const response = await fetch(`${API}/api/transactions`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Sync real ID quietly in background (replaces temp entry)
      loadRealData();
    } catch (error) {
      // Rollback on failure
      setTxns(prev => prev.filter(t => t.id !== tempId));
      console.error("Failed to save to Vault:", error);
      alert("Failed to save: " + error.message);
    }
  };

  const handleOCRUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setOcrLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/api/scan-receipt`, {
        method: 'POST',
        mode: 'cors', credentials: 'omit',
        body: fd,
      });
      const data = await res.json();
      if (data.error) {
        alert("AI failed to read image. Please try again.");
      } else {
        setOcrResult({
          merchant: data.merchant,
          amount: data.amount,
          category: data.category,
          confidence: 99
        });
      }
    } catch (err) {
      console.error('Vision AI error:', err);
      alert('Error talking to Python Brain.');
    }
    setOcrLoading(false);
  };

  const applyOCRResult = async () => {
    if (!ocrResult) return;
    setShowOCRModal(false);

    const txData = {
      desc: ocrResult.merchant,
      amount: parseFloat(ocrResult.amount),
      cat: ocrResult.category,
      type: 'expense',
      date: new Date().toISOString().split('T')[0]
    };

    // Optimistic: add instantly
    const tempId = Date.now();
    setTxns(prev => [{ id: tempId, ...txData }, ...prev]);
    setOcrResult(null);

    try {
      await fetch(`${API}/api/transactions`, {
        method: 'POST',
        mode: 'cors', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData)
      });
      loadRealData(); // sync real ID in background
    } catch (error) {
      setTxns(prev => prev.filter(t => t.id !== tempId)); // rollback
      console.error("Failed to auto-save receipt:", error);
      alert("Failed to save: " + error.message);
    }
  };

  const delTxn = async (id) => {
    const confirmed = await showConfirm("Are you sure you want to delete this expense?");
    if (!confirmed) return;

    // Optimistic: remove instantly
    const removed = txns.find(t => t.id === id);
    setTxns(prev => prev.filter(t => t.id !== id));

    try {
      await fetch(`${API}/api/transactions/` + id, { method: 'DELETE', mode: 'cors', credentials: 'omit' });
    } catch (error) {
      setTxns(prev => [removed, ...prev]); // rollback
      console.error("Failed to delete from Vault:", error);
    }
  };

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ id: null, desc: '', amount: '', cat: 'Food', type: 'expense', date: '' });

  const openEditModal = (tx) => {
    setEditForm({ id: tx.id, desc: tx.desc, amount: tx.amount, cat: tx.cat, type: tx.type, date: tx.date });
    setShowEditModal(true);
  };

  const saveEditTransaction = async () => {
    if (!editForm.desc || !editForm.amount) return;
    setShowEditModal(false);

    const updated = {
      desc: editForm.desc,
      amount: parseFloat(editForm.amount),
      cat: editForm.cat,
      type: editForm.type,
      date: editForm.date,
    };

    // Optimistic: update local state instantly
    const original = txns.find(t => t.id === editForm.id);
    setTxns(prev => prev.map(t => t.id === editForm.id ? { ...t, ...updated } : t));

    try {
      await fetch(`${API}/api/transactions/${editForm.id}`, {
        method: 'PUT',
        mode: 'cors', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (error) {
      setTxns(prev => prev.map(t => t.id === editForm.id ? original : t)); // rollback
      console.error("Failed to update Vault:", error);
      alert("Failed to update: " + error.message);
    }
  };

  // ─── RENDER FUNCTIONS ────────────────────────────────────────────────────
  const renderDashboard = () => (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ width: 24 }}></div>
            <div style={{ fontWeight: 'bold' }}>Financial Autopilot</div>
            <button
              onClick={() => { setSettingsForm({ income: monthlyIncome }); setShowSettingsModal(true); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}
              title="Settings"
            >⚙️</button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, marginBottom: 20 }}>
          <div style={{
            width: 160, height: 160, borderRadius: '50%',
            background: `conic-gradient(${safeColor} 0deg ${(safeToSpend / monthlyIncome) * 360}deg, ${COLORS.border} ${(safeToSpend / monthlyIncome) * 360}deg)`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 30px ${safeColor}40`,
          }}>
            <div style={{ color: COLORS.muted, fontSize: 9, fontWeight: 500 }}>SAFE TO SPEND</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.text }}>{fmt(safeToSpend)}</div>
            <div style={{ color: COLORS.muted, fontSize: 9, marginTop: 2 }}>this month</div>
          </div>
          <div style={{
            width: 130, height: 130, borderRadius: '50%',
            background: `conic-gradient(${COLORS.accent} 0deg ${Math.min((dailySafeSpend / (safeToSpend / 30 || 1)) * 360, 360)}deg, ${COLORS.border} ${Math.min((dailySafeSpend / (safeToSpend / 30 || 1)) * 360, 360)}deg)`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 20px ${COLORS.accent}40`,
          }}>
            <div style={{ color: COLORS.muted, fontSize: 8, fontWeight: 500 }}>DAILY LIMIT</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>{fmt(dailySafeSpend)}</div>
            <div style={{ color: COLORS.muted, fontSize: 8, marginTop: 2 }}>per day</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 16px', marginBottom: 20 }}>
        <button onClick={() => setShowAddModal(true)} style={{ background: COLORS.accent, color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          + Add Transaction
        </button>
        <button onClick={() => setShowOCRModal(true)} style={{ background: COLORS.accent2, color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          📸 Snap Payment
        </button>
      </div>

      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'INCOME', value: fmt(monthlyIncome + extraIncome), color: COLORS.success },
            { label: 'SPENT', value: fmt(totalExpense), color: COLORS.danger },
            { label: 'BALANCE', value: fmt((monthlyIncome + extraIncome) - fixedBills - totalExpense), color: COLORS.accent },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: '12px', textAlign: 'center' }}>
              <div style={{ color: COLORS.muted, fontSize: 10, marginBottom: 4 }}>{label}</div>
              <div style={{ color, fontWeight: 700, fontSize: 14 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: bills?.length > 0 ? 12 : 0 }}>
            <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 700 }}>⚡ Fixed Bills <span style={{ color: COLORS.muted, fontSize: 11, fontWeight: 400 }}>({bills?.length || 0})</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ color: COLORS.warning, fontWeight: 700, fontSize: 13 }}>{fmt(fixedBills)}/mo</div>
              <div onClick={addNewBill} style={{ color: COLORS.accent, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: `${COLORS.accent}20`, padding: '4px 10px', borderRadius: 6 }}>+ Add</div>
            </div>
          </div>
          {bills?.length > 0 && bills.map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${COLORS.border}50` }}>
              <div style={{ color: COLORS.text, fontSize: 13 }}>{b.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ color: COLORS.warning, fontSize: 13, fontWeight: 600 }}>-{fmt(b.amount)}</div>
                <div onClick={() => deleteBill(b.id)} style={{ color: COLORS.muted, fontSize: 14, cursor: 'pointer' }}>🗑️</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ background: `linear-gradient(135deg, ${COLORS.card}, #2a1b4d)`, border: `1px solid ${COLORS.accent}40`, borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: coachAdvice ? 12 : 0 }}>
            <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 14 }}>🤖 AI Financial Coach</div>
            <button onClick={fetchCoachAdvice} disabled={coachLoading} style={{ background: COLORS.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: coachLoading ? 0.7 : 1 }}>
              {coachLoading ? "Analyzing..." : "Roast Me"}
            </button>
          </div>
          {coachAdvice && (
            <div style={{ color: '#e8e8f0', fontSize: 13, lineHeight: 1.5, fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
              "{coachAdvice}"
            </div>
          )}
        </div>
      </div>

      {byCategory.length > 0 && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 16, margin: '0 16px 20px' }}>
          <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>SPENDING BREAKDOWN</div>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={byCategory} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" strokeWidth={0}>
                {byCategory.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 12 }}>
            {byCategory.slice(0, 4).map((item, i) => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[i] }} />
                  <span style={{ color: COLORS.muted }}>{item.name}</span>
                </div>
                <span style={{ color: COLORS.text, fontWeight: 600 }}>{fmt(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 16, margin: '0 16px' }}>
        <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>RECENT ACTIVITY</div>
        {currentMonthTxns.slice(-5).reverse().map((t) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 24 }}>{getEmoji(t.cat)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: COLORS.text, fontWeight: 500, fontSize: 13 }}>{t.desc}</div>
              <div style={{ color: COLORS.muted, fontSize: 11 }}>{t.cat}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ color: t.type === 'income' ? COLORS.success : COLORS.danger, fontWeight: 700, fontSize: 13 }}>
                {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
              </div>
              <button onClick={(e) => { e.stopPropagation(); openEditModal(t); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, marginRight: '15px' }} title="Edit">✏️</button>
              <button onClick={(e) => { e.stopPropagation(); delTxn(t.id); }} style={{ background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer', fontSize: 16 }} title="Delete">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderBudget = () => (
    <div style={{ paddingBottom: 80, padding: '16px' }}>
      <h2 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Monthly Budget</h2>
      <div style={{ background: `linear-gradient(135deg, ${COLORS.accent2}15, ${COLORS.card})`, border: `1px solid ${COLORS.accent2}40`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ color: COLORS.muted, fontSize: 11 }}>TOTAL BUDGET</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>{fmt(monthlyIncome)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: COLORS.muted, fontSize: 11 }}>TOTAL SPENT</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.danger }}>{fmt(totalExpense)}</div>
          </div>
        </div>
      </div>
      {CATEGORIES.map((cat) => {
        const limit = budgets[cat] || 0;
        const spent = expenses.filter((t) => t.cat === cat).reduce((s, t) => s + t.amount, 0);
        const pct = limit ? (spent / limit) * 100 : 0;
        const color = pct > 90 ? COLORS.danger : pct > 70 ? COLORS.warning : COLORS.success;
        return (
          <div key={cat} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>{CAT_EMOJI[cat]}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{cat}</div>
                  <div onClick={() => setCategoryGoal(cat)} style={{ fontSize: 11, color: COLORS.muted, cursor: 'pointer', padding: '2px 4px', border: '1px dashed #444', borderRadius: '4px', display: 'inline-block' }} title="Click to set target goal">
                    {fmt(spent)} / <span style={{ color: limit > 0 ? COLORS.text : COLORS.muted }}>{fmt(limit)}</span> ✏️
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color, fontWeight: 700, fontSize: 12 }}>{Math.round(pct)}%</div>
              </div>
            </div>
            <div style={{ background: COLORS.border, borderRadius: 3, height: 6, overflow: 'hidden' }}>
              <div style={{ background: color, height: '100%', width: `${Math.min(pct, 100)}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderAnalytics = () => (
    <div style={{ paddingBottom: 80, padding: '16px' }}>
      <h2 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Analytics</h2>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 12, marginBottom: 16 }}>
        <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>Income vs Expenses (6 months)</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData.slice(0, 6)}>
            <XAxis dataKey="month" tick={{ fill: COLORS.muted, fontSize: 10 }} />
            <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} />
            <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
            <Bar dataKey="income" fill={COLORS.success} radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill={COLORS.danger} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 12, marginBottom: 16 }}>
        <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>Top Categories</div>
        {byCategory.map((c, i) => (
          <div key={c.name} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: COLORS.muted }}>{CAT_EMOJI[c.name]} {c.name}</span>
              <span style={{ color: COLORS.text, fontWeight: 600 }}>{fmt(c.value)}</span>
            </div>
            <div style={{ background: COLORS.border, borderRadius: 3, height: 4, overflow: 'hidden' }}>
              <div style={{ background: CAT_COLORS[i], height: '100%', width: `${(c.value / (byCategory[0]?.value || 1)) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 12, marginBottom: 16 }}>
        <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>Daily Spending (Last 30 Days)</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dailyData} margin={{ left: -20, right: 4 }}>
            <XAxis dataKey="day" tick={{ fill: COLORS.muted, fontSize: 8 }} interval={4} />
            <YAxis tick={{ fill: COLORS.muted, fontSize: 9 }} />
            <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.text, fontSize: 11 }} />
            <Bar dataKey="expense" fill={COLORS.danger} radius={[3, 3, 0, 0]} name="Expense" />
            <Bar dataKey="income" fill={COLORS.success} radius={[3, 3, 0, 0]} name="Income" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 12 }}>
        <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>Monthly Trend</div>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={monthlyData.slice(0, 6)}>
            <XAxis dataKey="month" tick={{ fill: COLORS.muted, fontSize: 10 }} />
            <YAxis tick={{ fill: COLORS.muted, fontSize: 10 }} />
            <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.text }} />
            <Line type="monotone" dataKey="expense" stroke={COLORS.danger} strokeWidth={2} />
            <Line type="monotone" dataKey="income" stroke={COLORS.success} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderGoals = () => (
    <div style={{ paddingBottom: 80, padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, margin: 0 }}>Savings Goals</h2>
        <button onClick={addNewGoal} style={{ background: COLORS.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Add Goal
        </button>
      </div>
      {goals?.map((goal) => {
        const pct = Math.min((goal.current / goal.target) * 100, 100);
        const remaining = Math.max(goal.target - goal.current, 0);
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const safeMonths = goal.months && goal.months > 0 ? goal.months : 3;
        const monthlyNeeded = Math.ceil(remaining / safeMonths);
        const dailyNeeded = Math.ceil(monthlyNeeded / daysInMonth);
        return (
          <div key={goal.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>{goal.name}</div>
                <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{fmt(goal.current)} / {fmt(goal.target)}</div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div onClick={() => deleteGoal(goal.id)} style={{ cursor: 'pointer', fontSize: 13, color: COLORS.danger, background: `${COLORS.danger}20`, padding: '4px 10px', borderRadius: 6, fontWeight: 700, border: `1px solid ${COLORS.danger}40` }}>Delete</div>
                <div onClick={() => addFundsToGoal(goal)} style={{ color: COLORS.accent, fontWeight: 700, fontSize: 14, cursor: 'pointer', background: `${COLORS.accent}20`, padding: '4px 8px', borderRadius: 6 }}>+ Deposit</div>
              </div>
            </div>
            <div style={{ height: 8, background: COLORS.bg, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: COLORS.success, borderRadius: 4 }} />
            </div>
            {remaining > 0 && (
              <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 4, textAlign: 'center' }}>
                Save <span style={{ color: COLORS.warning, fontWeight: 700 }}>{fmt(Math.ceil(dailyNeeded))}/day</span> to hit goal in {goal.months || 1} months
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderAffiliate = () => (
    <div style={{ paddingBottom: 80, padding: '16px' }}>
      <h2 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Recommended For You</h2>
      {[
        { show: totalExpense > 3000, icon: '💳', name: 'Cred', desc: 'Manage credit cards, earn rewards', href: 'https://cred.club/referral', color: COLORS.accent },
        { show: true, icon: '🏦', name: 'Jupiter', desc: 'Zero-fee bank account, earn interest', href: 'https://jupiter.money/', color: COLORS.accent2 },
        { show: totalExpense > 2000, icon: '🍗', name: 'EatFit', desc: 'Meal planning, reduce food costs', href: 'https://eatfit.app/', color: COLORS.warning },
        { show: true, icon: '📈', name: 'Groww', desc: 'Invest in mutual funds, index funds', href: 'https://groww.in/', color: COLORS.accent },
      ].filter(a => a.show).map(a => (
        <div key={a.name} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{a.icon}</div>
              <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{a.name}</div>
              <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 8 }}>{a.desc}</div>
            </div>
            <a href={a.href} target="_blank" rel="noopener noreferrer" style={{ background: a.color, color: a.color === COLORS.warning ? '#000' : '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontWeight: 600, fontSize: 11, cursor: 'pointer', textDecoration: 'none' }}>Open →</a>
          </div>
        </div>
      ))}
    </div>
  );

  const tabBtnStyle = (active) => ({
    flex: 1, padding: '10px 4px', border: 'none', background: 'none',
    color: active ? COLORS.accent : COLORS.muted, cursor: 'pointer', fontSize: 10,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    transition: 'color 0.15s', fontWeight: 500,
  });

  return (
    <div style={{ background: COLORS.bg, color: COLORS.text, minHeight: '100vh', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ padding: '16px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>SAFE TO SPEND</div>
        <select value={filterMonth} onChange={(e) => setFilterMonth(parseInt(e.target.value))} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
      </div>

      {tab === 'dashboard' && renderDashboard()}
      {tab === 'budget' && renderBudget()}
      {tab === 'analytics' && renderAnalytics()}
      {tab === 'goals' && renderGoals()}
      {tab === 'affiliate' && renderAffiliate()}

      {/* Bottom Navigation */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, display: 'flex', zIndex: 100 }}>
        <button style={tabBtnStyle(tab === 'dashboard')} onClick={() => setTab('dashboard')}><span style={{ fontSize: 16 }}>◈</span>Dashboard</button>
        <button style={tabBtnStyle(tab === 'budget')} onClick={() => setTab('budget')}><span style={{ fontSize: 16 }}>◎</span>Budget</button>
        <button style={tabBtnStyle(tab === 'analytics')} onClick={() => setTab('analytics')}><span style={{ fontSize: 16 }}>▦</span>Analytics</button>
        <button style={tabBtnStyle(tab === 'goals')} onClick={() => setTab('goals')}><span style={{ fontSize: 16 }}>◆</span>Goals</button>
        <button style={tabBtnStyle(tab === 'affiliate')} onClick={() => setTab('affiliate')}><span style={{ fontSize: 16 }}>★</span>Earn</button>
      </nav>

      {/* ── SETTINGS MODAL ───────────────────────────────────────────── */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#121212', padding: 24, borderRadius: 16, width: '90%', maxWidth: 400, border: '1px solid #333' }}>
            <h2 style={{ marginTop: 0, color: '#FFFFFF', textAlign: 'center' }}>Vault Settings</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: '#A0A0A0', marginBottom: 8, fontSize: 12 }}>Monthly Income (₹)</label>
              <input type="number" value={settingsForm.income} onChange={(e) => setSettingsForm({ ...settingsForm, income: e.target.value })} style={{ ...inputStyle, padding: '12px' }} />
            </div>
            <div style={{ marginBottom: 24, padding: '12px', background: '#0D0D1A', borderRadius: 8, border: '1px solid #2A2A38' }}>
              <div style={{ color: '#9090A8', fontSize: 11, marginBottom: 4, fontWeight: 600 }}>FIXED BILLS TOTAL</div>
              <div style={{ color: '#4ECDC4', fontSize: 18, fontWeight: 700 }}>{`₹${bills.reduce((s, b) => s + b.amount, 0).toLocaleString('en-IN')}/mo`}</div>
              <div style={{ color: '#9090A8', fontSize: 10, marginTop: 4 }}>Auto-calculated from your bill items on the dashboard.</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowSettingsModal(false)} style={{ flex: 1, padding: '14px', borderRadius: 12, background: 'transparent', color: '#FFFFFF', cursor: 'pointer', border: '1px solid #333' }}>Cancel</button>
              <button onClick={saveSettings} style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: '#8B5CF6', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>Save & Update</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD TRANSACTION MODAL ────────────────────────────────────── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowAddModal(false)}>
          <div style={{ background: COLORS.card, borderRadius: '20px 20px 0 0', padding: 20, width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.border}` }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: COLORS.text, marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Add Transaction</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['expense', 'income'].map((type) => (
                <button key={type} onClick={() => setFormData({ ...formData, type })} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', background: formData.type === type ? (type === 'expense' ? COLORS.danger : COLORS.success) : COLORS.border, color: formData.type === type ? '#fff' : COLORS.muted }}>
                  {type === 'expense' ? 'Expense' : 'Income'}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Description</label>
              <input type="text" placeholder="e.g., Zomato lunch" value={formData.desc} onChange={(e) => setFormData({ ...formData, desc: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Amount (₹)</label>
              <input type="number" placeholder="0" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Category</label>
                <select value={formData.cat} onChange={(e) => setFormData({ ...formData, cat: e.target.value })} style={inputStyle}>
                  {allCategories.map((c) => <option key={c} value={c}>{getEmoji(c)} {c}</option>)}
                </select>
                <div onClick={addNewCategory} style={{ color: COLORS.accent, fontSize: 11, cursor: 'pointer', marginTop: 6, fontWeight: 700 }}>+ Create New Category</div>
              </div>
              <div>
                <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Date</label>
                <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <button onClick={addTransaction} style={{ background: formData.type === 'expense' ? COLORS.danger : COLORS.success, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%' }}>
              Add {formData.type}
            </button>
          </div>
        </div>
      )}

      {/* ── EDIT TRANSACTION MODAL ───────────────────────────────────── */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowEditModal(false)}>
          <div style={{ background: COLORS.card, borderRadius: '20px 20px 0 0', padding: 20, width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.border}` }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: COLORS.text, marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Edit Transaction</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['expense', 'income'].map((type) => (
                <button key={type} onClick={() => setEditForm({ ...editForm, type })} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', background: editForm.type === type ? (type === 'expense' ? COLORS.danger : COLORS.success) : COLORS.border, color: editForm.type === type ? '#fff' : COLORS.muted }}>
                  {type === 'expense' ? 'Expense' : 'Income'}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Description</label>
              <input type="text" value={editForm.desc} onChange={(e) => setEditForm({ ...editForm, desc: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Amount (₹)</label>
              <input type="number" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Category</label>
                <select value={editForm.cat} onChange={(e) => setEditForm({ ...editForm, cat: e.target.value })} style={inputStyle}>
                  {allCategories.map((c) => <option key={c} value={c}>{getEmoji(c)} {c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Date</label>
                <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <button onClick={saveEditTransaction} style={{ background: editForm.type === 'expense' ? COLORS.danger : COLORS.success, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%' }}>
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* ── OCR MODAL ────────────────────────────────────────────────── */}
      {showOCRModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowOCRModal(false)}>
          <div style={{ background: COLORS.card, borderRadius: '20px 20px 0 0', padding: 20, width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.border}` }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: COLORS.text, marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Snap UPI Payment</h3>
            <label style={{ cursor: 'pointer', display: 'block', marginBottom: 16 }}>
              <div style={{ background: COLORS.bg, border: `2px dashed ${COLORS.border}`, borderRadius: 12, padding: 20, textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
                <div style={{ color: COLORS.muted, fontSize: 13 }}>Upload UPI screenshot</div>
              </div>
              <input type="file" hidden accept="image/*" onChange={handleOCRUpload} />
            </label>
            {ocrLoading && <div style={{ color: COLORS.muted, textAlign: 'center', marginBottom: 16 }}>Processing image...</div>}
            {ocrResult && (
              <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <div style={{ color: COLORS.muted, fontSize: 11, marginBottom: 8 }}>DETECTED</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ color: COLORS.text, fontWeight: 600 }}>{ocrResult.merchant}</div>
                    <div style={{ color: COLORS.muted, fontSize: 12 }}>₹{ocrResult.amount}</div>
                  </div>
                  <div style={{ color: COLORS.success, fontWeight: 600, fontSize: 12 }}>✓ {ocrResult.confidence}%</div>
                </div>
                <button onClick={applyOCRResult} style={{ background: COLORS.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px', fontWeight: 600, fontSize: 12, cursor: 'pointer', width: '100%' }}>Use This</button>
              </div>
            )}
            <button onClick={() => setShowOCRModal(false)} style={{ background: COLORS.border, color: COLORS.muted, border: 'none', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%' }}>Close</button>
          </div>
        </div>
      )}

      {/* ── ADD BILL MODAL ───────────────────────────────────────────── */}
      {showBillModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, border: `1px solid ${COLORS.border}` }}>
            <h3 style={{ color: COLORS.text, marginTop: 0, marginBottom: 20, fontSize: 16, fontWeight: 700 }}>Add Fixed Bill</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 6, fontWeight: 600 }}>Bill Name</label>
              <input type="text" placeholder="e.g., Netflix, Rent, Gym" value={billForm.name} onChange={(e) => setBillForm({ ...billForm, name: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 6, fontWeight: 600 }}>Monthly Amount (₹)</label>
              <input type="number" placeholder="0" value={billForm.amount} onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })} style={inputStyle} onKeyDown={(e) => e.key === 'Enter' && submitNewBill()} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowBillModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'transparent', color: COLORS.muted, cursor: 'pointer', border: `1px solid ${COLORS.border}`, fontSize: 13 }}>Cancel</button>
              <button onClick={submitNewBill} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: COLORS.accent, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Add Bill</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD GOAL MODAL ───────────────────────────────────────────── */}
      {showGoalModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, border: `1px solid ${COLORS.border}` }}>
            <h3 style={{ color: COLORS.text, marginTop: 0, marginBottom: 20, fontSize: 16, fontWeight: 700 }}>New Savings Goal</h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 6, fontWeight: 600 }}>What are you saving for?</label>
              <input type="text" placeholder="e.g., PS5, Car, Vacation" value={goalForm.name} onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 6, fontWeight: 600 }}>Target Amount (₹)</label>
              <input type="number" placeholder="0" value={goalForm.target} onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 6, fontWeight: 600 }}>Months to save</label>
              <input type="number" placeholder="3" value={goalForm.months} onChange={(e) => setGoalForm({ ...goalForm, months: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowGoalModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'transparent', color: COLORS.muted, cursor: 'pointer', border: `1px solid ${COLORS.border}`, fontSize: 13 }}>Cancel</button>
              <button onClick={submitNewGoal} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: COLORS.accent, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Create Goal</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FUND GOAL MODAL ──────────────────────────────────────────── */}
      {showFundModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, border: `1px solid ${COLORS.border}` }}>
            <h3 style={{ color: COLORS.text, marginTop: 0, marginBottom: 8, fontSize: 16, fontWeight: 700 }}>Deposit to Goal</h3>
            <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 20 }}>How much are you depositing into <strong style={{ color: COLORS.text }}>{fundForm.goalName}</strong>?</p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 6, fontWeight: 600 }}>Amount (₹)</label>
              <input type="number" placeholder="0" value={fundForm.amount} onChange={(e) => setFundForm({ ...fundForm, amount: e.target.value })} style={inputStyle} onKeyDown={(e) => e.key === 'Enter' && submitFundGoal()} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowFundModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'transparent', color: COLORS.muted, cursor: 'pointer', border: `1px solid ${COLORS.border}`, fontSize: 13 }}>Cancel</button>
              <button onClick={submitFundGoal} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: COLORS.success, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Deposit</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CATEGORY MODAL ───────────────────────────────────────────── */}
      {showCategoryModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, border: `1px solid ${COLORS.border}` }}>
            <h3 style={{ color: COLORS.text, marginTop: 0, marginBottom: 20, fontSize: 16, fontWeight: 700 }}>New Category</h3>
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 6, fontWeight: 600 }}>Category Name</label>
              <input type="text" placeholder="e.g., Gaming, Pets, Travel" value={categoryForm.name} onChange={(e) => setCategoryForm({ name: e.target.value })} style={inputStyle} onKeyDown={(e) => e.key === 'Enter' && submitNewCategory()} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCategoryModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'transparent', color: COLORS.muted, cursor: 'pointer', border: `1px solid ${COLORS.border}`, fontSize: 13 }}>Cancel</button>
              <button onClick={submitNewCategory} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: COLORS.accent, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ── BUDGET TARGET MODAL ──────────────────────────────────────── */}
      {showTargetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, border: `1px solid ${COLORS.border}` }}>
            <h3 style={{ color: COLORS.text, marginTop: 0, marginBottom: 8, fontSize: 16, fontWeight: 700 }}>Set Monthly Limit</h3>
            <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 20 }}>Set your monthly spend limit for <strong style={{ color: COLORS.text }}>{targetForm.category}</strong></p>
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 6, fontWeight: 600 }}>Amount (₹)</label>
              <input type="number" placeholder="0" value={targetForm.amount} onChange={(e) => setTargetForm({ ...targetForm, amount: e.target.value })} style={inputStyle} onKeyDown={(e) => e.key === 'Enter' && submitCategoryTarget()} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowTargetModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'transparent', color: COLORS.muted, cursor: 'pointer', border: `1px solid ${COLORS.border}`, fontSize: 13 }}>Cancel</button>
              <button onClick={submitCategoryTarget} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: COLORS.accent, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Set Limit</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM MODAL ────────────────────────────────────────────── */}
      {confirmModal.show && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 24, width: '100%', maxWidth: 320, border: `1px solid ${COLORS.border}` }}>
            <p style={{ color: COLORS.text, fontSize: 15, textAlign: 'center', marginTop: 0, marginBottom: 24, lineHeight: 1.5 }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setConfirmModal({ show: false, message: '', onConfirm: null }); confirmModal.onConfirm(false); }} style={{ flex: 1, padding: '12px', borderRadius: 10, background: 'transparent', color: COLORS.muted, cursor: 'pointer', border: `1px solid ${COLORS.border}`, fontSize: 13 }}>Cancel</button>
              <button onClick={() => { setConfirmModal({ show: false, message: '', onConfirm: null }); confirmModal.onConfirm(true); }} style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: COLORS.danger, color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}