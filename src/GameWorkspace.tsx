import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Game, GameItem, Goal, Requirement } from './domain/schemas'
import { listGameContent, saveGameItem, updateGoal, createGoalWithMaterials } from './data/repositories'
import { getGoalProgressPercent, getItemAggregates } from './domain/progress'

type Content = { items: GameItem[]; goals: Goal[]; invalidGoalCount: number; requirements: Requirement[]; invalidRequirementCount: number }
type Props = { game: Game; onBack: () => void }

const emptyContent: Content = { items: [], goals: [], invalidGoalCount: 0, requirements: [], invalidRequirementCount: 0 }

export default function GameWorkspace({ game, onBack }: Props) {
  const [content, setContent] = useState<Content>(emptyContent)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<'goals' | 'items' | 'missing'>('goals')
  const [editingItem, setEditingItem] = useState<GameItem>()
  const [editingGoal, setEditingGoal] = useState<Goal>()
  const [materialDrafts, setMaterialDrafts] = useState([{ itemId: '', quantity: '', possessedQuantity: '' }])
  const [formVersion, setFormVersion] = useState(0)

  const refresh = useCallback(async () => {
    try {
      setContent(await listGameContent(game.id))
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo leer el contenido del juego.')
    }
  }, [game.id])
  useEffect(() => { void refresh() }, [refresh])

  const aggregates = useMemo(() => {
    return getItemAggregates(content.items, content.requirements.filter((r): r is Extract<Requirement, {kind:'item'}> => r.kind === 'item'), content.goals)
  }, [content])
  const missingGroups = useMemo(() => {
    const groups = new Map<string, { items: typeof aggregates; goals: Goal[]; conditions: Extract<Requirement, { kind: 'condition' }>[] }>()
    const groupAt = (place: string) => {
      const current = groups.get(place) ?? { items: [], goals: [], conditions: [] }
      groups.set(place, current)
      return current
    }
    for (const aggregate of aggregates.filter((entry) => entry.missingQuantity > 0)) {
      const item = content.items.find((entry) => entry.id === aggregate.itemId)
      const places = item?.locations.length ? item.locations : ['Sin ubicación']
      for (const place of places) groupAt(place).items.push(aggregate)
    }
    for (const goal of content.goals) {
      const direct = content.requirements.filter((entry) => entry.goalId === goal.id)
      const conditions = direct.filter((entry): entry is Extract<Requirement, { kind: 'condition' }> => entry.kind === 'condition' && !entry.done)
      for (const condition of conditions) groupAt(goal.location?.trim() || 'Sin ubicación').conditions.push(condition)
      if (direct.length === 0 && !goal.done) groupAt(goal.location?.trim() || 'Sin ubicación').goals.push(goal)
    }
    return Array.from(groups, ([place, data]) => ({ place, ...data })).sort((a, b) => a.place.localeCompare(b.place))
  }, [aggregates, content])

  function navigate(tabName: typeof tab, targetId?: string) {
    setTab(tabName)
    if (targetId) window.setTimeout(() => document.getElementById(targetId)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    }), 0)
  }

  async function persist(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true)
    setError('')
    try {
      await action()
      setEditingItem(undefined); setEditingGoal(undefined)
      setFormVersion((version) => version + 1)
      await refresh()
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los cambios.')
      return false
    } finally { setBusy(false) }
  }

  async function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await persist(() => saveGameItem({ gameId: game.id, name: String(form.get('name') ?? ''), stock: Number(form.get('stock')), locations: String(form.get('locations') ?? '').split(',').map((v) => v.trim()).filter(Boolean), note: String(form.get('note') ?? '') }, editingItem?.id))
  }
  async function submitGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const goal = { gameId: game.id, name: String(form.get('name') ?? ''), objectDescription: String(form.get('objectDescription') ?? ''), status: String(form.get('status') ?? 'active'), priority: Number(form.get('priority') ?? 0), location: String(form.get('location') ?? ''), note: String(form.get('note') ?? ''), done: form.get('done') === 'on' }
    if (editingGoal) { await persist(() => updateGoal(goal, editingGoal.id)); return }
    const materials = materialDrafts.map((draft) => ({ itemId: draft.itemId, quantity: Number(draft.quantity), possessedQuantity: Number(draft.possessedQuantity) }))
    if (await persist(() => createGoalWithMaterials(goal, materials))) setMaterialDrafts([{ itemId: '', quantity: '', possessedQuantity: '' }])
  }

  return <section className="page-card workspace-card">
    <button className="text-button back-link" type="button" onClick={onBack}>← Mis juegos</button>
    <p className="eyebrow">ESPACIO DEL JUEGO</p>
    <div className="workspace-heading"><span className="game-symbol" aria-hidden="true">✧</span><div><h1>{game.name}</h1><p className="intro">Objetivos, recordatorios y materiales de esta partida.</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {content.invalidGoalCount > 0 && <p className="data-warning" role="status">No se pudieron leer {content.invalidGoalCount} objetivo(s) guardado(s). Se conservaron sin cambios; se muestran los objetivos válidos.</p>}
    {content.invalidRequirementCount > 0 && <p className="data-warning" role="status">No se pudieron leer {content.invalidRequirementCount} requisito(s) guardado(s). Se conservaron sin cambios; las vistas muestran los requisitos válidos.</p>}
    <nav className="content-tabs" aria-label="Vistas del juego"><button aria-pressed={tab === 'goals'} className={tab === 'goals' ? 'selected' : ''} onClick={() => setTab('goals')} type="button">Objetivos</button><button aria-pressed={tab === 'items'} className={tab === 'items' ? 'selected' : ''} onClick={() => setTab('items')} type="button">Por objeto</button><button aria-pressed={tab === 'missing'} className={tab === 'missing' ? 'selected' : ''} onClick={() => setTab('missing')} type="button">Faltantes</button></nav>
    {tab === 'goals' ? <>
      <div className="content-grid single-panel-grid">
        <section className="content-panel"><h2>{editingGoal ? 'Editar objetivo' : 'Nuevo objetivo'}</h2>
          <form className="stacked-form compact-form" onSubmit={submitGoal} key={`${editingGoal?.id ?? 'new-goal'}-${formVersion}`}>
            <label className="field-label">Nombre<input className="text-input" name="name" defaultValue={editingGoal?.name} required /></label>
            <label className="field-label">Objeto / acción<textarea className="text-input text-area" name="objectDescription" defaultValue={editingGoal?.objectDescription ?? ''} placeholder="Ej.: Juntar madera" /></label>
            <div className="two-fields"><label className="field-label">Estado<select className="text-input" name="status" defaultValue={editingGoal?.status ?? 'active'}><option value="active">Activo</option><option value="paused">En pausa</option></select></label><label className="field-label">Prioridad<input className="text-input" type="number" name="priority" defaultValue={editingGoal?.priority ?? 0} /></label></div>
            <label className="field-label">Lugar (opcional)<input className="text-input" name="location" defaultValue={editingGoal?.location} /></label>
            <label className="field-label">Notas<textarea className="text-input text-area" name="note" defaultValue={editingGoal?.note ?? ''} /></label>
            <label className="check-row"><input type="checkbox" name="done" defaultChecked={editingGoal?.done} /> Recordatorio completado</label>
            {!editingGoal && <fieldset className="material-draft-list"><legend>Objetos del objetivo</legend>{content.items.length === 0 ? <p className="panel-hint">Primero crea los objetos en «Por objeto».</p> : materialDrafts.map((draft, index) => <div className="material-draft-row" key={index}><label className="field-label">Objeto<select className="text-input" value={draft.itemId} onChange={(event) => setMaterialDrafts((rows) => rows.map((row, i) => i === index ? { ...row, itemId: event.target.value } : row))} required><option value="">Selecciona</option>{content.items.filter((item) => !materialDrafts.some((other, i) => i !== index && other.itemId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field-label">Cantidad necesaria<input className="text-input" type="number" min="1" step="1" value={draft.quantity} onChange={(event) => setMaterialDrafts((rows) => rows.map((row, i) => i === index ? { ...row, quantity: event.target.value } : row))} required /></label><label className="field-label">Cantidad poseída<input className="text-input" type="number" min="0" step="1" value={draft.possessedQuantity} onChange={(event) => setMaterialDrafts((rows) => rows.map((row, i) => i === index ? { ...row, possessedQuantity: event.target.value } : row))} required /></label><span>Faltan {Math.max(0, Number(draft.quantity || 0) - Number(draft.possessedQuantity || 0))}</span><button className="text-button" type="button" disabled={materialDrafts.length === 1} onClick={() => setMaterialDrafts((rows) => rows.filter((_, i) => i !== index))}>Quitar</button></div>)}{content.items.length > 0 && <button className="secondary-button" type="button" onClick={() => setMaterialDrafts((rows) => [...rows, { itemId: '', quantity: '', possessedQuantity: '' }])}>Añadir otro objeto</button>}</fieldset>}
            <div className="form-actions"><button className="primary-button" disabled={busy}>{editingGoal ? 'Guardar objetivo' : 'Agregar objetivo'}</button>{editingGoal && <button className="secondary-button" type="button" onClick={() => setEditingGoal(undefined)}>Cancelar</button>}</div>
          </form>
        </section>

      </div>
      <div className="record-list"><h2>Progreso por objetivo</h2>{content.goals.length === 0 ? <p className="panel-hint">Todavía no hay objetivos.</p> : content.goals.map((goal) => {
        const direct = content.requirements.filter((requirement) => requirement.goalId === goal.id)
        const materials = direct.filter((requirement): requirement is Extract<Requirement, { kind: 'item' }> => requirement.kind === 'item')
        const conditions = direct.filter((requirement): requirement is Extract<Requirement, { kind: 'condition' }> => requirement.kind === 'condition')
        return <article className="record-card goal-summary" id={`goal-${goal.id}`} key={goal.id}><div className="goal-summary-content">
          <div className="record-title-row"><h3>{goal.name}</h3><span className="progress-pill">{Math.round(getGoalProgressPercent(goal, content.requirements, content.items))}%</span></div>
          <p>{goal.status === 'active' ? 'Activo' : 'En pausa'}{goal.location ? ` · ${goal.location}` : ''}{goal.done && direct.length === 0 ? ' · Recordatorio hecho' : ''}</p>
          {goal.objectDescription && <p>{goal.objectDescription}</p>}{goal.note && <p>{goal.note}</p>}
          {materials.length > 0 && <div className="materials-table-wrap"><table className="materials-table"><caption>Objetos para {goal.name}</caption><thead><tr><th scope="col">Objeto</th><th scope="col">Cantidad poseída</th><th scope="col">Necesario</th><th scope="col">Faltan</th></tr></thead><tbody>{materials.map((requirement) => {
            const item = content.items.find((entry) => entry.id === requirement.itemId)
            const stock = requirement.possessedQuantity
            const missing = Math.max(requirement.quantity - stock, 0)
            return <tr key={requirement.id}><th scope="row"><button className="link-button" type="button" onClick={() => navigate('items', `item-${requirement.itemId}`)}>{item?.name ?? 'Objeto'}</button></th><td>{stock}</td><td>{requirement.quantity}</td><td className={missing > 0 ? 'quantity-missing' : 'quantity-ready'}>{missing > 0 ? `${missing} más` : '0'}</td></tr>
          })}</tbody></table></div>}
          {conditions.length > 0 && <div className="condition-list"><h4>Condiciones</h4>{conditions.map((requirement) => <div className="condition-line" key={requirement.id}><span>{requirement.done ? '✓' : '○'} {requirement.name}</span><span>{requirement.done ? 'Cumplida' : 'Pendiente'}</span></div>)}</div>}
          <div className="record-actions"><button className="secondary-button" type="button" onClick={() => setEditingGoal(goal)}>Editar objetivo</button></div>
        </div></article>
      })}</div>
    </> : tab === 'items' ? <>
      <section className="content-panel item-editor"><h2>{editingItem ? 'Editar objeto' : 'Nuevo objeto'}</h2><p className="panel-hint">El faltante agregado suma las cantidades faltantes registradas en cada objetivo.</p>
        <form className="item-form" onSubmit={submitItem} key={`${editingItem?.id ?? 'new-item'}-${formVersion}`}><label className="field-label">Nombre<input className="text-input" name="name" defaultValue={editingItem?.name} required /></label><label className="field-label">Stock<input className="text-input" type="number" name="stock" min="0" step="1" defaultValue={editingItem?.stock ?? 0} required /></label><label className="field-label">Ubicaciones, separadas por coma<input className="text-input" name="locations" defaultValue={editingItem?.locations.join(', ')} /></label><label className="field-label">Notas<textarea className="text-input text-area" name="note" defaultValue={editingItem?.note ?? ''} /></label><div className="form-actions"><button className="primary-button" disabled={busy}>{editingItem ? 'Guardar objeto' : 'Agregar objeto'}</button>{editingItem && <button className="secondary-button" type="button" onClick={() => setEditingItem(undefined)}>Cancelar</button>}</div></form>
      </section>
      <div className="record-list"><h2>Agregado por objeto</h2>{content.items.length === 0 ? <p className="panel-hint">Todavía no hay objetos.</p> : content.items.map((item) => { const aggregate = aggregates.find((a) => a.itemId === item.id); return <article className="record-card" id={`item-${item.id}`} key={item.id}><div><button className="link-button item-title" type="button" onClick={() => setEditingItem(item)}><h3>{item.name}</h3></button><p>Stock de referencia {item.stock} · {item.locations.length ? item.locations.join(', ') : 'Sin ubicación'} · Necesitas {aggregate?.totalDemand ?? 0} · Faltan {aggregate?.missingQuantity ?? 0}</p>{aggregate?.breakdownByGoal.map((d) => <p key={d.goalId}><button className="link-button" type="button" onClick={() => navigate('goals', `goal-${d.goalId}`)}>{d.requiredQuantity} para {d.goalName}</button></p>)}{item.note && <p>{item.note}</p>}</div><button className="secondary-button" type="button" onClick={() => setEditingItem(item)}>Editar objeto</button></article> })}</div>
    </> : <div className="record-list"><h2>Faltantes por ubicación</h2><p className="panel-hint">Los objetos con varias ubicaciones aparecen en cada lugar posible; las cantidades son el faltante agregado común.</p>{missingGroups.length === 0 ? <p className="panel-hint">No hay faltantes ni recordatorios pendientes.</p> : missingGroups.map((group) => <section className="content-panel location-group" key={group.place}><h3>{group.place}</h3>{group.items.map((entry) => <p key={entry.itemId}>◈ <button className="link-button" type="button" onClick={() => navigate('items', `item-${entry.itemId}`)}>{entry.itemName}</button> — faltan {entry.missingQuantity}</p>)}{group.conditions.map((entry) => { const goal = content.goals.find((candidate) => candidate.id === entry.goalId); return <p key={entry.id}>○ <button className="link-button" type="button" onClick={() => goal && navigate('goals', `goal-${goal.id}`)}>{entry.name}</button>{goal ? ` · ${goal.name}` : ''}</p> })}{group.goals.map((goal) => <p key={goal.id}>○ <button className="link-button" type="button" onClick={() => navigate('goals', `goal-${goal.id}`)}>{goal.name}</button> (recordatorio)</p>)}</section>)}</div>}
  </section>
}



