import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';

const API = '/api';
const imageSet = [
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=85',
  'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1400&q=85',
  'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1400&q=85',
];
const navigation = [
  { title: 'Workspace', items: [['overview', 'Overview', '▦'], ['wedding', 'Wedding details', '♡'], ['guests', 'Guest list', '♧']] },
  { title: 'Your celebration', items: [['templates', 'Design studio', '✳'], ['gallery', 'Photo & media', '▧'], ['sharing', 'Sharing & QR code', '⌗']] },
];
const sampleCeremonies = [
  { name: 'ពិធីសូត្រមន្ត', date: '', time: '', description: '', location: '' },
  { name: 'ពិធីហែជំនូន', date: '', time: '', description: '', location: '' },
  { name: 'ពិធីសំពះផ្ទឹម និងចងដៃ', date: '', time: '', description: '', location: '' },
  { name: 'ពិធីទទួលភ្ញៀវ', date: '', time: '', description: '', location: '' },
];
const blankWedding = { title: 'Our Wedding', bride: '', groom: '', wedding_date: '', venue: '', address: '', maps_url: '', story: '', template: 'The Botanica', primary_color: '#9a7359', payment_qr_media_id: '', welcome_video_media_id: '', music_media_id: '', ceremony_schedule: [], love_timeline: [], parking_info: '', contact_phone: '', contact_telegram: '', gift_payment_info: '' };

async function api(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'EA';
const prettyDate = (date) => date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Choose your date';
const formatNumber = (number) => Number(number || 0).toLocaleString();

function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ever-after-session') || 'null'); } catch { return null; }
  });
  const { pathname } = useLocation();
  const invite = pathname.startsWith('/invite/');
  const token = session?.token;
  const onLogout = () => { localStorage.removeItem('ever-after-session'); setSession(null); };

  if (invite) return <PublicInvitation />;
  if (!token) return <AuthScreen onSuccess={(value) => { localStorage.setItem('ever-after-session', JSON.stringify(value)); setSession(value); }} />;
  return <Studio session={session} onLogout={onLogout} />;
}

