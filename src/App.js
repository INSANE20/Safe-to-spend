import React, { useState, useMemo, useEffect } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import Tesseract from 'tesseract.js';

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

// Seed data
const seedTransactions = [
  { id: 1, date: '2025-05-15', desc: 'Zomato', amount: 320, cat: 'Food', type: 'expense' },
  { id: 2, date: '2025-05-14', desc: 'Uber', amount: 150, cat: 'Transport', type: 'expense' },
  { id: 3, date: '2025-05-13', desc: 'Amazon', amount: 2499, cat: 'Shopping', type: 'expense' },
  { id: 4, date: '2025-05-12', desc: 'Salary', amount: 25000, cat: 'Other', type: 'income' },
  { id: 5, date: '2025-05-11', desc: 'Netflix', amount: 499, cat: 'Entertainment', type: 'expense' },
  { id: 6, date: '2025-05-10', desc: 'Electricity', amount: 1200, cat: 'Bills', type: 'expense' },
  { id: 7, date: '2025-05-09', desc: 'Swiggy', amount: 280, cat: 'Food', type: 'expense' },
  { id: 8, date: '2025-05-08', desc: 'Gym fee', amount: 500, cat: 'Health', type: 'expense' },
  { id: 9, date: '2025-05-07', desc: 'Movie', amount: 380, cat: 'Entertainment', type: 'expense' },
  { id: 10, date: '2025-05-05', desc: 'Freelance', amount: 5000, cat: 'Other', type: 'income' },
];

