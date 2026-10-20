import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
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
const blankWedding = { title: 'Our Wedding', bride: '', groom: '', wedding_date: '', venue: '', address: '', maps_url: '', story: '', template: 'The Botanica', primary_color: '#9a7359' };

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
              {active === 'gallery' && <MediaStudio wedding={wedding} token={token} onChange={loadWeddings} onToast={showToast} />}
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
  useEffect(() => setForm({ ...blankWedding, ...wedding }), [wedding.id]);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const submit = async (event) => { event.preventDefault(); await onSave(form); };
  return <><PageHeading eyebrow="THE DETAILS THAT MAKE IT YOURS" title="Tell your story." description="The little things your favorite people will want to know." actions={<button className="button button-dark" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <span>→</span></button>} />
    <form className="editor-layout" onSubmit={submit}>
      <div className="panel editor-panel"><div className="editor-section-heading"><span className="editor-number">01</span><div><h3>The two of you</h3><p>Start with the names at the heart of it all.</p></div></div><div className="form-grid"><label>Partner one<input required maxLength="100" placeholder="e.g. Sophie" value={form.bride} onChange={update('bride')} /></label><label>Partner two<input required maxLength="100" placeholder="e.g. James" value={form.groom} onChange={update('groom')} /></label><label className="full-field">A title for your invitation<input maxLength="120" placeholder="Sophie & James — we’re getting married!" value={form.title} onChange={update('title')} /></label></div></div>
      <div className="panel editor-panel"><div className="editor-section-heading"><span className="editor-number">02</span><div><h3>Save the date</h3><p>We promise, this is the one they won’t forget.</p></div></div><div className="form-grid"><label>Wedding date<input type="date" value={form.wedding_date} onChange={update('wedding_date')} /></label><label>Your venue<input maxLength="200" placeholder="e.g. The Rosewood Garden" value={form.venue} onChange={update('venue')} /></label><label className="full-field">Address<textarea rows="2" maxLength="500" placeholder="Street, city, country" value={form.address} onChange={update('address')} /></label><label className="full-field">Google Maps link<input type="url" maxLength="500" placeholder="https://maps.google.com/…" value={form.maps_url} onChange={update('maps_url')} /></label></div></div>
      <div className="panel editor-panel"><div className="editor-section-heading"><span className="editor-number">03</span><div><h3>A little about your love</h3><p>Let the people you love get to know your story.</p></div></div><label>Your story<textarea rows="5" maxLength="5000" placeholder="Tell them about the little moments that brought you here…" value={form.story} onChange={update('story')} /></label><div className="character-count">{form.story.length} / 5,000 characters</div></div>
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
      {filtered.length ? <div className="table-scroll"><table className="guest-table"><thead><tr><th>GUEST</th><th>GROUP</th><th>INVITED</th><th>RSVP</th><th>CHECK-IN</th><th></th></tr></thead><tbody>{filtered.map((guest, i) => <tr data-guest-status={guest.rsvp} key={guest.id}><td><span className={`table-guest-avatar avatar-tone-${i % 4}`}>{initials(guest.name)}</span><span className="table-guest-name">{guest.name}<small>{guest.email || guest.phone || 'No contact details yet'}</small></span></td><td>{guest.category}</td><td>{guest.party_size}</td><td><select aria-label={`RSVP status for ${guest.name}`} className={`rsvp-select ${guest.rsvp.toLowerCase()}`} value={guest.rsvp} onChange={(event) => updateGuest(guest, { rsvp: event.target.value, attendees: event.target.value === 'Attending' ? Math.max(1, guest.attendees || 1) : 0 })}><option>Pending</option><option>Attending</option><option>Declined</option><option>Maybe</option></select></td><td><button className={`checkin-button ${guest.checked_in ? 'checked' : ''}`} onClick={() => updateGuest(guest, { checked_in: !Boolean(guest.checked_in) })}>{guest.checked_in ? '✓ Here' : 'Check in'}</button></td><td><div className="guest-row-actions"><button className="copy-guest-link" title={`Copy personal invitation for ${guest.name}`} onClick={() => copyGuestInvite(guest)}>↗</button><button className="row-delete" title={`Remove ${guest.name}`} onClick={() => removeGuest(guest)}>×</button></div></td></tr>)}</tbody></table></div> : <div className="gentle-empty"><span className="empty-icon">♧</span><strong>No guests just yet</strong><span>Your favorite people will feel right at home here.</span><button className="button button-outline" onClick={() => setShowForm(true)}>Add your first guest →</button></div>}
    </div>
  </>;
}

