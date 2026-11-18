import React, { useState } from 'react';
import type { User } from '../types';
import { Eye, EyeOff, Lock, User as UserIcon, ArrowRight, ShieldCheck } from 'lucide-react';

interface Props {
  users: User[];
  onLogin: (user: User) => void;
}

export default function Login({ users, onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const foundUser = users.find(u => u.username === username && u.password === password);
    if (foundUser) {
      onLogin(foundUser);
    } else {
      setError('Usuário ou senha incorretos.');
    }
  };

  return (
    <div 
      className="login-wrapper"
      style={{
        backgroundImage: 'url(https://aadcdn.msftauthimages.net/dbd5a2dd-bgnnldy-7ijls5ee8eoflamoplaldujcou5i9bz81ce/logintenantbranding/0/illustration?ts=636089560069128108)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Background overlay & ambient accents */}
      <div className="login-backdrop-overlay" />
      <div className="login-ambient-orb orb-1" />
      <div className="login-ambient-orb orb-2" />

      <div className="login-box">
        <div className="login-brand-header">
          <div className="login-logo-glow">
            <img 
              src="https://costalog.com.br/wp-content/uploads/2024/12/lsl-transportes.webp" 
              alt="LSL Logo" 
              className="login-logo" 
            />
          </div>
          <div className="login-badge-pill">
            <ShieldCheck size={14} /> Sistema Integrado 103Ki
          </div>
          <h2 className="login-title">Controle Operacional</h2>
          <p className="login-subtitle">Gestão de Atividades, Presença & Produtividade</p>
        </div>
        
        {error && (
          <div className="login-error">
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-input-group">
            <span className="login-input-icon">
              <UserIcon size={18} />
            </span>
            <input 
              type="text" 
              placeholder="Digite seu usuário" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
              className="login-input"
              autoComplete="username"
            />
          </div>

          <div className="login-input-group">
            <span className="login-input-icon">
              <Lock size={18} />
            </span>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Digite sua senha" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              className="login-input"
              autoComplete="current-password"
              style={{ paddingRight: '2.75rem' }}
            />
            <button
              type="button"
              className="login-input-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="login-footer">
            <span className="login-forgot">
              Primeiro acesso ou esqueceu a senha?<br/>
              <strong>Contate a gestão ou desenvolvedor.</strong>
            </span>
            <div className="login-actions">
              <button type="submit" className="login-btn-next">
                <span>Acessar Painel</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
