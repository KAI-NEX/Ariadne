import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, ArrowUpRight, Menu, X, Pause, Play, ArrowDown } from 'lucide-react';
import '../../public/vi/tokens.css';
import '../../public/vi/layout.css';
import './styles.css';

const VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_204221_5339e40b-e73d-4ab0-9c65-79c18c66fd50.mp4';
const NAV = [{ id: 'home', label: '首页' }, { id: 'about', label: '介绍' }, { id: 'web', label: '网页版' }, { id: 'download', label: '下载' }];

function Brand() {
  return <><span className="wordmark">Ariadne</span><span className="brand-divider" aria-hidden="true" /><span className="brand-zh">衡</span></>;
}

function Action({ href, children, secondary = false, external = false, ...props }) {
  return <a className={`site-button ${secondary ? 'site-button-secondary' : ''}`} href={href} {...props}>
    {children}{external ? <ArrowUpRight size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
  </a>;
}

function Header({ active }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef(null);
  const menu = useRef(null);
  useEffect(() => {
    if (!open) return;
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
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', onKey); media.removeEventListener('change', onResize); };
  }, [open]);
  useEffect(() => {
    document.querySelector('main').inert = open;
    document.querySelector('footer').inert = open;
    return () => { document.querySelector('main').inert = false; document.querySelector('footer').inert = false; };
  }, [open]);
  const close = () => { setOpen(false); toggle.current.focus(); };
  return <header className={`site-header ${active === 'about' && !open ? 'header-light' : ''} ${active !== 'home' && active !== 'about' ? 'header-solid' : ''} ${open ? 'menu-is-open' : ''}`}>
    <div className="nav-inner flex items-center justify-between">
      <div className="flex items-center nav-left">
        <a className="brand flex items-center" href="#home" aria-label="Ariadne · 衡 首页" onClick={() => setOpen(false)}><Brand /></a>
        <nav className="desktop-nav hidden md:flex items-center" aria-label="主导航">
          {NAV.map(item => <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? 'location' : undefined}>{item.label}</a>)}
        </nav>
      </div>
      <a className="nav-cta site-button hidden md:inline-flex" href="#web">开始探索<ArrowUpRight size={16} aria-hidden="true" /></a>
      <button ref={toggle} className="menu-toggle md:hidden" onClick={() => setOpen(value => !value)} aria-label={open ? '关闭菜单' : '打开菜单'} aria-expanded={open} aria-controls="mobile-navigation">
        <span className={`menu-symbol ${open ? 'symbol-out' : ''}`}><Menu size={22} aria-hidden="true" /></span>
        <span className={`menu-symbol ${open ? '' : 'symbol-in'}`}><X size={22} aria-hidden="true" /></span>
      </button>
    </div>
    <nav ref={menu} id="mobile-navigation" className={`mobile-menu ${open ? 'is-open' : ''}`} aria-label="移动导航" inert={!open}>
      <div className="mobile-menu-content">
        {NAV.map((item, index) => <a key={item.id} href={`#${item.id}`} onClick={close} aria-current={active === item.id ? 'location' : undefined}><span>{item.label}</span><small aria-hidden="true">0{index + 1}</small></a>)}
        <Action href="#web" onClick={close}>开始探索</Action>
      </div>
    </nav>
  </header>;
}

function Hero() {
  const video = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { if (preference.matches) video.current.pause(); else video.current.play().catch(() => setPlaying(false)); };
    sync();
    preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  return <section id="home" className="hero relative w-full overflow-hidden" aria-labelledby="hero-title">
    <video ref={video} className="hero-video absolute h-full w-full object-cover" src={VIDEO} autoPlay={!matchMedia('(prefers-reduced-motion: reduce)').matches} muted loop playsInline preload="auto" aria-hidden="true" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false); }} />
    <div className="hero-content relative z-10 flex flex-col justify-between">
      <div className="hero-top">
        <p className="hero-label reveal reveal-1">每一步，都更接近你的方向</p>
        <h1 id="hero-title" className="reveal reveal-2"><span>看清自己，</span><span>走向想去的</span><span>地方。</span></h1>
      </div>
      <div className="hero-bottom flex justify-between items-end">
        <div>
          <p className="hero-description reveal reveal-3">从你的经历，到心中的职位。<br />让 AI 帮你理清线索，把下一步走得更清楚。</p>
          <div className="reveal reveal-4"><Action href="#about">认识 Ariadne</Action></div>
        </div>
        <div className="hero-utilities flex items-center">
          {!failed && <button className="video-control" aria-label={playing ? '暂停背景视频' : '播放背景视频'} onClick={() => { if (playing) video.current.pause(); else video.current.play().catch(() => setPlaying(false)); }}>{playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}</button>}
          <a className="scroll-link" href="#about" aria-label="向下了解 Ariadne"><ArrowDown size={18} aria-hidden="true" /></a>
        </div>
      </div>
    </div>
  </section>;
}

