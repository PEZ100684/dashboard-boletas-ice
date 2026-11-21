import { ChevronLeft, ChevronRight, FileText, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { BoletaRegistro } from '../types/boleta';
import { formatCRC, formatPct } from '../utils/formatters';

interface BoletasTableProps {
  boletas: BoletaRegistro[];
  alertIds: Set<string>;
}

const PAGE_SIZE = 15;

export function BoletasTable({ boletas, alertIds }: BoletasTableProps) {
  const [query, setQuery] = useState('');
  const [filtroExtra, setFiltroExtra] = useState<'all' | 'con_extra' | 'con_alerta' | 'pdf'>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<BoletaRegistro | null>(null);

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...boletas]
      .sort((a, b) => (a.anio !== b.anio ? b.anio - a.anio : b.bisemana - a.bisemana))
      .filter((b) => {
        if (filtroExtra === 'con_extra' && !(b.horasExtraMonto && b.horasExtraMonto > 0)) {
          return false;
        }
        if (filtroExtra === 'con_alerta' && !alertIds.has(b.id)) {
          return false;
        }
        if (filtroExtra === 'pdf' && b.origen !== 'pdf') {
          return false;
        }
        if (!q) return true;
        return (
          b.id.toLowerCase().includes(q) ||
          (b.numeroBoleta ?? '').toLowerCase().includes(q) ||
          b.fechaDeposito.toLowerCase().includes(q) ||
          (b.observaciones ?? '').toLowerCase().includes(q)
        );
      });
  }, [boletas, query, filtroExtra, alertIds]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const slice = filtradas.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Registro Detallado de Boletas</h2>
          <p className="panel-subtitle">
            Haz clic en cualquier boleta para auditar el desglose completo de ley e ingresos
          </p>
        </div>
        <span className="pill pill-blue">{filtradas.length} registros</span>
      </div>

      <div className="table-toolbar">
        <div className="search-box">
          <Search size={15} />
          <input
            id="search-boletas"
            type="text"
            className="input-control"
            placeholder="Buscar por ID (ej. 2026-B23), fecha o N° boleta..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          id="filter-tipo-boleta"
          className="select-control"
          value={filtroExtra}
          onChange={(e) => {
            setFiltroExtra(e.target.value as typeof filtroExtra);
            setPage(1);
          }}
        >
          <option value="all">Todas las boletas</option>
          <option value="con_extra">Con horas extra / pluses</option>
          <option value="con_alerta">Con alerta de variación</option>
          <option value="pdf">Cargadas desde PDF</option>
        </select>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID Periodo</th>
              <th>Fecha Depósito</th>
              <th>N° Boleta</th>
              <th className="num">Bruto Reportado</th>
              <th className="num">Deducciones</th>
              <th className="num">Neto Pagado</th>
              <th className="num">Liquidez</th>
              <th className="num">Aguinaldo Acum.</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                  No se encontraron boletas con los filtros actuales.
                </td>
              </tr>
            ) : (
              slice.map((b) => {
                const liquidez = b.reportado > 0 ? (b.pagado / b.reportado) * 100 : 0;
                const hasAlert = alertIds.has(b.id);
                return (
                  <tr key={b.id} onClick={() => setSelected(b)}>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {b.id}
                    </td>
                    <td>{b.fechaDeposito || '—'}</td>
                    <td className="mono">{b.numeroBoleta || '—'}</td>
                    <td className="num mono">{formatCRC(b.reportado)}</td>
                    <td className="num mono" style={{ color: 'var(--rose)' }}>
                      -{formatCRC(b.deducciones)}
                    </td>
                    <td className="num mono" style={{ fontWeight: 700, color: 'var(--emerald)' }}>
                      {formatCRC(b.pagado)}
                    </td>
                    <td className="num mono">{formatPct(liquidez)}</td>
                    <td className="num mono">{formatCRC(b.aguinaldoAcumulado)}</td>
                    <td>
                      {b.origen === 'pdf' ? (
                        <span className="pill pill-blue">PDF</span>
                      ) : hasAlert ? (
                        <span className="pill pill-amber">Variación</span>
                      ) : (
                        <span className="pill pill-emerald">Normal</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>
          Página {currentPage} de {totalPages}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={15} /> Anterior
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Siguiente <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal-card" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileText size={18} color="#0066b2" />
                <h2>Detalle de Boleta · {selected.id}</h2>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Fecha de Depósito:</span>{' '}
                  <strong>{selected.fechaDeposito || 'No registrada'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>N° Boleta:</span>{' '}
                  <strong className="mono">{selected.numeroBoleta || '—'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Días Laborados / Base:</span>{' '}
                  <strong className="mono">{formatCRC(selected.diasLaboradosMonto)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Horas Extra / Pluses:</span>{' '}
                  <strong className="mono">{formatCRC(selected.horasExtraMonto)}</strong>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '16px 0' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Salario Bruto Reportado</span>
                  <strong className="mono">{formatCRC(selected.reportado)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>CCSS SEM (5.50%)</span>
                  <span className="mono">{formatCRC(selected.ccssSem)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>CCSS IVM (4.17%)</span>
                  <span className="mono">{formatCRC(selected.ccssIvm)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Banco Popular (1.00%)</span>
                  <span className="mono">{formatCRC(selected.bancoPopular)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>Otras Deducciones / Renta</span>
                  <span className="mono">
                    {formatCRC((selected.otrasDeducciones ?? 0) + (selected.impuestoRenta ?? 0))}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--rose)' }}>
                  <strong>Total Deducciones</strong>
                  <strong className="mono">-{formatCRC(selected.deducciones)}</strong>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--emerald-soft)',
                    color: 'var(--emerald)',
                    marginTop: 4,
                  }}
                >
                  <strong>Salario Neto Depositado</strong>
                  <strong className="mono">{formatCRC(selected.pagado)}</strong>
                </div>
              </div>
              {selected.observaciones && (
                <p style={{ marginTop: 14, fontSize: 12.5, color: 'var(--text-muted)' }}>
                  Observaciones: {selected.observaciones}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" onClick={() => setSelected(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