function AuthScreen({ onSuccess }) {
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const data = await api(`/auth/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', body: JSON.stringify(form) });
      onSuccess(data);
      navigate('/');
    } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  return (
    <main className="auth-layout">
      <section className="auth-visual">
        <div className="auth-visual-top"><Brand light /></div>
        <div className="auth-photo" />
        <div className="auth-quote"><span className="eyebrow">A LOVE WORTH CELEBRATING</span><h1>Every great love<br />deserves a beautiful beginning.</h1><p>Your day, your story, your forever — thoughtfully brought together.</p><div className="photo-credit"><span>✦ &nbsp; MADE FOR YOUR MOMENT</span><span>01 / 03</span></div></div>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-mobile-brand"><Brand /></div>
        <div className="auth-form-inner">
          <span className="eyebrow">YOUR LITTLE CORNER OF THE WORLD</span>
          <h2>{mode === 'login' ? 'Welcome back' : 'Let’s make it official'}</h2>
          <p className="muted">{mode === 'login' ? 'Sign in to keep planning your day.' : 'Create an account and start telling your story.'}</p>
          <form onSubmit={submit} className="auth-form">
            {mode === 'register' && <label>Your name<input required minLength="2" autoComplete="name" placeholder="Alex Morgan" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>}
            <label>Email address<input required type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Password<input required minLength={mode === 'register' ? 10 : 1} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'register' ? 'At least 10 characters' : 'Enter your password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-dark button-wide" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in to your studio' : 'Create your account'} <span>→</span></button>
          </form>
          <p className="auth-switch">{mode === 'login' ? 'New around here?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
          <p className="auth-footnote">By continuing, you agree to our terms of service and privacy policy.</p>
        </div>
        <div className="auth-lower">MADE WITH CARE, FOR YOUR FOREVER <span>© EVER AFTER 2026</span></div>
      </section>
    </main>
  );
}

function Brand({ light = false }) {
  return <Link to="/" className={`brand ${light ? 'brand-light' : ''}`}><span className="brand-mark">e<span>✳</span></span><span className="brand-word">ever after<small>WEDDING STUDIO</small></span></Link>;
}

function Studio({ session, onLogout }) {
  const token = session.token;
  const [weddings, setWeddings] = useState([]);
  const [wedding, setWedding] = useState(null);
  const [guests, setGuests] = useState([]);
  const [active, setActive] = useState('overview');
  const [users, setUsers] = useState([]);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const showToast = (message) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };
  useEffect(() => {
    if (wedding?.slug) localStorage.setItem('ever-after-last-wedding-slug', wedding.slug);
  }, [wedding?.slug]);

  const loadWeddings = useCallback(async () => {
    const data = await api('/weddings', { token });
    setWeddings(data.weddings);
    if (data.weddings.length) setWedding((current) => data.weddings.find((row) => row.id === current?.id) || data.weddings[0]);
    else setWedding(null);
  }, [token]);
  const loadGuests = useCallback(async (id) => {
    if (!id) return setGuests([]);
    try { const data = await api(`/weddings/${id}/guests`, { token }); setGuests(data.guests); } catch (cause) { setError(cause.message); }
  }, [token]);
  useEffect(() => {
    let live = true;
    Promise.all([api('/weddings', { token }), session.user.role === 'admin' ? api('/admin/users', { token }) : Promise.resolve({ users: [] })])
      .then(([data, adminData]) => { if (!live) return; setWeddings(data.weddings); setWedding(data.weddings[0] || null); setUsers(adminData.users); })
      .catch((cause) => { if (live) { setError(cause.message); if (cause.message.includes('session')) onLogout(); } })
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [token, session.user.role]);
  useEffect(() => { if (wedding?.id) loadGuests(wedding.id); else setGuests([]); }, [wedding?.id, loadGuests]);

  const guestStats = useMemo(() => ({
    total: guests.length,
    attending: guests.filter((guest) => guest.rsvp === 'Attending').reduce((sum, guest) => sum + guest.attendees, 0),
    pending: guests.filter((guest) => guest.rsvp === 'Pending').length,
    declined: guests.filter((guest) => guest.rsvp === 'Declined').length,
  }), [guests]);

  async function createWedding() {
    setSaving(true); setError('');
    try {
      const { wedding: created } = await api('/weddings', { token, method: 'POST', body: JSON.stringify({ title: 'Our Wedding' }) });
      setWedding(created); setWeddings((items) => [created, ...items]); setActive('wedding'); showToast('Your new wedding space is ready.');
    } catch (cause) { setError(cause.message); } finally { setSaving(false); }
  }
  async function saveWedding(fields, notice = 'Your changes are saved.') {
    if (!wedding) return;
    setSaving(true); setError('');
    try {
      const { wedding: updated } = await api(`/weddings/${wedding.id}`, { token, method: 'PUT', body: JSON.stringify(fields) });
      setWedding(updated); setWeddings((items) => items.map((item) => item.id === updated.id ? updated : item)); showToast(notice);
      return updated;
    } catch (cause) { setError(cause.message); } finally { setSaving(false); }
  }
  async function changePage(page) { setActive(page); setMobileMenu(false); if (page === 'admin') { try { setUsers((await api('/admin/users', { token })).users); } catch (cause) { setError(cause.message); } } }
  async function refreshGuests() { await loadGuests(wedding?.id); }
  function previewWedding() {
    if (!wedding) return;
    window.open(`${window.location.origin}/invite/${encodeURIComponent(wedding.slug)}?preview=1`, '_blank', 'noopener,noreferrer');
  }

  if (loading) return <div className="loading-screen"><Brand /><div className="loading-pulse" />Gathering all the good things…</div>;

  return (
    <div className="studio-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand"><Brand /></div>
        <button className="wedding-switcher" onClick={() => changePage('overview')}><span className="switcher-thumb">♡</span><span className="switcher-copy"><small>YOUR WEDDING</small><strong>{wedding?.title || 'Your workspace'}</strong></span><span className="switcher-chevron">⌄</span></button>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map((group) => <div className="nav-group" key={group.title}><span className="nav-label">{group.title}</span>{group.items.map(([key, label, icon]) => <button className={`nav-item ${active === key ? 'nav-active' : ''}`} key={key} onClick={() => changePage(key)}><span className="nav-icon">{icon}</span>{label}{key === 'guests' && guests.length > 0 && <span className="nav-count">{guests.length}</span>}</button>)}</div>)}
          {session.user.role === 'admin' && <div className="nav-group"><span className="nav-label">Platform</span><button className={`nav-item ${active === 'admin' ? 'nav-active' : ''}`} onClick={() => changePage('admin')}><span className="nav-icon">⚙</span>Admin studio</button></div>}
        </nav>
        <div className="sidebar-bottom"><div className="upgrade-card"><span className="upgrade-star">✦</span><strong>Your day, beautifully told.</strong><span>Every little detail has a place.</span><button onClick={() => changePage('templates')}>Explore designs <span>→</span></button></div><button className="user-profile" onClick={onLogout}><span className="avatar">{initials(session.user.name)}</span><span className="profile-copy"><strong>{session.user.name}</strong><small>{session.user.role === 'admin' ? 'Studio administrator' : 'Wedding creator'}</small></span><span className="logout-icon" title="Sign out">↗</span></button></div>
      </aside>
      <main className="studio-main">
        <header className="topbar">
          <button className="mobile-menu-button" onClick={() => setMobileMenu((open) => !open)} aria-label="Toggle navigation">☰</button>
          <div className="breadcrumb">Studio <span>/</span> <strong>{pageTitle(active)}</strong></div>
          <div className="topbar-actions"><div className="search-box"><span>⌕</span><input aria-label="Search guests" placeholder="Search anything..." value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></div><button className="icon-button" aria-label="Notifications" onClick={() => showToast('You’re all caught up.')}>♧<i /></button><div className="top-avatar">{initials(session.user.name)}</div></div>
        </header>
        <div className="page-content">
          {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
          {!wedding && active !== 'admin' ? <EmptyWorkspace busy={saving} onCreate={createWedding} /> : (
            <>
              {active === 'overview' && <Overview wedding={wedding} guests={guests} stats={guestStats} onNavigate={changePage} onPreview={previewWedding} onPublish={() => saveWedding({ published: !wedding.published }, wedding.published ? 'Your invitation is now private.' : 'Your invitation is live!')} onCreate={createWedding} busy={saving} />}
              {active === 'wedding' && <WeddingEditor wedding={wedding} onSave={saveWedding} busy={saving} />}
              {active === 'guests' && <GuestManager wedding={wedding} guests={guests} token={token} query={query} onRefresh={refreshGuests} onToast={showToast} />}
              {active === 'templates' && <TemplateStudio wedding={wedding} onApply={(name, color) => saveWedding({ template: name, primary_color: color }, `${name} is now your invitation design.`)} />}
              {active === 'gallery' && <MediaStudio wedding={wedding} token={token} onChange={loadWeddings} onSave={saveWedding} onToast={showToast} />}
              {active === 'sharing' && <SharingStudio wedding={wedding} onPublish={() => saveWedding({ published: !wedding.published })} onToast={showToast} />}
              {active === 'admin' && session.user.role === 'admin' && <AdminStudio users={users} token={token} onRefresh={async () => setUsers((await api('/admin/users', { token })).users)} />}
            </>
          )}
        </div>
      </main>
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
      {mobileMenu && <button className="menu-backdrop" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
      <div className="main-sidebar-backdrop" onClick={() => setMobileMenu(false)} />
    </div>
  );
}

function pageTitle(page) {
  return ({ overview: 'Overview', wedding: 'Wedding details', guests: 'Guest list', templates: 'Design studio', gallery: 'Photo & media', sharing: 'Sharing & QR code', admin: 'Admin studio' })[page] || 'Overview';
}

function PageHeading({ eyebrow, title, description, actions }) {
  return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}

function Overview({ wedding, guests, stats, onNavigate, onPreview, onPublish, onCreate, busy }) {
  const weddingDay = wedding.wedding_date ? new Date(`${wedding.wedding_date}T12:00:00`) : null;
  const daysLeft = weddingDay ? Math.ceil((weddingDay - new Date()) / 86400000) : null;
  const rsvpCount = guests.filter((guest) => guest.rsvp !== 'Pending').length;
  const progress = Math.min(100, wedding ? [wedding.bride, wedding.groom, wedding.wedding_date, wedding.venue, wedding.story].filter(Boolean).length * 20 : 0);
  return (
    <>
      <PageHeading eyebrow={new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()} title={`Good things are taking shape, ${wedding?.bride || 'there'}.`} description="A little glimpse into how your celebration is coming together." actions={<><button className="button button-outline" onClick={onPreview}>◉ &nbsp; Preview</button><button className={`button ${wedding?.published ? 'button-live' : 'button-dark'}`} disabled={busy} onClick={onPublish}><span className="status-dot" />{wedding?.published ? 'Published' : 'Publish website'}</button></>} />
      <section className="overview-hero">
        <div className="overview-copy"><span className="eyebrow">YOUR NEXT CHAPTER</span><h2>{wedding?.bride || 'You'} <i>&</i> {wedding?.groom || 'Your love'}</h2><p>{wedding?.wedding_date ? prettyDate(wedding.wedding_date) : 'Your date is waiting to be set'}{wedding?.venue ? `  ·  ${wedding.venue}` : ''}</p><div className="hero-countdown"><span className="countdown-number">{daysLeft === null ? '—' : Math.max(daysLeft, 0)}</span><span>days until your<br />happily ever after</span></div><button className="hero-edit-link" onClick={() => onNavigate('wedding')}>Make it yours <span>→</span></button></div>
        <div className="overview-photo" role="img" aria-label="Wedding flowers and a warm celebration"><span>THE BEGINNING OF FOREVER</span><div className="photo-roundel">♡</div></div>
      </section>
      <section className="stats-grid">
        <StatCard icon="♧" label="On your guest list" value={formatNumber(stats.total)} detail="lovely people" tone="rose" />
        <StatCard icon="♡" label="Can’t wait to celebrate" value={formatNumber(stats.attending)} detail={stats.total ? `${Math.round(stats.attending / Math.max(stats.total, 1) * 100)}% of your guest list` : 'RSVPs will appear here'} tone="sage" />
        <StatCard icon="◷" label="Still deciding" value={formatNumber(stats.pending)} detail={rsvpCount ? `${rsvpCount} responses received` : 'Whenever they’re ready'} tone="sand" />
        <StatCard icon="✦" label="Your invitation" value={wedding?.published ? 'Live' : 'A work in progress'} detail={wedding?.published ? 'Ready to share with the world' : 'A few finishing touches'} tone="lilac" />
      </section>
      <section className="dashboard-columns">
        <div className="panel guest-progress-panel"><div className="panel-heading"><div><span className="eyebrow">LET THE GOOD PEOPLE IN</span><h3>Your guest list</h3></div><button className="text-link" onClick={() => onNavigate('guests')}>View guest list <span>→</span></button></div>
          {guests.length ? <><div className="progress-info"><span>{rsvpCount} of {stats.total} have responded</span><strong>{Math.round(rsvpCount / Math.max(stats.total, 1) * 100)}%</strong></div><div className="progress-track"><div style={{ width: `${Math.round(rsvpCount / Math.max(stats.total, 1) * 100)}%` }} /></div><div className="mini-guest-list">{guests.slice(0, 4).map((guest, i) => <div className="mini-guest" key={guest.id}><span className={`mini-avatar avatar-tone-${i % 4}`}>{initials(guest.name)}</span><span className="mini-guest-name">{guest.name}</span><span className={`rsvp-pill ${guest.rsvp.toLowerCase()}`}>{guest.rsvp}</span></div>)}</div></> : <div className="gentle-empty"><span className="empty-icon">♡</span><strong>Your favorite people, all in one place.</strong><span>Add your first guests to start keeping track.</span><button className="button button-outline" onClick={() => onNavigate('guests')}>Add someone lovely <span>→</span></button></div>}
        </div>
        <div className="panel checklist-panel"><div className="panel-heading"><div><span className="eyebrow">THE FUN PART</span><h3>Your love, in progress</h3></div><span className="completion-label">{progress}% complete</span></div><div className="checklist-line"><span className={`check-dot ${wedding?.bride && wedding?.groom ? 'done' : ''}`}>{wedding?.bride && wedding?.groom ? '✓' : '1'}</span><span><strong>Introduce the two of you</strong><small>Add your names and a little note</small></span><button onClick={() => onNavigate('wedding')}>{wedding?.bride && wedding?.groom ? 'Edit' : 'Start'} →</button></div><div className="checklist-line"><span className={`check-dot ${wedding?.wedding_date ? 'done' : ''}`}>{wedding?.wedding_date ? '✓' : '2'}</span><span><strong>Pick your perfect date</strong><small>Let everyone know when to save it</small></span><button onClick={() => onNavigate('wedding')}>{wedding?.wedding_date ? 'Edit' : 'Add'} →</button></div><div className="checklist-line"><span className={`check-dot ${wedding?.venue ? 'done' : ''}`}>{wedding?.venue ? '✓' : '3'}</span><span><strong>Show them where to meet</strong><small>Add your venue and directions</small></span><button onClick={() => onNavigate('wedding')}>{wedding?.venue ? 'Edit' : 'Add'} →</button></div><button className="checklist-tail" onClick={() => onNavigate('wedding')}>A few more lovely details <span>→</span></button></div>
      </section>
      <section className="bottom-invite-banner"><div><span className="eyebrow">SOMETHING BEAUTIFUL IS TAKING SHAPE</span><h3>It already feels like <i>you.</i></h3><p>Find a design that feels right and make every detail your own.</p></div><button className="button button-light" onClick={() => onNavigate('templates')}>Wander through the designs <span>→</span></button><span className="banner-sparkle">✳</span></section>
    </>
  );
}

function StatCard({ icon, label, value, detail, tone }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-detail">{detail}</span></article>;
}

function WeddingEditor({ wedding, onSave, busy }) {
  const [form, setForm] = useState({ ...blankWedding, ...wedding });
  useEffect(() => setForm({ ...blankWedding, ...wedding, ceremony_schedule: wedding.ceremony_schedule || [], love_timeline: wedding.love_timeline || [] }), [wedding.id]);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const updateCeremony = (index, field, value) => setForm((current) => ({
    ...current,
    ceremony_schedule: current.ceremony_schedule.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
  }));
  const updateMilestone = (index, field, value) => setForm((current) => ({
    ...current,
    love_timeline: current.love_timeline.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
  }));
  const submit = async (event) => { event.preventDefault(); await onSave({ ...form, ceremony_schedule: JSON.stringify(form.ceremony_schedule), love_timeline: JSON.stringify(form.love_timeline) }); };
  const isRoyalKhmer = ['Angkor Royal', 'Khmer Ceremonial', 'Khmer Ceremonial Gold'].includes(form.template);
  return <><PageHeading eyebrow="THE DETAILS THAT MAKE IT YOURS" title="Tell your story." description="The little things your favorite people will want to know." actions={<button className="button button-dark" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <span>→</span></button>} />
    <form className="editor-layout" onSubmit={submit}>
      <div className="panel editor-panel"><div className="editor-section-heading"><span className="editor-number">01</span><div><h3>The two of you</h3><p>Start with the names at the heart of it all.</p></div></div><div className="form-grid"><label>Partner one<input required maxLength="100" placeholder="e.g. Sophie" value={form.bride} onChange={update('bride')} /></label><label>Partner two<input required maxLength="100" placeholder="e.g. James" value={form.groom} onChange={update('groom')} /></label><label className="full-field">A title for your invitation<input maxLength="120" placeholder="Sophie & James — we’re getting married!" value={form.title} onChange={update('title')} /></label></div></div>
      <div className="panel editor-panel"><div className="editor-section-heading"><span className="editor-number">02</span><div><h3>Save the date</h3><p>We promise, this is the one they won’t forget.</p></div></div><div className="form-grid"><label>Wedding date<input type="date" value={form.wedding_date} onChange={update('wedding_date')} /></label><label>Your venue<input maxLength="200" placeholder="e.g. The Rosewood Garden" value={form.venue} onChange={update('venue')} /></label><label className="full-field">Address<textarea rows="2" maxLength="500" placeholder="Street, city, country" value={form.address} onChange={update('address')} /></label><label className="full-field">Google Maps link<input type="url" maxLength="500" placeholder="https://maps.google.com/…" value={form.maps_url} onChange={update('maps_url')} /></label></div></div>
      <div className="panel editor-panel"><div className="editor-section-heading"><span className="editor-number">03</span><div><h3>A little about your love</h3><p>Let the people you love get to know your story.</p></div></div><label>Your story<textarea rows="5" maxLength="5000" placeholder="Tell them about the little moments that brought you here…" value={form.story} onChange={update('story')} /></label><div className="character-count">{form.story.length} / 5,000 characters</div></div>
      {isRoyalKhmer && <>
        <div className="panel editor-panel royal-editor"><div className="editor-section-heading"><span className="editor-number">04</span><div><h3>កម្មវិធីពិធីមង្គលការ</h3><p>បន្ថែម និងកែសម្រួលពិធីតាមប្រពៃណី និងតាមជម្រើសរបស់អ្នក។ ពិធីទាំងអស់ជាគំរូប៉ុណ្ណោះ ហើយអាចលុបបាន។</p></div></div>
          {form.ceremony_schedule.map((item, index) => <div className="ceremony-editor-row" key={index}><div className="form-grid"><label>ឈ្មោះពិធី<input maxLength="120" value={item.name} onChange={(event) => updateCeremony(index, 'name', event.target.value)} /></label><label>កាលបរិច្ឆេទ<input type="date" value={item.date} onChange={(event) => updateCeremony(index, 'date', event.target.value)} /></label><label>ម៉ោង<input type="time" value={item.time} onChange={(event) => updateCeremony(index, 'time', event.target.value)} /></label><label>ទីតាំង<input maxLength="200" value={item.location} onChange={(event) => updateCeremony(index, 'location', event.target.value)} /></label><label className="full-field">សេចក្តីពិពណ៌នា<textarea rows="2" maxLength="500" value={item.description} onChange={(event) => updateCeremony(index, 'description', event.target.value)} /></label></div><button type="button" className="row-delete ceremony-remove" aria-label={`លុបពិធី ${item.name}`} onClick={() => setForm((current) => ({ ...current, ceremony_schedule: current.ceremony_schedule.filter((_, itemIndex) => itemIndex !== index) }))}>លុបពិធី ×</button></div>)}
          <div className="ceremony-editor-actions"><button type="button" className="button button-outline" disabled={form.ceremony_schedule.length >= 20} onClick={() => setForm((current) => ({ ...current, ceremony_schedule: [...current.ceremony_schedule, { name: '', date: '', time: '', description: '', location: '' }] }))}>＋ បន្ថែមពិធី</button>{form.ceremony_schedule.length === 0 && <button type="button" className="text-link" onClick={() => setForm((current) => ({ ...current, ceremony_schedule: sampleCeremonies.map((item) => ({ ...item })) }))}>បន្ថែមកម្មវិធីគំរូ (អាចកែ ឬលុបបាន)</button>}</div>
        </div>
        <div className="panel editor-panel royal-editor"><div className="editor-section-heading"><span className="editor-number">04b</span><div><h3>អនុស្សាវរីយ៍នៃស្នេហា</h3><p>បន្ថែមកាលបរិច្ឆេទ រឿងខ្លីៗ និងរូបថតសំខាន់ៗសម្រាប់ timeline។</p></div></div>
          {form.love_timeline.map((item, index) => <div className="ceremony-editor-row" key={index}><div className="form-grid"><label>ចំណងជើង<input maxLength="120" value={item.title} onChange={(event) => updateMilestone(index, 'title', event.target.value)} /></label><label>កាលបរិច្ឆេទ<input type="date" value={item.date} onChange={(event) => updateMilestone(index, 'date', event.target.value)} /></label><label className="full-field">រឿងរ៉ាវខ្លី<textarea rows="2" maxLength="500" value={item.description} onChange={(event) => updateMilestone(index, 'description', event.target.value)} /></label><label className="full-field">រូបថត<select value={item.photo_media_id} onChange={(event) => updateMilestone(index, 'photo_media_id', event.target.value)}><option value="">មិនជ្រើសរើសរូបថត</option>{(wedding.media || []).filter((media) => media.type === 'image').map((media) => <option key={media.id} value={media.id}>{media.name}</option>)}</select></label></div><button type="button" className="row-delete ceremony-remove" onClick={() => setForm((current) => ({ ...current, love_timeline: current.love_timeline.filter((_, itemIndex) => itemIndex !== index) }))}>លុបអនុស្សាវរីយ៍ ×</button></div>)}
          <div className="ceremony-editor-actions"><button type="button" className="button button-outline" disabled={form.love_timeline.length >= 20} onClick={() => setForm((current) => ({ ...current, love_timeline: [...current.love_timeline, { title: '', date: '', description: '', photo_media_id: '' }] }))}>＋ បន្ថែមអនុស្សាវរីយ៍</button></div>
        </div>
        <div className="panel editor-panel royal-editor"><div className="editor-section-heading"><span className="editor-number">05</span><div><h3>ទីតាំង ការទំនាក់ទំនង និងអំណោយ</h3><p>ព័ត៌មានទាំងនេះជាជម្រើស អ្នកអាចទុកចោលដើម្បីរក្សាភាពឯកជន។</p></div></div><div className="form-grid">
          <label className="full-field">ព័ត៌មានចតយានយន្ត<textarea rows="2" maxLength="500" value={form.parking_info} onChange={update('parking_info')} placeholder="ព័ត៌មានចំណត ឬការណែនាំសម្រាប់ភ្ញៀវ" /></label>
          <label>លេខទូរស័ព្ទទំនាក់ទំនង<input type="tel" maxLength="40" value={form.contact_phone} onChange={update('contact_phone')} placeholder="ជាជម្រើស" /></label>
          <label>Telegram link<input type="url" maxLength="500" value={form.contact_telegram} onChange={update('contact_telegram')} placeholder="https://t.me/…" /></label>
          <label className="full-field">ព័ត៌មានអំណោយ / ការទូទាត់<textarea rows="3" maxLength="5000" value={form.gift_payment_info} onChange={update('gift_payment_info')} placeholder="បញ្ចូលតែព័ត៌មានដែលអ្នកចង់បង្ហាញជាសាធារណៈ" /></label>
        </div></div>
        <div className="panel editor-panel royal-editor"><div className="editor-section-heading"><span className="editor-number">06</span><div><h3>ពណ៌តាមចំណូលចិត្ត</h3><p>កែពណ៌មាសសំខាន់របស់គេហទំព័រមង្គលការ។</p></div></div><label>ពណ៌មាស<input className="royal-color-input" type="color" value={form.primary_color} onChange={update('primary_color')} /></label></div>
      </>}
      <div className="editor-preview-card"><span className="eyebrow">A LITTLE PREVIEW</span><h3>{form.bride || 'Your name'} <i>&</i> {form.groom || 'their name'}</h3><p>{prettyDate(form.wedding_date)}</p><div className="preview-divider">❧</div><span>{form.venue || 'Your venue will appear here'}</span></div>
    </form>
  </>;
}

function GuestManager({ wedding, guests, token, query, onRefresh, onToast }) {
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', category: 'Friends', party_size: 1 });
  const fileRef = useRef(null);
  const filtered = guests.filter((guest) => [guest.name, guest.email, guest.category, guest.rsvp].some((value) => value?.toLowerCase().includes(query.toLowerCase())));
  async function addGuest(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api(`/weddings/${wedding.id}/guests`, { token, method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', email: '', phone: '', category: 'Friends', party_size: 1 }); setShowForm(false); await onRefresh(); onToast('Another lovely person is on the list.');
    } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  async function updateGuest(guest, fields) {
    try { await api(`/weddings/${wedding.id}/guests/${guest.id}`, { token, method: 'PUT', body: JSON.stringify(fields) }); await onRefresh(); onToast(fields.checked_in ? 'Guest checked in.' : 'Guest details updated.'); } catch (cause) { setError(cause.message); }
  }
  async function removeGuest(guest) {
    if (!window.confirm(`Remove ${guest.name} from your guest list?`)) return;
    try { await api(`/weddings/${wedding.id}/guests/${guest.id}`, { token, method: 'DELETE' }); await onRefresh(); onToast(`${guest.name} was removed from your list.`); } catch (cause) { setError(cause.message); }
  }
  async function copyGuestInvite(guest) {
    if (!wedding.published) { onToast('Publish your invitation before sharing guest RSVP links.'); return; }
    const inviteUrl = `${window.location.origin}/invite/${wedding.slug}?guest=${guest.invitation_token}`;
    try { await navigator.clipboard.writeText(inviteUrl); onToast(`A personal RSVP link for ${guest.name} is ready to share.`); }
    catch { window.prompt(`Copy a personal RSVP link for ${guest.name}:`, inviteUrl); }
  }
  async function importCsv(file) {
    if (!file) return;
    try {
      const content = await file.text();
      const lines = content.split(/\r?\n/).filter(Boolean);
      const parseLine = (line) => [...line.matchAll(/(?:^|,)(?:"((?:[^"]|"")*)"|([^,]*))/g)].map((match) => (match[1] ?? match[2] ?? '').replaceAll('""', '"').trim());
      const headers = parseLine(lines[0] || '').map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
      const rows = lines.slice(1).map(parseLine).map((values) => Object.fromEntries(headers.map((key, i) => [key, values[i] || '']))).filter((item) => item.name);
      if (!rows.length) throw new Error('We couldn’t find any guest names in that CSV. Add a “name” column and try again.');
      const guestsToImport = rows.map((item) => ({ name: item.name, email: item.email || '', phone: item.phone || '', category: item.category || 'Friends', party_size: Number(item.party_size || 1) }));
      const result = await api(`/weddings/${wedding.id}/guests/import`, { token, method: 'POST', body: JSON.stringify({ guests: guestsToImport }) });
      await onRefresh(); onToast(`${result.imported} guests imported successfully.`);
    } catch (cause) { setError(cause.message); } finally { if (fileRef.current) fileRef.current.value = ''; }
  }
  const attending = guests.reduce((sum, guest) => sum + (guest.rsvp === 'Attending' ? guest.attendees : 0), 0);
  return <><PageHeading eyebrow="THE PEOPLE WHO MAKE YOUR WORLD" title="Your guest list." description="A little home for everyone you can’t wait to celebrate with." actions={<><button className="button button-outline" onClick={() => fileRef.current?.click()}>↑ &nbsp; Import CSV</button><input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={(event) => importCsv(event.target.files?.[0])} /><a className="button button-outline" href={`/api/weddings/${wedding.id}/guests.csv?download=1`} onClick={async (event) => { event.preventDefault(); try { const response = await fetch(`/api/weddings/${wedding.id}/guests.csv`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error('Your guest list could not be exported.'); const blob = await response.blob(); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `wedding-${wedding.id}-guests.csv`; link.click(); URL.revokeObjectURL(link.href); } catch (cause) { setError(cause.message); } }}>↓ &nbsp; Export</a><button className="button button-dark" onClick={() => setShowForm(!showForm)}>＋ &nbsp; Add a guest</button></>} />
    <div className="guest-summary"><div><span className="eyebrow">ON YOUR LIST</span><strong>{guests.length}</strong><span>invited guests</span></div><div><span className="eyebrow">SAYING YES</span><strong>{attending}</strong><span>confirmed so far</span></div><div><span className="eyebrow">A LITTLE MAYBE</span><strong>{guests.filter((guest) => guest.rsvp === 'Pending' || guest.rsvp === 'Maybe').length}</strong><span>responses to come</span></div><div><span className="eyebrow">HERE THEY ARE</span><strong>{guests.filter((guest) => guest.checked_in).length}</strong><span>checked in today</span></div></div>
    {error && <div className="error-banner" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}
    {showForm && <form className="panel guest-add-form" onSubmit={addGuest}><div className="guest-form-heading"><div><span className="eyebrow">SOMEONE SPECIAL</span><h3>Add a guest</h3></div><button type="button" className="icon-button" onClick={() => setShowForm(false)}>×</button></div><div className="form-grid"><label>Full name<input required minLength="2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Their lovely name" /></label><label>Email address<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Optional" /></label><label>Phone number<input type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Optional" /></label><label>Guest group<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>Friends</option><option>Family</option><option>VIP</option><option>Colleagues</option></select></label><label>Invited guests<input type="number" min="1" max="20" value={form.party_size} onChange={(event) => setForm({ ...form, party_size: Number(event.target.value) })} /></label></div>{error && <p className="form-error">{error}</p>}<button className="button button-dark" disabled={busy}>{busy ? 'Adding…' : 'Add to your guest list'} →</button></form>}
    <div className="panel guest-table-panel"><div className="guest-table-heading"><div><h3>Your people</h3><span>{filtered.length} {filtered.length === 1 ? 'person' : 'people'}<span> &nbsp;·&nbsp; Just the way you like them</span></span></div><select aria-label="Filter guests" onChange={(event) => { const value = event.target.value; document.querySelectorAll('[data-guest-status]').forEach((row) => { row.hidden = value !== 'All guests' && row.dataset.guestStatus !== value; }); }}><option>All guests</option><option>Pending</option><option>Attending</option><option>Declined</option></select></div>
      {filtered.length ? <div className="table-scroll"><table className="guest-table"><thead><tr><th>GUEST</th><th>GROUP</th><th>INVITED</th><th>RSVP</th><th>CHECK-IN</th><th></th></tr></thead><tbody>{filtered.map((guest, i) => <tr data-guest-status={guest.rsvp} key={guest.id}><td><span className={`table-guest-avatar avatar-tone-${i % 4}`}>{initials(guest.name)}</span><span className="table-guest-name">{guest.name}<small>{guest.rsvp_phone || guest.email || guest.phone || 'No contact details yet'}{guest.meal_preference ? ` · ${guest.meal_preference}` : ''}{guest.rsvp_message ? ` · “${guest.rsvp_message}”` : ''}</small></span></td><td>{guest.category}</td><td>{guest.party_size}</td><td><select aria-label={`RSVP status for ${guest.name}`} className={`rsvp-select ${guest.rsvp.toLowerCase()}`} value={guest.rsvp} onChange={(event) => updateGuest(guest, { rsvp: event.target.value, attendees: event.target.value === 'Attending' ? Math.max(1, guest.attendees || 1) : 0 })}><option>Pending</option><option>Attending</option><option>Declined</option><option>Maybe</option></select></td><td><button className={`checkin-button ${guest.checked_in ? 'checked' : ''}`} onClick={() => updateGuest(guest, { checked_in: !Boolean(guest.checked_in) })}>{guest.checked_in ? '✓ Here' : 'Check in'}</button></td><td><div className="guest-row-actions"><button className="copy-guest-link" title={`Copy personal invitation for ${guest.name}`} onClick={() => copyGuestInvite(guest)}>↗</button><button className="row-delete" title={`Remove ${guest.name}`} onClick={() => removeGuest(guest)}>×</button></div></td></tr>)}</tbody></table></div> : <div className="gentle-empty"><span className="empty-icon">♧</span><strong>No guests just yet</strong><span>Your favorite people will feel right at home here.</span><button className="button button-outline" onClick={() => setShowForm(true)}>Add your first guest →</button></div>}
    </div>
  </>;
}

function TemplateStudio({ wedding, onApply }) {
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('All the good things');
  useEffect(() => { api('/templates').then((data) => setTemplates(data.templates)).catch((cause) => setError(cause.message)); }, []);
  const thumbs = [imageSet[0], imageSet[1], imageSet[2], imageSet[1], imageSet[0], imageSet[2]];
  const categories = ['All the good things', 'Romantic', 'Classic', 'Garden', 'Modern', 'Khmer', 'Khmer Luxury'];
  const visibleTemplates = category === 'All the good things' ? templates : templates.filter((template) => template.category === category);
  return <><PageHeading eyebrow="A FEELING, NOT JUST A DESIGN" title="Find your kind of beautiful." description="Thoughtful little worlds, made ready for your very big day." actions={<span className="template-count">✳ &nbsp; {templates.length} love notes to choose from</span>} />{error && <div className="error-banner">{error}</div>}
    <div className="template-feature"><div><span className="eyebrow">YOUR CURRENT CHAPTER</span><h3>{wedding?.template || 'The Botanica'}</h3><p>All your details stay right where they belong — only the look changes.</p></div><button className="button button-light" onClick={() => document.querySelector('#template-grid')?.scrollIntoView({ behavior: 'smooth' })}>Explore every design ↓</button><span className="template-feature-flower">✳</span></div>
    <div className="template-filters">{categories.map((item) => <button key={item} className={`filter-chip ${category === item ? 'selected' : ''}`} onClick={() => setCategory(item)}>{item}{item === 'All the good things' && <span>{templates.length}</span>}</button>)}</div>
    <div className="template-grid" id="template-grid">{visibleTemplates.map((template) => { const i = templates.indexOf(template); const thumb = thumbs[i % thumbs.length]; const previewUrl = ['Khmer Ceremonial', 'Khmer Ceremonial Gold'].includes(template.name) && wedding?.slug ? `/invite/${encodeURIComponent(wedding.slug)}?preview=1&template=${encodeURIComponent(template.name)}` : template.preview_url || thumb; const openPreview = () => window.open(previewUrl, '_blank', 'noopener,noreferrer'); return <article className="template-card" key={template.name}><div className="template-image" style={{ backgroundImage: `linear-gradient(180deg, transparent 62%, rgba(38,31,26,.2)), url("${thumb}")` }}><span className="template-category">{template.category}</span><div className="template-image-names" style={{ fontFamily: template.category === 'Khmer' ? '"Noto Serif Khmer", serif' : 'Georgia, serif' }}>{template.category === 'Khmer' ? 'សុភមង្គល' : 'A & J'}<small>{template.category === 'Khmer' ? 'សូមអញ្ជើញចូលរួម' : 'are getting married'}</small></div><button className="template-preview-button" onClick={openPreview} aria-label={`Preview ${template.name}`}>↗</button></div><div className="template-card-copy"><div><h3>{template.name}</h3><span>{['Khmer Ceremonial', 'Khmer Ceremonial Gold'].includes(template.name) ? 'Bilingual Cambodian invitation · fully editable and publishable' : template.category === 'Khmer' ? 'A Khmer-language invitation design' : 'Made for the moments that matter'}</span></div><button className={`template-apply ${wedding?.template === template.name ? 'applied' : ''}`} onClick={() => onApply(template.name, template.color)}>{wedding?.template === template.name ? '✓ Yours' : 'Choose design'}</button></div></article>; })}</div>
  </>;
}

function MediaStudio({ wedding, token, onChange, onSave, onToast }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const media = wedding.media || [];
  async function upload(file) {
    if (!file) return;
    const form = new FormData(); form.append('file', file);
    setBusy(true); setError('');
    try { await api(`/weddings/${wedding.id}/media`, { token, method: 'POST', body: form }); await onChange(); onToast('Your memory was added to the collection.'); }
    catch (cause) { setError(cause.message); } finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  }
  async function remove(item) {
    if (!window.confirm(`Remove ${item.name} from your collection?`)) return;
    try { await api(`/weddings/${wedding.id}/media/${item.id}`, { token, method: 'DELETE' }); await onChange(); onToast('The memory has been removed.'); } catch (cause) { setError(cause.message); }
  }
  const assignMedia = async (field, value) => {
    try { await onSave({ [field]: value }); }
    catch (cause) { setError(cause.message); }
  };
  return <><PageHeading eyebrow="THE MOMENTS YOU WANT TO KEEP" title="Little memories, gathered." description="A home for the photographs, sounds and moving pictures that tell your story." actions={<><button className="button button-outline" onClick={() => inputRef.current?.click()}>＋ &nbsp; Add media</button><input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/mp4" onChange={(event) => upload(event.target.files?.[0])} /></>} />
    <div className="upload-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); upload(event.dataTransfer.files?.[0]); }}><div className="upload-icon">↑</div><strong>{busy ? 'Tucking your memory in safely…' : 'Drop something lovely right here'}</strong><span>Photos, films and music · JPEG, PNG, WebP, MP4, MP3 · up to 25 MB each</span><button className="text-link" onClick={() => inputRef.current?.click()}>Choose a file from your device →</button></div>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}>×</button></div>}
    <section className="panel media-roles"><div><span className="eyebrow">MAKE IT YOURS</span><h3>Invitation extras</h3><p>Choose uploaded files to play before the invitation, play as background music, or show as your payment QR.</p></div><div className="media-role-grid">
      <label>Welcome video<select value={wedding.welcome_video_media_id || ''} onChange={(event) => assignMedia('welcome_video_media_id', event.target.value)}><option value="">No welcome video</option>{media.filter((item) => item.type === 'video').map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><small>Plays muted before the welcome page; guests can skip.</small></label>
      <label>Background music<select value={wedding.music_media_id || ''} onChange={(event) => assignMedia('music_media_id', event.target.value)}><option value="">No background music</option>{media.filter((item) => item.type === 'audio').map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><small>Starts when a guest opens the invitation.</small></label>
      <label>Payment QR image<select value={wedding.payment_qr_media_id || ''} onChange={(event) => assignMedia('payment_qr_media_id', event.target.value)}><option value="">No payment QR</option>{media.filter((item) => item.type === 'image').map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><small>Upload your bank/payment QR image above first.</small></label>
    </div></section>
    {media.length ? <div className="media-grid">{media.map((item) => <article className="media-card" key={item.id}>{item.type === 'image' ? <img src={item.url} alt={item.name} /> : item.type === 'video' ? <video src={item.url} controls /> : <div className="audio-card">♫<audio src={item.url} controls /></div>}<div className="media-card-info"><span>{item.name}<small>{(item.size / 1024 / 1024).toFixed(1)} MB · {item.type}</small></span><button className="row-delete" onClick={() => remove(item)} aria-label={`Remove ${item.name}`}>×</button></div></article>)}</div> : <div className="media-empty"><span>✿</span><h3>These memories are waiting for their moment.</h3><p>Add photos to make your invitation feel a little more like you.</p></div>}</>;
}

function SharingStudio({ wedding, onPublish, onToast }) {
  const [qr, setQr] = useState('');
  const inviteUrl = `${window.location.origin}/invite/${wedding.slug}`;
  const invitationPreview = `${inviteUrl}?preview=1`;
  useEffect(() => { QRCode.toDataURL(inviteUrl, { width: 360, margin: 2, color: { dark: '#392e2a', light: '#ffffff' } }).then(setQr).catch(() => setQr('')); }, [inviteUrl]);
  async function copyLink() {
    if (!wedding.published) { onToast('Publish your invitation before sharing its guest link.'); return; }
    try { await navigator.clipboard.writeText(inviteUrl); onToast('Your invitation link is ready to share.'); }
    catch { window.prompt('Copy your invitation link:', inviteUrl); }
  }
  function downloadQr() { if (!qr) return; const link = document.createElement('a'); link.href = qr; link.download = `${wedding.slug}-invitation-qr.png`; link.click(); }
  function openPreview() { window.open(invitationPreview, '_blank', 'noopener,noreferrer'); }
  return <><PageHeading eyebrow="SOMETHING BEAUTIFUL TO SHARE" title="Let the good news travel." description="Your invitation deserves to be passed along with a little love." actions={<><button className="button button-outline" onClick={openPreview}>Preview invitation ↗</button><button className="button button-dark" onClick={onPublish}>{wedding.published ? '✓ Your invitation is live' : 'Publish invitation'} <span>→</span></button></>} />
    {!wedding.published && <div className="draft-notice"><span>✳</span><div><strong>A little secret, for now.</strong><p>Your public invitation and QR code work once published. Preview the draft privately with the button above.</p></div></div>}
    <div className="sharing-layout"><div className="panel share-link-panel"><span className="eyebrow">YOUR PERSONAL INVITATION</span><h3>A link to your little corner<br />of the world.</h3><p>Send it to your favorite people. They can get all the details and let you know if they’ll be there.</p><div className="url-field"><span>↗</span><input aria-label="Invitation link" value={inviteUrl} readOnly /><button onClick={copyLink} disabled={!wedding.published}>Copy link</button></div><div className="share-buttons"><button disabled={!wedding.published} onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`We’d love you to join us! ${inviteUrl}`)}`, '_blank', 'noopener,noreferrer')}>◉ &nbsp; WhatsApp</button><button disabled={!wedding.published} onClick={() => window.open(`mailto:?subject=${encodeURIComponent('You’re invited to our wedding!')}&body=${encodeURIComponent(`We’d love you to join us! ${inviteUrl}`)}`, '_blank', 'noopener,noreferrer')}>✉ &nbsp; Email someone</button><button onClick={openPreview}>↗ &nbsp; Preview invitation</button></div><div className="share-secure-note"><span>⌑</span> Your guest list stays yours. The invitation only shares what you choose.</div></div>
      <div className="panel qr-panel"><span className="eyebrow">A LITTLE SOMETHING TO PRINT</span><h3>One scan, and they’re there.</h3><div className="qr-code-wrap">{qr && wedding.published ? <img src={qr} alt="QR code linking to your wedding invitation" /> : <span>{wedding.published ? 'Creating your QR…' : 'Publish to create your QR code'}</span>}<span>♡ &nbsp; A LITTLE LOVE, FROM US</span></div><button className="button button-outline" disabled={!qr || !wedding.published} onClick={downloadQr}>↓ &nbsp; Download your QR</button><p>Lovely on printed invitations, menus<br />or the welcome table.</p></div></div>
  </>;
}

