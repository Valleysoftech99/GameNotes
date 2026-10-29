import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import type { Game, GameItem, Goal, Requirement } from './domain/schemas'
import { addMaterialToGoal, addPossessedQuantity, createGoalWithMaterials, deleteGoal, deleteGoalMaterial, listGameContent } from './data/repositories'
import { getGoalProgressPercent, getRequirementProgressPercent } from './domain/progress'

type Content = { items: GameItem[]; goals: Goal[]; invalidGoalCount: number; requirements: Requirement[]; invalidRequirementCount: number }
type MaterialDraft = { name: string; quantity: string }
type Props = { game: Game; avatar?: string; onBack: () => void }

const emptyContent: Content = { items: [], goals: [], invalidGoalCount: 0, requirements: [], invalidRequirementCount: 0 }
const emptyMaterial = (): MaterialDraft => ({ name: '', quantity: '' })

export default function GameWorkspace({ game, avatar = '🙂', onBack }: Props) {
  const [content, setContent] = useState<Content>(emptyContent)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedGoalId, setSelectedGoalId] = useState<string>()
  const [creatingGoal, setCreatingGoal] = useState(false)
  const [materialDrafts, setMaterialDrafts] = useState<MaterialDraft[]>([emptyMaterial()])
  const [detailMaterialDraft, setDetailMaterialDraft] = useState<MaterialDraft>(emptyMaterial())
  const [collectedDrafts, setCollectedDrafts] = useState<Record<string, string>>({})
  const [collapsedMaterials, setCollapsedMaterials] = useState<Record<string, boolean>>({})
  const [formVersion, setFormVersion] = useState(0)
  const suggestionsId = useId()

  const refresh = useCallback(async () => {
    try {
      setContent(await listGameContent(game.id))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo leer el contenido del juego.')
    }
  }, [game.id])
  useEffect(() => { void refresh() }, [refresh])

  async function persist(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true)
    setError('')
    try {
      await action()
      setFormVersion((version) => version + 1)
      await refresh()
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los cambios.')
      return false
    } finally { setBusy(false) }
  }

  async function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const goal = {
      gameId: game.id,
      name: String(form.get('name') ?? ''),
      objectDescription: String(form.get('objectDescription') ?? ''),
      status: 'active',
      priority: 0,
      location: '',
      note: '',
      done: false,
    }
    const materials = materialDrafts.map((draft) => ({ name: draft.name, quantity: Number(draft.quantity) }))
    let createdGoal: Goal | undefined
    if (await persist(async () => { createdGoal = (await createGoalWithMaterials(goal, materials)).goal })) {
      setMaterialDrafts([emptyMaterial()])
      setCreatingGoal(false)
      if (createdGoal) setSelectedGoalId(createdGoal.id)
    }
  }

  async function submitMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedGoal) return
    const material = { name: detailMaterialDraft.name, quantity: Number(detailMaterialDraft.quantity) }
    if (await persist(() => addMaterialToGoal(game.id, selectedGoal.id, material))) setDetailMaterialDraft(emptyMaterial())
  }

  async function confirmDeleteGoal(goal: Goal) {
    const accepted = window.confirm(`¿Eliminar el objetivo «${goal.name}» y todos sus materiales, cantidades y progreso? Esta acción no se puede deshacer.`)
    if (!accepted) return
    await persist(() => deleteGoal(game.id, goal.id))
  }

  async function confirmDeleteMaterial(goal: Goal, requirement: Extract<Requirement, { kind: 'item' }>, itemName: string) {
    const accepted = window.confirm(`¿Quitar «${itemName}» de este objetivo? Se eliminarán su cantidad necesaria, lo juntado y su faltante de este objetivo. El objeto del catálogo y sus usos en otros objetivos se conservarán.`)
    if (!accepted) return
    if (await persist(() => deleteGoalMaterial(game.id, goal.id, requirement.id))) {
      setCollapsedMaterials((current) => { const next = { ...current }; delete next[requirement.id]; return next })
    }
  }

  const itemRequirements = content.requirements.filter((requirement): requirement is Extract<Requirement, { kind: 'item' }> => requirement.kind === 'item')
  const selectedGoal = content.goals.find((goal) => goal.id === selectedGoalId)
  const selectedMaterials = selectedGoal ? itemRequirements.filter((requirement) => requirement.goalId === selectedGoal.id) : []
  const selectedComplete = selectedMaterials.length > 0 && selectedMaterials.every((requirement) => requirement.possessedQuantity >= requirement.quantity)
  const selectedProgress = selectedGoal && selectedMaterials.length ? Math.round(getGoalProgressPercent(selectedGoal, selectedMaterials, content.items)) : 0

  return <section className="page-card workspace-card">
    <button className="text-button back-link" type="button" onClick={onBack}>← Mis juegos</button>
    <div className="workspace-profile"><span aria-hidden="true">{avatar}</span><span>Tu perfil</span></div>
    <div className="workspace-cover">
      <div className="workspace-cover-fallback" aria-hidden="true">✧</div>
      {game.coverUrl && <img className="workspace-cover-image" src={game.coverUrl} alt="" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.classList.add('image-load-failed') }} />}
      <div className="workspace-cover-overlay"><p className="eyebrow">ESPACIO DEL JUEGO</p><h1>{game.name}</h1><p>Objetivos y materiales para tu partida.</p>{game.rawgId && <p className="rawg-attribution">Datos e imágenes: <a href="https://rawg.io" target="_blank" rel="noreferrer">RAWG</a>.</p>}</div>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {content.invalidGoalCount > 0 && <p className="data-warning" role="status">No se pudieron leer {content.invalidGoalCount} objetivo(s) guardado(s). Se conservaron sin cambios; se muestran los objetivos válidos.</p>}
    {content.invalidRequirementCount > 0 && <p className="data-warning" role="status">No se pudieron leer {content.invalidRequirementCount} requisito(s) guardado(s). Se conservaron sin cambios; se muestran los materiales válidos.</p>}

    {!selectedGoal ? <>
      <div className="objectives-heading"><div><p className="eyebrow">TU PARTIDA</p><h2>Objetivos</h2></div><button className="icon-button create-objective-button" type="button" aria-label="Crear objetivo" title="Crear objetivo" onClick={() => { setError(''); setCreatingGoal(true) }}>＋</button></div>
      {content.goals.length === 0 ? <div className="empty-state"><h3>Todavía no hay objetivos</h3><p>Usa el botón + para crear uno y definir los materiales necesarios.</p></div> : <div className="objective-list">{content.goals.map((goal) => {
        const materials = itemRequirements.filter((requirement) => requirement.goalId === goal.id)
        const progress = materials.length ? Math.round(getGoalProgressPercent(goal, materials, content.items)) : 0
        const complete = materials.length > 0 && materials.every((requirement) => requirement.possessedQuantity >= requirement.quantity)
        const status = goal.status === 'paused' ? 'En pausa' : complete ? 'Completado' : 'Activo'
        return <article className="objective-list-row" key={goal.id}>
          <button className="objective-open-button" type="button" onClick={() => setSelectedGoalId(goal.id)}><span><strong>{goal.name}</strong><span>{goal.objectDescription || `${materials.length} materiales`}</span></span><span className="objective-list-progress">{progress}% · {status}</span></button>
          <button className="icon-button delete-icon-button" type="button" aria-label={`Eliminar objetivo ${goal.name}`} title={`Eliminar objetivo ${goal.name}`} disabled={busy} onClick={() => void confirmDeleteGoal(goal)}>×</button>
        </article>
      })}</div>}
      {creatingGoal && <div className="modal-backdrop"><section className="content-panel objective-modal" role="dialog" aria-modal="true" aria-labelledby="create-objective-title">
        <div className="modal-heading"><h2 id="create-objective-title">Crear objetivo</h2><button className="icon-button delete-icon-button" type="button" aria-label="Cerrar creación de objetivo" onClick={() => setCreatingGoal(false)}>×</button></div>
        <p className="panel-hint">Define el objetivo y sus materiales. Las cantidades recolectadas se actualizan desde el detalle.</p>
        <form className="stacked-form compact-form" onSubmit={submitGoal} key={formVersion}>
          <label className="field-label">Título<input className="text-input" name="name" required maxLength={200} /></label>
          <label className="field-label">Descripción<textarea className="text-input text-area" name="objectDescription" placeholder="Ej.: Juntar madera" maxLength={2000} /></label>
          <fieldset className="material-draft-list"><legend>Objetos requeridos</legend>
            {materialDrafts.map((draft, index) => <div className="material-draft-row" key={index}>
              <label className="field-label">Objeto<input className="text-input" list={suggestionsId} value={draft.name} onChange={(event) => setMaterialDrafts((rows) => rows.map((row, i) => i === index ? { ...row, name: event.target.value } : row))} required maxLength={200} /></label>
              <label className="field-label">Cantidad necesaria<input className="text-input" type="number" min="1" step="1" value={draft.quantity} onChange={(event) => setMaterialDrafts((rows) => rows.map((row, i) => i === index ? { ...row, quantity: event.target.value } : row))} required /></label>
              <button className="text-button" type="button" disabled={materialDrafts.length === 1} onClick={() => setMaterialDrafts((rows) => rows.filter((_, i) => i !== index))}>Quitar</button>
            </div>)}
            <datalist id={suggestionsId}>{content.items.map((item) => <option key={item.id} value={item.name} />)}</datalist>
            <button className="secondary-button" type="button" onClick={() => setMaterialDrafts((rows) => [...rows, emptyMaterial()])}>Añadir otro objeto</button>
          </fieldset>
          <button className="primary-button" disabled={busy}>{busy ? 'Guardando…' : 'Crear objetivo'}</button>
        </form>
      </section></div>}
    </> : <>
      <button className="text-button back-link" type="button" onClick={() => setSelectedGoalId(undefined)}>← Objetivos</button>
      <div className="objective-detail-heading"><div><p className="eyebrow">DETALLE DEL OBJETIVO</p><h2>{selectedGoal.name}</h2>{selectedGoal.objectDescription && <p className="intro">{selectedGoal.objectDescription}</p>}</div><span className="progress-pill">{selectedProgress}%{selectedGoal.status === 'paused' ? ' · En pausa' : selectedComplete ? ' · Completado' : ' · Activo'}</span></div>
      {selectedMaterials.length === 0 && <p className="panel-hint">Este objetivo no tiene materiales asociados.</p>}
      {selectedMaterials.length > 0 && <div className="detail-material-list">{selectedMaterials.map((requirement) => {
        const item = content.items.find((entry) => entry.id === requirement.itemId)
        const missing = Math.max(requirement.quantity - requirement.possessedQuantity, 0)
        const complete = requirement.possessedQuantity >= requirement.quantity
        const percent = Math.max(0, Math.min(100, Math.round(getRequirementProgressPercent(requirement, item))))
        const collapsed = collapsedMaterials[requirement.id] ?? false
        const draft = collectedDrafts[requirement.id] ?? '1'
        const detailsId = `material-details-${requirement.id}`
        return <article className={`detail-material${complete ? ' material-complete' : ''}`} key={requirement.id}>
          <div className="detail-material-name"><button className="accordion-toggle" type="button" aria-expanded={!collapsed} aria-controls={detailsId} aria-label={`${collapsed ? 'Expandir' : 'Contraer'} ${item?.name ?? 'objeto'}`} onClick={() => setCollapsedMaterials((current) => ({ ...current, [requirement.id]: !collapsed }))}><span aria-hidden="true">{collapsed ? '▸' : '▾'}</span><h3>{item?.name ?? 'Objeto'}</h3></button><button className="icon-button delete-icon-button" type="button" aria-label={`Eliminar ${item?.name ?? 'objeto'} de ${selectedGoal.name}`} title="Eliminar material de este objetivo" disabled={busy} onClick={() => item && void confirmDeleteMaterial(selectedGoal, requirement, item.name)}>×</button></div>
          <div id={detailsId} hidden={collapsed}>
            <div className="material-detail-grid">
              <div className="material-metrics-column">
                <div className="material-values" aria-label={complete ? 'Material completado' : 'Material en progreso'}>
                  <span className="value-needed"><span>Necesario</span><strong>{requirement.quantity}</strong></span>
                  <span className="value-collected"><span>Juntado</span><strong>{requirement.possessedQuantity}</strong></span>
                  <span className="value-missing"><span>Faltan</span><strong>{missing}</strong></span>
                </div>
                <label className="item-progress-label">Progreso del objeto: {percent}%<progress className="item-progress" max={100} value={percent} aria-label={`Progreso de ${item?.name ?? 'objeto'}: ${percent}%`} /></label>
              </div>
              <form className="collect-form" onSubmit={(event) => { event.preventDefault(); void persist(() => addPossessedQuantity(requirement.id, Number(draft))) }}>
                <label className="field-label">Cantidad<input className="text-input" type="number" min="1" step="1" value={draft} onChange={(event) => setCollectedDrafts((current) => ({ ...current, [requirement.id]: event.target.value }))} required /></label>
                <button className="secondary-button" disabled={busy}>Agregar</button>
              </form>
            </div>
          </div>
        </article>
      })}</div>}
      <section className="content-panel add-material-panel"><h3>Agregar material</h3><form className="add-material-form" onSubmit={submitMaterial}>
        <label className="field-label">Objeto<input className="text-input" list={suggestionsId} value={detailMaterialDraft.name} onChange={(event) => setDetailMaterialDraft((current) => ({ ...current, name: event.target.value }))} required maxLength={200} /></label>
        <label className="field-label">Cantidad necesaria<input className="text-input" type="number" min="1" step="1" value={detailMaterialDraft.quantity} onChange={(event) => setDetailMaterialDraft((current) => ({ ...current, quantity: event.target.value }))} required /></label>
        <datalist id={suggestionsId}>{content.items.map((item) => <option key={item.id} value={item.name} />)}</datalist>
        <button className="primary-button" disabled={busy}>{busy ? 'Guardando…' : 'Agregar material'}</button>
      </form></section>
    </>}
  </section>
}