export default function SafeToSpendApp() {
  const [tab, setTab] = useState('dashboard');
  const [txns, setTxns] = useState(seedTransactions);
  const [formData, setFormData] = useState({ desc: '', amount: '', cat: 'Food', type: 'expense', date: today() });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // --- FIXED BILLS LOGIC ---
  const [bills, setBills] = useState([]);

  const loadBills = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/bills');
      const data = await res.json();
      setBills(data);
      // Always derive fixedBills from actual bill items — never from Vault Settings
      const total = data.reduce((s, b) => s + b.amount, 0);
      setFixedBills(total);
      setBudgets(prev => ({ ...prev, 'Fixed Bills': total }));
      // Keep backend settings in sync so safe-to-spend formula is correct
      fetch('http://localhost:8000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income: null, bills: total, sync_bills_only: true })
      }).catch(() => {});
    } catch (error) {
      console.error("Failed to load bills:", error);
    }
  };

  const addNewBill = async () => {
    const name = window.prompt("Enter bill name (e.g., Netflix, Rent, Gym):");
    if (!name) return;
    const amountStr = window.prompt(`Enter the monthly amount for ${name}:`);
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;

    try {
      await fetch('http://localhost:8000/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, amount })
      });
      await loadBills(); // loadBills will recalculate fixedBills from items
    } catch (error) {
      console.error("Failed to save bill:", error);
    }
  };

  const deleteBill = async (id) => {
    try {
      await fetch(`http://localhost:8000/api/bills/${id}`, { method: 'DELETE' });
      await loadBills(); // loadBills will recalculate fixedBills from items
    } catch (error) {
      console.error("Failed to delete bill:", error);
    }
  };
  // -------------------------

  // --- CUSTOM CATEGORY LOGIC ---
  const [customCategories, setCustomCategories] = useState([]);

  const loadCategories = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/categories');
      const data = await res.json();
      setCustomCategories(data);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const addNewCategory = async () => {
    const name = window.prompt("Enter new category name (e.g., Gaming):");
    if (!name) return;
    const emoji = "🏷️"; 
    
    try {
      // 1. Tell Python to save it
      await fetch('http://localhost:8000/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, emoji })
      });
      
      // 2. FORCE React to wait for the new list to download
      await loadCategories(); 
      
      // 3. Now that the list is updated, change the dropdown!
      setFormData(prev => ({ ...prev, cat: name })); 
      
    } catch (error) {
      console.error("Failed to save category:", error);
      alert("Failed to save. Check Python terminal!");
    }
  };
  // Combine default categories with custom ones
  const allCategories = [...CATEGORIES, ...customCategories.map(c => c.name)];
  const getEmoji = (catName) => {
    const custom = customCategories.find(c => c.name === catName);
    return custom ? custom.emoji : (CAT_EMOJI[catName] || '🏷️');
  };
  // -----------------------------
  const [settingsForm, setSettingsForm] = useState({ income: '' });

  const saveSettings = async () => {
    const newIncome = parseFloat(settingsForm.income);
    if (isNaN(newIncome) || newIncome <= 0) return;
    try {
      // Only save income — bills are always derived from the bill items list
      const currentBillsTotal = bills.reduce((s, b) => s + b.amount, 0);
      await fetch('http://localhost:8000/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income: newIncome, bills: currentBillsTotal })
      });
      setMonthlyIncome(newIncome);
      setShowSettingsModal(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [ocrImage, setOcrImage] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth());
  const [monthlyIncome, setMonthlyIncome] = useState(25000);
  const [extraIncome, setExtraIncome] = useState(0);
  const [fixedBills, setFixedBills] = useState(8000);
  const [budgets, setBudgets] = useState({
    Food: 0,
    Transport: 0,
    Shopping: 0,
    Entertainment: 0,
    'Fixed Bills': fixedBills,
    Health: 0,
    Education: 0,
    Other: 0,
  });
  const [streak, setStreak] = useState(5);
  const [goals, setGoals] = useState([]);
  const [insights, setInsights] = useState(null);
  const [coachAdvice, setCoachAdvice] = useState(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [premiumUser, setPremiumUser] = useState(false);

  // Calculate current month transactions
  const currentMonthTxns = useMemo(
    () => txns.filter((t) => new Date(t.date).getMonth() === filterMonth),
    [txns, filterMonth]
  );

  const expenses = useMemo(() => currentMonthTxns.filter((t) => t.type === 'expense'), [currentMonthTxns]);
  const incomes = useMemo(() => currentMonthTxns.filter((t) => t.type === 'income'), [currentMonthTxns]);

  const totalExpense = useMemo(() => expenses.reduce((s, t) => s + t.amount, 0), [expenses]);
  const totalIncome = useMemo(() => incomes.reduce((s, t) => s + t.amount, 0), [incomes]);

  // Safe-To-Spend calculation
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

  // Category breakdown
  const byCategory = useMemo(() => {
    const map = {};
    expenses.forEach((t) => {
      map[t.cat] = (map[t.cat] || 0) + t.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Daily data for analytics - past 30 days
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
      
      // Inject the permanent Vault Income into the current month
      const baseIncome = i === currentMonthIndex ? monthlyIncome : 0;
      const extraIncome = mt.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);

      return {
        month: m,
        income: baseIncome + extraIncome,
        expense: mt.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      };
    });
  }, [txns, monthlyIncome]);

  // --- THE PYTHON CONNECTION ---
  useEffect(() => {
    loadRealData();
    loadGoals();
    loadCategories();
    loadBills(); // <-- ADD THIS LINE
  }, []);

  // --- AI FINANCIAL COACH ---
  const fetchCoachAdvice = async () => {
    setCoachLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/coach');
      const data = await res.json();
      setCoachAdvice(data.advice);
    } catch (error) {
      console.error("Coach error:", error);
      setCoachAdvice("Failed to reach the AI Coach.");
    }
    setCoachLoading(false);
  };

  // --- GOALS LOGIC ---
  const loadGoals = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/goals');
      const data = await res.json();
      // Always update — even empty array clears stale state
      setGoals(data.map(g => ({
        ...g,
        months: g.months || 3,  // default 3 if backend returns null/0
      })));
    } catch (error) {
      console.error("Failed to load goals:", error);
    }
  };

  const addNewGoal = async () => {
    const name = window.prompt("What are you saving for? (e.g., PS5, Car)");
    if (!name) return;
    
    const targetStr = window.prompt(`What is the target amount for ${name}? (₹)`);
    if (!targetStr || isNaN(parseFloat(targetStr))) return alert("Valid number required!");
    
    const monthsStr = window.prompt(`How many months do you have to save for ${name}? (e.g., 6)`);
    const months = parseInt(monthsStr) || 3; // Defaults to 3 if they leave it blank

    try {
      await fetch('http://localhost:8000/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // We pass an empty string for the emoji to bypass it completely
        body: JSON.stringify({ name, target: parseFloat(targetStr), current: 0, emoji: "", months })
      });
      loadGoals(); 
    } catch (error) {
      console.error("Failed to add goal:", error);
    }
  };

  const addFundsToGoal = async (goal) => {
    const amountStr = window.prompt(`How much money are you depositing into ${goal.name}? (₹)`);
    if (!amountStr || isNaN(parseFloat(amountStr))) return;

    try {
      await fetch(`http://localhost:8000/api/goals/${goal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amountStr) })
      });
      loadGoals(); // Instantly update the progress bar!
    } catch (error) {
      console.error("Failed to add funds:", error);
    }
  };

  const deleteGoal = async (id) => {
    const isConfirmed = window.confirm("Are you sure you want to delete this goal?");
    if (!isConfirmed) return;

    try {
      await fetch(`http://localhost:8000/api/goals/${id}`, {
        method: 'DELETE',
      });
      loadGoals(); // Instantly remove it from the screen!
    } catch (error) {
      console.error("Failed to delete goal:", error);
    }
  };

  const loadRealData = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/user-data');
      const data = await response.json();
      
      // 1. Update the Transaction History
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

      // 2. Update income only — bills are always derived from bill items via loadBills()
      if (data.income !== undefined) {
        setMonthlyIncome(data.income);
        setExtraIncome(data.extra_income || 0);
        // DO NOT setFixedBills here — loadBills() handles that from actual items
      }

    } catch (error) {
      console.error("Python Brain disconnected:", error);
    }
  };

  // --- TARGET GOALS LOGIC ---
  const loadTargets = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/targets');
      const data = await res.json();
      if (Object.keys(data).length > 0) {
        setBudgets(prev => ({ ...prev, ...data })); // Merge Python targets with existing budgets
      }
    } catch (error) {
      console.error("Target fetch failed:", error);
    }
  };

  // Run this once when the app loads
  useEffect(() => {
    loadTargets();
  }, []);

  const setCategoryGoal = async (category) => {
    const currentTarget = budgets[category] || 0;
    const newAmtStr = window.prompt(`Set your monthly limit for ${category} (₹):`, currentTarget);
    if (newAmtStr === null) return; // Stop if they hit Cancel
    
    const newAmt = parseFloat(newAmtStr);
    if (isNaN(newAmt)) return alert("Please enter a valid number.");

    const updatedBudgets = { ...budgets, [category]: newAmt };
    setBudgets(updatedBudgets); // Update the UI instantly
    
    try {
      // Shoot the new target to Python
      await fetch('http://localhost:8000/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: updatedBudgets })
      });
    } catch (error) {
      console.error("Failed to save target:", error);
    }
  };
  // --------------------------
  // Add transaction (NOW SAVES TO YOUR SQLITE VAULT)
 // Add transaction (NOW TALKS TO PYTHON)
  // Add transaction (NOW TALKS TO PYTHON)
  const addTransaction = async () => {
    if (!formData.desc || !formData.amount) return; // Prevent empty saves

    try {
      // 1. Shoot the data across the bridge to your new Python Mailbox
      await fetch('http://localhost:8000/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desc: formData.desc,
          amount: parseFloat(formData.amount),
          cat: formData.cat,
          type: formData.type,
          date: new Date().toISOString().split('T')[0] // Today's date
        })
      });

      // 2. Reset the form and close the popup
      setFormData({ desc: '', amount: '', cat: 'Food', type: 'expense', date: '' });
      setShowAddModal(false);
      
      // 3. Instantly reload the ring with the new math!
      loadRealData(); 
      
    } catch (error) {
      console.error("Failed to save to Vault:", error);
    }
  };

  // OCR parsing
  // --- SNAP PAYMENT (VISION AI) ---
  const handleOCRUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrLoading(true);
    
    // 1. Package the image for Python
    const formData = new FormData();
    formData.append('file', file);

    try {
      // 2. Send the image to the new Python Vision Mailbox
      const res = await fetch('http://localhost:8000/api/scan-receipt', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      
      if (data.error) {
         alert("AI failed to read image. Please try again.");
      } else {
         // 3. Catch the AI's response and show it on the screen
         setOcrResult({ 
           merchant: data.merchant, 
           amount: data.amount, 
           category: data.category,
           confidence: 99 // Gemini is usually extremely confident!
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
    
    // 1. Auto-save it to the database instantly
    try {
      await fetch('http://localhost:8000/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desc: ocrResult.merchant,
          amount: parseFloat(ocrResult.amount),
          cat: ocrResult.category,
          type: 'expense',
          date: new Date().toISOString().split('T')[0] 
        })
      });
      
      // 2. Clean up and refresh the UI
      setShowOCRModal(false);
      setOcrResult(null);
      loadRealData();
      
    } catch (error) {
      console.error("Failed to auto-save receipt:", error);
    }
  };
  // --------------------------------

  // Delete transaction
  // Delete transaction (NOW TALKS TO PYTHON)
  const delTxn = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) return;
    
    try {
      // Send the kill command to your Python SQLite Vault
      await fetch('http://localhost:8000/api/transactions/' + id, { 
        method: 'DELETE' 
      });
      
      // Instantly reload the real data to update the Safe-To-Spend ring
      loadRealData(); 
    } catch (error) {
      console.error("Failed to delete from Vault:", error);
    }
  };

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ id: null, desc: '', amount: '', cat: 'Food', type: 'expense', date: '' });

  const openEditModal = (tx) => {
    setEditForm({
      id: tx.id,
      desc: tx.desc,
      amount: tx.amount,
      cat: tx.cat,
      type: tx.type,
      date: tx.date,
    });
    setShowEditModal(true);
  };

  // Edit transaction - now uses modal
  const saveEditTransaction = async () => {
    if (!editForm.desc || !editForm.amount) return;
    try {
      await fetch(`http://localhost:8000/api/transactions/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          desc: editForm.desc,
          amount: parseFloat(editForm.amount),
          cat: editForm.cat,
          type: editForm.type,
          date: editForm.date,
        }),
      });
      setShowEditModal(false);
      loadRealData();
    } catch (error) {
      console.error("Failed to update Vault:", error);
    }
  };

  // Export CSV
  const exportCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Amount', 'Type'];
    const rows = currentMonthTxns.map((t) => [t.date, t.desc, t.cat, t.amount, t.type]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${MONTHS[filterMonth]}.csv`;
    a.click();
  };

  // Render functions
  const renderDashboard = () => (
    <div style={{ paddingBottom: 80 }}>
      {/* Safe-To-Spend Circle */}
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ width: 24 }}></div> {/* Invisible spacer to keep title centered */}
          <div style={{ fontWeight: 'bold' }}>Financial Autopilot</div>
          <button 
            onClick={() => { 
              setSettingsForm({ income: monthlyIncome });
              setShowSettingsModal(true); 
            }} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20, marginBottom: 20 }}>
          {/* Monthly Safe to Spend Circle */}
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: '50%',
              background: `conic-gradient(${safeColor} 0deg ${(safeToSpend / monthlyIncome) * 360}deg, ${COLORS.border} ${(safeToSpend / monthlyIncome) * 360}deg)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 30px ${safeColor}40`,
            }}
          >
            <div style={{ color: COLORS.muted, fontSize: 9, fontWeight: 500 }}>SAFE TO SPEND</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.text }}>{fmt(safeToSpend)}</div>
            <div style={{ color: COLORS.muted, fontSize: 9, marginTop: 2 }}>this month</div>
          </div>

          {/* Daily Safe to Spend Circle */}
          <div
            style={{
              width: 130,
              height: 130,
              borderRadius: '50%',
              background: `conic-gradient(${COLORS.accent} 0deg ${Math.min((dailySafeSpend / (safeToSpend / 30 || 1)) * 360, 360)}deg, ${COLORS.border} ${Math.min((dailySafeSpend / (safeToSpend / 30 || 1)) * 360, 360)}deg)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 20px ${COLORS.accent}40`,
            }}
          >
            <div style={{ color: COLORS.muted, fontSize: 8, fontWeight: 500 }}>DAILY LIMIT</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>{fmt(dailySafeSpend)}</div>
            <div style={{ color: COLORS.muted, fontSize: 8, marginTop: 2 }}>per day</div>
          </div>
        </div>


      </div>

      {/* Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 16px', marginBottom: 20 }}>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: COLORS.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          + Add Transaction
        </button>
        <button
          onClick={() => setShowOCRModal(true)}
          style={{
            background: COLORS.accent2,
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          📸 Snap Payment
        </button>
      </div>

      {/* Summary Stats */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: '12px',
              textAlign: 'center',
            }}
          >
            <div style={{ color: COLORS.muted, fontSize: 10, marginBottom: 4 }}>INCOME</div>
            <div style={{ color: COLORS.success, fontWeight: 700, fontSize: 14 }}>{fmt(monthlyIncome + extraIncome)}</div>          </div>
          <div
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: '12px',
              textAlign: 'center',
            }}
          >
            <div style={{ color: COLORS.muted, fontSize: 10, marginBottom: 4 }}>SPENT</div>
            <div style={{ color: COLORS.danger, fontWeight: 700, fontSize: 14 }}>{fmt(totalExpense)}</div>
          </div>
          <div
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: '12px',
              textAlign: 'center',
            }}
          >
            <div style={{ color: COLORS.muted, fontSize: 10, marginBottom: 4 }}>BALANCE</div>
            <div style={{ color: COLORS.accent, fontWeight: 700, fontSize: 14 }}>{fmt((monthlyIncome + extraIncome) - fixedBills - totalExpense)}</div>
          </div>
        </div>
      </div>

      {/* ⚡ Fixed Bills Card */}
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

      {/* AI Financial Coach Card */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div style={{ background: `linear-gradient(135deg, ${COLORS.card}, #2a1b4d)`, border: `1px solid ${COLORS.accent}40`, borderRadius: 16, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: coachAdvice ? 12 : 0 }}>
            <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 14 }}>🤖 AI Financial Coach</div>
            <button 
              onClick={fetchCoachAdvice} 
              disabled={coachLoading}
              style={{ background: COLORS.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: coachLoading ? 0.7 : 1 }}
            >
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

      {/* Spending Breakdown */}
      {byCategory.length > 0 && (
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 16,
            margin: '0 16px 20px',
          }}
        >
          <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>
            SPENDING BREAKDOWN
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={byCategory} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value" strokeWidth={0}>
                {byCategory.map((_, i) => (
                  <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                ))}
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

      {/* Recent Transactions */}
      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 16,
          margin: '0 16px',
        }}
      >
        <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>
          RECENT ACTIVITY
        </div>
        {currentMonthTxns.slice(-5).reverse().map((t) => (
          <div
            key={t.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 0',
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ fontSize: 24 }}>{getEmoji(t.cat)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: COLORS.text, fontWeight: 500, fontSize: 13 }}>{t.desc}</div>
              <div style={{ color: COLORS.muted, fontSize: 11 }}>{t.cat}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
  <div style={{ color: t.type === 'income' ? COLORS.success : COLORS.danger, fontWeight: 700, fontSize: 13 }}>
    {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
  </div>
  {/* The Edit Pencil Button */}
  <button 
    onClick={(e) => {
      e.stopPropagation(); 
      openEditModal(t);
    }} 
    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, marginRight: '15px' }}
    title="Edit Transaction"
  >
    ✏️
  </button>

  {/* The Delete Trash Button */}
  <button 
    onClick={(e) => {
      e.stopPropagation(); 
      delTxn(t.id);
    }} 
    style={{ background: 'none', border: 'none', color: COLORS.muted, cursor: 'pointer', fontSize: 16 }}
    title="Delete Transaction"
  >
    🗑️
  </button>
    
