import { useEffect, useRef, useState } from 'react'
import { getRawgGameDetails, rawgErrorMessage, searchRawgGames, type RawgGameDetails, type RawgSearchResult } from './data/rawgService'

export default function RawgGamePicker({ apiKey, query, selected, onSelect }: {
  apiKey?: string
  query: string
  selected?: RawgGameDetails
  onSelect: (game: RawgGameDetails | undefined) => void
}) {
  const [results, setResults] = useState<RawgSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingId, setLoadingId] = useState<number>()
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const activeSearch = useRef<AbortController | undefined>(undefined)

  useEffect(() => {
    const term = query.trim().replace(/\s+/g, ' ')
    if (!apiKey || selected || term.length < 3) {
      setResults([]); setLoading(false); setSearched(false); setError('')
      return
    }
    const controller = new AbortController()
    activeSearch.current = controller
    setResults([]); setLoading(true); setSearched(true); setError('')
    const timer = window.setTimeout(() => {
      void searchRawgGames(apiKey, term, controller.signal)
        .then((found) => { if (!controller.signal.aborted) setResults(found) })
        .catch((cause: unknown) => { if (!controller.signal.aborted) setError(rawgErrorMessage(cause)) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 650)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [apiKey, query, Boolean(selected)])

  async function choose(result: RawgSearchResult) {
    if (!apiKey || loadingId !== undefined) return
    activeSearch.current?.abort()
    const controller = new AbortController()
    activeSearch.current = controller
    setLoadingId(result.id); setError('')
    try {
      const detail = await getRawgGameDetails(apiKey, result.id, controller.signal)
      if (!controller.signal.aborted) onSelect(detail)
    } catch (cause) { if (!controller.signal.aborted) setError(rawgErrorMessage(cause)) }
    finally { if (!controller.signal.aborted) setLoadingId(undefined) }
  }

  if (!apiKey) return <section className="rawg-picker content-panel" aria-labelledby="rawg-picker-title"><p className="eyebrow">FICHA DEL JUEGO</p><h2 id="rawg-picker-title">Buscar carátula e información</h2><p className="panel-hint">Configura una clave en Perfil para consultar RAWG. También puedes agregar el juego manualmente.</p><p className="rawg-attribution">Datos e imágenes de <a href="https://rawg.io" target="_blank" rel="noreferrer">RAWG</a>.</p></section>

  return <section className="rawg-picker content-panel" aria-labelledby="rawg-picker-title">
    <p className="eyebrow">FICHA DEL JUEGO</p>
    <h2 id="rawg-picker-title">{selected ? 'Juego seleccionado' : 'Resultados de RAWG'}</h2>
    <p className="panel-hint">{selected ? 'Esta ficha se guardará junto al juego.' : 'Buscamos automáticamente mientras escribes el nombre. El término y tu clave se envían a RAWG.'}</p>
    {selected ? <div className="rawg-selected"><div className="rawg-selected-cover">{selected.backgroundImage ? <img src={selected.backgroundImage} alt={`Carátula de ${selected.name}`} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <span>Sin carátula</span>}</div><div className="rawg-selected-info"><h3>{selected.name}</h3><p>{[selected.released?.slice(0, 4), selected.genres.join(', '), selected.metacritic != null ? `Metacritic ${selected.metacritic}` : ''].filter(Boolean).join(' · ') || 'Información parcial'}</p>{selected.platforms.length > 0 && <p>Plataformas: {selected.platforms.join(', ')}</p>}{selected.developers.length > 0 && <p>Desarrolladores: {selected.developers.join(', ')}</p>}<button className="text-button" type="button" onClick={() => onSelect(undefined)}>Cambiar selección</button></div></div> : <>
      {query.trim().length < 3 && <p className="panel-hint">Escribe al menos 3 caracteres para ver sugerencias automáticas.</p>}
      {loading && <p className="panel-hint" role="status">Buscando coincidencias…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {results.length > 0 && <ul className="rawg-picker-results">{results.map((result) => <li className="rawg-picker-result" key={result.id}><div className="rawg-picker-cover">{result.backgroundImage ? <img src={result.backgroundImage} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <span aria-hidden="true">Sin carátula</span>}</div><div className="rawg-picker-info"><h3>{result.name}</h3><p>{[result.released?.slice(0, 4), result.genres.join(', '), result.metacritic != null ? `Metacritic ${result.metacritic}` : ''].filter(Boolean).join(' · ') || 'Información parcial'}</p>{result.platforms.length > 0 && <p>Plataformas: {result.platforms.slice(0, 4).join(', ')}</p>}</div><button className="secondary-button" type="button" onClick={() => void choose(result)} disabled={loadingId !== undefined}>{loadingId === result.id ? 'Cargando ficha…' : 'Elegir juego'}</button></li>)}</ul>}
      {searched && !loading && results.length === 0 && !error && <p className="panel-hint">No encontramos coincidencias. Puedes continuar con el nombre manual.</p>}
    </>}
    <p className="rawg-attribution">Datos e imágenes proporcionados por <a href="https://rawg.io" target="_blank" rel="noreferrer">RAWG</a>.</p>
  </section>
}
