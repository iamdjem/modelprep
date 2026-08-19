import { useState } from 'react';
import {
  Box, FileText, Globe, Send, Library, Plug, Settings, Palette,
  Check, AlertTriangle, XCircle, Plus, Upload, ChevronsUpDown,
  Image as ImageIcon, Clock, CircleDashed, Search, MoreHorizontal, X,
} from 'lucide-react';
import { PROJECT, FILES, IMAGES, LISTING, PLATFORMS, PUBLISH_ROWS, PREFLIGHT } from './data.js';

// =====================================================================
// Shared bits
// =====================================================================

function PuckThumb({ tone = 'model' }) {
  const stroke = tone === 'project' ? 'var(--info)' : 'var(--ink-tertiary)';
  return (
    <div aria-hidden className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border" style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3.2" stroke={stroke} strokeWidth="1.4" />
        <path d="M12 4v2.4M12 17.6V20M4 12h2.4M17.6 12H20" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function StateBadge({ state }) {
  if (state === 'ready' || state === 'pass' || state === 'done') return <span className="badge badge-success"><Check size={11} strokeWidth={2.6} />{state === 'done' ? 'Published' : 'Ready'}</span>;
  if (state === 'attention' || state === 'warn') return <span className="badge badge-warning"><AlertTriangle size={11} strokeWidth={2.4} />Review</span>;
  if (state === 'fail' || state === 'blocked') return <span className="badge badge-danger"><XCircle size={11} strokeWidth={2.4} />Blocked</span>;
  if (state === 'uploading') return <span className="badge badge-primary"><Upload size={11} strokeWidth={2.4} />Uploading</span>;
  return <span className="badge"><Clock size={11} strokeWidth={2.2} />Queued</span>;
}

function PlatformDot({ color }) {
  return <span aria-hidden className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: color }} />;
}

