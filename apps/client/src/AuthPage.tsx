import { useState } from 'react';
import { Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, CarFront, Eye, EyeOff, FileText, LockKeyhole, Mail, MessageSquare, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import { api, errorText } from './lib';
import { Button, Input } from './ui';
import './auth.css';

type User = { id: string; name: string; email: string; role: string };
const authSchema = z.object({ name: z.string().optional(), email: z.email('Enter a valid email'), password: z.string().min(8, 'Use at least 8 characters') });
type AuthValues = z.infer<typeof authSchema>;

export function AuthPage({ register, signedIn, onAuthenticated }: { register?: boolean; signedIn: boolean; onAuthenticated: (user: User) => void }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { register: field, handleSubmit, formState: { errors } } = useForm<AuthValues>({ resolver: zodResolver(authSchema) });

  if (signedIn) return <Navigate to="/app" replace/>;

  const submit = async (data: AuthValues) => {
    setBusy(true); setError('');
    try {
      if (register && (!data.name || data.name.trim().length < 2)) { setError('Enter your name'); return; }
      const response = await api.post(`/auth/${register ? 'register' : 'login'}`, data);
      localStorage.setItem('hyundai_token', response.data.token);
      onAuthenticated(response.data.user);
      navigate('/app');
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };

  return <div className="auth-page">
    <aside className="auth-story">
      <div className="auth-story-inner">
        <NavLink to="/" className="auth-brand"><span className="auth-brand-mark"><CarFront size={22}/></span><span>HYUNDAI <b>ASSISTANT</b></span></NavLink>
        <div className="auth-story-content">
          <span className="auth-kicker"><span/> THE FUTURE OF VEHICLE RESEARCH</span>
          <h1>Answers that<br/><em>move you forward.</em></h1>
          <p>Bring your Hyundai brochures together. Explore every feature, compare models, and trace answers to the source.</p>
          <div className="auth-preview">
            <div className="auth-preview-header"><span className="auth-preview-sparkle"><Sparkles size={17}/></span><span>YOUR RESEARCH, SIMPLIFIED</span><span className="auth-preview-dots">•••</span></div>
            <div className="auth-preview-question"><MessageSquare size={16}/> What should I know about this model?</div>
            <div className="auth-preview-answer"><span className="auth-preview-answer-icon"><CarFront size={17}/></span><div><strong>Explore with confidence</strong><p>Find clear answers about the vehicles in your brochures, backed by cited pages.</p><span><FileText size={13}/> Source linked insight</span></div></div>
          </div>
        </div>
        <div className="auth-story-footer"><span>YOUR DOCUMENTS. YOUR QUESTIONS. YOUR DECISION.</span><span>01 / 03</span></div>
      </div>
    </aside>
    <main className="auth-main">
      <div className="auth-mobile-brand"><NavLink to="/" className="auth-brand"><span className="auth-brand-mark"><CarFront size={20}/></span><span>HYUNDAI <b>ASSISTANT</b></span></NavLink></div>
      <NavLink className="auth-back" to="/"><ArrowLeft size={16}/> Back to home</NavLink>
      <div className="auth-form-wrap">
        <span className="auth-form-kicker">{register ? 'GET STARTED' : 'WELCOME BACK'}</span>
        <h2>{register ? 'Create your account.' : 'Welcome back.'}</h2>
        <p className="auth-form-intro">{register ? 'Set up your workspace and start exploring your Hyundai brochures.' : 'Sign in to continue your vehicle research.'}</p>
        <form onSubmit={handleSubmit(submit)} className="auth-form">
          {register && <label className="auth-field"><span>Full name</span><span className="auth-input-wrap"><UserRound size={18}/><Input autoComplete="name" placeholder="Your name" {...field('name')}/></span></label>}
          <label className="auth-field"><span>Email address</span><span className="auth-input-wrap"><Mail size={18}/><Input type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={Boolean(errors.email)} {...field('email')}/></span>{errors.email && <small className="auth-field-error">{errors.email.message}</small>}</label>
          <label className="auth-field"><span>Password</span><span className="auth-input-wrap"><LockKeyhole size={18}/><Input type={showPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} placeholder="At least 8 characters" aria-invalid={Boolean(errors.password)} {...field('password')}/><button type="button" className="auth-show-password" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></span>{errors.password && <small className="auth-field-error">{errors.password.message}</small>}</label>
          {error && <p role="alert" className="auth-alert">{error}</p>}
          <Button className="auth-submit" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'} <ArrowRight size={18}/></Button>
        </form>
        <div className="auth-switch">{register ? 'Already have an account?' : 'New to Hyundai Assistant?'} <NavLink to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create an account'}</NavLink></div>
        <div className="auth-assurance"><ShieldCheck size={17}/><span>Your brochures and conversations stay in your account.</span></div>
      </div>
      <div className="auth-copyright">© 2026 Hyundai Assistant · Brochure informed research</div>
    </main>
  </div>;
}