function TemplateStudio({ wedding, onApply }) {
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('All the good things');
  useEffect(() => { api('/templates').then((data) => setTemplates(data.templates)).catch((cause) => setError(cause.message)); }, []);
  const thumbs = [imageSet[0], imageSet[1], imageSet[2], imageSet[1], imageSet[0], imageSet[2]];
  const categories = ['All the good things', 'Romantic', 'Classic', 'Garden', 'Modern', 'Khmer Luxury'];
  const visibleTemplates = category === 'All the good things' ? templates : templates.filter((template) => template.category === category);
  return <><PageHeading eyebrow="A FEELING, NOT JUST A DESIGN" title="Find your kind of beautiful." description="Thoughtful little worlds, made ready for your very big day." actions={<span className="template-count">✳ &nbsp; {templates.length} love notes to choose from</span>} />{error && <div className="error-banner">{error}</div>}
    <div className="template-feature"><div><span className="eyebrow">YOUR CURRENT CHAPTER</span><h3>{wedding?.template || 'The Botanica'}</h3><p>All your details stay right where they belong — only the look changes.</p></div><button className="button button-light" onClick={() => document.querySelector('#template-grid')?.scrollIntoView({ behavior: 'smooth' })}>Explore every design ↓</button><span className="template-feature-flower">✳</span></div>
    <div className="template-filters">{categories.map((item) => <button key={item} className={`filter-chip ${category === item ? 'selected' : ''}`} onClick={() => setCategory(item)}>{item}{item === 'All the good things' && <span>{templates.length}</span>}</button>)}</div>
    <div className="template-grid" id="template-grid">{visibleTemplates.map((template) => { const i = templates.indexOf(template); return <article className="template-card" key={template.name}><div className="template-image" style={{ backgroundImage: `linear-gradient(180deg, transparent 62%, rgba(38,31,26,.2)), url("${thumbs[i]}")` }}><span className="template-category">{template.category}</span><div className="template-image-names" style={{ fontFamily: 'Georgia, serif' }}>A & J<small>are getting married</small></div><button className="template-preview-button" onClick={() => window.open(thumbs[i], '_blank', 'noopener,noreferrer')} aria-label={`Preview ${template.name}`}>↗</button></div><div className="template-card-copy"><div><h3>{template.name}</h3><span>Made for the moments that matter</span></div><button className={`template-apply ${wedding?.template === template.name ? 'applied' : ''}`} onClick={() => onApply(template.name, template.color)}>{wedding?.template === template.name ? '✓ Yours' : 'Choose design'}</button></div></article>; })}</div>
  </>;
}