function ScreenHeader({ title, description, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-xl">
        <h1 className="t-title-lg">{title}</h1>
        {description && <p className="t-secondary mt-1">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2 pt-1">{children}</div>}
    </div>
  );
}

// =====================================================================
// Screens
// =====================================================================

function PackageScreen() {
  return (
    <>
      <ScreenHeader title="Package" description="The files that ship with this model. ModelPrep routes each file to the platforms that accept it.">
        <button className="btn btn-secondary"><Plus size={15} />Add files</button>
      </ScreenHeader>

      <div className="card mb-4 flex items-start gap-3 p-4" style={{ background: 'var(--warning-tint)', borderColor: 'transparent' }}>
        <AlertTriangle size={16} style={{ color: 'var(--warning)', marginTop: 2 }} />
        <div className="min-w-0">
          <div className="t-label">The bundled 3MF is not sliced</div>
          <p className="t-body-sm t-secondary mt-0.5">It has no printer or plate metadata, so it uploads as a plain model file. Platforms that want a print profile will show it under model files instead.</p>
        </div>
        <button className="btn btn-ghost btn-sm ml-auto flex-shrink-0">Learn more</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="table" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th>File</th>
              <th>Role</th>
              <th className="t-num">Size</th>
              <th>Geometry</th>
              <th>Status</th>
              <th aria-label="Row actions" />
            </tr>
          </thead>
          <tbody>
            {FILES.map((f) => (
              <tr key={f.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <PuckThumb tone={f.kind === 'Project' ? 'project' : 'model'} />
                    <div className="min-w-0">
                      <div className="t-label truncate">{f.name}</div>
                      <div className="t-body-sm t-tertiary">{f.format} · {f.tris}</div>
                    </div>
                  </div>
                </td>
                <td><span className="badge">{f.kind}</span></td>
                <td className="t-num t-secondary">{f.size}</td>
                <td className="t-secondary">{f.dims}</td>
                <td><StateBadge state={f.status} /></td>
                <td className="text-right">
                  <button className="btn btn-ghost btn-sm" aria-label={`Actions for ${f.name}`}><MoreHorizontal size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-5 t-secondary transition-colors"
        style={{ borderColor: 'var(--border-strong)' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-sunken)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <Upload size={15} />
        Drop STL, 3MF, OBJ, or STEP files here, or browse
      </button>
    </>
  );
}

function ListingScreen() {
  const [tags, setTags] = useState(LISTING.tags);
  return (
    <>
      <ScreenHeader title="Listing" description="One listing, adapted to every destination. Fields that a platform limits or drops are flagged before publish." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid content-start gap-5">
          <div className="field">
            <label className="t-label" htmlFor="listing-title">Title</label>
            <input id="listing-title" className="input" defaultValue={LISTING.title} />
            <div className="field-hint">67 of 255 characters. Fits every enabled platform.</div>
          </div>
          <div className="field">
            <label className="t-label" htmlFor="listing-summary">Summary</label>
            <textarea id="listing-summary" className="textarea" defaultValue={LISTING.summary} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="field">
              <label className="t-label" htmlFor="listing-license">License</label>
              <select id="listing-license" className="select" defaultValue={LISTING.license}>
                <option>CC BY-NC 4.0</option>
                <option>CC BY 4.0</option>
                <option>CC0 1.0</option>
              </select>
            </div>
            <div className="field">
              <label className="t-label" htmlFor="listing-category">Category</label>
              <select id="listing-category" className="select" defaultValue={LISTING.category}>
                <option>Testing models</option>
                <option>Tools</option>
                <option>Gadgets</option>
              </select>
            </div>
          </div>
          <div className="field">
            <span className="t-label">Tags</span>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border p-2" style={{ borderColor: 'var(--border-strong)' }}>
              {tags.map((tag) => (
                <span key={tag} className="badge">
                  {tag}
                  <button aria-label={`Remove tag ${tag}`} className="-mr-1 flex items-center rounded-full p-0.5 hover:opacity-70" onClick={() => setTags(tags.filter((t) => t !== tag))}>
                    <X size={10} strokeWidth={2.6} />
                  </button>
                </span>
              ))}
              <input aria-label="Add tag" className="min-w-24 flex-1 border-none text-sm outline-none" placeholder="Add tag…" style={{ background: 'transparent', color: 'var(--ink)' }} />
            </div>
            <div className="field-hint">Platforms cap tags differently; the strictest is Nexprint at 6. You are at {tags.length}.</div>
          </div>
        </div>

        <aside className="grid content-start gap-3">
          <div className="flex items-center justify-between">
            <h2 className="t-title-sm">Media</h2>
            <button className="btn btn-ghost btn-sm"><Plus size={13} />Add</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {IMAGES.map((img) => (
              <figure key={img.id} className="relative m-0">
                <div className="flex aspect-square items-center justify-center rounded-md border" style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}>
                  <ImageIcon size={16} style={{ color: 'var(--ink-tertiary)' }} />
                </div>
                {img.cover && <span className="badge badge-primary absolute left-1 top-1" style={{ height: 18, fontSize: 10, padding: '0 6px' }}>Cover</span>}
                <figcaption className="t-body-sm t-tertiary mt-1 truncate">{img.label}</figcaption>
              </figure>
            ))}
          </div>
          <p className="t-body-sm t-tertiary">Ten images uploaded. The first is the cover everywhere; MakerWorld and Creality also get sized crops automatically.</p>
        </aside>
      </div>
    </>
  );
}

function DestinationsScreen() {
  const [platforms, setPlatforms] = useState(PLATFORMS);
  const toggle = (id) => setPlatforms(platforms.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)));
  const enabled = platforms.filter((p) => p.enabled).length;
  return (
    <>
      <ScreenHeader title="Destinations" description={`Publishing to ${enabled} of ${platforms.length} platforms. Options that differ per platform live behind each row.`}>
        <button className="btn btn-secondary"><Plug size={15} />Manage connections</button>
      </ScreenHeader>
      <div className="card">
        <ul className="m-0 list-none p-0">
          {platforms.map((p, i) => (
            <li key={p.id} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--surface-sunken)]" style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
              <button
                role="switch"
                aria-checked={p.enabled}
                aria-label={`Publish to ${p.name}`}
                className="switch"
                onClick={() => toggle(p.id)}
              />
              <PlatformDot color={p.dot} />
              <div className="min-w-0 flex-1">
                <div className="t-label">{p.name}</div>
                <div className="t-body-sm t-tertiary">{p.org}</div>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                {p.account
                  ? <span className="t-body-sm t-secondary">{p.account}</span>
                  : <button className="btn btn-ghost btn-sm">Connect account</button>}
              </div>
              <div className="w-40 whitespace-nowrap text-right">
                {p.enabled && p.ready && <StateBadge state="ready" />}
                {p.enabled && !p.ready && p.note && <span className="badge badge-warning"><AlertTriangle size={11} strokeWidth={2.4} />{p.note}</span>}
                {!p.enabled && <span className="t-body-sm t-tertiary">Off</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function PublishScreen() {
  const passCount = PREFLIGHT.filter((c) => c.state === 'pass').length;
  return (
    <>
      <ScreenHeader title="Review and publish" description="Preflight runs against every enabled destination. Anything blocked is skipped and reported, never retried silently.">
        <button className="btn btn-secondary"><Clock size={15} />Schedule</button>
        <button className="btn btn-primary"><Send size={15} />Publish 5 ready</button>
      </ScreenHeader>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <section aria-label="Preflight checks" className="card card-pad content-start">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="t-title-sm">Preflight</h2>
            <span className="t-body-sm t-tertiary t-num">{passCount} of {PREFLIGHT.length} passing</span>
          </div>
          <ul className="m-0 grid list-none gap-3 p-0">
            {PREFLIGHT.map((check) => (
              <li key={check.id} className="flex gap-2.5">
                {check.state === 'pass' && <Check size={15} strokeWidth={2.6} style={{ color: 'var(--success)', marginTop: 2, flexShrink: 0 }} />}
                {check.state === 'warn' && <AlertTriangle size={15} strokeWidth={2.3} style={{ color: 'var(--warning)', marginTop: 2, flexShrink: 0 }} />}
                {check.state === 'fail' && <XCircle size={15} strokeWidth={2.3} style={{ color: 'var(--danger)', marginTop: 2, flexShrink: 0 }} />}
                <div className="min-w-0">
                  <div className="t-body-sm" style={{ fontWeight: 500 }}>{check.label}</div>
                  <div className="t-body-sm t-tertiary">{check.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Publish queue" className="card">
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="t-title-sm">Queue</h2>
            <span className="t-body-sm t-tertiary">Drafts stay private until you publish on each platform</span>
          </div>
          <ul className="m-0 list-none p-0">
            {PUBLISH_ROWS.map((row, i) => (
              <li key={row.id} className="px-4 py-3" style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <PlatformDot color={row.dot} />
                  <span className="t-label w-36 flex-shrink-0">{row.name}</span>
                  <span className="t-body-sm t-secondary min-w-0 flex-1 truncate">{row.detail}</span>
                  <StateBadge state={row.state} />
                </div>
                {row.state === 'uploading' && (
                  <div className="progress mt-2.5" role="progressbar" aria-valuenow={row.progress} aria-valuemin={0} aria-valuemax={100}>
                    <div style={{ width: `${row.progress}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function SystemScreen() {
  const colors = [
    ['--primary', 'Primary', 'Actions, selection, progress'],
    ['--ink', 'Ink', 'Primary text'],
    ['--ink-secondary', 'Ink secondary', 'Supporting text, 7.2:1'],
    ['--ink-tertiary', 'Ink tertiary', 'Hints and captions, 4.9:1'],
    ['--border', 'Border', 'Hairlines and dividers'],
    ['--surface-sunken', 'Surface sunken', 'Sidebar, table hover'],
    ['--success', 'Success', 'Ready, published'],
    ['--warning', 'Warning', 'Needs review'],
    ['--danger', 'Danger', 'Blocked, destructive'],
    ['--info', 'Info', 'Neutral notices'],
  ];
  return (
    <>
      <ScreenHeader title="Design system" description="One family (Inter), a moss-green primary, pure white ground, 4 px spacing grid. Everything below is a token; no raw hex in screens." />
      <div className="grid content-start gap-8">
        <section>
          <h2 className="t-title-sm mb-3">Color</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {colors.map(([token, name, use]) => (
              <div key={token} className="card overflow-hidden">
                <div style={{ height: 44, background: `var(${token})` }} />
                <div className="px-2.5 py-2">
                  <div className="t-body-sm" style={{ fontWeight: 500 }}>{name}</div>
                  <div className="t-body-sm t-tertiary" style={{ fontSize: 11 }}>{use}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="t-title-sm mb-3">Type scale</h2>
          <div className="card card-pad grid gap-3">
            <div className="t-title-lg">Title large · 26/600 for screen titles</div>
            <div className="t-title">Title · 21/600 for dialogs and cards</div>
            <div className="t-title-sm">Title small · 16/600 for panel headings</div>
            <div className="t-body">Body · 14/400 is the working size for every control and paragraph.</div>
            <div className="t-body-sm t-secondary">Body small · 13/400 secondary ink for supporting copy.</div>
            <div className="t-body-sm t-tertiary">Caption · 13/400 tertiary ink for hints, captions, and metadata.</div>
          </div>
        </section>

        <section>
          <h2 className="t-title-sm mb-3">Controls</h2>
          <div className="card card-pad grid gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn btn-primary">Publish</button>
              <button className="btn btn-secondary">Secondary</button>
              <button className="btn btn-ghost">Ghost</button>
              <button className="btn btn-danger">Remove</button>
              <button className="btn btn-primary" disabled>Disabled</button>
              <button className="btn btn-primary btn-sm">Small</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge">Neutral</span>
              <span className="badge badge-primary">Primary</span>
              <span className="badge badge-success"><Check size={11} strokeWidth={2.6} />Ready</span>
              <span className="badge badge-warning"><AlertTriangle size={11} strokeWidth={2.4} />Review</span>
              <span className="badge badge-danger"><XCircle size={11} strokeWidth={2.4} />Blocked</span>
              <span className="badge badge-info">Info</span>
            </div>
            <div className="grid max-w-md gap-4">
              <div className="field">
                <label className="t-label" htmlFor="ds-input">Text input</label>
                <input id="ds-input" className="input" placeholder="Placeholder at 4.9:1 contrast" />
                <div className="field-hint">Hint text sits under the field, never inside it.</div>
              </div>
              <div className="field">
                <label className="t-label" htmlFor="ds-input-err">With error</label>
                <input id="ds-input-err" className="input" defaultValue="calibration puck!!" style={{ borderColor: 'var(--danger)' }} aria-invalid="true" />
                <div className="field-error">Titles cannot contain repeated punctuation on Thingiverse.</div>
              </div>
              <div className="flex items-center gap-3">
                <button role="switch" aria-checked="true" className="switch" aria-label="Example on" />
                <button role="switch" aria-checked="false" className="switch" aria-label="Example off" />
                <div className="segmented" role="group" aria-label="View">
                  <button aria-pressed="true">Library</button>
                  <button aria-pressed="false">Build plate</button>
                </div>
                <span className="kbd">⌘K</span>
              </div>
              <div className="grid gap-2" aria-hidden>
                <div className="skeleton" style={{ height: 14, width: '60%' }} />
                <div className="skeleton" style={{ height: 14, width: '85%' }} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

// =====================================================================
// Shell
// =====================================================================

const PREPARE_NAV = [
  { id: 'package', label: 'Package', icon: Box, meta: '3 files' },
  { id: 'listing', label: 'Listing', icon: FileText, meta: 'done' },
  { id: 'destinations', label: 'Destinations', icon: Globe, meta: '6/10' },
  { id: 'publish', label: 'Publish', icon: Send, meta: '1 blocked' },
];

const WORKSPACE_NAV = [
  { id: 'library', label: 'Library', icon: Library },
  { id: 'connections', label: 'Connections', icon: Plug },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function NavMeta({ item }) {
  if (item.meta === 'done') return <Check size={14} strokeWidth={2.6} style={{ color: 'var(--success)' }} aria-label="Complete" />;
  if (item.id === 'publish') return <span className="badge badge-warning" style={{ height: 18, fontSize: 10, padding: '0 6px' }}>{item.meta}</span>;
  return <span className="t-body-sm t-tertiary t-num">{item.meta}</span>;
}

export default function PrototypeApp() {
  const [screen, setScreen] = useState('package');
  const screens = {
    package: <PackageScreen />,
    listing: <ListingScreen />,
    destinations: <DestinationsScreen />,
    publish: <PublishScreen />,
    system: <SystemScreen />,
  };
  const placeholder = (label) => (
    <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed" style={{ borderColor: 'var(--border-strong)' }}>
      <CircleDashed size={20} style={{ color: 'var(--ink-tertiary)' }} />
      <span className="t-secondary">{label} is outside this prototype's scope</span>
    </div>
  );

  return (
    <div className="proto flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 flex-shrink-0 flex-col border-r" style={{ borderColor: 'var(--border)', background: 'var(--surface-sunken)' }}>
        <button className="mx-3 mt-3 flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md" style={{ background: 'var(--primary)' }}>
            <Box size={15} color="white" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="t-body-sm truncate" style={{ fontWeight: 600 }}>{PROJECT.name}</div>
            <div className="t-tertiary truncate" style={{ fontSize: 11 }}>{PROJECT.updated}</div>
          </div>
          <ChevronsUpDown size={14} style={{ color: 'var(--ink-tertiary)' }} />
        </button>

        <div className="mx-3 mt-3">
          <button className="flex w-full items-center gap-2 rounded-md border px-2.5 t-body-sm t-tertiary transition-colors hover:bg-[var(--surface-hover)]" style={{ borderColor: 'var(--border)', height: 30, background: 'var(--surface)' }}>
            <Search size={13} />
            <span className="flex-1 text-left">Search</span>
            <span className="kbd">⌘K</span>
          </button>
        </div>

        <nav aria-label="Prepare" className="mt-4 grid gap-0.5 px-3">
          {PREPARE_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className="nav-item" aria-current={screen === item.id ? 'page' : undefined} onClick={() => setScreen(item.id)}>
                <Icon size={16} strokeWidth={2} />
                <span className="flex-1">{item.label}</span>
                <NavMeta item={item} />
              </button>
            );
          })}
        </nav>

        <div className="mx-5 my-4"><hr className="divider" /></div>

        <nav aria-label="Workspace" className="grid gap-0.5 px-3">
          {WORKSPACE_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className="nav-item" aria-current={screen === item.id ? 'page' : undefined} onClick={() => setScreen(item.id)}>
                <Icon size={16} strokeWidth={2} />
                <span className="flex-1">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto grid gap-0.5 p-3">
          <button className="nav-item" aria-current={screen === 'system' ? 'page' : undefined} onClick={() => setScreen('system')}>
            <Palette size={16} strokeWidth={2} />
            <span className="flex-1">Design system</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 flex h-13 items-center gap-3 border-b px-6" style={{ borderColor: 'var(--border)', background: 'var(--bg)', height: 52, zIndex: 'var(--z-sticky)' }}>
          <span className="t-body-sm t-tertiary">Projects</span>
          <span className="t-body-sm t-tertiary" aria-hidden>/</span>
          <span className="t-body-sm" style={{ fontWeight: 500 }}>{PROJECT.name}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="badge badge-success"><Check size={11} strokeWidth={2.6} />5 destinations ready</span>
            <button className="btn btn-primary btn-sm" onClick={() => setScreen('publish')}><Send size={13} />Review and publish</button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-7">
          {screens[screen] || placeholder(screen === 'library' ? 'Library' : screen === 'connections' ? 'Connections' : 'Settings')}
        </main>
      </div>
    </div>
  );
}
