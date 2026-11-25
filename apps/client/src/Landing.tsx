import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BookOpen, CarFront, Check, FileSearch, GitCompareArrows, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import './landing.css';

const features = [
  { icon: FileSearch, number: '01', title: 'Make brochures searchable', description: 'Upload Hyundai PDF brochures and find the details that matter without scrolling through every page.' },
  { icon: MessageCircle, number: '02', title: 'Ask in plain language', description: 'Explore specifications, features, and options through a conversation with the assistant.' },
  { icon: GitCompareArrows, number: '03', title: 'Compare with confidence', description: 'Compare documented models and get recommendations based on the brochures in your workspace.' },
];

export function Landing({ signedIn }: { signedIn: boolean }) {
  return <div className="landing">
    <header className="landing-header">
      <Link to="/" className="landing-logo" aria-label="Hyundai Assistant home"><span className="landing-logo-icon"><CarFront size={22} strokeWidth={2.2}/></span><span>HYUNDAI <b>ASSISTANT</b></span></Link>
      <nav className="landing-nav" aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#features">Features</a></nav>
      <div className="landing-header-actions">{!signedIn && <Link className="landing-signin" to="/login">Sign in</Link>}<Link className="landing-small-cta" to={signedIn ? '/app' : '/register'}>{signedIn ? 'Open workspace' : 'Get started'} <ArrowUpRight size={16}/></Link></div>
    </header>

    <main>
      <section className="landing-hero">
        <div className="landing-hero-glow" aria-hidden="true"/>
        <div className="landing-hero-content">
          <div className="landing-eyebrow"><span className="landing-eyebrow-line"/> THE SMARTER WAY TO EXPLORE HYUNDAI</div>
          <h1>Every detail.<br/><em>One conversation.</em></h1>
          <p>Turn vehicle brochures into clear, useful answers. Ask questions, compare models, and see exactly where each answer came from.</p>
          <div className="landing-hero-actions"><Link to={signedIn ? '/app' : '/register'} className="landing-primary-cta">{signedIn ? 'Open your workspace' : 'Start exploring'} <ArrowRight size={19}/></Link><a href="#how-it-works" className="landing-text-link">See how it works <ArrowUpRight size={17}/></a></div>
          <div className="landing-hero-proof"><span><Check size={15}/> Brochure based answers</span><span><Check size={15}/> Cited source pages</span></div>
        </div>
        <div className="landing-visual" aria-label="Illustration of an assistant answering a vehicle question">
          <div className="landing-orbit landing-orbit-one"/><div className="landing-orbit landing-orbit-two"/>
          <div className="landing-visual-label"><span className="landing-live-dot"/> INTELLIGENCE, IN MOTION</div>
          <svg className="landing-car" viewBox="0 0 700 300" role="img" aria-label="Stylized modern vehicle"><defs><linearGradient id="carPaint" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c3d4e5"/><stop offset="0.48" stopColor="#f9fcff"/><stop offset="1" stopColor="#839bb3"/></linearGradient><linearGradient id="carGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#102947"/><stop offset="1" stopColor="#426583"/></linearGradient></defs><ellipse cx="350" cy="251" rx="284" ry="21" fill="#081a31" opacity=".55"/><path d="M65 190 L99 165 L159 153 L217 91 Q233 73 273 68 L432 66 Q466 67 492 92 L546 147 L611 164 Q635 170 642 194 L646 219 Q645 233 630 235 L594 235 Q590 197 551 196 Q510 195 504 235 L194 235 Q189 196 149 196 Q108 196 103 235 L78 235 Q62 233 60 219 Z" fill="url(#carPaint)" stroke="#e4eff7" strokeWidth="4"/><path d="M226 94 Q242 79 274 77 L426 76 Q449 76 468 96 L517 149 L171 149 Z" fill="url(#carGlass)" stroke="#a5bfd3" strokeWidth="4"/><path d="M352 77 L350 149 M173 151 L523 151" stroke="#d8e7f3" strokeWidth="4"/><path d="M74 185 L121 172 L119 191 L64 199 M574 165 L620 177 L633 197 L572 190" fill="#d6f8ff"/><path d="M184 168 L493 168" stroke="#7294ae" strokeWidth="3" opacity=".7"/><circle cx="149" cy="234" r="39" fill="#142235" stroke="#8da9bf" strokeWidth="6"/><circle cx="149" cy="234" r="19" fill="#c6d5e0"/><circle cx="550" cy="234" r="39" fill="#142235" stroke="#8da9bf" strokeWidth="6"/><circle cx="550" cy="234" r="19" fill="#c6d5e0"/></svg>
          <div className="landing-floating-card landing-question"><span className="landing-card-icon"><MessageCircle size={17}/></span><div><small>YOUR QUESTION</small><strong>Which model fits my family?</strong></div></div>
          <div className="landing-floating-card landing-answer"><span className="landing-answer-top"><Sparkles size={15}/> ASSISTANT INSIGHT</span><strong>Explore space, safety, and comfort in one answer.</strong><span className="landing-source"><BookOpen size={13}/> Linked to brochure sources</span></div>
          <div className="landing-visual-bottom">EXPLORE WITH CLARITY <span>↗</span></div>
        </div>
      </section>

      <section className="landing-stats" aria-label="Key capabilities"><div><strong>01</strong><span>One place for your research</span></div><div><strong>PDF</strong><span>Your brochures become searchable</span></div><div><strong>100%</strong><span>Answers tied to source pages</span></div></section>

      <section className="landing-section landing-how" id="how-it-works"><div className="landing-section-heading"><div><span className="landing-kicker">A BETTER WAY TO DECIDE</span><h2>From brochure to<br/><em>breakthrough.</em></h2></div><p>Vehicle research should feel simple. Bring your documents, ask what matters, and follow the evidence back to its source.</p></div><div className="landing-steps"><div><span>1</span><h3>Upload a brochure</h3><p>Add a text based Hyundai PDF to your private workspace.</p></div><div><span>2</span><h3>Ask or compare</h3><p>Explore features, specifications, and differences in everyday language.</p></div><div><span>3</span><h3>Check the source</h3><p>Review cited pages before making your decision.</p></div></div></section>

      <section className="landing-section landing-features" id="features"><div className="landing-section-heading"><div><span className="landing-kicker">BUILT FOR THE DETAILS</span><h2>Everything you need<br/>to <em>look closer.</em></h2></div><p>A focused workspace for researching Hyundai vehicles with your own brochure collection.</p></div><div className="landing-feature-grid">{features.map(({ icon: Icon, number, title, description }) => <article className="landing-feature" key={number}><div className="landing-feature-top"><span className="landing-feature-icon"><Icon size={24} strokeWidth={1.8}/></span><span>{number}</span></div><h3>{title}</h3><p>{description}</p><ArrowUpRight className="landing-feature-arrow" size={21}/></article>)}</div></section>

      <section className="landing-final"><div><span className="landing-kicker">READY WHEN YOU ARE</span><h2>Find your next answer.</h2><p>Your research starts with a single brochure.</p></div><Link to={signedIn ? '/app' : '/register'} className="landing-primary-cta">{signedIn ? 'Open workspace' : 'Create your account'} <ArrowRight size={19}/></Link></section>
    </main>
    <footer className="landing-footer"><Link to="/" className="landing-logo"><span className="landing-logo-icon"><CarFront size={19}/></span><span>HYUNDAI <b>ASSISTANT</b></span></Link><span>Brochure informed vehicle research.</span><span className="landing-footer-note"><ShieldCheck size={15}/> Verify details with original documents.</span></footer>
  </div>;
}
