import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UploadCloud, Film, Music2, Play, Download, Trash2, X, Clapperboard, Menu, CheckCircle2, AlertCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';
const MAX_BYTES = 2 * 1024 * 1024 * 1024;
const prettySize = (n = 0) => {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB']; let value = n / 1024, i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
};
const mediaUrl = (item) => `${API}${item.url}`;

function App() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('movie');
  const [file, setFile] = useState(null);
  const [poster, setPoster] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState(null);
  const [playing, setPlaying] = useState(null);
  const fileRef = useRef(null);

  async function loadMedia() {
    try {
      const response = await fetch(`${API}/api/media`);
      if (!response.ok) throw new Error('Could not load the media library.');
      setItems(await response.json());
    } catch (e) { setNotice({ type: 'error', text: `${e.message} Make sure the backend is running.` }); }
  }
  useEffect(() => { loadMedia(); }, []);

  const filtered = useMemo(() => items.filter(item => {
    const matchesText = `${item.title} ${item.kind} ${item.originalName}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === 'All' || item.kind === category.toLowerCase();
    return matchesText && matchesCategory;
  }), [items, query, category]);

  function selectFile(e) {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    if (chosen.size > MAX_BYTES) {
      setNotice({ type: 'error', text: 'This file exceeds the 2 GB limit.' });
      e.target.value = ''; setFile(null); return;
    }
    const isVideo = chosen.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv)$/i.test(chosen.name);
    const isAudio = chosen.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(chosen.name);
    if (!isVideo && !isAudio) {
      setNotice({ type: 'error', text: 'Choose a supported video or audio file.' });
      e.target.value = ''; setFile(null); return;
    }
    setFile(chosen); setKind(isAudio ? 'song' : 'movie');
    if (!title.trim()) setTitle(chosen.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
    setNotice(null);
  }

  function uploadMedia(e) {
    e.preventDefault();
    if (!file || !title.trim()) { setNotice({ type: 'error', text: 'Add a title and choose a media file.' }); return; }
    const data = new FormData();
    data.append('title', title.trim());
    data.append('kind', kind);
    data.append('media', file);
    if (poster) data.append('poster', poster);
    setBusy(true); setProgress(0); setNotice(null);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/api/media`);
    xhr.upload.onprogress = event => { if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = async () => {
      setBusy(false);
      let result = {};
      try { result = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        setNotice({ type: 'success', text: `“${result.title || title}” uploaded successfully.` });
        setTitle(''); setFile(null); setPoster(null); setKind('movie'); setShowUpload(false);
        if (fileRef.current) fileRef.current.value = '';
        loadMedia();
      } else {
        setNotice({ type: 'error', text: result.error || `Upload failed (${xhr.status}). Check server and hosting limits.` });
      }
    };
    xhr.onerror = () => { setBusy(false); setNotice({ type: 'error', text: 'Upload connection failed. Check your connection and server settings.' }); };
    xhr.onabort = () => { setBusy(false); setNotice({ type: 'error', text: 'Upload cancelled.' }); };
    xhr.send(data);
  }

  async function deleteItem(item) {
    if (!window.confirm(`Delete “${item.title}”? This removes the uploaded file.`)) return;
    try {
      const res = await fetch(`${API}/api/media/${item.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed.');
      setItems(current => current.filter(x => x.id !== item.id));
      if (playing?.id === item.id) setPlaying(null);
      setNotice({ type: 'success', text: 'Media deleted.' });
    } catch (e) { setNotice({ type: 'error', text: e.message }); }
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#home" aria-label="Phoenix Movies DSX home"><span className="brand-mark"><Clapperboard size={23}/></span><span>PHOENIX<span className="brand-red">_MOVIES</span><small>DSX MEDIA HUB</small></span></a>
      <nav><a href="#library">Library</a><a href="#about">About</a></nav>
      <button className="upload-top" onClick={() => setShowUpload(true)}><UploadCloud size={17}/> Upload media</button>
    </header>

    <main id="home">
      <section className="hero">
        <div className="hero-glow"></div><div className="hero-copy">
          <div className="eyebrow"><span className="live-dot"></span> YOUR PERSONAL MEDIA UNIVERSE</div>
          <h1>Stories worth<br/><span>pressing play.</span></h1>
          <p>Movies, music, and moments — all in one place. Upload your own media, give it a title, and build your collection.</p>
          <div className="hero-actions"><button className="primary-btn" onClick={() => document.getElementById('library').scrollIntoView({behavior:'smooth'})}><Play size={17} fill="currentColor"/> Explore library</button><button className="secondary-btn" onClick={() => setShowUpload(true)}><UploadCloud size={17}/> Upload your files</button></div>
          <div className="hero-stats"><div><strong>{items.length}</strong><span>IN YOUR LIBRARY</span></div><i></i><div><strong>2 GB</strong><span>MAX FILE SIZE</span></div><i></i><div><strong>MP4 + AUDIO</strong><span>MEDIA SUPPORT</span></div></div>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="poster-stack poster-back"><Film size={38}/><span>YOUR NEXT<br/>FAVORITE</span></div><div className="poster-stack poster-front"><div className="poster-sun"></div><div className="poster-lines"></div><div className="poster-label"><span>PHOENIX ORIGINAL</span><b>PLAY<br/>YOUR<br/>WORLD.</b></div><div className="poster-bottom">MOVIES · MUSIC · MORE</div></div><div className="floating-chip"><span className="chip-icon"><Music2 size={16}/></span><span><b>Every sound.</b><small>Every story.</small></span></div></div>
      </section>

      <section className="library section-wrap" id="library">
        <div className="section-heading"><div><div className="eyebrow muted">THE COLLECTION</div><h2>Your media <span>library</span></h2><p>Find something to watch or listen to.</p></div><button className="outline-btn" onClick={() => setShowUpload(true)}><UploadCloud size={16}/> Add media</button></div>
        <div className="library-tools"><div className="search-box"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search titles, movies, songs..." aria-label="Search media"/></div><div className="filters">{['All','Movie','Song'].map(c => <button key={c} className={category===c?'filter active':'filter'} onClick={() => setCategory(c)}>{c==='Movie'?<Film size={15}/>:c==='Song'?<Music2 size={15}/>:<Menu size={15}/>} {c}</button>)}</div></div>

        {filtered.length ? <div className="media-grid">{filtered.map(item => <article className="media-card" key={item.id}>
          <button className={`media-art ${item.kind==='song'?'audio-art':''}`} onClick={() => setPlaying(item)} aria-label={`Play ${item.title}`}>
            {item.posterUrl ? <img src={`${API}${item.posterUrl}`} alt=""/> : <div className="art-symbol">{item.kind==='song'?<Music2 size={40}/>:<Film size={42}/>}<span>PHOENIX DSX</span></div>}
            <span className="play-overlay"><Play size={23} fill="currentColor"/></span><span className="kind-pill">{item.kind==='song'?'♪ SONG':'▰ MOVIE'}</span>
          </button>
          <div className="card-info"><div className="card-title-row"><h3 title={item.title}>{item.title}</h3><button className="icon-btn delete-btn" onClick={() => deleteItem(item)} aria-label={`Delete ${item.title}`} title="Delete"><Trash2 size={16}/></button></div><p>{item.originalName}</p><div className="card-meta"><span>{prettySize(item.size)}</span><span>{item.kind==='song'?'AUDIO':'VIDEO'}</span></div><div className="card-actions"><button onClick={() => setPlaying(item)}><Play size={14} fill="currentColor"/> Play</button><a href={mediaUrl(item)} download={item.originalName}><Download size={14}/> Download</a></div></div>
        </article>)}</div> : <div className="empty-state"><div className="empty-icon"><Film size={30}/></div><h3>{items.length ? 'No matching media' : 'Your library is waiting'}</h3><p>{items.length ? 'Try another search or category.' : 'Upload your first MP4 movie or song to get started.'}</p>{!items.length && <button className="primary-btn" onClick={() => setShowUpload(true)}><UploadCloud size={17}/> Upload first file</button>}</div>}
      </section>

      <section className="upload-banner section-wrap" id="about"><div className="banner-icon"><UploadCloud size={25}/></div><div><h3>Bring your own entertainment.</h3><p>Upload a movie or song up to 2 GB per file. Add a title and find it here whenever you return to this server.</p></div><button className="primary-btn" onClick={() => setShowUpload(true)}>Upload media <span>↗</span></button></section>
    </main>

    <footer><a className="brand footer-brand" href="#home"><span className="brand-mark"><Clapperboard size={20}/></span><span>PHOENIX<span className="brand-red">_MOVIES</span><small>DSX MEDIA HUB</small></span></a><span>Made for your media universe.</span><span>© {new Date().getFullYear()} Phoenix Movies DSX</span></footer>

    {notice && <div className={`toast ${notice.type}`} role="status">{notice.type==='success'?<CheckCircle2 size={18}/>:<AlertCircle size={18}/>}<span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16}/></button></div>}

    {showUpload && <div className="modal-backdrop" onMouseDown={e => { if(e.target===e.currentTarget && !busy) setShowUpload(false); }}><section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-heading">
      <div className="modal-head"><div><div className="eyebrow muted">ADD TO YOUR COLLECTION</div><h2 id="upload-heading">Upload <span>media</span></h2></div><button className="icon-btn close-modal" onClick={() => !busy && setShowUpload(false)} disabled={busy} aria-label="Close"><X/></button></div>
      <form onSubmit={uploadMedia}>
        <label className="field-label" htmlFor="media-title">Title</label><input id="media-title" className="text-field" value={title} onChange={e => setTitle(e.target.value)} placeholder="Give your movie or song a title" maxLength={140} required/>
        <label className="field-label" htmlFor="media-kind">Media type</label><select id="media-kind" className="text-field" value={kind} onChange={e => setKind(e.target.value)}><option value="movie">Movie / Video</option><option value="song">Song / Audio</option></select>
        <label className="field-label">Media file</label><button type="button" className={`dropzone ${file?'has-file':''}`} onClick={() => fileRef.current?.click()}><span className="drop-icon">{file?<CheckCircle2 size={25}/>:<UploadCloud size={27}/>}</span><b>{file ? file.name : 'Choose a movie or song'}</b><span>{file ? `${prettySize(file.size)} · Ready to upload` : 'MP4, WebM, MOV, MP3, M4A, WAV and more'}</span><small>Maximum file size: 2 GB</small></button>
        <input ref={fileRef} type="file" accept="video/*,audio/*,.mp4,.webm,.mov,.m4v,.mkv,.mp3,.m4a,.aac,.wav,.ogg,.flac" onChange={selectFile} hidden/>
        <label className="field-label" htmlFor="media-poster">Poster image <span className="optional">(optional)</span></label><input id="media-poster" className="text-field file-field" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setPoster(e.target.files?.[0] || null)}/>
        {busy && <div className="progress-wrap"><div className="progress-label"><span>Uploading file…</span><b>{progress}%</b></div><div className="progress-track"><div style={{width:`${progress}%`}}/></div><small>Keep this page open until the upload finishes.</small></div>}
        <div className="modal-actions"><button type="button" className="secondary-btn" disabled={busy} onClick={() => setShowUpload(false)}>Cancel</button><button type="submit" className="primary-btn" disabled={busy || !file}>{busy ? `Uploading ${progress}%` : <><UploadCloud size={17}/> Upload file</>}</button></div>
        <p className="privacy-note">Upload only media you own or have permission to share. Large uploads depend on your server and hosting provider.</p>
      </form>
    </section></div>}

    {playing && <div className="modal-backdrop player-backdrop" onMouseDown={e => {if(e.target===e.currentTarget)setPlaying(null)}}><section className="player-modal" role="dialog" aria-modal="true" aria-label={playing.title}><div className="player-head"><div><span className="eyebrow muted">{playing.kind==='song'?'NOW PLAYING · AUDIO':'NOW PLAYING · VIDEO'}</span><h2>{playing.title}</h2></div><button className="icon-btn" onClick={() => setPlaying(null)} aria-label="Close player"><X/></button></div>{playing.kind==='song'?<div className="audio-player-art"><Music2 size={56}/><p>{playing.title}</p><audio controls autoPlay src={mediaUrl(playing)} /></div>:<video className="video-player" controls autoPlay src={mediaUrl(playing)} />}</section></div>}
  </div>;
}
export default App;