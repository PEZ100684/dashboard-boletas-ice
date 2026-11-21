import { AlertTriangle, CheckCircle2, Info, PiggyBank } from 'lucide-react';
import type { AguinaldoHistorico, AlertaAuditoria, BoletaRegistro } from '../types/boleta';
import { calcularProyeccionAguinaldo } from '../utils/auditoria';
import { formatCRC } from '../utils/formatters';

interface AuditoriaPanelProps {
  boletas: BoletaRegistro[];
  aguinaldosHistoricos: AguinaldoHistorico[];
  alertas: AlertaAuditoria[];
  anioReferencia: number;
}

export function AuditoriaPanel({
  boletas,
  aguinaldosHistoricos,
  alertas,
  anioReferencia,
}: AuditoriaPanelProps) {
  const proyeccion = calcularProyeccionAguinaldo(boletas, anioReferencia);
  const progresoPct = Math.min(100, Math.round((proyeccion.cantidadBoletas / 26) * 100));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="charts-grid-two">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Proyección de Aguinaldo y Salario Escolar ({anioReferencia})</h2>
              <p className="panel-subtitle">
                Acumulador automático 8.33% (1/12) sobre salarios brutos devengados
              </p>
            </div>
            <span className="kpi-icon emerald">
              <PiggyBank size={18} />
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12.5,
                  color: 'var(--text-secondary)',
                  marginBottom: 6,
                }}
              >
                <span>Avance del periodo ({proyeccion.cantidadBoletas} / 26 bisemanas)</span>
                <span className="mono">{progresoPct}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progresoPct}%` }} />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 12,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                  AGUINALDO ACUMULADO ACTUAL
                </div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                  {formatCRC(proyeccion.acumuladoActual)}
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: 'var(--emerald-soft)',
                  border: '1px solid #a7f3d0',
                }}
              >
                <div style={{ fontSize: 11.5, color: 'var(--emerald)', fontWeight: 600 }}>
                  PROYECCIÓN CIERRE AGUINALDO
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 18, fontWeight: 700, color: 'var(--emerald)', marginTop: 4 }}
                >
                  {formatCRC(proyeccion.proyeccionCierreAguinaldo)}
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: 'var(--ice-blue-soft)',
                  border: '1px solid #bae6fd',
                }}
              >
                <div style={{ fontSize: 11.5, color: 'var(--ice-navy)', fontWeight: 600 }}>
                  SALARIO ESCOLAR EST. (8.33%)
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 18, fontWeight: 700, color: 'var(--ice-navy)', marginTop: 4 }}
                >
                  {formatCRC(proyeccion.salarioEscolarEstimado)}
                </div>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                  BRUTO ACUMULADO {anioReferencia}
                </div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                  {formatCRC(proyeccion.brutoAnio)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Histórico de Aguinaldos Cobrados</h2>
              <p className="panel-subtitle">Registro verificado 2017–2025 desde Google Sheets</p>
            </div>
          </div>
          <div className="table-scroll" style={{ maxHeight: 270 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Año</th>
                  <th>Fecha de Pago</th>
                  <th className="num">Monto Cobrado</th>
                </tr>
              </thead>
              <tbody>
                {aguinaldosHistoricos.map((a) => (
                  <tr key={a.anio} style={{ cursor: 'default' }}>
                    <td className="mono">{a.anio}</td>
                    <td>{a.fechaPago}</td>
                    <td className="num mono" style={{ fontWeight: 600, color: 'var(--emerald)' }}>
                      {formatCRC(a.montoAguinaldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Alertas de Control y Variación Atípica</h2>
            <p className="panel-subtitle">
              Detección automática de caídas en el salario neto (&gt;5%) o liquidez inferior al 85%
            </p>
          </div>
          <span className="pill pill-slate">{alertas.length} eventos detectados</span>
        </div>

        {alertas.length === 0 ? (
          <div className="alert-item info">
            <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
            <div className="alert-content">
              <h4>Sin anomalías detectadas en el periodo</h4>
              <p>Todos los depósitos mantienen variaciones normales y liquidez saludable.</p>
            </div>
          </div>
        ) : (
          <div className="alert-list">
            {alertas.slice(0, 20).map((alerta) => (
              <div key={alerta.id} className={`alert-item ${alerta.severidad}`}>
                {alerta.severidad === 'info' ? (
                  <Info size={18} color="#0066b2" style={{ flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <AlertTriangle
                    size={18}
                    color={alerta.severidad === 'alta' ? '#dc2626' : '#d97706'}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                )}
                <div className="alert-content">
                  <h4>{alerta.titulo}</h4>
                  <p>
                    {alerta.fecha} · {alerta.descripcion}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
