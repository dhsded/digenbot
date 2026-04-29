import { useState, useCallback } from 'react'
import './App.css'

// ─── Types ───────────────────────────────────────────────────────────────────
type Mode = 'canais' | 'videos'
type ViewMode = 'grid' | 'list'
type SortKey = 'subs' | 'views' | 'recent'
type DateRange = 'any' | 'hour' | 'today' | 'week' | 'month' | 'year'

interface Channel {
  id: string
  name: string
  handle: string
  subs: string
  subsNum: number
  videoCount: string
  description: string
  url: string
  avatarUrl: string
}

interface Video {
  id: string
  title: string
  channelName: string
  channelUrl: string
  channelAvatarUrl: string
  viewCount: string
  viewsNum: number
  publishedAt: string
  duration: string
  url: string
  thumbnailUrl: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number): string => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace('.0', '') + 'K'
  return n.toString()
}

/** Parse Brazilian/Portuguese-style number strings like "1,2 mil" or "1,3 mi" */
function parseNumericStr(str: string): number {
  if (!str) return 0
  const s = str.toLowerCase().replace(/\./g, '').replace(',', '.').trim()
  const miMatch = s.match(/([\d.]+)\s*mi/)
  if (miMatch) return Math.round(parseFloat(miMatch[1]) * 1_000_000)
  const milMatch = s.match(/([\d.]+)\s*mil/)
  if (milMatch) return Math.round(parseFloat(milMatch[1]) * 1_000)
  const numMatch = s.match(/([\d.]+)/)
  if (numMatch) return Math.round(parseFloat(numMatch[1]))
  return 0
}

const COLORS = [
  'linear-gradient(135deg,#3b82f6,#8b5cf6)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#22c55e,#3b82f6)',
  'linear-gradient(135deg,#ec4899,#8b5cf6)',
  'linear-gradient(135deg,#14b8a6,#3b82f6)',
  'linear-gradient(135deg,#f97316,#eab308)',
]