function AdminStudio({ users, token, onRefresh }) {
  const [error, setError] = useState('');
  async function setStatus(user) {
    const status = user.status === 'active' ? 'suspended' : 'active';
    if (!window.confirm(`${status === 'suspended' ? 'Suspend' : 'Reactivate'} ${user.name}’s account?`)) return;
    try { await api(`/admin/users/${user.id}/status`, { token, method: 'PATCH', body: JSON.stringify({ status }) }); await onRefresh(); } catch (cause) { setError(cause.message); }
  }
  const activeCount = users.filter((user) => user.status === 'active').length;
  const weddingCount = users.reduce((sum, user) => sum + user.wedding_count, 0);
  return <><PageHeading eyebrow="THE PEOPLE MAKING THE MAGIC" title="A little look behind the curtain." description="The people, celebrations and growing community behind Ever After." />
    <div className="admin-stats"><StatCard icon="♧" label="The good people" value={users.length} detail="registered accounts" tone="rose" /><StatCard icon="♡" label="Making things happen" value={activeCount} detail="active creators" tone="sage" /><StatCard icon="✳" label="Love stories begun" value={weddingCount} detail="wedding websites" tone="sand" /><StatCard icon="⌘" label="The team" value={users.filter((user) => user.role === 'admin').length} detail="studio administrators" tone="lilac" /></div>
    {error && <div className="error-banner">{error}</div>}
    <div className="panel guest-table-panel admin-users"><div className="guest-table-heading"><div><h3>Your creative community</h3><span>{users.length} lovely people with a place to create</span></div></div><div className="table-scroll"><table className="guest-table"><thead><tr><th>PERSON</th><th>ROLE</th><th>WEDDING SPACES</th><th>JOINED</th><th>STATUS</th><th></th></tr></thead><tbody>{users.map((user, i) => <tr key={user.id}><td><span className={`table-guest-avatar avatar-tone-${i % 4}`}>{initials(user.name)}</span><span className="table-guest-name">{user.name}<small>{user.email}</small></span></td><td>{user.role === 'admin' ? 'Administrator' : 'Creator'}</td><td>{user.wedding_count}</td><td>{new Date(user.created_at).toLocaleDateString()}</td><td><span className={`rsvp-pill ${user.status === 'active' ? 'attending' : 'declined'}`}>{user.status}</span></td><td><button className="admin-action" onClick={() => setStatus(user)}>{user.status === 'active' ? 'Suspend' : 'Reactivate'}</button></td></tr>)}</tbody></table></div></div>
  </>;
}

