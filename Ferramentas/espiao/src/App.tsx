import { useState, useCallback } from 'react'
import './App.css'

// ─── Types ───────────────────────────────────────────────────────────────────
type Mode = 'canais' | 'videos'
type ViewMode = 'grid' | 'list'
type SortKey = 'vph' | 'subs' | 'views' | 'recent'

interface Channel {
  id: string
  name: string
  handle: string
  category: string
  subs: number
  totalViews: number
  videoCount: number
  vph: number
  vphPct: number
  description: string
  avatarLetter: string
  avatarColor: string
  url: string
}

interface Video {
  id: string
  title: string
  channelName: string
  channelHandle: string
  views: number
  likes: number
  publishedAt: string
  duration: string
  vph: number
  tags: ('hot' | 'trend' | 'new')[]
  url: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'K'
  return n.toString()
}

const COLORS = [
  'linear-gradient(135deg,#3b82f6,#8b5cf6)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#22c55e,#3b82f6)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
  'linear-gradient(135deg,#14b8a6,#3b82f6)',
  'linear-gradient(135deg,#f97316,#eab308)',
]

// ─── Mock data generator ──────────────────────────────────────────────────────
// In production this would call a real scraper via Electron IPC
function generateMockChannels(query: string, count = 12): Channel[] {
  const names = [
    `${query} Pro`, `O Canal de ${query}`, `${query} Viral`,
    `Master ${query}`, `${query} Top 10`, `Mundo ${query}`,
    `${query} Secrets`, `${query} BR`, `${query} Academy`,
    `${query} Hacks`, `${query} Daily`, `${query} Express`
  ]
  const categories = ['Educação', 'Entretenimento', 'Como Fazer', 'Reviews', 'Tecnologia', 'Lifestyle']
  return names.slice(0, count).map((name, i) => {
    const subs = Math.floor(Math.random() * 2_000_000) + 5_000
    const vph = Math.floor(Math.random() * 45_000) + 500
    return {
      id: `ch-${i}`,
      name,
      handle: `@${name.toLowerCase().replace(/\s+/g, '')}`,
      category: categories[i % categories.length],
      subs,
      totalViews: subs * (Math.floor(Math.random() * 80) + 20),
      videoCount: Math.floor(Math.random() * 500) + 10,
      vph,
      vphPct: Math.min(100, Math.floor(vph / 450)),
      description: `Canal sobre ${query} com conteúdo exclusivo para quem quer aprender mais sobre esse nicho incrível.`,
      avatarLetter: name[0].toUpperCase(),
      avatarColor: COLORS[i % COLORS.length],
      url: `https://youtube.com/@${name.toLowerCase().replace(/\s+/g, '')}`,
    }
  })
}