</div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderBudget = () => (
    <div style={{ paddingBottom: 80, padding: '16px' }}>
      <h2 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Monthly Budget</h2>

      <div
        style={{
          background: `linear-gradient(135deg, ${COLORS.accent2}15, ${COLORS.card})`,
          border: `1px solid ${COLORS.accent2}40`,
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ color: COLORS.muted, fontSize: 11 }}>TOTAL BUDGET</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.text }}>
              {fmt(monthlyIncome)}
            </div>
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
          <div
            key={cat}
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: 12,
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 18 }}>{CAT_EMOJI[cat]}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{cat}</div>
                  <div 
    onClick={() => setCategoryGoal(cat)}
    style={{ fontSize: 11, color: COLORS.muted, cursor: 'pointer', padding: '2px 4px', border: '1px dashed #444', borderRadius: '4px', display: 'inline-block' }}
    title="Click to set target goal"
  >
    {fmt(spent)} / <span style={{ color: limit > 0 ? COLORS.text : COLORS.muted }}>{fmt(limit)}</span> ✏️
  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color, fontWeight: 700, fontSize: 12 }}>{Math.round(pct)}%</div>
              </div>
            </div>
            <div
              style={{
                background: COLORS.border,
                borderRadius: 3,
                height: 6,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  background: color,
                  height: '100%',
                  width: `${Math.min(pct, 100)}%`,
                  transition: 'width 0.3s',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderAnalytics = () => (
    <div style={{ paddingBottom: 80, padding: '16px' }}>
      <h2 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Analytics</h2>

      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>
          Income vs Expenses (6 months)
        </div>
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

      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>
          Top Categories
        </div>
        {byCategory.map((c, i) => (
          <div key={c.name} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
              <span style={{ color: COLORS.muted }}>{CAT_EMOJI[c.name]} {c.name}</span>
              <span style={{ color: COLORS.text, fontWeight: 600 }}>{fmt(c.value)}</span>
            </div>
            <div
              style={{
                background: COLORS.border,
                borderRadius: 3,
                height: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  background: CAT_COLORS[i],
                  height: '100%',
                  width: `${(c.value / (byCategory[0]?.value || 1)) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>
          Daily Spending (Last 30 Days)
        </div>
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

      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 12,
        }}
      >
        <div style={{ color: COLORS.muted, fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase' }}>
          Monthly Trend
        </div>
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

  const renderAffiliate = () => (
    <div style={{ paddingBottom: 80, padding: '16px' }}>
      <h2 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Recommended For You</h2>

      {totalExpense > 3000 && (
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: 24, marginBottom: 6 }}>💳</div>
              <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Cred</div>
              <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 8 }}>Manage credit cards, earn rewards</div>
            </div>
            <a
              href="https://cred.club/referral"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: COLORS.accent,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                fontWeight: 600,
                fontSize: 11,
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              Open →
            </a>
          </div>
        </div>
      )}

      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: 14,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 24, marginBottom: 6 }}>🏦</div>
            <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Jupiter</div>
            <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 8 }}>Zero-fee bank account, earn interest</div>
          </div>
          <a
            href="https://jupiter.money/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: COLORS.accent2,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 12px',
              fontWeight: 600,
              fontSize: 11,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Open →
          </a>
        </div>
      </div>

      {totalExpense > 2000 && (
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🍗</div>
              <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 14, marginBottom: 4 }}>EatFit</div>
              <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 8 }}>Meal planning, reduce food costs</div>
            </div>
            <a
              href="https://eatfit.app/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: COLORS.warning,
                color: '#000',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                fontWeight: 600,
                fontSize: 11,
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              Open →
            </a>
          </div>
        </div>
      )}

      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <div style={{ fontSize: 24, marginBottom: 6 }}>📈</div>
            <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Groww</div>
            <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 8 }}>Invest in mutual funds, index funds</div>
          </div>
          <a
            href="https://groww.in/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: COLORS.accent,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 12px',
              fontWeight: 600,
              fontSize: 11,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Open →
          </a>
        </div>
      </div>
    </div>
  );

  const renderGoals = () => (
    <div style={{ paddingBottom: 80, padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
     <h2 style={{ color: COLORS.text, fontSize: 16, fontWeight: 700, margin: 0 }}>Savings Goals</h2>
     <button 
       onClick={addNewGoal} 
       style={{ background: COLORS.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
     >
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
          <div
            key={goal.id}
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 12,
              padding: 14,
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                {/* Emoji line completely deleted! */}
                <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>{goal.name}</div>
                <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>
                  {fmt(goal.current)} / {fmt(goal.target)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div onClick={() => deleteGoal(goal.id)} style={{ cursor: 'pointer', fontSize: 13, color: COLORS.danger, background: `${COLORS.danger}20`, padding: '4px 10px', borderRadius: 6, fontWeight: 700, border: `1px solid ${COLORS.danger}40` }}>Delete</div>
                <div
                  onClick={() => addFundsToGoal(goal)}
                  style={{ color: COLORS.accent, fontWeight: 700, fontSize: 14, cursor: 'pointer', background: `${COLORS.accent}20`, padding: '4px 8px', borderRadius: 6 }}
                >
                  + Deposit
                </div>
              </div>
            </div>

            <div style={{ height: 8, background: COLORS.bg, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: COLORS.success, borderRadius: 4 }} />
            </div>

            <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>
              {fmt(goal.current)} / {fmt(goal.target)}
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

  // Styles
  const tabBtnStyle = (active) => ({
    flex: 1,
    padding: '10px 4px',
    border: 'none',
    background: 'none',
    color: active ? COLORS.accent : COLORS.muted,
    cursor: 'pointer',
    fontSize: 10,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    transition: 'color 0.15s',
    fontWeight: 500,
  });

  return (
    <div style={{ background: COLORS.bg, color: COLORS.text, minHeight: '100vh', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <div style={{ padding: '16px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>
          SAFE TO SPEND
        </div>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(parseInt(e.target.value))}
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            color: COLORS.text,
            borderRadius: 8,
            padding: '4px 8px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {tab === 'dashboard' && renderDashboard()}
      {tab === 'budget' && renderBudget()}
      {tab === 'analytics' && renderAnalytics()}
      {tab === 'goals' && renderGoals()}
      {tab === 'affiliate' && renderAffiliate()}

      {/* Bottom Navigation */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: COLORS.card, borderTop: `1px solid ${COLORS.border}`, display: 'flex', zIndex: 100 }}>
        <button style={tabBtnStyle(tab === 'dashboard')} onClick={() => setTab('dashboard')}>
          <span style={{ fontSize: 16 }}>◈</span>Dashboard
        </button>
        <button style={tabBtnStyle(tab === 'budget')} onClick={() => setTab('budget')}>
          <span style={{ fontSize: 16 }}>◎</span>Budget
        </button>
        <button style={tabBtnStyle(tab === 'analytics')} onClick={() => setTab('analytics')}>
          <span style={{ fontSize: 16 }}>▦</span>Analytics
        </button>
        <button style={tabBtnStyle(tab === 'goals')} onClick={() => setTab('goals')}>
          <span style={{ fontSize: 16 }}>◆</span>Goals
        </button>
        <button style={tabBtnStyle(tab === 'affiliate')} onClick={() => setTab('affiliate')}>
          <span style={{ fontSize: 16 }}>★</span>Earn
        </button>
      </nav>

    {/* --- SETTINGS MODAL --- */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#121212', padding: 24, borderRadius: 16, width: '90%', maxWidth: 400, border: '1px solid #333' }}>
            <h2 style={{ marginTop: 0, color: '#FFFFFF', textAlign: 'center' }}>Vault Settings</h2>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: '#A0A0A0', marginBottom: 8, fontSize: 12 }}>Monthly Income (₹)</label>
              <input 
                type="number" 
                value={settingsForm.income} 
                onChange={(e) => setSettingsForm({...settingsForm, income: e.target.value})} 
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #333', background: '#1E1E1E', color: '#FFFFFF', boxSizing: 'border-box' }} 
              />
            </div>

            <div style={{ marginBottom: 24, padding: '12px', background: '#0D0D1A', borderRadius: 8, border: '1px solid #2A2A38' }}>
              <div style={{ color: '#9090A8', fontSize: 11, marginBottom: 4, fontWeight: 600 }}>FIXED BILLS TOTAL</div>
              <div style={{ color: '#4ECDC4', fontSize: 18, fontWeight: 700 }}>{`₹${bills.reduce((s, b) => s + b.amount, 0).toLocaleString('en-IN')}/mo`}</div>
              <div style={{ color: '#9090A8', fontSize: 10, marginTop: 4 }}>Auto-calculated from your bill items on the dashboard. Add or remove bills there.</div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowSettingsModal(false)} style={{ flex: 1, padding: '14px', borderRadius: 12, background: 'transparent', color: '#FFFFFF', cursor: 'pointer', border: '1px solid #333' }}>Cancel</button>
              <button onClick={saveSettings} style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: '#8B5CF6', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>Save & Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'flex-end',
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              background: COLORS.card,
              borderRadius: '20px 20px 0 0',
              padding: 20,
              width: '100%',
              boxSizing: 'border-box',
              border: `1px solid ${COLORS.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: COLORS.text, marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Add Transaction</h3>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['expense', 'income'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFormData({ ...formData, type })}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    background: formData.type === type ? (type === 'expense' ? COLORS.danger : COLORS.success) : COLORS.border,
                    color: formData.type === type ? '#fff' : COLORS.muted,
                  }}
                >
                  {type === 'expense' ? 'Expense' : 'Income'}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Description</label>
              <input
                type="text"
                placeholder="e.g., Zomato lunch"
                value={formData.desc}
                onChange={(e) => setFormData({ ...formData, desc: e.target.value })}
                style={{
                  background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  color: COLORS.text,
                  width: '100%',
                  boxSizing: 'border-box',
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Amount (₹)</label>
              <input
                type="number"
                placeholder="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                style={{
                  background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  color: COLORS.text,
                  width: '100%',
                  boxSizing: 'border-box',
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Category</label>
                <select
                  value={formData.cat}
                  onChange={(e) => setFormData({ ...formData, cat: e.target.value })}
                  style={{
                    background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 10,
                    padding: '10px 12px',
                    color: COLORS.text,
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: 13,
                  }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CAT_EMOJI[c]} {c}
                    </option>
                  ))}
                </select>
                {/* THE NEW BUTTON */}
                <div 
                  onClick={addNewCategory}
                  style={{ color: COLORS.accent, fontSize: 11, cursor: 'pointer', marginTop: 6, fontWeight: 700 }}
                >
                  + Create New Category
                </div>
              </div>
              <div>
                <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  style={{
                    background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 10,
                    padding: '10px 12px',
                    color: COLORS.text,
                    width: '100%',
                    boxSizing: 'border-box',
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            <button
              onClick={addTransaction}
              style={{
                background: formData.type === 'expense' ? COLORS.danger : COLORS.success,
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '12px',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Add {formData.type}
            </button>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowEditModal(false)}
        >
          <div
            style={{ background: COLORS.card, borderRadius: '20px 20px 0 0', padding: 20, width: '100%', boxSizing: 'border-box', border: `1px solid ${COLORS.border}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: COLORS.text, marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Edit Transaction</h3>

            {/* Type toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['expense', 'income'].map((type) => (
                <button
                  key={type}
                  onClick={() => setEditForm({ ...editForm, type })}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer',
                    background: editForm.type === type ? (type === 'expense' ? COLORS.danger : COLORS.success) : COLORS.border,
                    color: editForm.type === type ? '#fff' : COLORS.muted,
                  }}
                >
                  {type === 'expense' ? 'Expense' : 'Income'}
                </button>
              ))}
            </div>

            {/* Description */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Description</label>
              <input
                type="text"
                value={editForm.desc}
                onChange={(e) => setEditForm({ ...editForm, desc: e.target.value })}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '10px 12px', color: COLORS.text, width: '100%', boxSizing: 'border-box', fontSize: 13 }}
              />
            </div>

            {/* Amount */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Amount (₹)</label>
              <input
                type="number"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '10px 12px', color: COLORS.text, width: '100%', boxSizing: 'border-box', fontSize: 13 }}
              />
            </div>

            {/* Category + Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Category</label>
                <select
                  value={editForm.cat}
                  onChange={(e) => setEditForm({ ...editForm, cat: e.target.value })}
                  style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '10px 12px', color: COLORS.text, width: '100%', boxSizing: 'border-box', fontSize: 13 }}
                >
                  {allCategories.map((c) => (
                    <option key={c} value={c}>{getEmoji(c)} {c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ color: COLORS.muted, fontSize: 11, display: 'block', marginBottom: 4, fontWeight: 600 }}>Date</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '10px 12px', color: COLORS.text, width: '100%', boxSizing: 'border-box', fontSize: 13 }}
                />
              </div>
            </div>

            <button
              onClick={saveEditTransaction}
              style={{ background: editForm.type === 'expense' ? COLORS.danger : COLORS.success, color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 600, fontSize: 13, cursor: 'pointer', width: '100%' }}
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* OCR Modal */}
      {showOCRModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'flex-end',
          }}
          onClick={() => setShowOCRModal(false)}
        >
          <div
            style={{
              background: COLORS.card,
              borderRadius: '20px 20px 0 0',
              padding: 20,
              width: '100%',
              boxSizing: 'border-box',
              border: `1px solid ${COLORS.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: COLORS.text, marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Snap UPI Payment</h3>

            <label style={{ cursor: 'pointer', display: 'block', marginBottom: 16 }}>
              <div
                style={{
                  background: COLORS.bg,
                  border: `2px dashed ${COLORS.border}`,
                  borderRadius: 12,
                  padding: 20,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
                <div style={{ color: COLORS.muted, fontSize: 13 }}>Upload UPI screenshot</div>
              </div>
              <input type="file" hidden accept="image/*" onChange={handleOCRUpload} />
            </label>

            {ocrLoading && <div style={{ color: COLORS.muted, textAlign: 'center', marginBottom: 16 }}>Processing image...</div>}

            {ocrResult && (
              <div
                style={{
                  background: COLORS.bg,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <div style={{ color: COLORS.muted, fontSize: 11, marginBottom: 8 }}>DETECTED</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ color: COLORS.text, fontWeight: 600 }}>{ocrResult.merchant}</div>
                    <div style={{ color: COLORS.muted, fontSize: 12 }}>₹{ocrResult.amount}</div>
                  </div>
                  <div style={{ color: COLORS.success, fontWeight: 600, fontSize: 12 }}>✓ {ocrResult.confidence}%</div>
                </div>
                <button
                  onClick={applyOCRResult}
                  style={{
                    background: COLORS.accent,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  Use This
                </button>
              </div>
            )}

            <button
              onClick={() => setShowOCRModal(false)}
              style={{
                background: COLORS.border,
                color: COLORS.muted,
                border: 'none',
                borderRadius: 10,
                padding: '12px',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}