const steps = [
  ['理解你的经历', '从简历、作品和项目材料中，理清你做过什么、如何做，以及有哪些证据。'],
  ['读懂目标职位', '独立理解职位的职责与要求，把明确的信息和需要澄清的部分分开。'],
  ['找到下一步', '结合两边的线索，讨论值得补充的证据与表达，让每次调整都有依据。'],
];

function About() {
  return <section id="about" className="about-section section-pad" aria-labelledby="about-title">
    <div className="vi-container">
      <div className="vi-grid about-intro">
        <p className="section-label vi-span-4">介绍 / ABOUT ARIADNE</p>
        <div className="vi-span-8"><h2 id="about-title">方向，由你决定。<br /><span className="soft-ink">线索，一起理清。</span></h2><p className="section-copy">Ariadne · 衡，是一个帮助你探索职业方向的 AI 工具。先理解你的资料，再理解你选择的职位，在两者之间建立有依据的联系。</p></div>
      </div>
      <div className="steps-grid">
        {steps.map(([title, copy], index) => <article key={title} className="step"><span className="step-number">0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}
      </div>
      <p className="about-note">保留每份材料的来源。区分事实、推断与未知。修改建议由你审阅，确认后再保存。</p>
    </div>
  </section>;
}

function WebSection() {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  return <section id="web" className="web-section section-pad" aria-labelledby="web-title">
    <div className="vi-container vi-grid">
      <p className="section-label vi-span-4">网页版 / ARIADNE WEB</p>
      <div className="vi-span-8"><h2 id="web-title">打开浏览器，<br />从一份资料开始。</h2><p className="section-copy">把经历与职位放进自己的工作区，慢慢整理，继续讨论。资料保存在当前浏览器；使用 AI 分析前，由你确认发送的材料。</p>
        <div className="release-info"><span className="release-label">网页版正在准备中</span><p>正式开放后，你可以从这里直接进入。</p></div>
        {local ? <Action href="http://127.0.0.1:8000/" external>打开本机工作区</Action> : <Action href="#about" secondary>了解 Ariadne 如何工作</Action>}
      </div>
    </div>
  </section>;
}

function Download() {
  return <section id="download" className="download-section section-pad" aria-labelledby="download-title">
    <div className="vi-container vi-grid"><p className="section-label vi-span-4">下载 / DOWNLOAD</p><div className="vi-span-8"><h2 id="download-title">留在你的电脑里，<br />陪你继续往前。</h2><p className="section-copy">Ariadne 正在探索更便捷的桌面使用方式。可独立安装的公开版本尚未发布，准备好后会在这里提供下载。</p><p className="download-status">桌面版 · 敬请期待</p><Action href="#web" secondary>了解网页版</Action></div></div>
  </section>;
}

function App() {
  const [active, setActive] = useState('home');
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
    }, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
    document.querySelectorAll('main > section').forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  return <div className="site-root font-geist"><a className="skip-link" href="#about">跳到介绍</a><Header active={active} /><main><Hero /><About /><WebSection /><Download /></main><footer><div className="vi-container flex items-center justify-between"><a href="#home" className="brand flex items-center" aria-label="回到首页"><Brand /></a><p>你的方向，你的步调。</p><span>© {new Date().getFullYear()} Ariadne</span></div></footer></div>;
}

createRoot(document.getElementById('root')).render(<App />);
