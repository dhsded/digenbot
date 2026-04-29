import { useState, useCallback, useEffect } from 'react'
import './App.css'

// ─── Types ───────────────────────────────────────────────────────────────────
type Mode = 'canais' | 'videos' | 'keywords'
type ViewMode = 'grid' | 'list'
type SortKey = 'subs' | 'views' | 'recent' | 'vph' | 'views30' | 'views60' | 'views90' | 'views365'
type DateRange = 'any' | 'hour' | 'today' | 'week' | 'month' | 'year'
type VideoDuration = 'any' | 'short' | 'long'

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
  vph: number
}

interface TrendKeyword {
  keyword: string
  views30: number
  views60: number
  views90: number
  views365: number
  analyzed: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number): string => {
  const rounded = Math.round(n);
  if (rounded >= 1_000_000) return (rounded / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (rounded >= 1_000) return (rounded / 1_000).toFixed(1).replace('.0', '') + 'K'
  return rounded.toString()
}

const fmtFull = (n: number): string => {
  return new Intl.NumberFormat('pt-BR').format(Math.round(n))
}

function parseNumericStr(str: string): number {
  if (!str) return 0
  const s = str.toLowerCase().replace(/\./g, '').replace(',', '.').trim()
  
  // Portuguese "mi" / "mil"
  const miMatch = s.match(/([\d.]+)\s*mi/)
  if (miMatch) return Math.round(parseFloat(miMatch[1]) * 1_000_000)
  const milMatch = s.match(/([\d.]+)\s*mil/)
  if (milMatch) return Math.round(parseFloat(milMatch[1]) * 1_000)
  
  // International "m" / "k"
  const mMatch = s.match(/([\d.]+)\s*m/)
  if (mMatch && !miMatch) return Math.round(parseFloat(mMatch[1]) * 1_000_000)
  const kMatch = s.match(/([\d.]+)\s*k/)
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1_000)

  // Fallback pure number
  const numMatch = s.match(/([\d.]+)/)
  if (numMatch) return Math.round(parseFloat(numMatch[1]))
  return 0
}

/** Parses strings like "há 2 dias", "há 3 horas", "2 weeks ago" into estimated hours */
function parsePublishedTimeToHours(str: string): number {
  if (!str) return 720 // default 1 month if unknown
  const s = str.toLowerCase()
  const numMatch = s.match(/\d+/)
  const num = numMatch ? parseInt(numMatch[0]) : 1
  
  if (s.includes('minuto') || s.includes('minute')) return num / 60
  if (s.includes('hora') || s.includes('hour')) return num
  if (s.includes('dia') || s.includes('day')) return num * 24
  if (s.includes('semana') || s.includes('week')) return num * 24 * 7
  if (s.includes('mês') || s.includes('mes') || s.includes('month')) return num * 24 * 30
  if (s.includes('ano') || s.includes('year')) return num * 24 * 365
  
  return 720
}

