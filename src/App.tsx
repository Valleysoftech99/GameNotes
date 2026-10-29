import { useEffect, useState, type FormEvent } from 'react'
import type { Game, UserProfile } from './domain/schemas'
import { loadLocalWorkspace, saveGame, saveLocalProfile, saveRawgMetadata } from './data/profileAndGames'
import GameWorkspace from './GameWorkspace'
import BackupPanel from './BackupPanel'
import { getRawgGameDetails, testRawgApiKey, type RawgGameDetails } from './data/rawgService'
import RawgGamePicker from './RawgGamePicker'

const avatarChoices = ['🌸', '🪻', '🌙', '⭐', '🎮', '🦊', '🐉', '🪐']
type Screen = 'loading' | 'profile' | 'games' | 'gameForm' | 'workspace'

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading')
  const [profile, setProfile] = useState<UserProfile>()
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<Game>()
  const [editingGame, setEditingGame] = useState<Game>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [updateWaiting, setUpdateWaiting] = useState(false)


  useEffect(() => {
    let mounted = true
    loadLocalWorkspace()
      .then((snapshot) => {
        if (!mounted) return
        setProfile(snapshot.profile)
        setGames(snapshot.games)
        setScreen(snapshot.profile ? 'games' : 'profile')
      })
      .catch((loadError: unknown) => {
        if (!mounted) return
        setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar tus datos locales.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const onWaiting = () => setUpdateWaiting(true)
    const onActivated = () => setUpdateWaiting(false)
    window.addEventListener('notegame:sw-update-waiting', onWaiting)
    window.addEventListener('notegame:sw-update-activated', onActivated)
    setUpdateWaiting(window.__notegameUpdateWaiting === true)
    return () => {
      window.removeEventListener('notegame:sw-update-waiting', onWaiting)
      window.removeEventListener('notegame:sw-update-activated', onActivated)
    }
  }, [])

  function startCreateGame() {
    setEditingGame(undefined)
    setError('')
    setScreen('gameForm')
  }

  function startEditGame(game: Game) {
    setEditingGame(game)
    setError('')
    setScreen('gameForm')
  }

  async function handleProfileSubmit(name: string, avatar: string, rawgApiKey: string) {
    setError('')
    try {
      const saved = await saveLocalProfile(name, avatar, rawgApiKey)
      setProfile(saved)
      setScreen('games')
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el perfil en este dispositivo.')
    }
  }

  async function handleGameSubmit(name: string, rawgSelection?: RawgGameDetails) {
    setError('')
    try {
      const saved = await saveGame(name, editingGame, rawgSelection ? rawgMetadataFrom(rawgSelection) : undefined)
      setGames((current) => [...current.filter((game) => game.id !== saved.id), saved].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
      if (selectedGame?.id === saved.id) setSelectedGame(saved)
      setEditingGame(undefined)
      setScreen('games')
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el juego en este dispositivo.')
    }
  }

  async function handleRawgLink(game: Game, detail: RawgGameDetails) {
    const saved = await saveRawgMetadata(game.id, {
      rawgId: detail.id,
      ...(detail.backgroundImage ? { coverUrl: detail.backgroundImage } : {}),
      ...(detail.released ? { releaseDate: detail.released } : {}),
      genres: detail.genres.slice(0, 100), platforms: detail.platforms.slice(0, 100), developers: detail.developers.slice(0, 100),
      ...(detail.metacritic == null ? {} : { metacriticScore: detail.metacritic }),
      ...(detail.description ? { description: detail.description.slice(0, 10_000) } : {}),
    })
    setGames((current) => current.map((row) => row.id === saved.id ? saved : row))
    if (selectedGame?.id === saved.id) setSelectedGame(saved)
  }

  async function handleRawgUnlink(game: Game) {
    setError('')
    try {
      const saved = await saveRawgMetadata(game.id, undefined)
      setGames((current) => current.map((row) => row.id === saved.id ? saved : row))
      if (selectedGame?.id === saved.id) setSelectedGame(saved)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo desvincular RAWG.') }
  }

  async function handleRawgRefresh(game: Game) {
    setError('')
    try {
      if (!profile?.rawgApiKey || !game.rawgId) throw new Error('Configura una clave RAWG en Perfil para actualizar estos datos.')
      const detail = await getRawgGameDetails(profile.rawgApiKey, game.rawgId)
      await handleRawgLink(game, detail)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron actualizar los datos RAWG.') }
  }
  function openGame(game: Game) {
    setSelectedGame(game)
    setError('')
    setScreen('workspace')
  }

  async function handleRestoreComplete() {
    const snapshot = await loadLocalWorkspace()
    setProfile(snapshot.profile)
    setGames(snapshot.games)
    setSelectedGame(undefined)
    setScreen('profile')
  }

  return (
    <main className="app-shell">
      <div className="glow glow-one" aria-hidden="true" />
      <div className="glow glow-two" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Notegame, inicio" onClick={(event) => { event.preventDefault(); setScreen(profile ? 'games' : 'profile') }}>
          <span className="brand-mark" aria-hidden="true">✿</span>
          <span>notegame</span>
        </a>
        <div className="topbar-actions">
          <span className="local-badge"><span /> Datos locales</span>
          {profile && screen !== 'profile' && (
            <button className="profile-chip" type="button" onClick={() => { setError(''); setScreen('profile') }} aria-label="Editar perfil">
              <span aria-hidden="true">{profile.avatar || '🙂'}</span><span>{profile.name}</span>
            </button>
          )}
        </div>
      </header>

      {updateWaiting && <div className="update-notice" role="status" aria-live="polite">Hay una versión nueva de Notegame. Para activarla sin interrumpir esta sesión, cerrá todas las pestañas de Notegame y volvé a abrirla.</div>}

      {loading ? (
        <section className="page-card status-card" aria-live="polite"><p className="eyebrow">PREPARANDO TU ESPACIO</p><p>Cargando datos locales…</p></section>
      ) : error && !profile && screen === 'loading' ? (
        <section className="page-card status-card" role="alert"><h1>No pudimos abrir tus datos</h1><p>{error}</p><button className="primary-button" type="button" onClick={() => window.location.reload()}>Volver a intentar</button></section>
      ) : screen === 'profile' ? (
        <ProfileForm profile={profile} onSubmit={handleProfileSubmit} onRestoreComplete={handleRestoreComplete} error={error} />
      ) : screen === 'gameForm' ? (
        <GameForm game={editingGame} rawgApiKey={profile?.rawgApiKey} onSubmit={handleGameSubmit} onCancel={() => { setError(''); setScreen('games') }} error={error} />
      ) : screen === 'workspace' && selectedGame ? (
        <GameWorkspace game={selectedGame} avatar={profile?.avatar} onBack={() => setScreen('games')} />
      ) : (
        <GamesPage
          profile={profile}
          games={games}
          onCreate={startCreateGame}
          onEdit={startEditGame}
          onOpen={openGame}
          onRawgUnlink={handleRawgUnlink}
          onRawgRefresh={handleRawgRefresh}
          error={error}
        />
      )}
      <footer>Hecho para que vuelvas a jugar, no a buscar tus notas.</footer>
    </main>
  )
}

function ProfileForm({ profile, onSubmit, onRestoreComplete, error }: {
  profile?: UserProfile
  onSubmit: (name: string, avatar: string, rawgApiKey: string) => Promise<void>
  onRestoreComplete: () => Promise<void>
  error: string
}) {
  const [name, setName] = useState(profile?.name ?? '')
  const [avatar, setAvatar] = useState(profile?.avatar || avatarChoices[0])
  const [rawgApiKey, setRawgApiKey] = useState(profile?.rawgApiKey ?? '')
  const [keyTest, setKeyTest] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(profile?.name ?? '')
    setAvatar(profile?.avatar || avatarChoices[0])
    setRawgApiKey(profile?.rawgApiKey ?? '')
    setKeyTest('idle')
  }, [profile?.id, profile?.name, profile?.avatar, profile?.rawgApiKey])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    await onSubmit(name, avatar, rawgApiKey)
    setSaving(false)
  }

  async function testKey() {
    setKeyTest('testing')
    try { await testRawgApiKey(rawgApiKey); setKeyTest('valid') }
    catch { setKeyTest('invalid') }
  }

  return (
    <section className="page-card form-card">
      <p className="eyebrow">{profile ? 'TU PERFIL' : 'PRIMEROS PASOS'}</p>
      <h1>{profile ? <>Editar tu <span>perfil.</span></> : <>Tu partida,<br />a tu <span>manera.</span></>}</h1>
      <p className="intro">Elegí un nombre y un avatar para identificar tu espacio. Tus datos quedan guardados en este dispositivo.</p>
      <form className="stacked-form" onSubmit={submit}>
        <label className="field-label" htmlFor="profile-name">Tu nombre</label>
        <input id="profile-name" className="text-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="¿Cómo te llamamos?" autoComplete="nickname" required />
        <fieldset className="avatar-picker">
          <legend className="field-label">Elegí un avatar</legend>
          <div className="avatar-options">
            {avatarChoices.map((choice) => (
              <button key={choice} type="button" className={`avatar-option${avatar === choice ? ' selected' : ''}`} onClick={() => setAvatar(choice)} aria-pressed={avatar === choice} aria-label={`Elegir avatar ${choice}`}>{choice}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="rawg-key-field">
          <legend className="field-label">RAWG API (opcional)</legend>
          <label className="field-label" htmlFor="rawg-api-key">Clave personal</label>
          <input id="rawg-api-key" className="text-input" type="password" value={rawgApiKey} onChange={(event) => { setRawgApiKey(event.target.value); setKeyTest('idle') }} autoComplete="new-password" spellCheck={false} />
          <p className="panel-hint">La clave se guarda localmente sin cifrado y no se incluye en los respaldos. No la reutilices si no aceptas este riesgo.</p>
          <div className="form-actions"><button className="secondary-button" type="button" onClick={() => void testKey()} disabled={keyTest === 'testing' || !rawgApiKey.trim()}>{keyTest === 'testing' ? 'Probando…' : 'Probar clave'}</button>{rawgApiKey && <button className="text-button" type="button" onClick={() => { setRawgApiKey(''); setKeyTest('idle') }}>Borrar clave (guardar cambios después)</button>}</div>
          {keyTest === 'valid' && <p className="success-message" role="status">La clave respondió correctamente. Guarda el perfil para conservarla.</p>}
          {keyTest === 'invalid' && <p className="form-error" role="alert">No se pudo validar la clave. Revisa la clave o la conexión.</p>}
        </fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : profile ? 'Guardar perfil' : 'Crear perfil y continuar'}</button>
      </form>
      {profile && <BackupPanel onRestoreComplete={onRestoreComplete} />}
    </section>
  )
}

function GamesPage({ profile, games, onCreate, onEdit, onOpen, onRawgUnlink, onRawgRefresh, error }: {
  profile?: UserProfile
  games: Game[]
  onCreate: () => void
  onEdit: (game: Game) => void
  onOpen: (game: Game) => void
  onRawgUnlink: (game: Game) => Promise<void>
  onRawgRefresh: (game: Game) => Promise<void>
  error: string
}) {
  return (
    <section className="page-card games-page">
      <div className="section-heading">
        <div><p className="eyebrow">{profile ? `HOLA, ${profile.name.toLocaleUpperCase()}` : 'TU BIBLIOTECA'}</p><h1>Mis <span>juegos.</span></h1></div>
        <button className="primary-button create-game-button" type="button" onClick={onCreate}><span aria-hidden="true">＋</span> Nuevo juego</button>
      </div>
      <p className="intro">Cada juego tiene sus propias anotaciones y objetivos.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {games.length === 0 ? (
        <div className="empty-state"><span className="coming-icon" aria-hidden="true">✿</span><h2>Tu próxima aventura empieza acá</h2><p>Creá tu primer juego para preparar objetivos y anotar lo que querés conseguir.</p><button className="secondary-button" type="button" onClick={onCreate}>Crear mi primer juego</button></div>
      ) : (
        <div className="games-grid">
          {games.map((game) => (
            <article className="game-card" key={game.id}>
              {game.rawgId ? <div className="game-cover"><div className="cover-fallback" aria-hidden="true">Sin carátula</div>{game.coverUrl && <img src={game.coverUrl} alt={`Carátula de ${game.name}`} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} />}</div> : <div className="game-card-symbol" aria-hidden="true">✧</div>}
              <h2>{game.name}</h2>
              {game.rawgId ? <div className="game-metadata"><p>{game.releaseDate ? `Lanzamiento: ${game.releaseDate.slice(0, 4)}` : 'Año no disponible'}{game.metacriticScore != null ? ` · Metacritic ${game.metacriticScore}` : ''}</p>{game.genres?.length ? <p>Géneros: {game.genres.join(', ')}</p> : null}{game.platforms?.length ? <p>Plataformas: {game.platforms.join(', ')}</p> : null}{game.developers?.length ? <p>Desarrolladores: {game.developers.join(', ')}</p> : null}{game.description && <p className="game-description">{game.description}</p>}<p className="rawg-attribution">Datos e imágenes: <a href="https://rawg.io" target="_blank" rel="noreferrer">RAWG</a>.</p><div className="form-actions"><button className="secondary-button" type="button" onClick={() => void onRawgRefresh(game)}>Actualizar datos</button><button className="text-button" type="button" onClick={() => void onRawgUnlink(game)}>Desvincular</button></div></div> : <p>Espacio personal de juego</p>}
              <div className="game-card-actions"><button className="primary-button" type="button" onClick={() => onOpen(game)}>Entrar</button><button className="secondary-button" type="button" onClick={() => onEdit(game)}>Editar</button></div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function rawgMetadataFrom(detail: RawgGameDetails) {
  return {
    rawgId: detail.id,
    ...(detail.backgroundImage ? { coverUrl: detail.backgroundImage } : {}),
    ...(detail.released ? { releaseDate: detail.released } : {}),
    genres: detail.genres,
    platforms: detail.platforms,
    developers: detail.developers,
    ...(detail.metacritic == null ? {} : { metacriticScore: detail.metacritic }),
    ...(detail.description ? { description: detail.description.slice(0, 10_000) } : {}),
  }
}

function GameForm({ game, rawgApiKey, onSubmit, onCancel, error }: {
  game?: Game
  rawgApiKey?: string
  onSubmit: (name: string, selection?: RawgGameDetails) => Promise<void>
  onCancel: () => void
  error: string
}) {
  const [name, setName] = useState(game?.name ?? '')
  const [rawgSelection, setRawgSelection] = useState<RawgGameDetails>()
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    try { await onSubmit(name.trim() || rawgSelection?.name || '', rawgSelection) }
    finally { setSaving(false) }
  }

  return (
    <section className="page-card form-card game-form-card">
      <button className="text-button back-link" type="button" onClick={onCancel}>← Volver a mis juegos</button>
      <p className="eyebrow">{game ? 'ACTUALIZAR ESPACIO' : 'NUEVA AVENTURA'}</p>
      <h1>{game ? <>Editar <span>juego.</span></> : <>Elegí tu<br /><span>juego.</span></>}</h1>
      <p className="intro">Escribe el nombre para buscar automáticamente su ficha. Al agregarlo, aparecerá en tu biblioteca con carátula e información; después podrás entrar y crear listas y anotaciones.</p>
      <form className="stacked-form" onSubmit={submit}>
        <label className="field-label" htmlFor="game-name">Nombre en tu biblioteca</label>
        <input id="game-name" className="text-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej.: Stardew Valley" autoComplete="off" required />
        <RawgGamePicker apiKey={rawgApiKey} query={name} selected={rawgSelection} onSelect={setRawgSelection} />
        {game?.rawgId && <p className="panel-hint">Este juego ya tiene una ficha RAWG vinculada. Si eliges otra, se reemplazarán esos metadatos; el nombre local se mantiene.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button className="primary-button" type="submit" disabled={saving || !name.trim()}>{saving ? 'Guardando…' : game ? 'Guardar cambios' : 'Agregar a mis juegos'}</button><button className="secondary-button" type="button" onClick={onCancel}>Cancelar</button></div>
      </form>
    </section>
  )
}


