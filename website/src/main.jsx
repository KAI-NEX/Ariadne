import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, ArrowUpRight, Menu, X, Pause, Play, Download, Globe, Monitor } from 'lucide-react';
import { COPY, WEB_URL, GITHUB_URL, DOWNLOAD_URL } from './content';
import VIDEO from '../public/media/ariadne-fish-loop-v4.mp4';
import '../../public/vi/tokens.css';
import '../../public/vi/layout.css';
import './styles.css';

const pageFromHash = () => {
  const name = location.hash.slice(1);
  if (name === 'web' || name === 'download') return 'experience';
  return ['home', 'about', 'experience'].includes(name) ? name : 'home';
};
const readLanguage = () => { try { return localStorage.getItem('ariadne-website-language') === 'en' ? 'en' : 'zh'; } catch { return 'zh'; } };

function Brand() {
  return <><span className="wordmark">Ariadne</span><span className="brand-divider" aria-hidden="true" /><span className="brand-zh">衡</span></>;
}
function Action({ href, children, external = false, download = false, onClick, secondary = false }) {
  const Icon = download ? Download : external ? ArrowUpRight : ArrowRight;
  return <a className={`site-button ${secondary ? 'site-button-secondary' : ''}`} href={href} onClick={onClick}>{children}<Icon size={16} aria-hidden="true" /></a>;
}
function Header({ page, copy, language, setLanguage, navigate }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef(null);
  const menu = useRef(null);
  useEffect(() => {
    const main = document.querySelector('main');
    main.inert = open;
    if (!open) return () => { main.inert = false; };
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menu.current.querySelector('a').focus();
    const onKey = (event) => {
      if (event.key === 'Escape') { setOpen(false); toggle.current.focus(); }
      if (event.key === 'Tab') {
        const elements = [toggle.current, ...menu.current.querySelectorAll('a')];
        const index = elements.indexOf(document.activeElement);
        if (event.shiftKey && index === 0) { event.preventDefault(); elements.at(-1).focus(); }
        if (!event.shiftKey && index === elements.length - 1) { event.preventDefault(); elements[0].focus(); }
      }
    };
    const media = matchMedia('(min-width: 768px)');
    const onResize = () => { if (media.matches) setOpen(false); };
    media.addEventListener('change', onResize);
    document.addEventListener('keydown', onKey);
    return () => { main.inert = false; document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', onKey); media.removeEventListener('change', onResize); };
  }, [open]);
  const go = (event, next) => { if (open) toggle.current.focus(); setOpen(false); navigate(event, next); };
  return <header className={`site-header ${page !== 'home' && !open ? 'header-light' : ''} ${open ? 'menu-is-open' : ''}`}>
    <div className="nav-inner flex items-center justify-between">
      <div className="flex items-center nav-left">
        <a className="brand flex items-center" href="#home" aria-label="Ariadne · 衡" onClick={event => go(event, 'home')}><Brand /></a>
        <nav className="desktop-nav hidden md:flex items-center" aria-label={language === 'zh' ? '主导航' : 'Main navigation'}>
          {Object.entries(copy.nav).map(([id, label]) => <a key={id} href={`#${id}`} onClick={event => go(event, id)} aria-current={page === id ? 'page' : undefined}>{label}</a>)}
        </nav>
      </div>
      <div className="nav-settings flex items-center">
        <div className="language-switch" role="group" aria-label="Language / 语言"><span aria-hidden="true">[</span><button lang="zh-CN" aria-pressed={language === 'zh'} onClick={() => setLanguage('zh')}>中</button><span aria-hidden="true">/</span><button lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button><span aria-hidden="true">]</span></div>
        <button ref={toggle} className="menu-toggle md:hidden" onClick={() => setOpen(value => !value)} aria-label={open ? copy.closeMenu : copy.openMenu} aria-expanded={open} aria-controls="mobile-navigation">
          <span className={`menu-symbol ${open ? 'symbol-out' : ''}`}><Menu size={22} aria-hidden="true" /></span><span className={`menu-symbol ${open ? '' : 'symbol-in'}`}><X size={22} aria-hidden="true" /></span>
        </button>
      </div>
    </div>
    <nav ref={menu} id="mobile-navigation" className={`mobile-menu ${open ? 'is-open' : ''}`} aria-label={language === 'zh' ? '移动导航' : 'Mobile navigation'} inert={!open}>
      <div className="mobile-menu-content">{Object.entries(copy.nav).map(([id, label]) => <a key={id} href={`#${id}`} onClick={event => go(event, id)} aria-current={page === id ? 'page' : undefined}>{label}</a>)}</div>
    </nav>
  </header>;
}
function Hero({ copy, language, navigate }) {
  const video = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { if (preference.matches) video.current.pause(); else video.current.play().catch(() => setPlaying(false)); };
    sync(); preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  return <section className="hero relative w-full overflow-hidden" aria-labelledby="page-title">
    <div className="scene-frame"><video ref={video} className="hero-video" src={VIDEO} autoPlay={!matchMedia('(prefers-reduced-motion: reduce)').matches} muted loop playsInline preload="auto" aria-hidden="true" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false); }} /></div>
    <div className="hero-content relative z-10 flex flex-col justify-between">
      <h1 id="page-title" tabIndex={-1} aria-label={copy.slogan.join(language === 'en' ? ' ' : '')} className={language === 'en' ? 'slogan-en' : ''}>{copy.slogan.map(line => <span key={line}>{line}</span>)}</h1>
      <div className="hero-bottom flex justify-between items-end"><div><p className="hero-description">{copy.description}</p><Action href="#about" onClick={event => navigate(event, 'about')}>{copy.more}</Action></div>
        {!failed && <button className="video-control" aria-label={playing ? copy.pause : copy.play} onClick={() => { if (playing) video.current.pause(); else video.current.play().catch(() => setPlaying(false)); }}>{playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}</button>}
      </div>
    </div>
  </section>;
}
function Footer({ copy }) {
  return <footer className="page-footer"><span>{copy.footer}</span><span>© {new Date().getFullYear()} Ariadne</span></footer>;
}
function About({ copy }) {
  return <section className="interior-page about-page" aria-labelledby="page-title"><div className="vi-container">
    <div className="vi-grid about-intro"><h1 id="page-title" tabIndex={-1} className="vi-span-6">{copy.aboutTitle.map(line => <span key={line}>{line}</span>)}</h1><p className="intro-copy vi-span-6">{copy.aboutIntro}</p></div>
    <div className="features">{copy.features.map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}</div>
    <div className="open-source"><div><h2>{copy.openSource}</h2><p>{copy.openSourceCopy}</p></div><a href={GITHUB_URL} className="text-link">{copy.github}<ArrowUpRight size={16} aria-hidden="true" /></a></div>
    <Footer copy={copy} />
  </div></section>;
}
function Experience({ copy }) {
  return <section className="interior-page experience-page" aria-labelledby="page-title"><div className="vi-container">
    <div className="experience-heading"><h1 id="page-title" tabIndex={-1}>{copy.experienceTitle.map(line => <span key={line}>{line}</span>)}</h1><p>{copy.experienceIntro}</p></div>
    <div className="experience-options"><article><Globe className="experience-icon" size={32} strokeWidth={1.3} aria-hidden="true" /><h2>{copy.webName}</h2><p>{copy.webCopy}</p><Action href={WEB_URL} external>{copy.webAction}</Action></article><article><Monitor className="experience-icon" size={32} strokeWidth={1.3} aria-hidden="true" /><h2>{copy.desktopName}</h2><p>{copy.desktopCopy}</p><Action href={DOWNLOAD_URL} download>{copy.downloadAction}</Action><small>{copy.downloadNote}</small></article></div>
    <Footer copy={copy} />
  </div></section>;
}
function App() {
  const [language, setLanguage] = useState(readLanguage);
  const [requested, setRequested] = useState(pageFromHash);
  const [page, setPage] = useState(pageFromHash);
  const [phase, setPhase] = useState('enter');
  const main = useRef(null);
  const copy = COPY[language];
  useEffect(() => {
    const sync = () => setRequested(pageFromHash());
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = copy.title;
    document.querySelector('meta[name="description"]').content = copy.aboutIntro;
    try { localStorage.setItem('ariadne-website-language', language); } catch { /* Preference is optional. */ }
  }, [language, copy]);
  useEffect(() => {
    if (requested === page) { setPhase('enter'); return; }
    setPhase('exit');
    const timer = setTimeout(() => {
      setPage(requested); setPhase('enter');
      main.current.scrollTop = 0;
      requestAnimationFrame(() => document.querySelector('#page-title')?.focus({ preventScroll: true }));
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320);
    return () => clearTimeout(timer);
  }, [requested, page]);
  const navigate = (event, next) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return;
    event.preventDefault();
    if (location.hash !== `#${next}`) history.pushState(null, '', `#${next}`);
    setRequested(next);
  };
  return <div className={`site-root font-geist ${page === 'home' ? 'home-root' : 'interior-root'}`}><a className="skip-link" href="#page-title" onClick={event => { event.preventDefault(); document.querySelector('#page-title')?.focus(); }}>{copy.skip}</a><Header page={page} copy={copy} language={language} setLanguage={setLanguage} navigate={navigate} /><main ref={main} className={`page-stage ${phase}`} data-page={page} aria-busy={phase === 'exit'}>{page === 'home' ? <Hero copy={copy} language={language} navigate={navigate} /> : page === 'about' ? <About copy={copy} /> : <Experience copy={copy} />}</main></div>;
}
createRoot(document.getElementById('root')).render(<App />);
