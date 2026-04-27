import React, { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('media');
  const [activePropertyTab, setActivePropertyTab] = useState('video');
  const [resourceTab, setResourceTab] = useState('local');

  // Core State
  const [mediaItems, setMediaItems] = useState([]);
  const [clips, setClips] = useState([]);
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [playheadTime, setPlayheadTime] = useState(0); // in seconds
  const [isPlaying, setIsPlaying] = useState(false);

  const fileInputRef = useRef(null);
  const timerRef = useRef(null);

  // Playback logic
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setPlayheadTime(prev => {
          // loop back to 0 if we hit 60 seconds for demo purposes
          if (prev >= 60) return 0;
          return prev + 0.1;
        });
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  const togglePlayback = () => setIsPlaying(!isPlaying);

  // Import Media
  const handleImportClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const newMedia = files.map(file => ({
      id: 'media_' + Date.now() + Math.random(),
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type.startsWith('video') ? 'video' : 'image'
    }));
    setMediaItems([...mediaItems, ...newMedia]);
    e.target.value = null; // reset
  };

  // Add to Timeline
  const handleAddMediaToTimeline = (media) => {
    const defaultDuration = media.type === 'video' ? 10 : 5; // seconds
    const newClip = {
      id: 'clip_' + Date.now(),
      mediaId: media.id,
      name: media.name,
      type: media.type,
      startTime: 0, // In a real app, find the end of the track or playhead
      duration: defaultDuration,
      url: media.url,
      transform: {
        scale: 100,
        x: 0,
        y: 0,
        opacity: 100
      }
    };
    
    // Auto-append to the end of existing clips
    if (clips.length > 0) {
      const lastClip = clips[clips.length - 1];
      newClip.startTime = lastClip.startTime + lastClip.duration;
    }

    setClips([...clips, newClip]);
    setSelectedClipId(newClip.id);
  };

  // Property Change Handlers
  const handlePropertyChange = (property, value) => {
    if (!selectedClipId) return;
    setClips(clips.map(clip => {
      if (clip.id === selectedClipId) {
        return {
          ...clip,
          transform: {
            ...clip.transform,
            [property]: Number(value)
          }
        };
      }
      return clip;
    }));
  };

  // Selected Clip Helper
  const selectedClip = clips.find(c => c.id === selectedClipId) || null;

  // Format Time Helper
  const formatTime = (timeInSeconds) => {
    const m = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    const ms = Math.floor((timeInSeconds % 1) * 100).toString().padStart(2, '0');
    return `00:${m}:${s}:${ms}`;
  };

  // Calculate playhead position in pixels (assuming 1 sec = 10px for now)
  const TIME_SCALE = 10; // 10 pixels per second
  const playheadPos = playheadTime * TIME_SCALE;

  // Find clip at playhead
  const clipAtPlayhead = clips.find(c => playheadTime >= c.startTime && playheadTime <= c.startTime + c.duration);

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">CapCut Clone</div>
          <button className="menu-btn">Menu</button>
          <span className="save-status">Salvo automaticamente</span>
        </div>
        <div className="header-center">
          <span className="timecode">{formatTime(playheadTime)}</span>
        </div>
        <div className="header-right">
          <button className="pro-btn">Pro</button>
          <button className="share-btn">Compartilhar</button>
          <button className="export-btn">Exportar</button>
          <div className="window-controls">
            <span className="window-btn minimize">_</span>
            <span className="window-btn maximize">□</span>
            <span className="window-btn close">×</span>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div className="main-workspace">
        
        {/* LEFT NAV BAR */}
        <div className="left-nav">
          <div className={`nav-item ${activeTab === 'media' ? 'active' : ''}`} onClick={() => setActiveTab('media')}>
            <span className="nav-icon">📁</span><span>Mídia</span>
          </div>
          <div className={`nav-item ${activeTab === 'audio' ? 'active' : ''}`} onClick={() => setActiveTab('audio')}>
            <span className="nav-icon">🎵</span><span>Áudio</span>
          </div>
          <div className={`nav-item ${activeTab === 'text' ? 'active' : ''}`} onClick={() => setActiveTab('text')}>
            <span className="nav-icon">T</span><span>Texto</span>
          </div>
          <div className="nav-item"><span className="nav-icon">✨</span><span>Efeitos</span></div>
          <div className="nav-item"><span className="nav-icon">🔁</span><span>Transições</span></div>
          <div className="nav-item"><span className="nav-icon">🎨</span><span>Filtros</span></div>
        </div>

        {/* RESOURCE PANEL */}
        <div className="resource-panel">
          <div className="panel-header">
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              multiple 
              accept="video/*,image/*" 
              onChange={handleFileChange} 
            />
            <button className="import-btn" onClick={handleImportClick}>+ Importar</button>
            <div className="search-bar">
              <input type="text" placeholder="Pesquisar mídia" />
            </div>
          </div>
          
          <div className="resource-tabs">
            <span className={`resource-tab ${resourceTab === 'local' ? 'active' : ''}`} onClick={() => setResourceTab('local')}>Local</span>
            <span className={`resource-tab ${resourceTab === 'ai' ? 'active' : ''}`} onClick={() => setResourceTab('ai')}>Mídia de IA</span>
            <span className={`resource-tab ${resourceTab === 'lib' ? 'active' : ''}`} onClick={() => setResourceTab('lib')}>Biblioteca</span>
          </div>

          <div className="media-grid">
            {mediaItems.length === 0 ? (
              <div style={{ color: '#666', fontSize: 12, padding: 16 }}>Nenhuma mídia. Clique em + Importar.</div>
            ) : (
              mediaItems.map(item => (
                <div className="media-item" key={item.id} onClick={() => handleAddMediaToTimeline(item)} title="Clique para adicionar à timeline">
                  <div className="media-thumbnail">
                    {item.type === 'image' && <img src={item.url} style={{width:'100%', height:'100%', objectFit:'cover', borderRadius:4}} alt="" />}
                    {item.type === 'video' && <video src={item.url} style={{width:'100%', height:'100%', objectFit:'cover', borderRadius:4}} />}
                  </div>
                  <span className="media-name">{item.name}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CANVAS */}
        <div className="video-player">
          <div className="player-header">
            <span>Reproduzindo - Linha do tempo 01</span>
            <button className="icon-btn">⋮</button>
          </div>
          <div className="canvas-area">
            <div className="canvas-placeholder" style={{ position: 'relative', overflow: 'hidden' }}>
              {clipAtPlayhead ? (
                clipAtPlayhead.type === 'video' ? (
                  <video 
                    src={clipAtPlayhead.url} 
                    style={{
                      width: '100%', height: '100%', objectFit: 'contain',
                      transform: `scale(${clipAtPlayhead.transform.scale / 100}) translate(${clipAtPlayhead.transform.x}px, ${clipAtPlayhead.transform.y}px)`,
                      opacity: clipAtPlayhead.transform.opacity / 100
                    }} 
                  />
                ) : (
                  <img 
                    src={clipAtPlayhead.url} 
                    style={{
                      width: '100%', height: '100%', objectFit: 'contain',
                      transform: `scale(${clipAtPlayhead.transform.scale / 100}) translate(${clipAtPlayhead.transform.x}px, ${clipAtPlayhead.transform.y}px)`,
                      opacity: clipAtPlayhead.transform.opacity / 100
                    }} 
                    alt="" 
                  />
                )
              ) : (
                <span className="preview-text">Sem clipe no momento</span>
              )}
            </div>
          </div>
          <div className="player-controls">
            <span className="player-time">{formatTime(playheadTime)}</span>
            <div className="playback-buttons">
              <button className="icon-btn" onClick={() => setPlayheadTime(0)}>⏪</button>
              <button className="icon-btn play" onClick={togglePlayback}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button className="icon-btn" onClick={() => setPlayheadTime(prev => prev + 5)}>⏩</button>
            </div>
            <div className="player-tools">
              <button className="icon-btn">🔍</button>
              <button className="icon-btn">🔲</button>
            </div>
          </div>
        </div>

        {/* PROPERTIES */}
        <div className="properties-panel">
          <div className="properties-tabs">
            <button className={`prop-tab ${activePropertyTab === 'video' ? 'active' : ''}`} onClick={() => setActivePropertyTab('video')}>Vídeo</button>
            <button className={`prop-tab ${activePropertyTab === 'audio' ? 'active' : ''}`} onClick={() => setActivePropertyTab('audio')}>Áudio</button>
            <button className={`prop-tab ${activePropertyTab === 'adjust' ? 'active' : ''}`} onClick={() => setActivePropertyTab('adjust')}>Ajuste</button>
          </div>

          <div className="properties-content">
            {!selectedClip ? (
              <div style={{ color: '#666', fontSize: 12, padding: 16 }}>Selecione um clipe na linha do tempo para editar.</div>
            ) : (
              <>
                <div className="sub-tabs">
                  <span className="sub-tab active">Básico</span>
                  <span className="sub-tab">Retoque</span>
                </div>
                
                <div className="property-group">
                  <div className="property-header">Transformar</div>
                  
                  <div className="property-row">
                    <span className="property-label">Escala</span>
                    <input type="range" className="property-slider" min="0" max="200" value={selectedClip.transform.scale} onChange={e => handlePropertyChange('scale', e.target.value)} />
                    <span className="property-value">{selectedClip.transform.scale}%</span>
                  </div>
                  
                  <div className="property-row">
                    <span className="property-label">Posição</span>
                    <div className="position-inputs">
                      <span>X</span> <input type="number" value={selectedClip.transform.x} onChange={e => handlePropertyChange('x', e.target.value)} />
                      <span>Y</span> <input type="number" value={selectedClip.transform.y} onChange={e => handlePropertyChange('y', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="property-group">
                  <div className="property-header">Mistura</div>
                  <div className="property-row">
                    <span className="property-label">Opacidade</span>
                    <input type="range" className="property-slider" min="0" max="100" value={selectedClip.transform.opacity} onChange={e => handlePropertyChange('opacity', e.target.value)} />
                    <span className="property-value">{selectedClip.transform.opacity}%</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      {/* TIMELINE */}
      <div className="timeline-area">
        <div className="timeline-toolbar">
          <div className="toolbar-left">
            <button className="icon-btn">↩</button>
            <button className="icon-btn">↪</button>
            <div className="toolbar-divider"></div>
            <button className="icon-btn" onClick={() => {
              if (selectedClipId) setClips(clips.filter(c => c.id !== selectedClipId));
            }}>🗑️</button>
          </div>
          <div className="toolbar-right">
            <input type="range" className="zoom-slider" />
          </div>
        </div>
        
        <div className="timeline-workspace">
          <div className="track-headers">
            <div className="track-header">
              <span className="track-icon">👁️</span>
              <span className="track-icon">🔒</span>
            </div>
          </div>
          <div className="tracks-container">
            <div className="time-ruler">
              {[0, 10, 20, 30, 40, 50, 60].map(sec => (
                 <span key={sec} style={{ position: 'absolute', left: sec * TIME_SCALE }}>{sec}s</span>
              ))}
            </div>
            
            <div className="track">
              {clips.map(clip => (
                <div 
                  key={clip.id} 
                  className={`clip ${clip.type === 'video' ? 'video-clip' : 'image-clip'} ${selectedClipId === clip.id ? 'selected' : ''}`} 
                  style={{ 
                    width: clip.duration * TIME_SCALE, 
                    left: clip.startTime * TIME_SCALE 
                  }}
                  onClick={() => setSelectedClipId(clip.id)}
                >
                  <span className="clip-name">{clip.name}</span>
                </div>
              ))}
              
              {/* Playhead Marker */}
              <div className="playhead-line" style={{ left: playheadPos }}>
                <div className="playhead-head"></div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