// ─── Declare the Electron IPC bridge ─────────────────────────────────────────
declare global {
  interface Window {
    espiao?: {
      searchYouTube: (
        query: string,
        mode: string,
        filters: Record<string, unknown>
      ) => Promise<{ success: boolean; data: unknown[]; error?: string }>
    }
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChannelCard({ ch, onClick, idx }: { ch: Channel; onClick: () => void; idx: number }) {
  const hasAvatar = !!ch.avatarUrl
  return (
    <div className="channel-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div className="channel-card-header">
        <div className="channel-avatar"
          style={hasAvatar ? undefined : { background: COLORS[idx % COLORS.length] }}>
          {hasAvatar ? (
            <img src={ch.avatarUrl} alt={ch.name} referrerPolicy="no-referrer"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          ) : (
            ch.name[0]?.toUpperCase() || '?'
          )}
        </div>
        <div className="channel-info">
          <div className="channel-name">{ch.name}</div>
          <div className="channel-handle">{ch.handle}</div>
        </div>
      </div>

      <div className="channel-stats">
        <div className="stat-item">
          <div className="stat-value">{ch.subs || '—'}</div>
          <div className="stat-label">Inscritos</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{ch.videoCount || '—'}</div>
          <div className="stat-label">Vídeos</div>
        </div>
      </div>

      {ch.description && (
        <div className="channel-desc-preview">{ch.description}</div>
      )}

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
        {v.thumbnailUrl ? (
          <img src={v.thumbnailUrl} alt={v.title} referrerPolicy="no-referrer" />
        ) : (
          '🎬'
        )}
        {v.duration && <span className="video-thumb-duration">{v.duration}</span>}
      </div>
      <div className="video-info">
        <div className="video-title">{v.title}</div>
        <div className="video-meta">
          {v.channelAvatarUrl && (
            <img className="video-channel-avatar" src={v.channelAvatarUrl}
              alt="" referrerPolicy="no-referrer" />
          )}
          <span className="video-channel-name">{v.channelName}</span>
          <span>{v.viewCount}</span>
          {v.publishedAt && <span>• {v.publishedAt}</span>}
        </div>
      </div>
      <div className="video-vph">
        <div className="video-vph-value">{fmt(v.viewsNum)}</div>
        <div className="video-vph-label">Views</div>
      </div>
    </div>
  )
}

function DetailPanel({ channel, onClose, idx }: { channel: Channel | null; onClose: () => void; idx: number }) {
  const hasAvatar = !!channel?.avatarUrl
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
              <div className="detail-avatar"
                style={hasAvatar
                  ? { background: 'transparent', border: 'none', overflow: 'hidden' }
                  : { background: COLORS[idx % COLORS.length] }}>
                {hasAvatar ? (
                  <img src={channel.avatarUrl} alt={channel.name}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    referrerPolicy="no-referrer" />
                ) : (
                  channel.name[0]?.toUpperCase() || '?'
                )}
              </div>
              <div className="detail-name">{channel.name}</div>
              <div className="detail-handle">{channel.handle}</div>
            </div>

            <div className="detail-stats-grid">
              <div className="detail-stat">
                <div className="detail-stat-val">{channel.subs || '—'}</div>
                <div className="detail-stat-lbl">Inscritos</div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-val">{channel.videoCount || '—'}</div>
                <div className="detail-stat-lbl">Vídeos</div>
              </div>
            </div>

            {channel.description && (
              <div>
                <div className="section-label">Descrição</div>
                <div className="detail-desc">{channel.description}</div>
              </div>
            )}

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
  const [sortKey, setSortKey] = useState<SortKey>('subs')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [language, setLanguage] = useState('pt')
  const [dateRange, setDateRange] = useState<DateRange>('any')
  const [maxResults, setMaxResults] = useState(20)
  const [loading, setLoading] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true)
    setHasSearched(true)
    setSelectedChannel(null)
    setErrorMsg('')
    setStatusMsg('Conectando ao YouTube...')

    try {
      if (!window.espiao?.searchYouTube) {
        setErrorMsg('Bridge IPC não disponível. Execute dentro do Electron.')
        setLoading(false)
        setStatusMsg('')
        return
      }

      setStatusMsg(mode === 'canais' ? 'Buscando canais no YouTube...' : 'Buscando vídeos no YouTube...')

      const result = await window.espiao.searchYouTube(query.trim(), mode, {
        language,
        dateRange,
        maxResults,
      })

      if (!result.success) {
        setErrorMsg(result.error || 'Erro desconhecido na busca.')
        setChannels([])
        setVideos([])
        setLoading(false)
        setStatusMsg('')
        return
      }

      if (mode === 'canais') {
        const raw = result.data as Array<{
          name: string; handle: string; subs: string;
          videoCount: string; description: string; url: string; avatarUrl: string
        }>
        const parsed: Channel[] = raw.map((ch, i) => ({
          id: `ch-${i}`,
          name: ch.name,
          handle: ch.handle,
          subs: ch.subs,
          subsNum: parseNumericStr(ch.subs),
          videoCount: ch.videoCount,
          description: ch.description,
          url: ch.url,
          avatarUrl: ch.avatarUrl,
        }))

        parsed.sort((a, b) => {
          if (sortKey === 'subs') return b.subsNum - a.subsNum
          return 0
        })

        setChannels(parsed)
        setVideos([])
        setStatusMsg(`${parsed.length} canais encontrados`)
      } else {
        const raw = result.data as Array<{
          title: string; url: string; channelName: string; channelUrl: string;
          channelAvatarUrl: string; viewCount: string; publishedAt: string;
          duration: string; thumbnailUrl: string
        }>
        const parsed: Video[] = raw.map((v, i) => ({
          id: `v-${i}`,
          title: v.title,
          channelName: v.channelName,
          channelUrl: v.channelUrl,
          channelAvatarUrl: v.channelAvatarUrl || '',
          viewCount: v.viewCount,
          viewsNum: parseNumericStr(v.viewCount),
          publishedAt: v.publishedAt,
          duration: v.duration,
          url: v.url,
          thumbnailUrl: v.thumbnailUrl,
        }))

        parsed.sort((a, b) => {
          if (sortKey === 'views') return b.viewsNum - a.viewsNum
          return 0
        })

        setVideos(parsed)
        setChannels([])
        setStatusMsg(`${parsed.length} vídeos encontrados`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado.'
      setErrorMsg(msg)
      setStatusMsg('')
    } finally {
      setLoading(false)
    }
  }, [query, mode, sortKey, language, dateRange, maxResults])

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

        {statusMsg && !errorMsg && (
          <div className="header-status">{statusMsg}</div>
        )}

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
                </select>

                <select
                  id="filter-sort"
                  className="filter-select"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                >
                  <option value="subs">👥 Ordenar por Inscritos</option>
                  <option value="views">👁️ Ordenar por Views</option>
                  <option value="recent">🕐 Mais Recentes</option>
                </select>
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <div className="section-label">📅 Período de Upload</div>
              <div className="date-range-grid">
                {([
                  { key: 'any', label: 'Qualquer', icon: '∞' },
                  { key: 'hour', label: 'Última hora', icon: '⏱' },
                  { key: 'today', label: 'Hoje', icon: '📆' },
                  { key: 'week', label: 'Esta semana', icon: '📅' },
                  { key: 'month', label: 'Este mês', icon: '🗓' },
                  { key: 'year', label: 'Este ano', icon: '📊' },
                ] as { key: DateRange; label: string; icon: string }[]).map(({ key, label, icon }) => (
                  <button
                    key={key}
                    className={`date-range-btn ${dateRange === key ? 'active' : ''}`}
                    onClick={() => setDateRange(key)}
                  >
                    <span className="date-range-icon">{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              {mode === 'canais' && dateRange !== 'any' && (
                <div className="filter-hint">
                  ⓘ Filtro de data é aplicado apenas em vídeos
                </div>
              )}
            </div>

            {/* Max Results */}
            <div className="range-group">
              <div className="range-label-row">
                <span className="range-label">Máx. resultados</span>
                <span className="range-value">{maxResults}</span>
              </div>
              <input
                id="filter-max-results"
                type="range"
                min={5}
                max={30}
                step={5}
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

            {/* Error message */}
            {errorMsg && (
              <div className="error-msg">
                <span>⚠️</span> {errorMsg}
              </div>
            )}
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
              {channels.map((ch, i) => (
                <ChannelCard key={ch.id} ch={ch} idx={i} onClick={() => { setSelectedChannel(ch); setSelectedIdx(i) }} />
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
        <DetailPanel channel={selectedChannel} onClose={() => setSelectedChannel(null)} idx={selectedIdx} />
      </div>
    </div>
  )
}