function generateMockVideos(query: string, count = 15): Video[] {
  const titles = [
    `${query}: O Guia Definitivo`, `Aprenda ${query} em 10 Minutos`,
    `${query} que VIRALIZOU`, `Esse ${query} mudou tudo`,
    `TOP 10 ${query} do momento`, `${query} - Você está fazendo errado`,
    `Como usar ${query} para lucrar`, `${query} SECRETO revelado`,
    `${query} para iniciantes`, `${query} avançado 2025`,
    `${query} que ninguém te conta`, `${query} em 60 segundos`,
    `${query} GRÁTIS vs PAGO`, `${query} Challenge`, `${query} na prática`,
  ]
  const tags: Video['tags'][] = [['hot'], ['trend'], ['new'], ['hot', 'trend'], ['new', 'trend'], []]
  return titles.slice(0, count).map((title, i) => {
    const views = Math.floor(Math.random() * 5_000_000) + 10_000
    const vph = Math.floor(Math.random() * 30_000) + 200
    const mins = Math.floor(Math.random() * 18) + 2
    const secs = Math.floor(Math.random() * 59)
    return {
      id: `v-${i}`,
      title,
      channelName: `Canal ${query} ${i + 1}`,
      channelHandle: `@canal${query.toLowerCase()}${i + 1}`,
      views,
      likes: Math.floor(views * (Math.random() * 0.08 + 0.02)),
      publishedAt: `${Math.floor(Math.random() * 30) + 1} dias atrás`,
      duration: `${mins}:${secs.toString().padStart(2, '0')}`,
      vph,
      tags: tags[i % tags.length],
      url: `https://youtube.com/watch?v=fake-${i}`,
    }
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChannelCard({ ch, onClick }: { ch: Channel; onClick: () => void }) {
  return (
    <div className="channel-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div className="channel-card-header">
        <div className="channel-avatar" style={{ background: ch.avatarColor }}>
          {ch.avatarLetter}
        </div>
        <div className="channel-info">
          <div className="channel-name">{ch.name}</div>
          <div className="channel-handle">{ch.handle}</div>
        </div>
        <div className="channel-category">{ch.category}</div>
      </div>

      <div className="channel-stats">
        <div className="stat-item">
          <div className="stat-value">{fmt(ch.subs)}</div>
          <div className="stat-label">Inscritos</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{fmt(ch.totalViews)}</div>
          <div className="stat-label">Views</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{ch.videoCount}</div>
          <div className="stat-label">Vídeos</div>
        </div>
      </div>

      <div className="vph-bar-wrap">
        <div className="vph-bar-row">
          <span className="vph-label">VPH (Views/Hora)</span>
          <span className="vph-value">{fmt(ch.vph)}</span>
        </div>
        <div className="vph-bar">
          <div className="vph-bar-fill" style={{ width: `${ch.vphPct}%` }} />
        </div>
      </div>

      <div className="channel-card-actions">
        <button className="action-btn" onClick={(e) => { e.stopPropagation(); window.open(ch.url, '_blank') }}>
          🔴 YouTube
        </button>
        <button className="action-btn primary" onClick={(e) => { e.stopPropagation(); onClick() }}>
          📊 Detalhes
        </button>
      </div>
    </div>
  )
}

function VideoCard({ v }: { v: Video }) {
  return (
    <div className="video-card" role="button" tabIndex={0}
      onClick={() => window.open(v.url, '_blank')}>
      <div className="video-thumb">
        🎬
        <span className="video-thumb-duration">{v.duration}</span>
      </div>
      <div className="video-info">
        <div className="video-title">{v.title}</div>
        <div className="video-meta">
          <span>{v.channelName}</span>
          <span>{fmt(v.views)} views</span>
          <span>{v.publishedAt}</span>
        </div>
        {v.tags.length > 0 && (
          <div className="video-badges">
            {v.tags.includes('hot') && <span className="badge badge-hot">🔥 Hot</span>}
            {v.tags.includes('trend') && <span className="badge badge-trend">📈 Trend</span>}
            {v.tags.includes('new') && <span className="badge badge-new">✨ Novo</span>}
          </div>
        )}
      </div>
      <div className="video-vph">
        <div className="video-vph-value">{fmt(v.vph)}</div>
        <div className="video-vph-label">VPH</div>
      </div>
    </div>
  )
}

function DetailPanel({ channel, onClose }: { channel: Channel | null; onClose: () => void }) {
  return (
    <div className={`detail-panel ${channel ? '' : 'collapsed'}`}>
      {channel && (
        <>
          <div className="detail-header">
            <h3>Perfil do Canal</h3>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="detail-body">
            <div className="detail-avatar-wrap">
              <div className="detail-avatar" style={{ background: channel.avatarColor }}>
                {channel.avatarLetter}
              </div>
              <div className="detail-name">{channel.name}</div>
              <div className="detail-handle">{channel.handle}</div>
            </div>

            <div className="detail-stats-grid">
              <div className="detail-stat">
                <div className="detail-stat-val">{fmt(channel.subs)}</div>
                <div className="detail-stat-lbl">Inscritos</div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-val">{fmt(channel.totalViews)}</div>
                <div className="detail-stat-lbl">Total Views</div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-val">{channel.videoCount}</div>
                <div className="detail-stat-lbl">Vídeos</div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-val" style={{ color: 'var(--green)' }}>{fmt(channel.vph)}</div>
                <div className="detail-stat-lbl">VPH</div>
              </div>
            </div>

            <div>
              <div className="section-label">Nicho / Categoria</div>
              <div className="channel-category" style={{ display: 'inline-block', marginTop: 4 }}>
                {channel.category}
              </div>
            </div>

            <div>
              <div className="section-label">Descrição</div>
              <div className="detail-desc">{channel.description}</div>
            </div>

            <button className="open-yt-btn" onClick={() => window.open(channel.url, '_blank')}>
              ▶ Abrir no YouTube
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState<Mode>('canais')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('vph')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [minSubs, setMinSubs] = useState(0)
  const [maxResults, setMaxResults] = useState(12)
  const [language, setLanguage] = useState('pt')
  const [loading, setLoading] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setHasSearched(true)
    setSelectedChannel(null)

    // Simulate network delay
    await new Promise(r => setTimeout(r, 1400 + Math.random() * 600))

    if (mode === 'canais') {
      let results = generateMockChannels(query.trim(), maxResults)
      if (minSubs > 0) results = results.filter(c => c.subs >= minSubs * 1000)
      results.sort((a, b) => {
        if (sortKey === 'vph') return b.vph - a.vph
        if (sortKey === 'subs') return b.subs - a.subs
        if (sortKey === 'views') return b.totalViews - a.totalViews
        return b.videoCount - a.videoCount
      })
      setChannels(results)
    } else {
      const results = generateMockVideos(query.trim(), maxResults)
      results.sort((a, b) => {
        if (sortKey === 'vph') return b.vph - a.vph
        if (sortKey === 'views') return b.views - a.views
        return 0
      })
      setVideos(results)
    }

    setLoading(false)
  }, [query, mode, sortKey, minSubs, maxResults])

  const totalResults = mode === 'canais' ? channels.length : videos.length

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-logo">
          <div className="header-logo-icon">🕵️</div>
          <div>
            <div className="header-logo-text">Espião</div>
            <div className="header-logo-sub">Inteligência de Nicho YouTube</div>
          </div>
        </div>

        <nav className="header-tabs">
          <button
            id="tab-canais"
            className={`header-tab ${mode === 'canais' ? 'active' : ''}`}
            onClick={() => { setMode('canais'); setViewMode('grid') }}
          >
            📡 Canais
          </button>
          <button
            id="tab-videos"
            className={`header-tab ${mode === 'videos' ? 'active' : ''}`}
            onClick={() => { setMode('videos'); setViewMode('list') }}
          >
            🎬 Vídeos
          </button>
        </nav>

        <div className="header-spacer" />
        <div className="header-badge">
          <div className="header-badge-dot" />
          Zero API
        </div>
      </header>

      {/* Body */}
      <div className="main-layout">
        {/* Search Panel */}
        <aside className="search-panel">
          <div className="search-panel-inner">
            {/* Query input */}
            <div>
              <div className="section-label">Nicho / Palavra-chave</div>
              <div className="search-input-wrap">
                <span className="search-input-icon">🔍</span>
                <input
                  id="search-query-input"
                  className="search-input"
                  type="text"
                  placeholder='Ex: "meditação", "receitas fit"…'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </div>

            {/* Mode cards */}
            <div>
              <div className="section-label">O que pesquisar</div>
              <div className="mode-grid">
                <button
                  id="mode-canais"
                  className={`mode-card ${mode === 'canais' ? 'active' : ''}`}
                  onClick={() => setMode('canais')}
                >
                  <div className="mode-card-icon">📡</div>
                  <div className="mode-card-title">Canais</div>
                  <div className="mode-card-desc">Encontra canais do mesmo nicho</div>
                </button>
                <button
                  id="mode-videos"
                  className={`mode-card ${mode === 'videos' ? 'active' : ''}`}
                  onClick={() => { setMode('videos'); setViewMode('list') }}
                >
                  <div className="mode-card-icon">🎬</div>
                  <div className="mode-card-title">Vídeos</div>
                  <div className="mode-card-desc">Encontra vídeos relacionados</div>
                </button>
              </div>
            </div>

            {/* Filters */}
            <div>
              <div className="section-label">Filtros</div>
              <div className="filter-row">
                <select
                  id="filter-language"
                  className="filter-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="pt">🇧🇷 Português (BR)</option>
                  <option value="en">🇺🇸 Inglês</option>
                  <option value="es">🇪🇸 Espanhol</option>
                  <option value="all">🌍 Todos os idiomas</option>
                </select>

                <select
                  id="filter-sort"
                  className="filter-select"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                >
                  <option value="vph">📈 Ordenar por VPH</option>
                  <option value="subs">👥 Ordenar por Inscritos</option>
                  <option value="views">👁️ Ordenar por Views</option>
                  <option value="recent">🕐 Mais Recentes</option>
                </select>
              </div>
            </div>

            {mode === 'canais' && (
              <div className="range-group">
                <div className="range-label-row">
                  <span className="range-label">Inscritos mínimos</span>
                  <span className="range-value">{minSubs === 0 ? 'Qualquer' : fmt(minSubs * 1000)}</span>
                </div>
                <input
                  id="filter-min-subs"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={minSubs}
                  onChange={(e) => setMinSubs(Number(e.target.value))}
                />
              </div>
            )}

            <div className="range-group">
              <div className="range-label-row">
                <span className="range-label">Máx. resultados</span>
                <span className="range-value">{maxResults}</span>
              </div>
              <input
                id="filter-max-results"
                type="range"
                min={6}
                max={30}
                step={3}
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
              />
            </div>

            {/* Search Button */}
            <button
              id="search-btn"
              className={`search-btn ${loading ? 'loading' : ''}`}
              onClick={handleSearch}
              disabled={loading || !query.trim()}
            >
              {loading ? '' : `🔎 Espionar ${mode === 'canais' ? 'Canais' : 'Vídeos'}`}
            </button>
          </div>
        </aside>

        {/* Results */}
        <main className="results-panel">
          {/* Toolbar */}
          <div className="results-toolbar">
            <span className="results-count">
              {hasSearched && !loading
                ? <><strong>{totalResults}</strong> {mode === 'canais' ? 'canais' : 'vídeos'} encontrados</>
                : 'Aguardando pesquisa…'}
            </span>

            {hasSearched && !loading && (
              <>
                {[
                  { k: 'vph' as SortKey, label: '📈 VPH' },
                  { k: 'subs' as SortKey, label: '👥 Inscritos' },
                  { k: 'views' as SortKey, label: '👁️ Views' },
                ].map(({ k, label }) => (
                  <button
                    key={k}
                    className={`sort-btn ${sortKey === k ? 'active' : ''}`}
                    onClick={() => setSortKey(k)}
                  >
                    {label}
                  </button>
                ))}
              </>
            )}

            {mode === 'canais' && hasSearched && !loading && (
              <div className="view-toggle">
                <button
                  id="view-grid"
                  className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grade"
                >⊞</button>
                <button
                  id="view-list"
                  className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="Lista"
                >≡</button>
              </div>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className={`results-grid ${viewMode === 'grid' && mode === 'canais' ? 'grid-view' : 'list-view'}`}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: mode === 'canais' ? 220 : 82 }} />
              ))}
            </div>
          ) : !hasSearched ? (
            <div className="empty-state">
              <div className="empty-icon">🕵️</div>
              <div className="empty-title">Pronto para espionar</div>
              <div className="empty-desc">
                Digite um nicho ou palavra-chave no painel esquerdo e clique em
                <strong> Espionar</strong> para descobrir canais e vídeos que estão bombando.
              </div>
            </div>
          ) : totalResults === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">😶</div>
              <div className="empty-title">Nenhum resultado</div>
              <div className="empty-desc">Tente outros filtros ou uma palavra-chave diferente.</div>
            </div>
          ) : mode === 'canais' ? (
            <div className={`results-grid ${viewMode === 'grid' ? 'grid-view' : 'list-view'}`}>
              {channels.map((ch) => (
                <ChannelCard key={ch.id} ch={ch} onClick={() => setSelectedChannel(ch)} />
              ))}
            </div>
          ) : (
            <div className="results-grid list-view">
              {videos.map((v) => (
                <VideoCard key={v.id} v={v} />
              ))}
            </div>
          )}
        </main>

        {/* Detail Panel */}
        <DetailPanel channel={selectedChannel} onClose={() => setSelectedChannel(null)} />
      </div>
    </div>
  )
}
