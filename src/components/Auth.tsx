import React, { useState } from 'react';
import { supabase } from '../supabase';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Mail, Lock, User } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });
        
        if (signUpError) throw signUpError;

        if (data.user) {
          if (data.session) {
            setSuccess('Conta criada com sucesso! Redirecionando...');
          } else {
            setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro (ou verifique se desativou a confirmação no Supabase).');
          }

          // Try to create profile
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert([
              { id: data.user.id, name, email, created_at: new Date().toISOString() }
            ]);
          
          if (profileError) {
            console.error('Erro ao criar perfil:', profileError);
            // We don't necessarily want to block the user if the profile creation fails but auth succeeded
          }
        }
      }
    } catch (err: any) {
      console.error('Erro de Autenticação:', err);
      
      let message = err.message || 'Ocorreu um erro inesperado.';
      
      if (message === 'Invalid login credentials') {
        message = 'E-mail ou senha incorretos. Verifique seus dados ou crie uma nova conta se ainda não tiver uma.';
      } else if (message === 'Email not confirmed') {
        message = 'E-mail ainda não confirmado. Verifique sua caixa de entrada ou desative a confirmação no painel do Supabase.';
      } else if (message === 'User already registered') {
        message = 'Este e-mail já está cadastrado. Tente fazer login.';
      } else if (message.includes('rate limit exceeded')) {
        message = 'Muitas tentativas em pouco tempo. Por favor, aguarde alguns minutos antes de tentar novamente.';
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-faith-blue">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[32px] p-8 shadow-[0_12px_0_0_rgba(0,0,0,0.05)] border-b-8 border-slate-100"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-faith-blue mb-2">Cofre da Fé</h1>
          <p className="text-slate-500">Gestão de Mordomia Financeira</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Nome Completo"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-hope-green outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
            <input
              type="email"
              placeholder="E-mail"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-hope-green outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
            <input
              type="password"
              placeholder="Senha"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-hope-green outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}
          {success && <p className="text-emerald-600 text-sm bg-emerald-50 p-3 rounded-xl border border-emerald-100">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-hope-green text-white py-4 rounded-full font-bold hover:bg-hope-green/90 transition-all flex items-center justify-center gap-2 shadow-[0_6px_0_0_#236b43] active:shadow-none active:translate-y-1"
          >
            {loading ? 'Carregando...' : isLogin ? (
              <><LogIn className="w-5 h-5" /> Entrar</>
            ) : (
              <><UserPlus className="w-5 h-5" /> Criar Conta</>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-faith-blue font-bold hover:underline"
          >
            {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
