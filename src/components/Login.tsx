import React, { useState } from 'react';
import type { User } from '../types';

interface Props {
  users: User[];
  onLogin: (user: User) => void;
}

export default function Login({ users, onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="login-wrapper" style={{ backgroundImage: 'url(https://aadcdn.msftauthimages.net/dbd5a2dd-bgnnldy-7ijls5ee8eoflamoplaldujcou5i9bz81ce/logintenantbranding/0/illustration?ts=636089560069128108)' }}>
      <div className="login-box">
        <h2 className="login-title">Entrar</h2>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input 
              type="text" 
              placeholder="Usuário (ex: reldery_assuncao)" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
              className="login-input"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input 
              type="password" 
              placeholder="Senha" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              className="login-input"
            />
          </div>
          <div className="login-footer">
            <p className="login-forgot">Não tem uma conta configurada? Contate a gestão.</p>
            <div className="login-actions">
              <button type="submit" className="login-btn-next">Entrar</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