function MediaStudio({ wedding, token, onChange, onToast }) {
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
  return <><PageHeading eyebrow="THE MOMENTS YOU WANT TO KEEP" title="Little memories, gathered." description="A home for the photographs, sounds and moving pictures that tell your story." actions={<><button className="button button-outline" onClick={() => inputRef.current?.click()}>＋ &nbsp; Add media</button><input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/mp4" onChange={(event) => upload(event.target.files?.[0])} /></>} />
    <div className="upload-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); upload(event.dataTransfer.files?.[0]); }}><div className="upload-icon">↑</div><strong>{busy ? 'Tucking your memory in safely…' : 'Drop something lovely right here'}</strong><span>Photos, films and music · JPEG, PNG, WebP, MP4, MP3 · up to 25 MB each</span><button className="text-link" onClick={() => inputRef.current?.click()}>Choose a file from your device →</button></div>
    {error && <div className="error-banner">{error}<button onClick={() => setError('')}>×</button></div>}
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
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [wedding, setWedding] = useState(null);
  const [invitedGuest, setInvitedGuest] = useState(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', attending: true, attendees: 1, message: '' });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const params = new URLSearchParams(location.search);
  const invitationToken = params.get('guest') || '';
  const isPreview = params.get('preview') === '1';
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
        setWedding(data.wedding);
        setInvitedGuest(data.invited_guest);
        setPreview(isPreview);
        if (data.invited_guest) setForm((current) => ({ ...current, name: data.invited_guest.name, attendees: Math.min(current.attendees, data.invited_guest.party_size) }));
        if (!isPreview && data.wedding.slug !== slug) {
          const canonicalUrl = `/invite/${encodeURIComponent(data.wedding.slug)}${invitationToken ? `?guest=${encodeURIComponent(invitationToken)}` : ''}`;
          navigate(canonicalUrl, { replace: true });
        }
      })
      .catch((cause) => setError(cause.message));
  }, [slug, invitationToken, isPreview, navigate]);
  async function submit(event) {
    if (preview) { event.preventDefault(); setError('This is a private preview. Publish your website before collecting RSVPs.'); return; }
    event.preventDefault(); setBusy(true); setError('');
    try { await api(`/public/${slug}/rsvp`, { method: 'POST', body: JSON.stringify({ ...form, attendees: Number(form.attendees), invitation_token: invitationToken }) }); setSent(true); } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  if (error && !wedding) return <div className="invitation-error"><Brand /><span>♡</span><h1>A little invitation, not found.</h1><p>{error}</p><Link to="/">Visit Ever After</Link></div>;
  if (!wedding) return <div className="loading-screen"><Brand />A moment, while we find your invitation…</div>;
  const date = prettyDate(wedding.wedding_date);
  return <main className="public-invitation" style={{ '--invite-accent': wedding.primary_color }}>
    {preview && <aside className="invitation-preview-banner"><span>PRIVATE PREVIEW</span><strong>{wedding.published ? 'This is your published invitation.' : 'This is a draft; publish it before sharing with guests.'}</strong><Link to="/">Back to studio</Link></aside>}
    <div className="invitation-topbar"><Brand /><span>PLEASE JOIN US FOR OUR WEDDING</span><a href="#rsvp">KINDLY REPLY <span>↓</span></a></div>
    <section className="invitation-cover" style={{ backgroundImage: `linear-gradient(0deg, rgba(31,27,24,.42), rgba(31,27,24,.04) 72%), url("${wedding.media?.find((item) => item.type === 'image')?.url || imageSet[0]}")` }}><span className="invitation-overline">WITH FULL HEARTS AND SO MUCH JOY</span><h1>{wedding.bride}<br /><i>&</i> {wedding.groom}</h1><span className="invitation-rule">✳</span><p>{date.toUpperCase()}</p><a className="cover-scroll" href="#welcome">SCROLL TO CELEBRATE <span>↓</span></a></section>
    <section className="invitation-intro" id="welcome"><span className="eyebrow">TO OUR FAVORITE PEOPLE</span><h2>We’re getting married.<br /><i>And we’d love you there.</i></h2><span className="flourish">❧</span>{wedding.story && <p>{wedding.story}</p>}<span className="intro-names">{wedding.bride} & {wedding.groom}</span></section>
    {wedding.media?.filter((item) => item.type === 'image').length > 0 && <section className="invitation-gallery">{wedding.media.filter((item) => item.type === 'image').slice(0, 3).map((item) => <img key={item.id} src={item.url} alt={item.name} />)}</section>}
    {wedding.media?.some((item) => item.type !== 'image') && <section className="invitation-media"><span className="eyebrow">A LITTLE MORE OF OUR STORY</span><h2>Sounds & moving pictures.</h2><div className="invitation-media-grid">{wedding.media.filter((item) => item.type !== 'image').map((item) => item.type === 'video' ? <figure key={item.id}><video src={item.url} controls preload="metadata" /><figcaption>{item.name}</figcaption></figure> : <figure key={item.id}><figcaption>♫ &nbsp; {item.name}</figcaption><audio src={item.url} controls preload="none" /></figure>)}</div></section>}
    <section className="invitation-details"><span className="eyebrow">SAVE THE DATE</span><h2>The day we say <i>“I do”</i></h2><div className="detail-card"><span className="detail-calendar">♡</span><h3>{date}</h3>{wedding.venue && <p>{wedding.venue}</p>}{wedding.address && <span>{wedding.address}</span>}{wedding.maps_url && <a className="button button-dark" target="_blank" rel="noreferrer" href={wedding.maps_url}>Find your way here ↗</a>}</div></section>
    <section className="invitation-rsvp" id="rsvp"><span className="eyebrow">WE HOPE YOU CAN BE THERE</span><h2>Will you join us<br /><i>for the beginning?</i></h2>{sent ? <div className="rsvp-thanks"><span>♡</span><h3>How lovely to hear from you.</h3><p>Thank you for letting us know. We can’t wait to celebrate together.</p></div> : invitedGuest || preview ? <form className="rsvp-form" onSubmit={submit}><label>Your name<input required minLength="2" maxLength="120" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="The name we know you by" /></label><label>Email address <span className="optional-label">OPTIONAL</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="For the occasional little update" /></label><label>Can we save you a seat?<select value={String(form.attending)} onChange={(event) => setForm({ ...form, attending: event.target.value === 'true', attendees: event.target.value === 'true' ? 1 : 0 })}><option value="true">Yes, I’ll be there with bells on!</option><option value="false">I’m so sorry to miss it.</option></select></label>{form.attending && <label>How many will be celebrating?<input type="number" min="1" max={invitedGuest?.party_size || 20} value={form.attendees} onChange={(event) => setForm({ ...form, attendees: event.target.value })} /></label>}<label>A little note for the happy couple <span className="optional-label">OPTIONAL</span><textarea rows="3" maxLength="500" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Anything you’d like us to know…" /></label>{error && <p className="form-error">{error}</p>}<button className="button button-dark button-wide" disabled={busy}>{preview ? 'Preview only — RSVPs are not sent' : busy ? 'Sending your reply…' : 'Send our reply with love'} <span>→</span></button></form> : <div className="rsvp-link-note"><span>♡</span><p>To keep each invitation personal, please open the link shared directly with you. If you need your RSVP link, just ask the happy couple.</p></div>}</section>
    <footer className="invitation-footer"><span>WITH LOVE,</span><h2>{wedding.bride} & {wedding.groom}</h2><div>MADE WITH A LITTLE MAGIC BY <a href="/">EVER AFTER</a></div></footer>
  </main>;
}

export default App;
