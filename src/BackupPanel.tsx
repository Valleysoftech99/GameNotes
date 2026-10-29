import { useEffect, useRef, useState } from 'react'
import { applyRestore, createBackup, parseBackupText, previewRestore, type BackupDocument, type RestoreMode, type RestoreSummary } from './data/backups'

const labels: Record<keyof RestoreSummary, string> = { profile: 'Perfil', games: 'Juegos', items: 'Objetos', goals: 'Objetivos', requirements: 'Requisitos' }

export default function BackupPanel({ onRestoreComplete }: { onRestoreComplete: () => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [document, setDocument] = useState<BackupDocument>()
  const [mode, setMode] = useState<RestoreMode>('replace')
  const [summary, setSummary] = useState<RestoreSummary>()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    let active = true
    setSummary(undefined)
    if (!document) { setPreviewing(false); return }
    setPreviewing(true)
    previewRestore(document, mode)
      .then((value) => { if (active) { setSummary(value); setPreviewing(false) } })
      .catch(() => { if (active) { setError('No se pudo preparar el resumen de restauración.'); setPreviewing(false) } })
    return () => { active = false }
  }, [document, mode])

  async function exportFile() {
    setBusy(true); setError(''); setNotice('')
    try {
      const backup = await createBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = window.document.createElement('a')
      anchor.href = url
      anchor.download = `notegame-respaldo-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice('Respaldo JSON descargado.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear el respaldo.') }
    finally { setBusy(false) }
  }

  async function selectFile(file?: File) {
    setError(''); setNotice(''); setDocument(undefined); setSummary(undefined); setPreviewing(false)
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('El archivo supera el límite de 5 MB.'); return }
    setBusy(true)
    try {
      setDocument(parseBackupText(await file.text()))
      setMode('replace')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo leer el respaldo.') }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = '' }
  }

  async function confirmRestore() {
    if (!document || !summary) return
    setBusy(true); setError(''); setNotice('')
    try {
      const applied = await applyRestore(document, mode)
      await onRestoreComplete()
      setNotice(mode === 'replace' ? 'Respaldo restaurado. Los datos anteriores fueron reemplazados.' : 'Respaldo combinado con los datos locales según el resumen mostrado.')
      setDocument(undefined); setSummary(applied)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo restaurar el respaldo.') }
    finally { setBusy(false) }
  }

  return <section className="content-panel backup-panel">
    <p className="eyebrow">RESPALDO LOCAL</p><h2>Guardar o restaurar datos</h2>
    <p className="panel-hint">El archivo JSON v2 incluye perfil, juegos, objetos, objetivos y requisitos, pero excluye la clave RAWG. También se aceptan respaldos v1 y se convierten en memoria. No contiene código ejecutable.</p>
    <div className="form-actions"><button className="secondary-button" type="button" onClick={() => void exportFile()} disabled={busy}>Descargar respaldo</button><button className="secondary-button" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>Elegir archivo JSON</button><input ref={inputRef} className="visually-hidden" type="file" accept=".json,application/json" onChange={(event) => void selectFile(event.target.files?.[0])} /></div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
    {document && <div className="restore-review">
      <p className="panel-hint">Archivo válido · exportado {new Date(document.exportedAt).toLocaleString()}</p>
      <fieldset className="restore-modes"><legend className="field-label">Cómo restaurar</legend>
        <label><input type="radio" name="restore-mode" checked={mode === 'replace'} onChange={() => { setSummary(undefined); setPreviewing(true); setError(''); setMode('replace') }} /> Reemplazar los datos locales</label>
        <label><input type="radio" name="restore-mode" checked={mode === 'merge'} onChange={() => { setSummary(undefined); setPreviewing(true); setError(''); setMode('merge') }} /> Combinar con los datos locales</label>
      </fieldset>
      <p className={mode === 'replace' ? 'data-warning' : 'panel-hint'}>{mode === 'replace' ? `Al confirmar, se sustituirá todo el contenido local por este respaldo. Esta acción no se puede deshacer desde la aplicación. La clave RAWG local se conservará si el respaldo contiene perfil; si no contiene perfil, también se eliminará la clave local.` : 'La combinación es aditiva: ante IDs duplicados se conserva el registro local; se agregan los demás registros sin conflicto. Objetos nuevos con nombre normalizado duplicado por juego y registros dependientes de referencias no agregadas se omiten. Si un juego comparte ID con uno local, los registros añadidos quedan dentro del juego local existente. La clave RAWG local se conserva y nunca se importa desde el respaldo.'}</p>
      {previewing && <p className="panel-hint" role="status">Preparando resumen…</p>}
      {summary && <div className="summary-table"><h3>Resumen antes de aplicar</h3>{(Object.keys(labels) as (keyof RestoreSummary)[]).map((key) => <p key={key}><span>{labels[key]}</span><span>Agregar {summary[key].add} · Omitir {summary[key].skip}</span></p>)}</div>}
      <button className="primary-button" type="button" onClick={() => void confirmRestore()} disabled={busy || previewing || !summary}>{busy ? 'Procesando…' : mode === 'replace' ? 'Confirmar reemplazo' : 'Confirmar combinación'}</button>
    </div>}
  </section>
}