function EmptyWorkspace({ busy, onCreate }) {
  return <div className="empty-workspace"><div className="empty-workspace-flower">✳</div><span className="eyebrow">EVERYTHING STARTS WITH A LITTLE YES</span><h1>Your love story has a space of its own.</h1><p>Make a beautiful home for all the details, photographs and people that make your wedding yours.</p><button className="button button-dark" onClick={onCreate} disabled={busy}>{busy ? 'Making a little room…' : 'Create your wedding website'} <span>→</span></button></div>;
}

function PublicInvitation() {
  const location = useLocation();
  const navigate = useNavigate();
  let slug = '';
  try { slug = decodeURIComponent(location.pathname.slice('/invite/'.length).split('/')[0] || ''); }
  catch { slug = ''; }
  const [wedding, setWedding] = useState(null);
  const [invitedGuest, setInvitedGuest] = useState(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', meal_preference: '', attending: true, attendees: 1, message: '' });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [entryStage, setEntryStage] = useState('loading');
  const [audioError, setAudioError] = useState('');
  const [musicPlaying, setMusicPlaying] = useState(false);
  const musicRef = useRef(null);
  const invitationContentRef = useRef(null);
  const params = new URLSearchParams(location.search);
  const invitationToken = params.get('guest') || '';
  const isPreview = params.get('preview') === '1';
  const requestedTemplate = params.get('template');
  useEffect(() => {
    let token;
    try { token = isPreview ? JSON.parse(localStorage.getItem('ever-after-session') || 'null')?.token : undefined; }
    catch { token = undefined; }
    const endpoint = isPreview ? `/preview/${encodeURIComponent(slug)}` : `/public/${encodeURIComponent(slug)}`;
    const query = new URLSearchParams();
    if (invitationToken) query.set('guest', invitationToken);
    if (isPreview) query.set('_', String(Date.now()));
    api(`${endpoint}${query.size ? `?${query}` : ''}`, { token })
      .then((data) => {
        const previewTemplate = isPreview && ['Khmer Ceremonial', 'Khmer Ceremonial Gold'].includes(requestedTemplate) ? requestedTemplate : '';
        const invitationWedding = previewTemplate ? { ...data.wedding, template: previewTemplate } : data.wedding;
        setWedding(invitationWedding);
        setInvitedGuest(data.invited_guest);
        setPreview(isPreview);
        setEntryStage(data.wedding.media?.some((item) => item.id === data.wedding.welcome_video_media_id && item.type === 'video') ? 'video' : invitationWedding.template === 'Khmer Ceremonial Gold' ? 'invitation' : 'welcome');
        if (data.invited_guest) setForm((current) => ({ ...current, name: data.invited_guest.name, attendees: Math.min(current.attendees, data.invited_guest.party_size) }));
        if (!isPreview && data.wedding.slug !== slug) {
          const canonicalUrl = `/invite/${encodeURIComponent(data.wedding.slug)}${invitationToken ? `?guest=${encodeURIComponent(invitationToken)}` : ''}`;
          navigate(canonicalUrl, { replace: true });
        }
      })
      .catch((cause) => setError(cause.message));
  }, [slug, invitationToken, isPreview, requestedTemplate, navigate]);
  useEffect(() => {
    const root = invitationContentRef.current;
    if (!wedding || ['Angkor Royal', 'Khmer Ceremonial', 'Khmer Ceremonial Gold'].includes(wedding.template) || entryStage !== 'invitation' || !root || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const targets = root.querySelectorAll('.invitation-cover, .invitation-intro, .invitation-gallery, .invitation-media, .invitation-details, .invitation-rsvp, .invitation-footer');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach((target, index) => {
      target.classList.add('invitation-reveal-target');
      target.style.setProperty('--invitation-reveal-delay', `${Math.min(index % 4, 3) * 90}ms`);
      const bounds = target.getBoundingClientRect();
      if (bounds.top < window.innerHeight && bounds.bottom > 0) target.classList.add('is-visible');
      else observer.observe(target);
    });
    root.classList.add('invitation-motion-ready');
    return () => {
      observer.disconnect();
      root.classList.remove('invitation-motion-ready');
      targets.forEach((target) => {
        target.classList.remove('invitation-reveal-target', 'is-visible');
        target.style.removeProperty('--invitation-reveal-delay');
      });
    };
  }, [wedding, entryStage]);
  async function submit(event) {
    if (preview) { event.preventDefault(); setError('This is a private preview. Publish your website before collecting RSVPs.'); return; }
    event.preventDefault(); setBusy(true); setError('');
    try { await api(`/public/${slug}/rsvp`, { method: 'POST', body: JSON.stringify({ ...form, attendees: Number(form.attendees), invitation_token: invitationToken }) }); setSent(true); } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  if (error && !wedding) return <div className="invitation-error"><Brand /><span>♡</span><h1>A little invitation, not found.</h1><p>{error}</p><Link to="/">Visit Ever After</Link></div>;
  if (!wedding) return <div className="loading-screen"><Brand />A moment, while we find your invitation…</div>;
  const isKhmer = ['Khmer Heritage', 'Angkor Royal', 'Khmer Ceremonial', 'Khmer Ceremonial Gold'].includes(wedding.template);
  const isRoyalKhmer = wedding.template === 'Angkor Royal';
  const isKhmerCeremonial = wedding.template === 'Khmer Ceremonial';
  const isKhmerCeremonialGold = wedding.template === 'Khmer Ceremonial Gold';
  const date = wedding.wedding_date
    ? new Date(`${wedding.wedding_date}T12:00:00`).toLocaleDateString(isKhmer ? 'km-KH' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Choose your date';
  const paymentQr = wedding.media?.find((item) => item.id === wedding.payment_qr_media_id && item.type === 'image');
  const welcomeVideo = wedding.media?.find((item) => item.id === wedding.welcome_video_media_id && item.type === 'video');
  const music = wedding.media?.find((item) => item.id === wedding.music_media_id && item.type === 'audio');
  const invitationPhoto = wedding.media?.find((item) => item.type === 'image' && item.id !== wedding.payment_qr_media_id);
  const copy = isKhmer ? {
    invitation: 'សូមអញ្ជើញចូលរួមពិធីមង្គលការរបស់យើង',
    welcome: 'សូមស្វាគមន៍មកកាន់ពិធីមង្គលការរបស់យើង',
    open: 'បើកលិខិតអញ្ជើញ',
    skip: 'រំលងវីដេអូ',
    reply: 'សូមឆ្លើយតប',
    story: 'យើងខ្ញុំនឹងរៀបការ ហើយសូមអញ្ជើញអ្នកមកចូលរួម',
    date: 'ថ្ងៃមង្គលការ',
    details: 'ព័ត៌មានពិធីមង្គលការ',
    map: 'មើលទីតាំង',
    payment: 'ចូលរួមជូនពរ និងផ្ញើជាសក្ខីភាព',
    rsvp: 'សូមបញ្ជាក់ការចូលរួម',
    name: 'ឈ្មោះរបស់អ្នក',
    email: 'អ៊ីមែល (មិនចាំបាច់)',
    attending: 'តើអ្នកអាចចូលរួមបានទេ?',
    yes: 'ចាស/បាទ ខ្ញុំនឹងចូលរួម',
    no: 'សូមអភ័យទោស ខ្ញុំមិនអាចចូលរួមបានទេ',
    guests: 'ចំនួនអ្នកចូលរួម',
    message: 'សារជូនពរ (មិនចាំបាច់)',
    send: 'ផ្ញើការឆ្លើយតប',
    thanks: 'អរគុណសម្រាប់ការឆ្លើយតប។ យើងខ្ញុំរីករាយដែលបានជួបអ្នក!',
    private: 'សូមប្រើតំណ RSVP ផ្ទាល់ខ្លួនដែលគូស្វាមីភរិយាបានចែករំលែកជូនអ្នក។',
    music: 'ចាក់តន្ត្រី',
    pauseMusic: 'ផ្អាកតន្ត្រី',
    phone: 'លេខទូរស័ព្ទ',
    meal: 'ចំណង់ចំណូលចិត្តអាហារ (ជាជម្រើស)',
    share: 'ចែករំលែកលិខិតអញ្ជើញ',
    print: 'បោះពុម្ពលិខិតអញ្ជើញ',
    ceremony: 'កម្មវិធីពិធីមង្គលការ',
    location: 'ទីតាំងពិធី',
    gallery: 'វិចិត្រសាលរូបថត',
    ourStory: 'រឿងរ៉ាវស្នេហារបស់យើង',
    parking: 'ព័ត៌មានចតយានយន្ត',
    giftDetails: 'ព័ត៌មានអំណោយ',
    copy: 'ចម្លងព័ត៌មានទូទាត់',
    directions: 'មើលផ្លូវ',
    days: 'ថ្ងៃ',
    hours: 'ម៉ោង',
    minutes: 'នាទី',
    seconds: 'វិនាទី',
    join: 'សូមចូលរួមអបអរសាទរ',
    mapUnavailable: 'សូមបន្ថែមឈ្មោះទីតាំង និងអាសយដ្ឋានដើម្បីបង្ហាញផែនទី។',
    cover: 'ដោយក្តីស្រឡាញ់ និងសេចក្តីរីករាយ',
    scroll: 'អូសចុះក្រោមដើម្បីមើល',
    memories: 'រឿងរ៉ាវ និងអនុស្សាវរីយ៍របស់យើង',
    memoriesEyebrow: 'អនុស្សាវរីយ៍របស់យើង',
    footer: 'បង្កើតដោយក្តីស្រឡាញ់',
  } : {
    invitation: 'Please join us for our wedding',
    welcome: 'Welcome to our wedding',
    open: 'Open your invitation',
    skip: 'Skip video',
    reply: 'Kindly reply',
    story: 'We’re getting married, and we’d love you there.',
    date: 'Save the date',
    details: 'Wedding details',
    map: 'Find your way here',
    payment: 'A little wedding gift',
    rsvp: 'Please reply',
    name: 'Your name',
    email: 'Email address (optional)',
    attending: 'Can we save you a seat?',
    yes: 'Yes, I’ll be there!',
    no: 'I’m sorry to miss it.',
    guests: 'How many will be celebrating?',
    message: 'A note for the happy couple (optional)',
    send: 'Send your reply',
    thanks: 'Thank you for letting us know. We can’t wait to celebrate together.',
    private: 'Please open the personal RSVP link shared directly with you.',
    music: 'Play music',
    pauseMusic: 'Pause music',
    phone: 'Phone number',
    meal: 'Meal preference (optional)',
    share: 'Share invitation',
    print: 'Print invitation',
    ceremony: 'Wedding ceremony schedule',
    location: 'Wedding venue',
    gallery: 'Photo gallery',
    ourStory: 'Our love story',
    parking: 'Parking information',
    giftDetails: 'Gift details',
    copy: 'Copy payment details',
    directions: 'Get directions',
    days: 'Days',
    hours: 'Hours',
    minutes: 'Minutes',
    seconds: 'Seconds',
    join: 'Join Our Celebration',
    mapUnavailable: 'Add a venue and address to show the map.',
    cover: 'With full hearts and so much joy',
    scroll: 'Scroll to celebrate',
    memories: 'Sounds & moving pictures.',
    memoriesEyebrow: 'A little more of our story',
    footer: 'Made with a little magic by',
  };
  function openInvitation() {
    setEntryStage('invitation');
    if (music && musicRef.current) {
      musicRef.current.muted = false;
      musicRef.current.play().catch(() => setAudioError('Tap the music button to start.'));
    }
  }
  async function toggleMusic() {
    const audio = musicRef.current;
    if (!audio) return;
    if (audio.paused) {
      try { await audio.play(); setAudioError(''); }
      catch { setAudioError('Music could not be played. Try again.'); }
    } else {
      audio.pause();
    }
  }
  async function finishWelcomeVideo() {
    if (!music || !musicRef.current) {
      setEntryStage(wedding.template === 'Khmer Ceremonial Gold' ? 'invitation' : 'welcome');
      return;
    }
    const audio = musicRef.current;
    audio.muted = false;
    try {
      if (audio.paused) await audio.play();
      setAudioError('');
    } catch {
      setAudioError('Tap the music button to start.');
    }
    setEntryStage(wedding.template === 'Khmer Ceremonial Gold' ? 'invitation' : 'welcome');
  }
  function prepareWelcomeMusic() {
    const audio = musicRef.current;
    if (!audio) return;
    audio.muted = true;
    audio.play().catch(() => setAudioError('Music will start when the video ends.'));
  }
  if (isRoyalKhmer || isKhmerCeremonial || isKhmerCeremonialGold) return <main lang="km" className={`public-invitation invitation-khmer invitation-khmer-royal ${isKhmerCeremonial ? 'invitation-khmer-ceremonial' : ''} ${isKhmerCeremonialGold ? 'invitation-khmer-ceremonial-gold' : ''}`} style={{ '--invite-accent': isKhmerCeremonial || isKhmerCeremonialGold ? '#D4AF37' : wedding.primary_color }}>
    {preview && <aside className="invitation-preview-banner"><span>PRIVATE PREVIEW</span><strong>{wedding.published ? 'This is your published invitation.' : 'This is a draft; publish it before sharing with guests.'}</strong><Link to="/">Back to studio</Link></aside>}
    {music && <div className="invitation-music-control" hidden={entryStage !== 'invitation'}><audio ref={musicRef} src={music.url} loop muted onPlay={() => { setMusicPlaying(true); setAudioError(''); }} onPause={() => setMusicPlaying(false)} onError={() => { setMusicPlaying(false); setAudioError('Music could not be loaded.'); }} /><button type="button" className="invitation-music-button royal-music-button" onClick={toggleMusic} aria-label={musicPlaying ? copy.pauseMusic : copy.music} title={musicPlaying ? copy.pauseMusic : copy.music}>{musicPlaying ? 'Ⅱ' : '♫'}</button><span>{audioError}</span></div>}
    {entryStage === 'video' && welcomeVideo && <section className="invitation-entry-video"><video src={welcomeVideo.url} autoPlay muted playsInline onPlay={prepareWelcomeMusic} onEnded={finishWelcomeVideo} onError={() => setEntryStage(isKhmerCeremonialGold ? 'invitation' : 'welcome')} /><button className="button button-light" onClick={() => setEntryStage(isKhmerCeremonialGold ? 'invitation' : 'welcome')}>{copy.skip}</button></section>}
    {entryStage === 'welcome' && <section className="invitation-welcome invitation-welcome-royal" style={{ backgroundImage: invitationPhoto ? `linear-gradient(rgba(37,31,26,.55),rgba(37,31,26,.62)), url("${invitationPhoto.url}")` : undefined }}><Brand light /><span className="eyebrow">{copy.welcome}</span><h1>{wedding.bride}<br /><i>&</i> {wedding.groom}</h1><button className="button button-light" onClick={openInvitation}>{copy.open} <span>→</span></button></section>}
    {entryStage === 'invitation' && (isKhmerCeremonialGold
      ? <KhmerCeremonialGoldInvitation wedding={wedding} invitedGuest={invitedGuest} preview={preview} form={form} setForm={setForm} sent={sent} submit={submit} busy={busy} error={error} />
      : <KhmerRoyalInvitation wedding={wedding} copy={copy} invitedGuest={invitedGuest} preview={preview} ceremonial={isKhmerCeremonial} form={form} setForm={setForm} sent={sent} submit={submit} busy={busy} error={error} />)}
  </main>;
  return <main ref={invitationContentRef} lang={isKhmer ? 'km' : 'en'} className={`public-invitation ${isKhmer ? 'invitation-khmer' : ''}`} style={{ '--invite-accent': wedding.primary_color }}>
    {preview && <aside className="invitation-preview-banner"><span>PRIVATE PREVIEW</span><strong>{wedding.published ? 'This is your published invitation.' : 'This is a draft; publish it before sharing with guests.'}</strong><Link to="/">Back to studio</Link></aside>}
    {music && <div className="invitation-music-control" hidden={entryStage === 'loading' || entryStage === 'video'}><audio ref={musicRef} src={music.url} loop muted onPlay={() => { setMusicPlaying(true); setAudioError(''); }} onPause={() => setMusicPlaying(false)} onEnded={() => { const audio = musicRef.current; if (audio) { audio.currentTime = 0; audio.play().catch(() => setAudioError('Tap the music button to start.')); } }} onError={() => { setMusicPlaying(false); setAudioError('Music could not be loaded.'); }} /><button type="button" className="invitation-music-button" onClick={toggleMusic} aria-label={musicPlaying ? copy.pauseMusic : copy.music} title={musicPlaying ? copy.pauseMusic : copy.music}>{musicPlaying ? 'Ⅱ' : '♫'}</button><span>{audioError}</span></div>}
    {entryStage === 'video' && welcomeVideo && <section className="invitation-entry-video"><video src={welcomeVideo.url} autoPlay muted playsInline onPlay={prepareWelcomeMusic} onEnded={finishWelcomeVideo} onError={() => setEntryStage('welcome')} /><button className="button button-light" onClick={() => setEntryStage('welcome')}>{copy.skip}</button></section>}
    {entryStage === 'welcome' && <section className={`invitation-welcome ${isRoyalKhmer || isKhmerCeremonial ? 'invitation-welcome-royal' : ''}`} style={{ backgroundImage: isRoyalKhmer || isKhmerCeremonial ? (invitationPhoto ? `linear-gradient(rgba(37,31,26,.55),rgba(37,31,26,.62)), url("${invitationPhoto.url}")` : undefined) : `linear-gradient(rgba(37,31,26,.45),rgba(37,31,26,.45)), url("${invitationPhoto?.url || imageSet[0]}")` }}><Brand light /><span className="eyebrow">{copy.welcome}</span><h1>{wedding.bride}<br /><i>&</i> {wedding.groom}</h1><button className="button button-light" onClick={openInvitation}>{copy.open} <span>→</span></button></section>}
    {entryStage === 'invitation' && <>
    <div className="invitation-topbar"><Brand /><span>{copy.invitation}</span><a href="#rsvp">{copy.reply} <span>↓</span></a></div>
    <section className="invitation-cover"><div className="invitation-cover-photo" aria-hidden="true" style={{ backgroundImage: `linear-gradient(0deg, rgba(31,27,24,.42), rgba(31,27,24,.04) 72%), url("${invitationPhoto?.url || imageSet[0]}")` }} /><span className="invitation-overline">{copy.cover}</span><h1>{wedding.bride}<br /><i>&</i> {wedding.groom}</h1><span className="invitation-rule">✳</span><p>{date.toUpperCase()}</p><a className="cover-scroll" href="#welcome">{copy.scroll} <span>↓</span></a></section>
    <section className="invitation-intro" id="welcome"><span className="eyebrow">{isKhmer ? 'សូមស្វាគមន៍មកកាន់ថ្ងៃដ៏ពិសេស' : 'TO OUR FAVORITE PEOPLE'}</span><h2>{copy.story}</h2><span className="flourish">❧</span>{wedding.story && <p>{wedding.story}</p>}<span className="intro-names">{wedding.bride} & {wedding.groom}</span></section>
    {wedding.media?.filter((item) => item.type === 'image').length > 0 && <section className="invitation-gallery">{wedding.media.filter((item) => item.type === 'image').slice(0, 3).map((item) => <img key={item.id} src={item.url} alt={item.name} />)}</section>}
    {wedding.media?.some((item) => item.type !== 'image' && item.id !== music?.id && item.id !== welcomeVideo?.id) && <section className="invitation-media"><span className="eyebrow">{copy.memoriesEyebrow}</span><h2>{copy.memories}</h2><div className="invitation-media-grid">{wedding.media.filter((item) => item.type !== 'image' && item.id !== music?.id && item.id !== welcomeVideo?.id).map((item) => item.type === 'video' ? <figure key={item.id}><video src={item.url} controls preload="metadata" /><figcaption>{item.name}</figcaption></figure> : <figure key={item.id}><figcaption>♫ &nbsp; {item.name}</figcaption><audio src={item.url} controls preload="none" /></figure>)}</div></section>}
    <section className="invitation-details"><span className="eyebrow">{copy.date}</span><h2>{copy.details}</h2><div className="detail-card"><span className="detail-calendar">♡</span><h3>{date}</h3>{wedding.venue && <p>{wedding.venue}</p>}{wedding.address && <span>{wedding.address}</span>}{wedding.maps_url && <a className="button button-dark" target="_blank" rel="noreferrer" href={wedding.maps_url}>{copy.map} ↗</a>}</div>{paymentQr && <div className="payment-qr-card"><h3>{copy.payment}</h3><img src={paymentQr.url} alt={isKhmer ? 'រូបភាព QR សម្រាប់ការទូទាត់' : 'Payment QR code'} /><p>{paymentQr.name}</p></div>}</section>
    <section className="invitation-rsvp" id="rsvp"><span className="eyebrow">{copy.rsvp}</span><h2>{copy.attending}</h2>{sent ? <div className="rsvp-thanks"><span>♡</span><h3>{isKhmer ? 'អរគុណច្រើន!' : 'How lovely to hear from you.'}</h3><p>{copy.thanks}</p></div> : invitedGuest || preview ? <form className="rsvp-form" onSubmit={submit}><label>{copy.name}<input required minLength="2" maxLength="120" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={copy.name} /></label><label>{copy.email}<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder={copy.email} /></label><label>{copy.attending}<select value={String(form.attending)} onChange={(event) => setForm({ ...form, attending: event.target.value === 'true', attendees: event.target.value === 'true' ? 1 : 0 })}><option value="true">{copy.yes}</option><option value="false">{copy.no}</option></select></label>{form.attending && <label>{copy.guests}<input type="number" min="1" max={invitedGuest?.party_size || 20} value={form.attendees} onChange={(event) => setForm({ ...form, attendees: event.target.value })} /></label>}<label>{copy.message}<textarea rows="3" maxLength="500" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder={copy.message} /></label>{error && <p className="form-error">{error}</p>}<button className="button button-dark button-wide" disabled={busy}>{preview ? 'Preview only — RSVPs are not sent' : busy ? 'Sending…' : copy.send} <span>→</span></button></form> : <div className="rsvp-link-note"><span>♡</span><p>{copy.private}</p></div>}</section>
    <footer className="invitation-footer"><span>{isKhmer ? 'ដោយក្តីស្រឡាញ់' : 'WITH LOVE,'}</span><h2>{wedding.bride} & {wedding.groom}</h2><div>{copy.footer} <a href="/">EVER AFTER</a></div></footer>
    </>}
  </main>;
}

function KhmerRoyalInvitation({ wedding, copy, invitedGuest, preview, ceremonial, form, setForm, sent, submit, busy, error }) {
  const [now, setNow] = useState(Date.now());
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [shareQr, setShareQr] = useState('');
  const [notice, setNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const royalRef = useRef(null);
  const place = [wedding.venue, wedding.address].filter(Boolean).join(', ');
  const photos = (wedding.media || []).filter((item) => item.type === 'image' && item.id !== wedding.payment_qr_media_id);
  const schedule = Array.isArray(wedding.ceremony_schedule) ? wedding.ceremony_schedule : [];
  const timeline = Array.isArray(wedding.love_timeline) ? wedding.love_timeline : [];
  const inviteUrl = `${window.location.origin}/invite/${encodeURIComponent(wedding.slug)}`;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    QRCode.toDataURL(inviteUrl, { width: 240, margin: 2, color: { dark: '#34251D', light: '#FFF9F0' } })
      .then(setShareQr)
      .catch(() => setNotice('Invitation QR code could not be generated.'));
  }, [inviteUrl]);
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') setSelectedPhoto(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);
  useEffect(() => {
    const root = royalRef.current;
    if (!root || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const targets = root.querySelectorAll('.royal-section-heading, .royal-timeline-item, .royal-gallery-photo, .royal-schedule-item, .royal-venue-copy, .royal-map, .royal-rsvp-form, .royal-rsvp-success, .royal-private-note, .royal-gift-section, .royal-share-section, .royal-contact');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          if (entry.target.classList.contains('royal-timeline-item')) entry.target.closest('.royal-timeline')?.classList.add('royal-line-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach((target, index) => {
      target.classList.add('royal-reveal-target');
      target.style.setProperty('--royal-reveal-delay', `${Math.min(index % 5, 4) * 85}ms`);
      const bounds = target.getBoundingClientRect();
      if (bounds.top < window.innerHeight && bounds.bottom > 0) {
        target.classList.add('is-visible');
        if (target.classList.contains('royal-timeline-item')) target.closest('.royal-timeline')?.classList.add('royal-line-visible');
      } else {
        observer.observe(target);
      }
    });
    root.classList.add('royal-motion-ready');
    return () => {
      observer.disconnect();
      root.classList.remove('royal-motion-ready');
      root.querySelector('.royal-timeline')?.classList.remove('royal-line-visible');
      targets.forEach((target) => {
        target.classList.remove('royal-reveal-target', 'is-visible');
        target.style.removeProperty('--royal-reveal-delay');
      });
    };
  }, [wedding.slug]);
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionMeta?.content;
    document.title = `${wedding.bride} និង ${wedding.groom} | ពិធីមង្គលការ`;
    if (descriptionMeta) descriptionMeta.content = `សូមចូលរួមអបអរសាទរពិធីមង្គលការរបស់ ${wedding.bride} និង ${wedding.groom}។`;
    return () => {
      document.title = previousTitle;
      if (descriptionMeta && previousDescription) descriptionMeta.content = previousDescription;
    };
  }, [wedding.bride, wedding.groom]);
  const targetDate = wedding.wedding_date ? new Date(`${wedding.wedding_date}T00:00:00`).getTime() : 0;
  const remaining = Math.max(0, targetDate - now);
  const countdown = [
    [Math.floor(remaining / 86400000), copy.days],
    [Math.floor((remaining / 3600000) % 24), copy.hours],
    [Math.floor((remaining / 60000) % 60), copy.minutes],
    [Math.floor((remaining / 1000) % 60), copy.seconds],
  ];
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place || wedding.venue || 'Cambodia')}`;
  async function shareInvitation() {
    try {
      if (navigator.share) await navigator.share({ title: wedding.title, text: copy.invitation, url: inviteUrl });
      else { await navigator.clipboard.writeText(inviteUrl); setNotice('បានចម្លងតំណលិខិតអញ្ជើញ'); }
    } catch (cause) {
      if (cause.name !== 'AbortError') setNotice('មិនអាចចែករំលែកបានទេ។ សូមសាកល្បងម្តងទៀត។');
    }
  }
  async function copyGiftDetails() {
    try { await navigator.clipboard.writeText(wedding.gift_payment_info); setNotice('បានចម្លងព័ត៌មានទូទាត់'); }
    catch { setNotice('មិនអាចចម្លងបានទេ។ សូមជ្រើសរើស និងចម្លងអត្ថបទដោយដៃ។'); }
  }
  const paymentQr = wedding.media?.find((item) => item.id === wedding.payment_qr_media_id && item.type === 'image');
  return <div ref={royalRef} className={`royal-invitation-content ${ceremonial ? 'royal-ceremonial-content' : ''}`}>
    <nav className="royal-nav"><a className="royal-brand" href="#royal-home"><span>❋</span><strong>{wedding.bride} <i>និង</i> {wedding.groom}{ceremonial && <small>{wedding.bride} &amp; {wedding.groom}</small>}</strong></a><button className="royal-menu-toggle" aria-label="បើកម៉ឺនុយ" aria-controls="royal-navigation-links" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>☰</button><div id="royal-navigation-links" className={`royal-nav-links ${menuOpen ? 'is-open' : ''}`} onClick={() => setMenuOpen(false)}><a href="#royal-story">{copy.ourStory}</a>{photos.length > 0 && <a href="#royal-gallery">{copy.gallery}</a>}<a href="#royal-schedule">{copy.ceremony}</a><a href="#royal-venue">{copy.location}</a>{(paymentQr || wedding.gift_payment_info) && <a href="#royal-gift">{copy.giftDetails}</a>}<a href="#royal-rsvp">{copy.rsvp}</a></div></nav>
    <section className="royal-hero" id="royal-home">
      <div className="royal-hero-photo" style={photos[0] ? { backgroundImage: `url("${photos[0].url}")` } : undefined} />
      <div className="royal-hero-shade" />
      <div className="royal-frame"><span className="royal-lotus">❋</span><span className="royal-kicker">{ceremonial ? 'KHMER CEREMONIAL · ពិធីមង្គលការខ្មែរ' : 'ពិធីមង្គលការខ្មែរ'}</span><h1><span className="royal-name">{wedding.bride}</span><span className="royal-name-connector">និង</span><span className="royal-name">{wedding.groom}</span></h1>{ceremonial && <p className="royal-ceremonial-english-names">{wedding.bride} &amp; {wedding.groom}</p>}<div className="royal-divider"><i />❋<i /></div><p>{copy.invitation}</p><time>{wedding.wedding_date ? new Date(`${wedding.wedding_date}T12:00:00`).toLocaleDateString('km-KH', { day: 'numeric', month: 'long', year: 'numeric' }) : 'សូមស្វាគមន៍'}</time>{wedding.venue && <span className="royal-hero-venue">{wedding.venue}</span>}<div className="royal-countdown" aria-label="រាប់ថយក្រោយដល់ថ្ងៃមង្គលការ">{countdown.map(([value, label]) => <div key={label}><strong key={`${label}-${value}`}>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>)}</div><a className="royal-cta royal-hero-cta" href="#royal-rsvp">{copy.join}<span>↓</span></a></div>
      <a className="royal-hero-scroll" href="#royal-story" aria-label="អូសចុះក្រោម">⌄</a>
    </section>
    <section className="royal-section royal-story" id="royal-story"><div className="royal-section-heading"><span className="royal-overline">ដំណើរនៃក្តីស្រឡាញ់</span><h2>{copy.ourStory}</h2><span className="royal-heading-flower">❋</span></div><div className="royal-timeline">{timeline.length ? timeline.map((milestone, index) => { const photo = wedding.media?.find((item) => item.id === milestone.photo_media_id && item.type === 'image'); return <article className="royal-timeline-item" key={`${milestone.title}-${index}`}><span className="royal-timeline-mark">{String(index + 1).padStart(2, '0')}</span><div>{milestone.date && <time>{new Date(`${milestone.date}T12:00:00`).toLocaleDateString('km-KH', { day: 'numeric', month: 'long', year: 'numeric' })}</time>}<h3>{milestone.title}</h3>{milestone.description && <p>{milestone.description}</p>}{photo && <button className="royal-timeline-photo" onClick={() => setSelectedPhoto(photo)}><img src={photo.url} alt={photo.name} loading="lazy" /></button>}</div></article>; }) : <article className="royal-timeline-item"><span className="royal-timeline-mark">១</span><div>{wedding.wedding_date && <time>{new Date(`${wedding.wedding_date}T12:00:00`).toLocaleDateString('km-KH', { day: 'numeric', month: 'long', year: 'numeric' })}</time>}<h3>{wedding.bride} និង {wedding.groom}</h3><p>{wedding.story || 'រឿងរ៉ាវរបស់យើងចាប់ផ្តើមពីថ្ងៃដ៏ពិសេសមួយ ហើយបន្តទៅជាដំណើរជីវិតដែលពោរពេញដោយក្តីស្រឡាញ់។'}</p></div></article>}<span className="royal-timeline-tail">❋</span></div></section>
    {photos.length > 0 && <section className="royal-gallery-section" id="royal-gallery"><div className="royal-section-heading"><span className="royal-overline">អនុស្សាវរីយ៍ដ៏មានន័យ</span><h2>{copy.gallery}</h2><span className="royal-heading-flower">❋</span></div><div className="royal-gallery">{photos.map((photo, index) => <button className={`royal-gallery-photo royal-gallery-photo-${index % 5}`} key={photo.id} onClick={() => setSelectedPhoto(photo)} aria-label={`មើលរូបថត ${photo.name}`}><img src={photo.url} alt={photo.name} loading="lazy" /><span className="royal-gallery-caption">{photo.name}</span></button>)}</div></section>}
    <section className="royal-section royal-schedule-section" id="royal-schedule"><div className="royal-section-heading"><span className="royal-overline">ថ្ងៃដ៏ពិសេស និងក្តីរីករាយ</span><h2>{copy.ceremony}</h2><span className="royal-heading-flower">❋</span><p>កម្មវិធីពិធីតាមជម្រើសរបស់គ្រួសារ និងគូស្វាមីភរិយា</p></div>{schedule.length ? <div className="royal-schedule">{schedule.map((item, index) => <article className="royal-schedule-item" key={`${item.name}-${index}`}><span className="royal-schedule-number">{String(index + 1).padStart(2, '0')}</span><div className="royal-schedule-time">{[item.date, item.time].filter(Boolean).join(' · ') || '♡'}</div><div className="royal-schedule-copy"><h3>{item.name}</h3>{item.description && <p>{item.description}</p>}{item.location && <span>⌖ &nbsp;{item.location}</span>}</div></article>)}</div> : <p className="royal-empty-note">កម្មវិធីពិធីនឹងជម្រាបជូនក្នុងពេលឆាប់ៗនេះ។</p>}</section>
    <section className="royal-venue-section" id="royal-venue"><div className="royal-venue-copy"><span className="royal-overline">សូមអញ្ជើញមកចូលរួម</span><h2>{copy.location}</h2><span className="royal-heading-flower">❋</span><h3>{wedding.venue || 'ទីតាំងពិធីមង្គលការ'}</h3><p>{wedding.address}</p>{wedding.parking_info && <div className="royal-parking"><strong>{copy.parking}</strong><p>{wedding.parking_info}</p></div>}{place ? <a className="royal-cta royal-cta-dark" href={wedding.maps_url || directionsUrl} target="_blank" rel="noreferrer">{copy.directions} ↗</a> : <p>{copy.mapUnavailable}</p>}</div>{place && <iframe className="royal-map" title="ផែនទីទីតាំងពិធីមង្គលការ" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${encodeURIComponent(place)}&output=embed`} />}</section>
    <section className="royal-rsvp-section" id="royal-rsvp"><div className="royal-section-heading"><span className="royal-overline">វត្តមានរបស់អ្នកជាកាដូដ៏មានតម្លៃ</span><h2>{copy.rsvp}</h2><span className="royal-heading-flower">❋</span><p>សូមបញ្ជាក់ការចូលរួមរបស់អ្នក ដើម្បីឱ្យយើងខ្ញុំត្រៀមទទួលស្វាគមន៍បានយ៉ាងកក់ក្តៅ។</p></div>{sent ? <div className="royal-rsvp-success"><span>❋</span><h3>{copy.thanks}</h3></div> : invitedGuest || preview ? <form className="royal-rsvp-form" onSubmit={submit}><label>{copy.name}<input required minLength="2" maxLength="120" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>{copy.phone}<input type="tel" maxLength="40" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>{copy.email}<input type="email" maxLength="254" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>{copy.attending}<select value={String(form.attending)} onChange={(event) => setForm({ ...form, attending: event.target.value === 'true', attendees: event.target.value === 'true' ? 1 : 0 })}><option value="true">{copy.yes}</option><option value="false">{copy.no}</option></select></label>{form.attending && <><label>{copy.guests}<input type="number" min="1" max={invitedGuest?.party_size || 20} value={form.attendees} onChange={(event) => setForm({ ...form, attendees: event.target.value })} /></label><label>{copy.meal}<input maxLength="120" value={form.meal_preference} onChange={(event) => setForm({ ...form, meal_preference: event.target.value })} /></label></>}<label>{copy.message}<textarea rows="3" maxLength="500" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="royal-cta royal-cta-dark" disabled={busy}>{busy ? 'កំពុងផ្ញើ…' : copy.send}<span>→</span></button></form> : <p className="royal-private-note">{copy.private}</p>}</section>
    {(paymentQr || wedding.gift_payment_info) && <section className="royal-gift-section" id="royal-gift"><span className="royal-overline">ដោយក្តីដឹងគុណ ប្រសិនបើអ្នកមានបំណង</span><h2>{copy.giftDetails}</h2><p>វត្តមាន និងពាក្យជូនពររបស់អ្នក គឺជាកាដូដ៏មានតម្លៃបំផុត។</p>{paymentQr && <img className="royal-gift-qr" src={paymentQr.url} alt="រូបកូដ QR សម្រាប់ផ្ញើជាសក្ខីភាព" />}{wedding.gift_payment_info && <><pre>{wedding.gift_payment_info}</pre><button className="royal-cta royal-cta-dark" onClick={copyGiftDetails}>{copy.copy}</button></>}</section>}
    <section className="royal-share-section"><div><span className="royal-overline">សូមចែករំលែកថ្ងៃដ៏ពិសេសនេះ</span><h2>{copy.share}</h2><button className="royal-cta royal-cta-dark" onClick={shareInvitation}>{copy.share} ↗</button><button className="royal-text-button" onClick={() => window.print()}>{copy.print}</button><div className="royal-social-links"><a href={`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(copy.invitation)}`} target="_blank" rel="noreferrer">Telegram ↗</a><a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}`} target="_blank" rel="noreferrer">Facebook ↗</a></div></div>{shareQr && <div className="royal-share-qr"><img src={shareQr} alt="កូដ QR ភ្ជាប់ទៅកាន់លិខិតអញ្ជើញ" /><span>ស្កេនដើម្បីបើកលិខិតអញ្ជើញ</span></div>}</section>
    {(wedding.contact_phone || wedding.contact_telegram) && <section className="royal-contact"><span className="royal-overline">យើងខ្ញុំរីករាយក្នុងការជួយ</span><h2>ទំនាក់ទំនង</h2><div>{wedding.contact_phone && <a href={`tel:${wedding.contact_phone}`}>☎ &nbsp;{wedding.contact_phone}</a>}{wedding.contact_telegram && <a href={wedding.contact_telegram} target="_blank" rel="noreferrer">Telegram ↗</a>}</div></section>}
    <footer className="royal-footer"><span className="royal-footer-ornament">❋</span><p>ដោយក្តីស្រឡាញ់ និងការគោរពតាមប្រពៃណីខ្មែរ</p><h2>{wedding.bride} <i>និង</i> {wedding.groom}</h2><span>ពិធីមង្គលការខ្មែរ</span></footer>
    {notice && <div className="royal-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="បិទ">×</button></div>}
    {selectedPhoto && <div className="royal-lightbox" role="dialog" aria-modal="true" aria-label="រូបថតពង្រីក" onClick={() => setSelectedPhoto(null)}><button onClick={() => setSelectedPhoto(null)} aria-label="បិទរូបថត">×</button><img src={selectedPhoto.url} alt={selectedPhoto.name} /></div>}
  </div>;
}

function KhmerCeremonialGoldInvitation({ wedding, invitedGuest, preview, form, setForm, sent, submit, busy, error }) {
  const [now, setNow] = useState(Date.now());
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  const [english, setEnglish] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [shareQr, setShareQr] = useState('');
  const [notice, setNotice] = useState('');
  const rootRef = useRef(null);
  const entryTimerRef = useRef(null);
  const photos = (wedding.media || []).filter((item) => item.type === 'image' && item.id !== wedding.payment_qr_media_id);
  const schedule = Array.isArray(wedding.ceremony_schedule) ? wedding.ceremony_schedule : [];
  const timeline = Array.isArray(wedding.love_timeline) ? wedding.love_timeline : [];
  const paymentQr = wedding.media?.find((item) => item.id === wedding.payment_qr_media_id && item.type === 'image');
  const inviteUrl = `${window.location.origin}/invite/${encodeURIComponent(wedding.slug)}`;
  const venue = [wedding.venue, wedding.address].filter(Boolean).join(', ');
  const directionsUrl = wedding.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue || 'Cambodia')}`;
  const calendarDate = wedding.wedding_date?.replace(/-/g, '') || '';
  const calendarEnd = wedding.wedding_date ? new Date(`${wedding.wedding_date}T00:00:00Z`) : null;
  if (calendarEnd) calendarEnd.setUTCDate(calendarEnd.getUTCDate() + 1);
  const calendarEndDate = calendarEnd?.toISOString().slice(0, 10).replace(/-/g, '') || '';
  const escapeCalendarValue = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const calendarUrl = calendarDate
    ? `data:text/calendar;charset=utf-8,${encodeURIComponent(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Ever After//Khmer Wedding//EN\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${calendarDate}\r\nDTEND;VALUE=DATE:${calendarEndDate}\r\nSUMMARY:${escapeCalendarValue(`${wedding.bride} & ${wedding.groom} Wedding`)}\r\nLOCATION:${escapeCalendarValue(venue)}\r\nEND:VEVENT\r\nEND:VCALENDAR`)}`
    : '';
  const text = english ? {
    open: 'Open Invitation', navStory: 'Our Story', navGallery: 'Gallery', navSchedule: 'Schedule', navVenue: 'Venue', navRsvp: 'RSVP',
    wedding: 'The Wedding Celebration', countdown: 'COUNTING DOWN TO OUR DAY', days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds',
    couple: 'Together with our families', story: 'Our Love Story', gallery: 'A collection of cherished moments', schedule: 'Wedding Ceremony Schedule',
    venue: 'Join us at the celebration', directions: 'Get Directions', rsvp: 'Kindly Respond', rsvpIntro: 'Please let us know if you will join us.',
    name: 'Full name', email: 'Email (optional)', phone: 'Phone (optional)', attending: 'Will you attend?', yes: 'Joyfully accepts', no: 'Regretfully declines',
    guests: 'Number of guests', meal: 'Meal preference (optional)', message: 'Your wishes (optional)', submit: 'Send RSVP',
    thanks: 'Thank you for your response. We look forward to celebrating with you.', private: 'Please open your personal invitation link to send your RSVP.',
    wishes: 'Wishes & Guestbook', wishesCopy: 'Leave your warm wishes in the message field when you RSVP.',
    gift: 'A thoughtful gift', giftCopy: 'Your presence is our greatest gift. If you wish, you may share a contribution below.',
    copy: 'Copy payment details', contact: 'Questions? Contact us', footer: 'With love and gratitude, we invite you to celebrate with us.',
    share: 'Share this invitation', copyLink: 'Copy link', copied: 'Invitation link copied.', copyFailed: 'Could not copy automatically. Please copy the invitation link.',
    qrFailed: 'Invitation QR code could not be generated.', photo: 'View photo', close: 'Close photo', storySoon: 'Our story is being written, one beautiful moment at a time.',
    scheduleSoon: 'The ceremony schedule will be shared soon.', locationSoon: 'Venue details will be shared soon.',
  } : {
    open: 'បើកលិខិតអញ្ជើញ', navStory: 'ដំណើរជីវិត', navGallery: 'រូបថត', navSchedule: 'កម្មវិធីពិធី', navVenue: 'ទីតាំង', navRsvp: 'ឆ្លើយតប',
    wedding: 'ពិធីមង្គលការរបស់យើង', countdown: 'រាប់ថយក្រោយដល់ថ្ងៃពិសេស', days: 'ថ្ងៃ', hours: 'ម៉ោង', minutes: 'នាទី', seconds: 'វិនាទី',
    couple: 'ដោយមានការគាំទ្រពីក្រុមគ្រួសារ', story: 'ដំណើរនៃក្តីស្រឡាញ់', gallery: 'អនុស្សាវរីយ៍ដ៏មានន័យ', schedule: 'កម្មវិធីពិធីមង្គលការ',
    venue: 'សូមអញ្ជើញមកចូលរួម', directions: 'មើលផែនទី', rsvp: 'សូមបញ្ជាក់ការចូលរួម', rsvpIntro: 'សូមជម្រាបយើងខ្ញុំថា អ្នកនឹងចូលរួមឬទេ។',
    name: 'ឈ្មោះពេញ', email: 'អ៊ីមែល (មិនចាំបាច់)', phone: 'លេខទូរស័ព្ទ (មិនចាំបាច់)', attending: 'តើអ្នកអាចចូលរួមបានទេ?', yes: 'ចាស/បាទ ខ្ញុំនឹងចូលរួម', no: 'សូមអភ័យទោស មិនអាចចូលរួមបានទេ',
    guests: 'ចំនួនភ្ញៀវ', meal: 'ចំណង់ចំណូលចិត្តអាហារ (មិនចាំបាច់)', message: 'សារជូនពរ (មិនចាំបាច់)', submit: 'ផ្ញើការឆ្លើយតប',
    thanks: 'សូមអរគុណសម្រាប់ការឆ្លើយតប។ យើងខ្ញុំរីករាយក្នុងការជួបអ្នក។', private: 'សូមប្រើតំណអញ្ជើញផ្ទាល់ខ្លួន ដើម្បីផ្ញើការឆ្លើយតប។',
    wishes: 'ពាក្យជូនពរ', wishesCopy: 'សូមសរសេរពាក្យជូនពររបស់អ្នកនៅក្នុងប្រអប់សារពេលឆ្លើយតប។',
    gift: 'កាដូជូនពរ', giftCopy: 'វត្តមានរបស់អ្នកគឺជាកាដូដ៏មានតម្លៃបំផុត។ ប្រសិនបើមានបំណង អ្នកអាចចូលរួមជូនពរតាមរយៈព័ត៌មានខាងក្រោម។',
    copy: 'ចម្លងព័ត៌មានទូទាត់', contact: 'សូមទាក់ទងមកយើងខ្ញុំ', footer: 'ដោយក្តីស្រឡាញ់ និងការដឹងគុណ សូមអញ្ជើញចូលរួមអបអរសាទរជាមួយយើងខ្ញុំ។',
    share: 'ចែករំលែកលិខិតអញ្ជើញ', copyLink: 'ចម្លងតំណ', copied: 'បានចម្លងតំណលិខិតអញ្ជើញ។', copyFailed: 'មិនអាចចម្លងដោយស្វ័យប្រវត្តិបានទេ។ សូមចម្លងតំណដោយដៃ។',
    qrFailed: 'មិនអាចបង្កើត QR លិខិតអញ្ជើញបានទេ។', photo: 'មើលរូបថត', close: 'បិទរូបថត', storySoon: 'រឿងរ៉ាវនៃក្តីស្រឡាញ់របស់យើងកំពុងត្រូវបានសរសេរតាមរយៈអនុស្សាវរីយ៍ដ៏ស្រស់ស្អាត។',
    scheduleSoon: 'កម្មវិធីពិធីនឹងជម្រាបជូនក្នុងពេលឆាប់ៗនេះ។', locationSoon: 'ព័ត៌មានទីតាំងនឹងជម្រាបជូនក្នុងពេលឆាប់ៗនេះ។',
  };
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    QRCode.toDataURL(inviteUrl, { width: 220, margin: 2, color: { dark: '#291b18', light: '#FFF8E7' } })
      .then(setShareQr)
      .catch(() => setNotice(text.qrFailed));
  }, [inviteUrl, text.qrFailed]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const targets = root.querySelectorAll('.cg-reveal');
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach((target, index) => {
      target.style.setProperty('--cg-delay', `${Math.min(index % 4, 3) * 70}ms`);
      if (target.getBoundingClientRect().top < window.innerHeight) target.classList.add('is-visible');
      else observer.observe(target);
    });
    return () => observer.disconnect();
  }, [wedding.slug, opened]);
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') setSelectedPhoto(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);
  useEffect(() => () => window.clearTimeout(entryTimerRef.current), []);
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionMeta = document.querySelector('meta[name="description"]');
    const previousDescription = descriptionMeta?.content;
    document.title = `${wedding.bride} & ${wedding.groom} | Khmer Ceremonial Gold`;
    if (descriptionMeta) descriptionMeta.content = `Celebrate the wedding of ${wedding.bride} and ${wedding.groom}.`;
    return () => {
      document.title = previousTitle;
      if (descriptionMeta && previousDescription) descriptionMeta.content = previousDescription;
    };
  }, [wedding.bride, wedding.groom]);
  const targetDate = wedding.wedding_date ? new Date(`${wedding.wedding_date}T00:00:00`).getTime() : 0;
  const remaining = Math.max(0, targetDate - now);
  const countdown = [
    [Math.floor(remaining / 86400000), text.days],
    [Math.floor((remaining / 3600000) % 24), text.hours],
    [Math.floor((remaining / 60000) % 60), text.minutes],
    [Math.floor((remaining / 1000) % 60), text.seconds],
  ];
  const dateLabel = wedding.wedding_date ? new Date(`${wedding.wedding_date}T12:00:00`).toLocaleDateString(english ? 'en-US' : 'km-KH', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  async function copyText(value, success, failure) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(success);
    } catch {
      setNotice(failure);
    }
  }
  function finishEntry() {
    window.clearTimeout(entryTimerRef.current);
    setOpened(true);
  }
  function openEntry() {
    if (opening) return;
    setOpening(true);
    entryTimerRef.current = window.setTimeout(finishEntry, 1400);
  }
  return <div ref={rootRef} lang={english ? 'en' : 'km'} className={`cg-site ${opened ? 'cg-opened' : ''}`}>
    {!opened && <div className={`cg-entry ${opening ? 'is-opening' : ''}`} onTransitionEnd={(event) => {
      if (opening && event.target.classList.contains('cg-door-left') && event.propertyName === 'transform') finishEntry();
    }}>
      <div className="cg-door cg-door-left" />
      <div className="cg-door cg-door-right" />
      <div className="cg-entry-card cg-frame"><span className="cg-entry-mark">❋</span><p>{text.wedding}</p><h1>{wedding.bride}<br /><i>&amp;</i><br />{wedding.groom}</h1>{dateLabel && 
      <time>{dateLabel}</time>}
      <br />{venue && <span className="cg-entry-venue">{venue}</span>}
      <button type="button" className="cg-button" onClick={openEntry}>{text.open} <span>→</span></button></div>
    </div>}
    <nav className="cg-nav">
      <a className="cg-brand" href="#cg-home">{wedding.bride} <i>❋</i> {wedding.groom}</a>
      <button type="button" className="cg-menu" aria-label={english ? 'Open menu' : 'បើកម៉ឺនុយ'} aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}>☰</button>
      <div className={`cg-links ${menuOpen ? 'is-open' : ''}`} onClick={() => setMenuOpen(false)}><a href="#cg-story">{text.navStory}</a>{photos.length > 0 && <a href="#cg-gallery">{text.navGallery}</a>}<a href="#cg-schedule">{text.navSchedule}</a><a href="#cg-venue">{text.navVenue}</a><a href="#cg-rsvp">{text.navRsvp}</a></div>
      <button type="button" className="cg-language" onClick={() => setEnglish((current) => !current)} aria-label="Toggle language">{english ? 'ខ្មែរ' : 'EN'}</button>
    </nav>
    <section className="cg-hero" id="cg-home">
      <svg className="cg-temple" viewBox="0 0 1440 210" preserveAspectRatio="none" aria-hidden="true"><path d="M0 210h1440v-24h-88v-25h-66v-25h-70v-24h-48v-28h-34v-31h-27V24h-18V5h-12v19h-18v53h-27v31h-34v28h-49v24h-70v25h-66v25h-64v-25h-66v-25h-70v-24h-49v-28h-34v-31h-27V24h-18V5h-12v19h-18v53h-27v31h-34v28h-49v24h-70v25h-66v25H0z" /></svg>
      <div className="cg-hero-card cg-frame"><span className="cg-mark">❋</span><span className="cg-kicker">KHMER CEREMONIAL · ពិធីមង្គលការខ្មែរ</span><p className="cg-hero-small">{text.couple}</p><h1>{wedding.bride}<span>&amp;</span>{wedding.groom}</h1><p className="cg-english-name">{wedding.bride} &amp; {wedding.groom}</p><svg className="cg-ornament" viewBox="0 0 220 30" aria-hidden="true"><path d="M4 15h77l12-9 17 18 17-18 12 9h77M95 15h30M105 5l5-4 5 4-5 4zM105 25l5 4 5-4-5-4z" /></svg><p>{text.wedding}</p>{dateLabel && <time>{dateLabel}</time>}{venue && <span className="cg-hero-venue">{venue}</span>}<a className="cg-button cg-button-link" href="#cg-rsvp">{text.navRsvp}<span>↓</span></a></div>
      <a className="cg-scroll" href="#cg-countdown" aria-label={english ? 'Scroll down' : 'អូសចុះក្រោម'}>⌄</a>
    </section>
    <section className="cg-section cg-countdown-section" id="cg-countdown">
      <div className="cg-section-head cg-reveal"><span className="cg-eyebrow">{text.countdown}</span><h2>{dateLabel || text.wedding}</h2><svg className="cg-ornament" viewBox="0 0 220 30" aria-hidden="true"><path d="M4 15h77l12-9 17 18 17-18 12 9h77" /></svg></div>
      <div className="cg-countdown">{countdown.map(([value, label]) => 
        <div className="cg-count-card cg-reveal" key={label}><strong key={`${label}-${value}`}>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>)}</div></section>
    <section className="cg-section cg-couple-section">
      <div className="cg-section-head cg-reveal"><span className="cg-eyebrow">{text.couple}</span><h2>{wedding.bride} <i>&amp;</i> {wedding.groom}</h2></div>
      <div className="cg-couple-cards">{[0, 1].map((index) => { const name = index === 0 ? wedding.bride : wedding.groom; const photo = photos[index]; return <article className="cg-person cg-frame cg-reveal" key={`${name}-${index}`}>{photo ? <img src={photo.url} alt={photo.name || name} loading="lazy" /> : 
      <div className="cg-person-placeholder" aria-hidden="true">❋</div>}<h3>{name}</h3><p>{index === 0 ? (english ? 'The Bride' : 'កូនក្រមុំ') : (english ? 'The Groom' : 'កូនកំលោះ')}</p></article>; })}</div></section>
    <section className="cg-section cg-story-section" id="cg-story"><div className="cg-section-head cg-reveal"><span className="cg-eyebrow">OUR JOURNEY · ដំណើរនៃក្តីស្រឡាញ់</span><h2>{text.story}</h2></div><div className="cg-timeline">{timeline.length ? timeline.map((item, index) => { const photo = photos.find((entry) => entry.id === item.photo_media_id); return <article className="cg-moment cg-reveal" key={`${item.title}-${index}`}><span className="cg-moment-number">{String(index + 1).padStart(2, '0')}</span><div>{item.date && <time>{item.date}</time>}<h3>{item.title}</h3>{item.description && <p>{item.description}</p>}{photo && <button type="button" className="cg-moment-photo" onClick={() => setSelectedPhoto(photo)}><img src={photo.url} alt={photo.name} loading="lazy" /></button>}</div></article>; }) : <article className="cg-moment cg-reveal"><span className="cg-moment-number">❋</span><p>{wedding.story || text.storySoon}</p></article>}</div></section>
    {photos.length > 0 && <section className="cg-section cg-gallery-section" id="cg-gallery"><div className="cg-section-head cg-reveal"><span className="cg-eyebrow">MEMORIES · អនុស្សាវរីយ៍</span><h2>{text.gallery}</h2></div><div className="cg-gallery">{photos.map((photo, index) => <button type="button" className={`cg-gallery-photo cg-gallery-photo-${index % 5} cg-reveal`} key={photo.id} onClick={() => setSelectedPhoto(photo)} aria-label={`${text.photo}: ${photo.name}`}><img src={photo.url} alt={photo.name} loading="lazy" /><span>{photo.name}</span></button>)}</div></section>}
    <section className="cg-section cg-schedule-section" id="cg-schedule"><div className="cg-section-head cg-reveal"><span className="cg-eyebrow">SACRED MOMENTS · ពិធីប្រពៃណីខ្មែរ</span><h2>{text.schedule}</h2></div>{schedule.length ? <div className="cg-events">{schedule.map((item, index) => <article className="cg-event cg-reveal" key={`${item.name}-${index}`}><span className="cg-event-icon">{['❋', '❀', '♡', '♬'][index % 4]}</span><div><h3>{item.name}</h3>{item.description && <p>{item.description}</p>}{item.location && <span>⌖ &nbsp;{item.location}</span>}</div><time>{[item.date, item.time].filter(Boolean).join(' · ')}</time></article>)}</div> : <p className="cg-empty cg-reveal">{text.scheduleSoon}</p>}</section>
    <section className="cg-venue-section" id="cg-venue"><div className="cg-venue-copy cg-reveal"><span className="cg-eyebrow">THE CELEBRATION · ពិធីអបអរសាទរ</span><h2>{text.venue}</h2><h3>{wedding.venue || text.locationSoon}</h3>{wedding.address && <p>{wedding.address}</p>}{wedding.parking_info && <p className="cg-parking">{wedding.parking_info}</p>}{venue && <a className="cg-button cg-button-dark" href={directionsUrl} target="_blank" rel="noreferrer">{text.directions} ↗</a>}</div>{venue ? <iframe className="cg-map cg-reveal" title={english ? 'Wedding venue map' : 'ផែនទីទីតាំងមង្គលការ'} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://maps.google.com/maps?q=${encodeURIComponent(venue)}&output=embed`} /> : <div className="cg-map cg-map-empty cg-reveal">⌖</div>}</section>
    <section className="cg-section cg-rsvp-section" id="cg-rsvp"><div className="cg-section-head cg-reveal"><span className="cg-eyebrow">YOUR PRESENCE IS OUR GREATEST GIFT</span><h2>{text.rsvp}</h2><p>{text.rsvpIntro}</p></div>{sent ? <div className="cg-success cg-frame"><span>❋</span><h3>{text.thanks}</h3></div> : invitedGuest || preview ? <form className="cg-form cg-frame" onSubmit={submit}><label>{text.name}<input required minLength="2" maxLength="120" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>{text.email}<input type="email" maxLength="254" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>{text.phone}<input type="tel" maxLength="40" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>{text.attending}<select value={String(form.attending)} onChange={(event) => setForm({ ...form, attending: event.target.value === 'true', attendees: event.target.value === 'true' ? 1 : 0 })}><option value="true">{text.yes}</option><option value="false">{text.no}</option></select></label>{form.attending && <><label>{text.guests}<input type="number" min="1" max={invitedGuest?.party_size || 20} value={form.attendees} onChange={(event) => setForm({ ...form, attendees: event.target.value })} /></label><label>{text.meal}<input maxLength="120" value={form.meal_preference} onChange={(event) => setForm({ ...form, meal_preference: event.target.value })} /></label></>}<label className="cg-form-wide">{text.message}<textarea rows="4" maxLength="500" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>{error && <p className="cg-form-error" role="alert">{error}</p>}<button className="cg-button cg-button-dark cg-form-wide" disabled={busy}>{busy ? (english ? 'Sending…' : 'កំពុងផ្ញើ…') : text.submit} →</button></form> : <p className="cg-private cg-frame">{text.private}</p>}</section>
    <section className="cg-section cg-wishes-section"><div className="cg-wishes-card cg-frame cg-reveal"><span className="cg-mark">♡</span><span className="cg-eyebrow">{text.wishes}</span><h2>{text.wishesCopy}</h2><a className="cg-button cg-button-dark" href="#cg-rsvp">{text.navRsvp} ↓</a></div></section>
    {(paymentQr || wedding.gift_payment_info) && <section className="cg-section cg-gift-section" id="cg-gift"><div className="cg-section-head cg-reveal"><span className="cg-eyebrow">WITH GRATITUDE · ដោយក្តីដឹងគុណ</span><h2>{text.gift}</h2><p>{text.giftCopy}</p></div><div className="cg-gift-card cg-frame cg-reveal">{paymentQr && <img className="cg-gift-qr" src={paymentQr.url} alt={english ? 'Gift payment QR code' : 'QR សម្រាប់ផ្ញើជាកាដូជូនពរ'} />}{wedding.gift_payment_info && <><pre>{wedding.gift_payment_info}</pre><button type="button" className="cg-button cg-button-dark" onClick={() => copyText(wedding.gift_payment_info, english ? 'Payment details copied.' : 'បានចម្លងព័ត៌មានទូទាត់។', english ? 'Could not copy payment details.' : 'មិនអាចចម្លងព័ត៌មានបានទេ។')}>{text.copy}</button></>}</div></section>}
    <section className="cg-share-section"><div className="cg-share-copy"><span className="cg-eyebrow">{text.share}</span><h2>{wedding.bride} &amp; {wedding.groom}</h2><button type="button" className="cg-button" onClick={() => copyText(inviteUrl, text.copied, text.copyFailed)}>{text.copyLink}</button><button type="button" className="cg-text-button" onClick={() => window.print()}>{english ? 'Print invitation' : 'បោះពុម្ពលិខិតអញ្ជើញ'}</button>{calendarUrl && <a className="cg-text-button" href={calendarUrl} download="wedding-invitation.ics">{english ? 'Add to calendar' : 'បន្ថែមទៅប្រតិទិន'}</a>}<div className="cg-social"><a href={`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}`} target="_blank" rel="noreferrer">Telegram ↗</a><a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteUrl)}`} target="_blank" rel="noreferrer">Facebook ↗</a></div></div>{shareQr && <img className="cg-share-qr" src={shareQr} alt={english ? 'Invitation QR code' : 'QR សម្រាប់ចែករំលែកលិខិតអញ្ជើញ'} />}</section>
    {(wedding.contact_phone || wedding.contact_telegram) && <section className="cg-contact"><span className="cg-eyebrow">{text.contact}</span><div>{wedding.contact_phone && <a href={`tel:${wedding.contact_phone}`}>{wedding.contact_phone}</a>}{wedding.contact_telegram && <a href={wedding.contact_telegram} target="_blank" rel="noreferrer">Telegram ↗</a>}</div></section>}
    <footer className="cg-footer"><span className="cg-mark">❋</span><p>{text.footer}</p><h2>{wedding.bride} <i>&amp;</i> {wedding.groom}</h2><span>KHMER CEREMONIAL · ពិធីមង្គលការខ្មែរ</span></footer>
    {notice && <div className="cg-notice" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label={english ? 'Dismiss' : 'បិទ'}>×</button></div>}
    {selectedPhoto && <div className="cg-lightbox" role="dialog" aria-modal="true" aria-label={text.photo} onClick={() => setSelectedPhoto(null)}><button type="button" onClick={() => setSelectedPhoto(null)} aria-label={text.close}>×</button><img src={selectedPhoto.url} alt={selectedPhoto.name} /></div>}
  </div>;
}

export default App;