/** Converts "10:35", "1:05:22" or "SHORTS" to total seconds */
function parseDurationToSeconds(duration: string): number {
  if (!duration) return 0
  const d = duration.toUpperCase()
  if (d.includes('SHORT')) return 59
  
  const parts = d.split(':').map(Number)
  if (parts.length === 3) {
    return (parts[0] * 3600) + (parts[1] * 60) + (parts[2] || 0)
  } else if (parts.length === 2) {
    return (parts[0] * 60) + (parts[1] || 0)
  }
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
      saveReport: (
        csvContent: string,
        defaultName: string
      ) => Promise<{ success: boolean; filePath?: string; error?: string }>
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
      <div className="video-vph" title={`${fmtFull(v.vph)} VPH`}>
        <div className="video-vph-value" style={{ color: v.vph > 1000 ? '#ef4444' : v.vph > 100 ? '#f59e0b' : 'inherit' }}>
          {fmt(v.vph)}
        </div>
        <div className="video-vph-label">VPH</div>
      </div>
      <div className="video-vph" title={`${fmtFull(v.viewsNum)} Visualizações`}>
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
  const [language, setLanguage] = useState('')
  const [country, setCountry] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('any')
  const [videoDuration, setVideoDuration] = useState<VideoDuration>('any')
  const [maxResults, setMaxResults] = useState(30)
  const [minSubs, setMinSubs] = useState(0)
  const [loading, setLoading] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [keywords, setKeywords] = useState<string[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [trendKeywords, setTrendKeywords] = useState<TrendKeyword[]>([])

  // Radar Stream Listener
  useEffect(() => {
    if (!window.espiao?.onTrendKeywordFound) return

    window.espiao.onTrendKeywordFound((kws: string[]) => {
      setTrendKeywords(prev => {
        const existing = new Set(prev.map(p => p.keyword))
        const added = kws
          .filter(k => {
            if (existing.has(k)) return false;
            const firstChar = k.charAt(0).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
            return /^[A-Z]$/.test(firstChar);
          })
          .map(k => ({ 
            keyword: k, views30: 0, views60: 0, views90: 0, views365: 0, analyzed: false 
          }))
        return [...prev, ...added]
      })
      setHasSearched(true)
    })

    window.espiao.onTrendKeywordMetric((data: { keyword: string, topVideos: any[] }) => {
      let views30 = 0, count30 = 0;
      let views60 = 0, count60 = 0;
      let views90 = 0, count90 = 0;
      let views365 = 0, count365 = 0;

      for (const v of data.topVideos) {
        const viewsNum = parseNumericStr(v.viewCount)
        const hours = parsePublishedTimeToHours(v.publishedAt)
        
        if (viewsNum > 0) {
          if (hours <= 720 && count30 < 10) { views30 += viewsNum; count30++; }
          if (hours <= 1440 && count60 < 20) { views60 += viewsNum; count60++; }
          if (hours <= 2160 && count90 < 20) { views90 += viewsNum; count90++; }
          if (hours <= 8760 && count365 < 20) { views365 += viewsNum; count365++; }
        }
      }

      setTrendKeywords(prev => prev.map(p => 
        p.keyword === data.keyword ? { ...p, views30, views60, views90, views365, analyzed: true } : p
      ))
    })

    window.espiao.onTrendStatus((status: string) => {
      setStatusMsg(status)
    })

    return () => {
      window.espiao?.offTrendEvents?.()
    }
  }, [])

  const handleSearch = useCallback(async () => {
    if (!query.trim() && mode !== 'keywords') return
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

      if (mode === 'keywords') {
        setStatusMsg('Minerando variações de palavras-chave no Google...')
        if (!window.espiao?.getKeywords) {
          setErrorMsg('API de keywords não disponível.')
          setLoading(false)
          return
        }
        const result = await window.espiao.getKeywords(query.trim())
        if (!result.success) {
          setErrorMsg(result.error || 'Erro ao minerar palavras-chave.')
          setKeywords([])
        } else {
          setKeywords(result.data as string[])
          setStatusMsg(`${(result.data as string[]).length} subnichos/termos encontrados`)
        }
        setChannels([])
        setVideos([])
        setLoading(false)
        return
      }

      setStatusMsg(mode === 'canais' ? 'Buscando canais no YouTube...' : 'Buscando vídeos no YouTube...')

      const result = await window.espiao.searchYouTube(query.trim(), mode, {
        hl: language,
        gl: country,
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

        // Apply minimum subscribers filter
        const filtered = parsed.filter(c => c.subsNum >= minSubs)

        setChannels(filtered)
        setVideos([])
        setStatusMsg(`${filtered.length} canais encontrados ${filtered.length < parsed.length ? `(ocultos: ${parsed.length - filtered.length} por filtro de inscritos)` : ''}`)
      } else {
        const raw = result.data as Array<{
          title: string; url: string; channelName: string; channelUrl: string;
          channelAvatarUrl: string; viewCount: string; publishedAt: string;
          duration: string; thumbnailUrl: string
        }>
        const parsed: Video[] = raw.map((v, i) => {
          const viewsNum = parseNumericStr(v.viewCount)
          const hours = parsePublishedTimeToHours(v.publishedAt)
          const vph = viewsNum / Math.max(hours, 1)

          return {
            id: `v-${i}`,
            title: v.title,
            channelName: v.channelName,
            channelUrl: v.channelUrl,
            channelAvatarUrl: v.channelAvatarUrl || '',
            viewCount: v.viewCount,
            viewsNum,
            publishedAt: v.publishedAt,
            duration: v.duration,
            url: v.url,
            thumbnailUrl: v.thumbnailUrl,
            vph,
          }
        })

        setVideos(parsed)
        setChannels([])
        setKeywords([])
        setStatusMsg('Varredura concluída!')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado.'
      setErrorMsg(msg)
      setStatusMsg('')
    } finally {
      setLoading(false)
    }
  }, [query, mode, sortKey, language, country, dateRange, maxResults, minSubs])

  const handleExport = useCallback(async () => {
    if (!window.espiao?.saveReport) return
    const isChannel = mode === 'canais'
    const items = isChannel ? channels : videos
    if (items.length === 0) return

    let csv = ''
    if (isChannel) {
      csv = 'Nome,Handle,Inscritos,Vídeos,URL,Descrição\n'
      channels.forEach(c => {
        csv += `"${c.name}","${c.handle}","${c.subs}","${c.videoCount}","${c.url}","${(c.description || '').replace(/"/g, '""')}"\n`
      })
    } else {
      csv = 'Título,Canal,Views,Duração,Publicado,URL\n'
      videos.forEach(v => {
        csv += `"${v.title.replace(/"/g, '""')}","${v.channelName}","${v.viewCount}","${v.duration}","${v.publishedAt}","${v.url}"\n`
      })
    }

    const defaultName = isChannel ? `Canais_${query}.csv` : `Videos_${query}.csv`
    const res = await window.espiao.saveReport(csv, defaultName)
    if (res.success) {
      setStatusMsg('Relatório salvo com sucesso!')
    } else if (res.error) {
      setErrorMsg(res.error)
    }
  }, [mode, channels, videos, query])

  const sortedChannels = [...channels].sort((a, b) => {
    if (sortKey === 'subs') return b.subsNum - a.subsNum
    return 0
  })

  // Filter and sort videos
  const filteredVideos = videos.filter(v => {
    if (videoDuration === 'any') return true
    const sec = parseDurationToSeconds(v.duration)
    if (videoDuration === 'short') return sec <= 180 // up to 3 mins
    if (videoDuration === 'long') return sec > 180
    return true
  })

  const sortedVideos = [...filteredVideos].sort((a, b) => {
    if (sortKey === 'vph') return b.vph - a.vph
    if (sortKey === 'views') return b.viewsNum - a.viewsNum
    return 0
  })

  const totalResults = mode === 'canais' ? channels.length : mode === 'videos' ? sortedVideos.length : isScanning || trendKeywords.length > 0 ? trendKeywords.length : keywords.length

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
            onClick={() => { 
              setMode('canais'); 
              setViewMode('grid');
              if (sortKey !== 'subs') setSortKey('subs');
            }}
          >
            📡 Canais
          </button>
          <button
            id="tab-videos"
            className={`header-tab ${mode === 'videos' ? 'active' : ''}`}
            onClick={() => { 
              setMode('videos'); 
              setViewMode('list');
              if (sortKey === 'subs') setSortKey('vph');
            }}
          >
            🎬 Vídeos
          </button>
          <button
            id="tab-keywords"
            className={`header-tab ${mode === 'keywords' ? 'active' : ''}`}
            onClick={() => { setMode('keywords'); setViewMode('grid') }}
          >
            🔑 Palavras-Chave
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
            {mode !== 'keywords' && (
              <div>
                <div className="section-label">O que pesquisar</div>
                <div className="mode-grid">
                  <button
                    id="mode-canais"
                    className={`mode-card ${mode === 'canais' ? 'active' : ''}`}
                    onClick={() => {
                      setMode('canais');
                      if (sortKey !== 'subs') setSortKey('subs');
                    }}
                  >
                    <div className="mode-card-icon">📡</div>
                    <div className="mode-card-title">Canais</div>
                    <div className="mode-card-desc">Encontra canais do mesmo nicho</div>
                  </button>
                  <button
                    id="mode-videos"
                    className={`mode-card ${mode === 'videos' ? 'active' : ''}`}
                    onClick={() => { 
                      setMode('videos'); 
                      setViewMode('list');
                      if (sortKey === 'subs') setSortKey('vph');
                    }}
                  >
                    <div className="mode-card-icon">🎬</div>
                    <div className="mode-card-title">Vídeos</div>
                    <div className="mode-card-desc">Encontra vídeos relacionados</div>
                  </button>
                </div>
              </div>
            )}

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
                  <option value="">🌐 Qualquer Idioma</option>
                  <option value="pt-BR">🇧🇷 Português</option>
                  <option value="en">🇺🇸 Inglês</option>
                  <option value="es">🇪🇸 Espanhol</option>
                  <option value="fr">🇫🇷 Francês</option>
                  <option value="de">🇩🇪 Alemão</option>
                  <option value="it">🇮🇹 Italiano</option>
                  <option value="ru">🇷🇺 Russo</option>
                  <option value="ja">🇯🇵 Japonês</option>
                  <option value="ko">🇰🇷 Coreano</option>
                  <option value="hi">🇮🇳 Hindi</option>
                  <option value="ar">🇸🇦 Árabe</option>
                </select>
                <select
                  id="filter-country"
                  className="filter-select"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="">🌍 Qualquer País</option>
                  <option value="BR">🇧🇷 Brasil</option>
                  <option value="US">🇺🇸 Estados Unidos</option>
                  <option value="PT">🇵🇹 Portugal</option>
                  <option value="GB">🇬🇧 Reino Unido</option>
                  <option value="CA">🇨🇦 Canadá</option>
                  <option value="AU">🇦🇺 Austrália</option>
                  <option value="ES">🇪🇸 Espanha</option>
                  <option value="MX">🇲🇽 México</option>
                  <option value="AR">🇦🇷 Argentina</option>
                  <option value="FR">🇫🇷 França</option>
                  <option value="DE">🇩🇪 Alemanha</option>
                  <option value="IT">🇮🇹 Itália</option>
                  <option value="IN">🇮🇳 Índia</option>
                  <option value="JP">🇯🇵 Japão</option>
                  <option value="KR">🇰🇷 Coreia do Sul</option>
                  <option value="RU">🇷🇺 Rússia</option>
                </select>

                {mode !== 'keywords' && (
                  <select
                    id="filter-sort"
                    className="filter-select"
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                  >
                    {mode === 'canais' ? (
                      <option value="subs">👥 Ordenar por Inscritos</option>
                    ) : (
                      <>
                        <option value="vph">🚀 Ordenar por Viralidade (VPH)</option>
                        <option value="views">👁️ Ordenar por Views</option>
                        <option value="recent">🕐 Mais Recentes</option>
                      </>
                    )}
                  </select>
                )}
              </div>

              {/* Minimum Subscribers (Channels only) */}
              {mode === 'canais' && (
                <div style={{ marginTop: '12px' }}>
                  <div className="section-label">Mínimo de Inscritos</div>
                  <input
                    type="number"
                    className="search-input"
                    placeholder="Ex: 1000"
                    style={{ paddingLeft: '12px' }}
                    value={minSubs || ''}
                    onChange={(e) => setMinSubs(Number(e.target.value))}
                    min={0}
                  />
                </div>
              )}
            </div>

            {/* Date Range Filter */}
            {mode !== 'keywords' && (
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
            )}

            {/* Duration Filter */}
            {mode === 'videos' && (
              <div>
                <div className="section-label">⏱️ Duração do Vídeo</div>
                <div className="date-range-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <button
                    className={`date-range-btn ${videoDuration === 'any' ? 'active' : ''}`}
                    onClick={() => setVideoDuration('any')}
                  >
                    <span>Todos</span>
                  </button>
                  <button
                    className={`date-range-btn ${videoDuration === 'long' ? 'active' : ''}`}
                    onClick={() => setVideoDuration('long')}
                  >
                    <span>Longos</span>
                  </button>
                  <button
                    className={`date-range-btn ${videoDuration === 'short' ? 'active' : ''}`}
                    onClick={() => setVideoDuration('short')}
                  >
                    <span>Curtos/Shorts</span>
                  </button>
                </div>
              </div>
            )}

            {/* Max Results */}
            {mode !== 'keywords' && (
              <div className="range-group">
                <div className="range-label-row">
                  <span className="range-label">Máx. resultados</span>
                  <span className="range-value">{maxResults}</span>
                </div>
                <input
                  id="filter-max-results"
                  type="range"
                  min={5}
                  max={200}
                  step={10}
                  value={maxResults}
                  onChange={(e) => setMaxResults(Number(e.target.value))}
                />
              </div>
            )}

            {/* Search Button */}
            {mode === 'keywords' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className={`search-btn`}
                    style={{ flex: 1, background: isScanning ? 'var(--bg-card-hover)' : '' }}
                    onClick={() => {
                      if (isScanning) return;
                      setIsScanning(true);
                      setTrendKeywords([]);
                      setSortKey('recent');
                      window.espiao?.startTrendScan?.({ hl: language, gl: country, dateRange });
                    }}
                    disabled={isScanning}
                  >
                    🔤 Alfabeto (A-Z)
                  </button>
                  <button
                    className={`search-btn`}
                    style={{ width: '80px', background: isScanning ? 'var(--red)' : 'var(--bg-card-hover)', color: isScanning ? '#fff' : 'var(--text-muted)' }}
                    onClick={() => {
                      if (!isScanning) return;
                      setIsScanning(false);
                      window.espiao?.stopTrendScan?.();
                    }}
                    disabled={!isScanning}
                  >
                    ⏸ Pausar
                  </button>
                </div>
                <button
                  className={`search-btn`}
                  style={{ width: '100%', background: isScanning ? 'var(--bg-card-hover)' : 'var(--accent)', opacity: (!query.trim() || isScanning) ? 0.5 : 1 }}
                  onClick={() => {
                    if (isScanning || !query.trim()) return;
                    setIsScanning(true);
                    setTrendKeywords([]);
                    setSortKey('views30'); // Sort by recent ascensão
                    window.espiao?.startSubnicheScan?.(query, { hl: language, gl: country, dateRange });
                  }}
                  disabled={isScanning || !query.trim()}
                >
                  🌊 Oceano Azul (Subnichos)
                </button>
              </div>
            ) : (
              <button
                id="search-btn"
                className={`search-btn ${loading ? 'loading' : ''}`}
                onClick={handleSearch}
                disabled={loading || !query.trim()}
              >
                {loading ? '' : `🔎 Espionar ${mode === 'canais' ? 'Canais' : 'Vídeos'}`}
              </button>
            )}

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
                ? <><strong>{totalResults}</strong> {mode === 'canais' ? 'canais' : mode === 'videos' ? 'vídeos' : 'termos'} encontrados</>
                : 'Aguardando pesquisa…'}
            </span>

            {hasSearched && !loading && (
              <>
                {mode === 'canais' && [
                  { k: 'subs' as SortKey, label: '👥 Inscritos' },
                ].map(({ k, label }) => (
                  <button
                    key={k}
                    className={`sort-btn ${sortKey === k ? 'active' : ''}`}
                    onClick={() => setSortKey(k)}
                  >
                    {label}
                  </button>
                ))}

                {(mode === 'videos' || mode === 'keywords') && [
                  ...(mode === 'keywords' ? [
                    { k: 'recent' as SortKey, label: '🔠 Letras' },
                    { k: 'views30' as SortKey, label: '🔥 Ascensão (30d)' },
                    { k: 'views90' as SortKey, label: '📈 Força (90d)' },
                    { k: 'views365' as SortKey, label: '👑 Consolidado' }
                  ] : [
                    { k: 'vph' as SortKey, label: '🚀 Viralidade (VPH)' },
                    { k: 'views' as SortKey, label: '👁️ Views' }
                  ]),
                ].map(({ k, label }) => (
                  <button
                    key={k}
                    className={`sort-btn ${sortKey === k ? 'active' : ''}`}
                    onClick={() => setSortKey(k)}
                  >
                    {label}
                  </button>
                ))}

                {(mode === 'canais' || mode === 'videos') && hasSearched && !loading && (
                  <div className="view-mode-toggles">
                    <button
                      className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                      onClick={() => setViewMode('grid')}
                      title="Visualização em Grade"
                    >
                      <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', width: '12px', height: '12px' }}>
                        <div style={{ background: 'currentColor', borderRadius: '1px' }}></div>
                        <div style={{ background: 'currentColor', borderRadius: '1px' }}></div>
                        <div style={{ background: 'currentColor', borderRadius: '1px' }}></div>
                        <div style={{ background: 'currentColor', borderRadius: '1px' }}></div>
                      </span>
                    </button>
                    <button
                      className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                      onClick={() => setViewMode('list')}
                      title="Visualização em Lista"
                    >
                      <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '12px', height: '12px' }}>
                        <div style={{ background: 'currentColor', height: '3px', borderRadius: '1px' }}></div>
                        <div style={{ background: 'currentColor', height: '3px', borderRadius: '1px' }}></div>
                        <div style={{ background: 'currentColor', height: '3px', borderRadius: '1px' }}></div>
                      </span>
                    </button>
                  </div>
                )}
                
                <button
                  className="sort-btn"
                  onClick={handleExport}
                  title="Exportar como CSV"
                  style={{ marginLeft: 'auto', background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)', color: 'var(--green)' }}
                >
                  📥 Exportar CSV
                </button>
              </>
            )}

            {(mode === 'canais' || mode === 'videos' || mode === 'keywords') && hasSearched && !loading && (
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
              {sortedChannels.map((ch, i) => (
                <ChannelCard key={ch.id} ch={ch} idx={i} onClick={() => { setSelectedChannel(ch); setSelectedIdx(i) }} />
              ))}
            </div>
          ) : mode === 'keywords' ? (
              (query.trim() || keywords.length > 0) && !isScanning && trendKeywords.length === 0 ? (
                <div className="keywords-grid">
                  {keywords.map((kw, i) => (
                    <div key={i} className="keyword-card">
                      <span className="keyword-icon">🔑</span>
                      <span className="keyword-text">{kw}</span>
                      <button 
                        className="keyword-search-btn"
                        onClick={(e) => { e.stopPropagation(); setQuery(kw); setMode('videos'); }}
                        title="Pesquisar vídeos com este termo"
                      >
                        🔎
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="keywords-grid-container" style={{ position: 'relative' }}>
                  {(() => {
                    if (sortKey === 'recent') {
                      // Group by first letter
                      const grouped = trendKeywords.reduce((acc, kw) => {
                        const letter = (kw.keyword.charAt(0) || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
                        if (!acc[letter]) acc[letter] = [];
                        acc[letter].push(kw);
                        return acc;
                      }, {} as Record<string, TrendKeyword[]>);

                      const sortedLetters = Object.keys(grouped).sort();

                      return (
                        <>
                          {/* Alphabet Navigation Bar */}
                          {sortedLetters.length > 0 && (
                            <div style={{
                              position: 'sticky',
                              top: '0',
                              zIndex: 10,
                              background: 'var(--bg-card)',
                              padding: '12px 16px',
                              marginBottom: '24px',
                              borderRadius: '12px',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '8px',
                              boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
                            }}>
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                                Ir para:
                              </span>
                              {sortedLetters.map(l => (
                                <button
                                  key={`nav-${l}`}
                                  onClick={() => {
                                    const el = document.getElementById(`letter-${l}`);
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }}
                                  style={{
                                    background: 'var(--bg-main)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-primary)',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseOver={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff'; }}
                                  onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg-main)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                >
                                  {l}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Letter Sections */}
                          {sortedLetters.map(letter => (
                            <div id={`letter-${letter}`} key={letter} className="keyword-group-section" style={{ marginBottom: '24px', width: '100%', scrollMarginTop: '80px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '0 8px' }}>
                                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent)', background: 'rgba(59,130,246,0.15)', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
                                  {letter}
                                </div>
                                <div style={{ height: '1px', flex: 1, background: 'var(--border)' }}></div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{grouped[letter].length} termos</div>
                              </div>
                              <div className="keywords-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                                {grouped[letter].sort((a,b) => a.keyword.localeCompare(b.keyword)).map((kw, i) => {
                                  const isRising = kw.views30 > 0 && kw.views365 > 0 && (kw.views30 > kw.views365 * 0.4);
                                  const isLetterWinner = kw.analyzed && kw.views30 > 0 && Math.max(...grouped[letter].filter(k => k.analyzed).map(k => k.views30)) === kw.views30;
                                  return renderKeywordCard(kw, i, isRising, isLetterWinner);
                                })}
                              </div>
                            </div>
                          ))}
                        </>
                      );
                    }

                    // Flat sorted view
                    return (
                      <div className="keywords-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                        {[...trendKeywords].sort((a,b) => {
                          if (sortKey === 'views30') return b.views30 - a.views30;
                          if (sortKey === 'views60') return b.views60 - a.views60;
                          if (sortKey === 'views90') return b.views90 - a.views90;
                          if (sortKey === 'views365') return b.views365 - a.views365;
                          return a.keyword.localeCompare(b.keyword);
                        }).map((kw, i) => {
                          const isRising = kw.views30 > 0 && kw.views365 > 0 && (kw.views30 > kw.views365 * 0.4);
                          return renderKeywordCard(kw, i, isRising, false);
                        })}
                      </div>
                    );
                    
                    function renderKeywordCard(kw: TrendKeyword, i: number, isRising: boolean, isLetterWinner: boolean) {
                      return (
                        <div key={kw.keyword + i} className="keyword-card" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '14px', gap: '10px', height: 'auto', border: isLetterWinner ? '1px solid var(--accent)' : '' }}>
                          <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="keyword-icon">{isLetterWinner ? '👑' : '🔑'}</span>
                              <span className="keyword-text" style={{ fontSize: '14px', fontWeight: 600, color: isLetterWinner ? 'var(--accent)' : '#fff' }}>{kw.keyword}</span>
                              {isRising && <span style={{ fontSize: '10px', background: 'var(--red)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>ASCENSÃO 🔥</span>}
                            </div>
                            <button 
                              className="keyword-search-btn"
                              onClick={(e) => { e.stopPropagation(); setQuery(kw.keyword); setMode('videos'); handleSearch(); }}
                              title="Pesquisar vídeos com este termo"
                            >
                              🔎
                            </button>
                          </div>
                          {kw.analyzed ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                              <div title={`${fmtFull(kw.views30)} visualizações nos últimos 30 dias`} style={{ fontSize: '11px', color: 'var(--text-secondary)', cursor: 'help' }}>
                                30d: <span style={{color: 'var(--green)', fontWeight: 700}}>{fmt(kw.views30)}</span>
                              </div>
                              <div title={`${fmtFull(kw.views60)} visualizações nos últimos 60 dias`} style={{ fontSize: '11px', color: 'var(--text-secondary)', cursor: 'help' }}>
                                60d: <span style={{color: '#fff', fontWeight: 600}}>{fmt(kw.views60)}</span>
                              </div>
                              <div title={`${fmtFull(kw.views90)} visualizações nos últimos 90 dias`} style={{ fontSize: '11px', color: 'var(--text-secondary)', cursor: 'help' }}>
                                90d: <span style={{color: '#fff', fontWeight: 600}}>{fmt(kw.views90)}</span>
                              </div>
                              <div title={`${fmtFull(kw.views365)} visualizações no último ano`} style={{ fontSize: '11px', color: 'var(--text-secondary)', cursor: 'help' }}>
                                Ano: <span style={{color: '#fff', fontWeight: 600}}>{fmt(kw.views365)}</span>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: '8px', width: '100%' }}>
                              Analisando em 2º plano...
                            </div>
                          )}
                        </div>
                      );
                    }
                  })()}
                </div>
              )
          ) : (
            <div className={`results-grid ${viewMode === 'grid' ? 'grid-view' : 'list-view'}`}>
              {sortedVideos.map((v) => (
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
