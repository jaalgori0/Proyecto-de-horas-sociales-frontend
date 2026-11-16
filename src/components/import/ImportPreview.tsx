/**
 * Vista previa del lote: pestañas por estado (Nuevos, Ignorados, Advertencias,
 * Conflictos) con contadores, filtro por entidad, búsqueda y filas expandibles con
 * la comparación "en el archivo" vs "en la base" y los campos que se completarán.
 */
import { ArrowRight, ChevronDown, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ImportItem, ImportItemEntidad, ImportItemEstado } from '../../services/api';
import { ItemEstadoBadge, MotivoTag } from './ImportBadges';
import {
  ENTIDAD_ORDEN,
  ITEM_ESTADOS,
  compareItem,
  completarLabels,
  describeItem,
  describeMatch,
  entidadLabels,
  formatCompletarValue,
  formatNumber,
  itemEstadoConfig,
  itemSearchText,
} from './importLabels';

const PAGE_SIZE = 50;

function ItemRow({ item }: { item: ImportItem }) {
  const [open, setOpen] = useState(false);
  const { titulo, subtitulo } = describeItem(item);
  const match = item.estado === 'IGNORADO' ? describeMatch(item) : null;
  const rows = open ? compareItem(item) : [];
  const hasBase = rows.some((r) => r.base !== null);
  const completar = item.completar ? Object.entries(item.completar) : [];

  return (
    <li className={`imp-item ${open ? 'open' : ''}`}>
      <button type="button" className="imp-item-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="imp-item-entity">{entidadLabels[item.entidad].singular}</span>
        <span className="imp-item-main">
          <strong>{titulo}</strong>
          <span className="muted">{subtitulo}</span>
          {match ? (
            <span className="imp-item-match">
              <ArrowRight size={13} /> Coincide con: {match}
            </span>
          ) : null}
        </span>
        <span className="imp-item-side">
          {item.accion === 'COMPLETAR' ? <span className="imp-tag imp-tag-info">Completa {completar.length} campo{completar.length !== 1 ? 's' : ''}</span> : null}
          <ChevronDown size={18} className={`imp-chevron ${open ? 'imp-rotate' : ''}`} />
        </span>
      </button>

      {item.motivos.length > 0 ? (
        <div className="imp-tags imp-item-tags">
          {item.motivos.map((m) => <MotivoTag key={m} motivo={m} />)}
        </div>
      ) : null}

      {open ? (
        <div className="imp-item-detail">
          {completar.length > 0 ? (
            <div className="imp-completar">
              <span className="imp-detail-title">Se completará (solo campos vacíos)</span>
              <ul>
                {completar.map(([campo, valor]) => (
                  <li key={campo}>
                    <span>{completarLabels[campo] ?? campo}</span>
                    <span className="muted">vacío</span>
                    <ArrowRight size={13} />
                    <strong>{formatCompletarValue(campo, valor)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="dash-table-wrapper">
            <table className="dash-table imp-compare">
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>En el archivo</th>
                  {hasBase ? <th>En la base</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.campo} className={r.difiere ? 'imp-diff' : ''}>
                    <td>{r.campo}</td>
                    <td>{r.archivo}</td>
                    {hasBase ? <td>{r.base ?? '—'}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="imp-item-key">Clave: {item.clave}</span>
        </div>
      ) : null}
    </li>
  );
}

export default function ImportPreview({
  items,
  conteo,
  initialTab,
}: {
  items: ImportItem[];
  conteo: Record<ImportItemEstado, number>;
  initialTab: ImportItemEstado;
}) {
  const [tab, setTab] = useState<ImportItemEstado>(initialTab);
  const [entidad, setEntidad] = useState<ImportItemEntidad | 'TODAS'>('TODAS');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Un lote nuevo (o la vista previa actualizada tras un 409) reabre en la pestaña sugerida.
  useEffect(() => {
    setTab(initialTab);
    setEntidad('TODAS');
    setQuery('');
  }, [items, initialTab]);

  useEffect(() => setVisible(PAGE_SIZE), [tab, entidad, query]);

  // Participaciones y estudiantes primero: es lo que el usuario revisa con más frecuencia.
  const inTab = useMemo(
    () =>
      items
        .filter((i) => i.estado === tab)
        .sort((a, b) => ENTIDAD_ORDEN.indexOf(a.entidad) - ENTIDAD_ORDEN.indexOf(b.entidad)),
    [items, tab],
  );

  const entidadCounts = useMemo(() => {
    const counts = new Map<ImportItemEntidad, number>();
    for (const item of inTab) counts.set(item.entidad, (counts.get(item.entidad) ?? 0) + 1);
    return counts;
  }, [inTab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inTab.filter((i) => (entidad === 'TODAS' || i.entidad === entidad) && (!q || itemSearchText(i).includes(q)));
  }, [inTab, entidad, query]);

  const cfg = itemEstadoConfig[tab];

  return (
    <section className="dash-chart-card imp-preview">
      <div className="tabs-row imp-tabs" role="tablist" aria-label="Estados de la vista previa">
        {ITEM_ESTADOS.map((estado) => {
          const c = itemEstadoConfig[estado];
          return (
            <button
              key={estado}
              type="button"
              role="tab"
              aria-selected={tab === estado}
              className={`tab ${tab === estado ? 'active' : ''}`}
              onClick={() => setTab(estado)}
            >
              <span className="imp-pill-dot" style={{ background: c.dot }} />
              {c.plural}
              <span className="imp-tab-count" style={{ color: c.color, background: c.bg }}>{formatNumber(conteo[estado] ?? 0)}</span>
            </button>
          );
        })}
      </div>

      <p className="imp-tab-help">
        <ItemEstadoBadge estado={tab} /> {cfg.help}
      </p>

      {inTab.length > 0 ? (
        <div className="imp-preview-toolbar">
          <div className="chip-row">
            <button type="button" className={`chip ${entidad === 'TODAS' ? 'active' : ''}`} onClick={() => setEntidad('TODAS')}>
              Todas · {formatNumber(inTab.length)}
            </button>
            {ENTIDAD_ORDEN.filter((e) => entidadCounts.has(e)).map((e) => (
              <button key={e} type="button" className={`chip ${entidad === e ? 'active' : ''}`} onClick={() => setEntidad(e)}>
                {entidadLabels[e].plural} · {formatNumber(entidadCounts.get(e) ?? 0)}
              </button>
            ))}
          </div>
          <div className="search-wrapper imp-search">
            <Search size={16} className="search-icon-inside" />
            <input type="text" placeholder="Carnet, nombre, proyecto…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      ) : null}

      {inTab.length === 0 ? (
        <p className="muted imp-empty">No hay registros en «{cfg.plural}».</p>
      ) : filtered.length === 0 ? (
        <p className="muted imp-empty">Ningún registro coincide con la búsqueda.</p>
      ) : (
        <>
          <ul className="imp-items">
            {filtered.slice(0, visible).map((item) => <ItemRow key={item.id} item={item} />)}
          </ul>
          <div className="imp-list-footer">
            <span className="muted">
              Mostrando {formatNumber(Math.min(visible, filtered.length))} de {formatNumber(filtered.length)}
            </span>
            {visible < filtered.length ? (
              <button type="button" className="secondary-btn" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Mostrar {Math.min(PAGE_SIZE, filtered.length - visible)} más
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
