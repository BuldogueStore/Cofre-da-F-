import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Transaction, Profile, CATEGORIES, CHRISTIAN_QUOTES, FixedExpense, Budget } from './types';
import Auth from './components/Auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Plus, 
  LogOut, 
  Wallet, 
  PieChart, 
  History, 
  X,
  TrendingUp,
  TrendingDown,
  Calendar,
  Tag,
  FileText,
  AlertCircle,
  ChevronRight,
  Target,
  Users,
  Briefcase,
  Trash2,
  Filter,
  Utensils,
  Car,
  Home,
  Gamepad2,
  Church,
  HeartPulse,
  GraduationCap,
  MoreHorizontal,
  LayoutGrid
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, eachMonthOfInterval, subMonths, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { GoogleGenAI } from "@google/genai";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'reports' | 'planning'>('dashboard');
  const [quote, setQuote] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [insights, setInsights] = useState<string>('');
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [salaryUser, setSalaryUser] = useState<string>('');
  const [salarySpouse, setSalarySpouse] = useState<string>('');

  // Form state
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [value, setValue] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      if (newUser) {
        fetchUserData(newUser.id);
      } else {
        setProfile(null);
        setTransactions([]);
        setLoading(false);
      }
    });

    setQuote(CHRISTIAN_QUOTES[Math.floor(Math.random() * CHRISTIAN_QUOTES.length)]);

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserData = async (userId: string) => {
    setLoading(true);
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileData) {
        setProfile(profileData);
        setSalaryUser(profileData.salary_user?.toString() || '');
        setSalarySpouse(profileData.salary_spouse?.toString() || '');
      }

      // Fetch transactions
      const { data: transData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (transData) setTransactions(transData);

      // Fetch fixed expenses
      const { data: fixedData } = await supabase
        .from('fixed_expenses')
        .select('*')
        .eq('user_id', userId);
      
      if (fixedData) setFixedExpenses(fixedData);

      // Fetch budgets
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', userId);
      
      if (budgetData) setBudgets(budgetData);
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Real-time subscription for transactions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('transactions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUserData(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { error } = await supabase.from('transactions').insert([
        {
          user_id: user.id,
          type,
          value: parseFloat(value),
          category,
          description,
          date: new Date(date).toISOString(),
          created_at: new Date().toISOString()
        }
      ]);

      if (error) throw error;

      setIsModalOpen(false);
      resetForm();
      fetchUserData(user.id);
    } catch (error) {
      console.error("Error adding transaction:", error);
    }
  };

  const resetForm = () => {
    setType('expense');
    setValue('');
    setCategory(CATEGORIES[0]);
    setDescription('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!window.confirm('Deseja realmente excluir esta transação?')) return;
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchUserData(user.id);
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  };

  const triggerHaptic = () => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(10);
    }
  };

  const generateInsights = async () => {
    if (transactions.length === 0) return;
    setGeneratingInsights(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const monthLabel = format(selectedMonth, 'MMMM yyyy', { locale: ptBR });
      
      const monthTransactions = transactions.filter(t => {
        const tDate = parseISO(t.date);
        return isSameMonth(tDate, selectedMonth);
      });

      const summary = monthTransactions.map(t => 
        `- ${t.type === 'income' ? 'Ganho' : 'Gasto'}: R$ ${t.value} (${t.category}) - ${t.description}`
      ).join('\n');

      const prompt = `Como um consultor financeiro cristão, analise as seguintes transações de ${monthLabel} e forneça 3 insights curtos e práticos sobre mordomia e economia. Seja encorajador e use princípios bíblicos se apropriado.
      
      Transações:
      ${summary}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setInsights(response.text || 'Não foi possível gerar insights no momento.');
    } catch (error) {
      console.error("Error generating insights:", error);
      setInsights('Erro ao conectar com o consultor de mordomia.');
    } finally {
      setGeneratingInsights(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'reports' && !insights) {
      generateInsights();
    }
  }, [activeTab, selectedMonth]);

  const handleUpdateSalaries = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          salary_user: parseFloat(salaryUser) || 0,
          salary_spouse: parseFloat(salarySpouse) || 0
        })
        .eq('id', user.id);
      
      if (error) throw error;
      fetchUserData(user.id);
    } catch (error) {
      console.error("Error updating salaries:", error);
    }
  };

  const handleAddFixedExpense = async (name: string, value: number, category: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('fixed_expenses')
        .insert([{ user_id: user.id, name, value, category }]);
      
      if (error) throw error;
      fetchUserData(user.id);
    } catch (error) {
      console.error("Error adding fixed expense:", error);
    }
  };

  const handleDeleteFixedExpense = async (id: string) => {
    try {
      const { error } = await supabase.from('fixed_expenses').delete().eq('id', id);
      if (error) throw error;
      fetchUserData(user!.id);
    } catch (error) {
      console.error("Error deleting fixed expense:", error);
    }
  };

  const handleUpdateBudget = async (category: string, limit: number) => {
    if (!user) return;
    try {
      const existing = budgets.find(b => b.category === category);
      if (existing) {
        await supabase.from('budgets').update({ limit_value: limit }).eq('id', existing.id);
      } else {
        await supabase.from('budgets').insert([{ user_id: user.id, category, limit_value: limit }]);
      }
      fetchUserData(user.id);
    } catch (error) {
      console.error("Error updating budget:", error);
    }
  };

  const CATEGORY_STYLES: Record<string, { icon: any, color: string, border: string, bg: string, activeBg: string, shadow: string }> = {
    'Alimentação': { icon: Utensils, color: 'text-orange-600', border: 'border-orange-200', bg: 'bg-orange-50', activeBg: 'bg-orange-500', shadow: 'shadow-[0_4px_0_0_#c2410c]' },
    'Transporte': { icon: Car, color: 'text-blue-600', border: 'border-blue-200', bg: 'bg-blue-50', activeBg: 'bg-blue-500', shadow: 'shadow-[0_4px_0_0_#1d4ed8]' },
    'Moradia': { icon: Home, color: 'text-indigo-600', border: 'border-indigo-200', bg: 'bg-indigo-50', activeBg: 'bg-indigo-500', shadow: 'shadow-[0_4px_0_0_#4338ca]' },
    'Lazer': { icon: Gamepad2, color: 'text-pink-600', border: 'border-pink-200', bg: 'bg-pink-50', activeBg: 'bg-pink-500', shadow: 'shadow-[0_4px_0_0_#be185d]' },
    'Dízimos/Ofertas': { icon: Church, color: 'text-yellow-700', border: 'border-yellow-200', bg: 'bg-yellow-50', activeBg: 'bg-yellow-600', shadow: 'shadow-[0_4px_0_0_#a16207]' },
    'Saúde': { icon: HeartPulse, color: 'text-red-600', border: 'border-red-200', bg: 'bg-red-50', activeBg: 'bg-red-500', shadow: 'shadow-[0_4px_0_0_#b91c1c]' },
    'Educação': { icon: GraduationCap, color: 'text-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50', activeBg: 'bg-emerald-500', shadow: 'shadow-[0_4px_0_0_#047857]' },
    'Outros': { icon: MoreHorizontal, color: 'text-slate-600', border: 'border-slate-200', bg: 'bg-slate-50', activeBg: 'bg-slate-500', shadow: 'shadow-[0_4px_0_0_#334155]' },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-faith-blue">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 border-4 border-hope-green border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) return <Auth />;

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.value, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.value, 0);

  const balance = totalIncome - totalExpense;

  const monthTransactions = transactions.filter(t => {
    const tDate = parseISO(t.date);
    return isSameMonth(tDate, selectedMonth);
  });

  const monthIncome = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.value, 0);

  const monthExpense = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.value, 0);

  const monthBalance = monthIncome - monthExpense;

  const categoryData = CATEGORIES.map(cat => {
    const value = monthTransactions
      .filter(t => t.category === cat && t.type === 'expense')
      .reduce((acc, t) => acc + t.value, 0);
    return { name: cat, value };
  }).filter(d => d.value > 0);

  const COLORS = ['#2E8B57', '#D4AF37', '#2C2C54', '#E74C3C', '#3B82F6', '#F59E0B', '#6366F1', '#8B5CF6'];

  const availableMonths = eachMonthOfInterval({
    start: subMonths(new Date(), 6),
    end: new Date()
  }).reverse();

  const filteredTransactions = selectedCategory 
    ? transactions.filter(t => t.category === selectedCategory)
    : transactions;

  const mostUsedCategory = categoryData.length > 0 
    ? categoryData.reduce((prev, current) => (prev.value > current.value) ? prev : current)
    : null;

  const leastUsedCategory = categoryData.length > 0 
    ? categoryData.reduce((prev, current) => (prev.value < current.value) ? prev : current)
    : null;

  const totalFixedExpenses = fixedExpenses.reduce((acc, fe) => acc + fe.value, 0);
  const totalSalaries = (parseFloat(salaryUser) || 0) + (parseFloat(salarySpouse) || 0);
  const availableForVariable = totalSalaries - totalFixedExpenses;

  return (
    <div className="min-h-screen bg-faith-blue pb-20">
      {/* Header */}
      <header className="bg-faith-blue text-white p-4 sm:p-6 rounded-b-[40px] shadow-lg border-b border-white/10">
        <div className="max-w-4xl mx-auto flex justify-between items-center mb-4 sm:mb-6">
          <div>
            <h1 className="text-sm sm:text-xl font-medium opacity-80">Olá, {profile?.name || 'Fiel'}</h1>
            <p className="text-lg sm:text-2xl font-bold">Paz seja convosco!</p>
          </div>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        <div className="max-w-4xl mx-auto glass-card p-6 sm:p-8 bg-white text-slate-900 shadow-[0_12px_0_0_rgba(0,0,0,0.05)] rounded-[32px] border-b-8 border-slate-100">
          <p className="text-[10px] sm:text-sm text-slate-500 font-bold uppercase tracking-widest mb-1">Saldo Total</p>
          <h2 className="text-3xl sm:text-5xl font-black text-prosperity-gold mb-4 sm:mb-6">
            R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </h2>
          <div className="flex gap-2 sm:gap-4">
            <div className="flex-1 bg-emerald-50 p-3 sm:p-4 rounded-2xl flex items-center gap-2 sm:gap-3 border-b-4 border-emerald-100">
              <div className="bg-hope-green p-1.5 sm:p-2 rounded-xl text-white shadow-lg">
                <TrendingUp className="w-4 h-4 sm:w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-emerald-600 font-bold uppercase">Ganhos</p>
                <p className="font-bold text-sm sm:text-lg text-emerald-700">R$ {monthIncome.toLocaleString('pt-BR')}</p>
              </div>
            </div>
            <div className="flex-1 bg-rose-50 p-3 sm:p-4 rounded-2xl flex items-center gap-2 sm:gap-3 border-b-4 border-rose-100">
              <div className="bg-expense-red p-1.5 sm:p-2 rounded-xl text-white shadow-lg">
                <TrendingDown className="w-4 h-4 sm:w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-rose-600 font-bold uppercase">Gastos</p>
                <p className="font-bold text-sm sm:text-lg text-rose-700">R$ {monthExpense.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
        {activeTab === 'dashboard' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4 sm:space-y-6"
          >
            {/* Quote Card */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 sm:p-6 rounded-[32px] flex gap-3 sm:gap-4 items-center border-b-4 border-white/10">
              <div className="bg-prosperity-gold p-2 sm:p-3 rounded-2xl text-white shrink-0 shadow-[0_4px_0_0_rgba(0,0,0,0.1)]">
                <AlertCircle className="w-5 h-5 sm:w-6 h-6" />
              </div>
              <p className="text-white italic font-medium text-sm sm:text-lg">"{quote}"</p>
            </div>

            {/* Category Filter Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-9 gap-3 sm:gap-4">
              <button
                onClick={() => { setSelectedCategory(null); triggerHaptic(); }}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all gap-1 border-2 card-3d ${
                  selectedCategory === null 
                    ? 'bg-hope-green text-white border-hope-green shadow-lg shadow-hope-green/20' 
                    : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'
                }`}
              >
                <LayoutGrid className="w-6 h-6" />
                <span className="text-[10px] font-bold uppercase truncate w-full text-center">Todos</span>
              </button>
              {CATEGORIES.map(cat => {
                const style = CATEGORY_STYLES[cat] || { icon: MoreHorizontal, color: 'text-slate-600', border: 'border-slate-200', bg: 'bg-slate-50', activeBg: 'bg-slate-500', shadow: 'shadow-[0_4px_0_0_#334155]' };
                const Icon = style.icon;
                return (
                  <button
                    key={cat}
                    onClick={() => { setSelectedCategory(cat); triggerHaptic(); }}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all gap-1 border-2 card-3d ${
                      selectedCategory === cat 
                        ? `${style.activeBg} text-white ${style.border.replace('200', '600')} ${style.shadow} active:shadow-none` 
                        : `bg-white ${style.color} border-slate-100 hover:bg-slate-50 shadow-[0_4px_0_0_rgba(0,0,0,0.05)] active:shadow-none`
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase truncate w-full text-center">
                      {cat === 'Dízimos' ? 'Dízimos' : cat}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Summary Insights */}
            {!selectedCategory && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass-card p-4 flex items-center gap-4 card-3d border-slate-100">
                  <div className="bg-rose-100 p-3 rounded-2xl text-rose-600 shadow-inner">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Maior Gasto</p>
                    <p className="font-bold text-slate-900">{mostUsedCategory?.name || 'Nenhum'}</p>
                    <p className="text-xs text-rose-600">R$ {mostUsedCategory?.value.toLocaleString('pt-BR') || '0,00'}</p>
                  </div>
                </div>
                <div className="glass-card p-4 flex items-center gap-4 card-3d border-slate-100">
                  <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600 shadow-inner">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Menor Gasto</p>
                    <p className="font-bold text-slate-900">{leastUsedCategory?.name || 'Nenhum'}</p>
                    <p className="text-xs text-emerald-600">R$ {leastUsedCategory?.value.toLocaleString('pt-BR') || '0,00'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Alerts */}
            {monthExpense > monthIncome && monthIncome > 0 && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-red-800 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 sm:w-6 h-6 shrink-0" />
                <p className="font-medium text-sm">Atenção: seus gastos estão maiores que seus ganhos este mês! ⚠️</p>
              </div>
            )}

            {/* Charts Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {!selectedCategory && (
                <div className="glass-card p-4 sm:p-6 card-3d border-slate-100">
                  <h3 className="font-bold text-base sm:text-lg mb-4 flex items-center gap-2">
                    <PieChart className="w-4 h-4 sm:w-5 h-5 text-hope-green" />
                    Gastos por Categoria
                  </h3>
                  <div className="h-48 sm:h-64">
                    {categoryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RePieChart>
                          <Pie
                            data={categoryData}
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {categoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </RePieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 italic text-sm">
                        Nenhum gasto registrado
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className={`glass-card p-4 sm:p-6 card-3d border-slate-100 ${selectedCategory ? 'md:col-span-2' : ''}`}>
                <h3 className="font-bold text-base sm:text-lg mb-4 flex items-center gap-2">
                  <History className="w-4 h-4 sm:w-5 h-5 text-hope-green" />
                  {selectedCategory ? `Transações em ${selectedCategory}` : 'Últimas Transações'}
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  {(selectedCategory ? filteredTransactions : transactions.slice(0, 5)).map(t => (
                    <div key={t.id} className="flex justify-between items-center p-2 sm:p-3 hover:bg-slate-50 rounded-xl transition-colors border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`p-1.5 sm:p-2 rounded-xl shadow-sm ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {t.type === 'income' ? <ArrowUpCircle className="w-4 h-4 sm:w-5 h-5" /> : <ArrowDownCircle className="w-4 h-4 sm:w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-xs sm:text-sm">{t.description || t.category}</p>
                          <p className="text-[10px] sm:text-xs text-slate-500">{format(parseISO(t.date), 'dd MMM', { locale: ptBR })}</p>
                        </div>
                      </div>
                      <p className={`font-bold text-sm sm:text-base ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.type === 'income' ? '+' : '-'} R$ {t.value.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  ))}
                  {(selectedCategory ? filteredTransactions : transactions).length === 0 && (
                    <p className="text-center text-slate-400 py-8 italic text-sm">Nenhuma transação encontrada</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-6 card-3d border-slate-100"
          >
            <h3 className="font-bold text-xl mb-6">Histórico Completo</h3>
            <div className="space-y-4">
              {transactions.map(t => (
                <div key={t.id} className="flex justify-between items-center p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-xl transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {t.type === 'income' ? <ArrowUpCircle className="w-6 h-6" /> : <ArrowDownCircle className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="font-bold">{t.description || t.category}</p>
                      <div className="flex gap-2 text-xs text-slate-500 mt-1">
                        <span className="bg-slate-100 px-2 py-0.5 rounded-full">{t.category}</span>
                        <span>{format(parseISO(t.date), 'dd/MM/yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <p className={`font-bold text-lg ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === 'income' ? '+' : '-'} R$ {t.value.toLocaleString('pt-BR')}
                    </p>
                    <button 
                      onClick={() => handleDeleteTransaction(t.id)}
                      className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'reports' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Month Selector */}
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide px-1">
              {availableMonths.map((m, idx) => {
                const isActive = isSameMonth(m, selectedMonth);
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedMonth(m);
                      setInsights('');
                      triggerHaptic();
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all gap-1 border-2 card-3d min-w-[80px] ${
                      isActive
                        ? 'bg-prosperity-gold text-white border-prosperity-gold shadow-[0_4px_0_0_#b8860b] active:shadow-none'
                        : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50 shadow-[0_4px_0_0_rgba(0,0,0,0.05)] active:shadow-none'
                    }`}
                  >
                    <Calendar className={`w-5 h-5 ${isActive ? 'text-white' : 'text-prosperity-gold'}`} />
                    <span className="text-[10px] font-bold uppercase truncate w-full text-center">
                      {format(m, 'MMM yy', { locale: ptBR })}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Monthly Summary Card */}
            <div className="glass-card p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 card-3d border-slate-100">
              <div className="text-center p-4 bg-emerald-50 rounded-2xl border-b-4 border-emerald-100">
                <p className="text-xs text-emerald-600 font-bold uppercase mb-1">Entradas</p>
                <p className="text-xl font-bold text-emerald-700">R$ {monthIncome.toLocaleString('pt-BR')}</p>
              </div>
              <div className="text-center p-4 bg-rose-50 rounded-2xl border-b-4 border-rose-100">
                <p className="text-xs text-rose-600 font-bold uppercase mb-1">Saídas</p>
                <p className="text-xl font-bold text-rose-700">R$ {monthExpense.toLocaleString('pt-BR')}</p>
              </div>
              <div className={`text-center p-4 rounded-2xl border-b-4 ${monthBalance >= 0 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
                <p className={`text-xs font-bold uppercase mb-1 ${monthBalance >= 0 ? 'text-amber-600' : 'text-red-600'}`}>Saldo</p>
                <p className={`text-xl font-bold ${monthBalance >= 0 ? 'text-amber-700' : 'text-red-700'}`}>R$ {monthBalance.toLocaleString('pt-BR')}</p>
              </div>
            </div>

            <div className="glass-card p-6 card-3d border-slate-100">
              <h3 className="font-bold text-xl mb-6">Distribuição de Gastos</h3>
              <div className="h-80">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RePieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 italic">
                    Nenhum gasto neste mês
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card p-6 card-3d border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-hope-green" />
                  Insights de Mordomia
                </h3>
                {generatingInsights && (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-hope-green border-t-transparent rounded-full"
                  />
                )}
              </div>
              <div className="space-y-4">
                {insights ? (
                  <div className="bg-slate-50 p-4 rounded-2xl text-slate-700 leading-relaxed whitespace-pre-line">
                    {insights}
                  </div>
                ) : generatingInsights ? (
                  <p className="text-slate-500 italic">O consultor está analisando sua mordomia...</p>
                ) : (
                  <p className="text-slate-500 italic">Aguardando dados para gerar insights...</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'planning' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Salaries Section */}
            <div className="glass-card p-6 card-3d border-slate-100">
              <h3 className="font-bold text-xl mb-6 flex items-center gap-2">
                <Users className="w-6 h-6 text-hope-green" />
                Renda Mensal Familiar
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-2">Seu Salário</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-3.5 text-slate-400 w-5 h-5" />
                    <input
                      type="number"
                      placeholder="0,00"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-hope-green outline-none"
                      value={salaryUser}
                      onChange={(e) => setSalaryUser(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-2">Salário do Cônjuge</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-3.5 text-slate-400 w-5 h-5" />
                    <input
                      type="number"
                      placeholder="0,00"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-hope-green outline-none"
                      value={salarySpouse}
                      onChange={(e) => setSalarySpouse(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={handleUpdateSalaries}
                className="w-full bg-faith-blue text-white py-3 rounded-2xl font-bold hover:bg-faith-blue/90 transition-all"
              >
                Atualizar Renda
              </button>
            </div>

            {/* Fixed Expenses Section */}
            <div className="glass-card p-6 card-3d border-slate-100">
              <h3 className="font-bold text-xl mb-6 flex items-center gap-2">
                <Calendar className="w-6 h-6 text-hope-green" />
                Despesas Fixas Mensais
              </h3>
              <div className="space-y-4 mb-6">
                {fixedExpenses.map(fe => (
                  <div key={fe.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border-b-2 border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-2 rounded-xl shadow-sm">
                        <Tag className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{fe.name}</p>
                        <p className="text-xs text-slate-500">{fe.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-bold text-rose-600">R$ {fe.value.toLocaleString('pt-BR')}</p>
                      <button 
                        onClick={() => handleDeleteFixedExpense(fe.id)}
                        className="text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
                {fixedExpenses.length === 0 && (
                  <p className="text-center text-slate-400 py-4 italic">Nenhuma despesa fixa registrada</p>
                )}
              </div>

              {/* Add Fixed Expense Form */}
              <div className="p-4 border-2 border-dashed border-slate-200 rounded-[32px] space-y-4">
                <p className="text-sm font-bold text-slate-500 uppercase text-center">Adicionar Nova Despesa Fixa</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    id="fe-name"
                    type="text"
                    placeholder="Nome (ex: Aluguel)"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  />
                  <input
                    id="fe-value"
                    type="number"
                    placeholder="Valor"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  />
                  <select
                    id="fe-category"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <button
                  onClick={() => {
                    const name = (document.getElementById('fe-name') as HTMLInputElement).value;
                    const value = parseFloat((document.getElementById('fe-value') as HTMLInputElement).value);
                    const category = (document.getElementById('fe-category') as HTMLSelectElement).value;
                    if (name && value) {
                      handleAddFixedExpense(name, value, category);
                      (document.getElementById('fe-name') as HTMLInputElement).value = '';
                      (document.getElementById('fe-value') as HTMLInputElement).value = '';
                    }
                  }}
                  className="w-full bg-hope-green text-white py-3 rounded-2xl font-bold hover:bg-hope-green/90 transition-all"
                >
                  Adicionar Despesa
                </button>
              </div>
            </div>

            {/* Budget Planning Section */}
            <div className="glass-card p-6 card-3d border-slate-100">
              <h3 className="font-bold text-xl mb-6 flex items-center gap-2">
                <Target className="w-6 h-6 text-hope-green" />
                Planejamento de Orçamento
              </h3>
              
              <div className="bg-faith-blue/5 p-6 rounded-[32px] mb-8 border-b-4 border-faith-blue/10">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-bold text-slate-500 uppercase">Resumo da Mordomia</p>
                  <span className="bg-hope-green text-white text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider">Sugestão 50/30/20</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-600">Necessidades (Fixas)</span>
                      <span className={totalFixedExpenses > totalSalaries * 0.5 ? 'text-rose-600' : 'text-emerald-600'}>
                        {((totalFixedExpenses / (totalSalaries || 1)) * 100).toFixed(0)}% de 50%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${totalFixedExpenses > totalSalaries * 0.5 ? 'bg-rose-500' : 'bg-hope-green'}`}
                        style={{ width: `${Math.min((totalFixedExpenses / (totalSalaries || 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 italic">
                    {totalFixedExpenses > totalSalaries * 0.5 
                      ? "⚠️ Suas despesas fixas estão acima do recomendado (50%). Tente reduzir custos recorrentes."
                      : "✅ Suas despesas fixas estão sob controle. Continue assim!"}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-sm font-bold text-slate-500 uppercase">Limites por Categoria</p>
                {CATEGORIES.map(cat => {
                  const budget = budgets.find(b => b.category === cat);
                  const spent = transactions
                    .filter(t => t.category === cat && t.type === 'expense' && isSameMonth(parseISO(t.date), selectedMonth))
                    .reduce((acc, t) => acc + t.value, 0);
                  const limit = budget?.limit_value || 0;
                  const percent = limit > 0 ? (spent / limit) * 100 : 0;

                  return (
                    <div key={cat} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-700">{cat}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Limite:</span>
                          <input
                            type="number"
                            className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                            defaultValue={limit}
                            onBlur={(e) => handleUpdateBudget(cat, parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      {limit > 0 && (
                        <div className="space-y-1">
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${percent > 100 ? 'bg-rose-500' : 'bg-hope-green'}`}
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] font-bold">
                            <span className="text-slate-400">Gasto: R$ {spent.toLocaleString('pt-BR')}</span>
                            <span className={percent > 100 ? 'text-rose-600' : 'text-slate-400'}>
                              {percent.toFixed(0)}% do limite
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-slate-100 py-2 px-4 flex justify-around items-center z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => { setActiveTab('dashboard'); triggerHaptic(); }}
          className={`flex flex-col items-center gap-0.5 transition-colors relative ${activeTab === 'dashboard' ? 'text-hope-green' : 'text-slate-400'}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase">Início</span>
          {activeTab === 'dashboard' && (
            <motion.div layoutId="nav-indicator" className="absolute -bottom-1 w-1 h-1 bg-hope-green rounded-full" />
          )}
        </motion.button>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => { setActiveTab('history'); triggerHaptic(); }}
          className={`flex flex-col items-center gap-0.5 transition-colors relative ${activeTab === 'history' ? 'text-hope-green' : 'text-slate-400'}`}
        >
          <History className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase">Histórico</span>
          {activeTab === 'history' && (
            <motion.div layoutId="nav-indicator" className="absolute -bottom-1 w-1 h-1 bg-hope-green rounded-full" />
          )}
        </motion.button>
        <div className="relative -top-6">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { setIsModalOpen(true); triggerHaptic(); }}
            className="bg-hope-green text-white p-3 rounded-full shadow-[0_6px_0_0_#236b43] active:shadow-none active:translate-y-1 transition-all"
          >
            <Plus className="w-6 h-6" />
          </motion.button>
        </div>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => { setActiveTab('reports'); triggerHaptic(); }}
          className={`flex flex-col items-center gap-0.5 transition-colors relative ${activeTab === 'reports' ? 'text-hope-green' : 'text-slate-400'}`}
        >
          <PieChart className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase">Relatórios</span>
          {activeTab === 'reports' && (
            <motion.div layoutId="nav-indicator" className="absolute -bottom-1 w-1 h-1 bg-hope-green rounded-full" />
          )}
        </motion.button>
        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => { setActiveTab('planning'); triggerHaptic(); }}
          className={`flex flex-col items-center gap-0.5 transition-colors relative ${activeTab === 'planning' ? 'text-hope-green' : 'text-slate-400'}`}
        >
          <Target className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase">Planejar</span>
          {activeTab === 'planning' && (
            <motion.div layoutId="nav-indicator" className="absolute -bottom-1 w-1 h-1 bg-hope-green rounded-full" />
          )}
        </motion.button>
      </nav>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-lg bg-white rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-faith-blue">Nova Transação</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="space-y-6">
                <div className="flex p-1 bg-slate-100 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${type === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    Gasto
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`flex-1 py-3 rounded-xl font-bold transition-all ${type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    Ganho
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      className="w-full pl-14 pr-4 py-6 bg-slate-50 border-none rounded-3xl text-4xl font-bold text-slate-900 focus:ring-2 focus:ring-hope-green outline-none"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-2">Categoria</label>
                      <div className="relative">
                        <Tag className="absolute left-3 top-3.5 text-slate-400 w-5 h-5" />
                        <select
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-hope-green outline-none appearance-none"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                        >
                          {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase ml-2">Data</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3.5 text-slate-400 w-5 h-5" />
                        <input
                          type="date"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-hope-green outline-none"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-2">Descrição</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3.5 text-slate-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Ex: Aluguel, Salário..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:ring-2 focus:ring-hope-green outline-none"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-hope-green text-white py-4 rounded-2xl font-bold text-lg hover:bg-hope-green/90 transition-all shadow-lg shadow-hope-green/20"
                >
                  Salvar Transação
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
