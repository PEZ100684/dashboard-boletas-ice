import {
  Activity,
  ArrowDownRight,
  Landmark,
  ShieldAlert,
  Wallet,
} from 'lucide-react';
import type { BoletaRegistro } from '../types/boleta';
import { formatCRC, formatPct } from '../utils/formatters';

interface KpiCardsProps {
  boletas: BoletaRegistro[];
  anioSeleccionado: number | 'all';
}

export function KpiCards({ boletas, anioSeleccionado }: KpiCardsProps) {
  const totalBruto = boletas.reduce((acc, b) => acc + b.reportado, 0);
  const totalDeducciones = boletas.reduce((acc, b) => acc + b.deducciones, 0);
  const totalOtras = boletas.reduce(
    (acc, b) => acc + (b.otrasDeducciones ?? 0) + (b.fondoAhorroAsdeice ?? 0),
    0
  );
  const totalDeduccionesLey = Math.max(0, totalDeducciones - totalOtras);
  const totalNeto = boletas.reduce((acc, b) => acc + b.pagado, 0);
  const liquidezPct = totalBruto > 0 ? (totalNeto / totalBruto) * 100 : 0;

  const ordenadas = [...boletas].sort((a, b) =>
    a.anio !== b.anio ? a.anio - b.anio : a.bisemana - b.bisemana
  );
  const ultima = ordenadas[ordenadas.length - 1];
  const promedioNeto = boletas.length > 0 ? totalNeto / boletas.length : 0;

  const etiquetaPeriodo =
    anioSeleccionado === 'all'
      ? `${boletas.length} boletas (2017–2026)`
      : `${boletas.length} boletas en ${anioSeleccionado}`;

  return (
    <section className="kpi-grid" aria-label="Indicadores clave de desempeño">
      <article className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Salario Bruto Total</span>
          <span className="kpi-icon blue">
            <Wallet size={16} />
          </span>
        </div>
        <div className="kpi-value mono">{formatCRC(totalBruto)}</div>
        <div className="kpi-foot">
          <span>{etiquetaPeriodo}</span>
          {ultima && <span className="mono">Últ: {formatCRC(ultima.reportado)}</span>}
        </div>
      </article>

      <article className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Deducciones de Ley</span>
          <span className="kpi-icon rose">
            <Landmark size={16} />
          </span>
        </div>
        <div className="kpi-value mono">{formatCRC(totalDeduccionesLey)}</div>
        <div className="kpi-foot">
          <span>CCSS · Banco Popular · Renta</span>
          <span className="mono">
            {totalBruto > 0 ? formatPct((totalDeduccionesLey / totalBruto) * 100) : '0.00%'}
          </span>
        </div>
      </article>

      <article className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Deducciones Personales</span>
          <span className="kpi-icon amber">
            <ShieldAlert size={16} />
          </span>
        </div>
        <div className="kpi-value mono">{formatCRC(totalOtras)}</div>
        <div className="kpi-foot">
          <span>Fondo ICE / ASDEICE / Otros</span>
          <span className="mono">
            {totalBruto > 0 ? formatPct((totalOtras / totalBruto) * 100) : '0.00%'}
          </span>
        </div>
      </article>

      <article className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Salario Neto Depositado</span>
          <span className="kpi-icon emerald">
            <ArrowDownRight size={16} />
          </span>
        </div>
        <div className="kpi-value mono">{formatCRC(totalNeto)}</div>
        <div className="kpi-foot">
          <span>Prom. bisemanal</span>
          <span className="mono">{formatCRC(promedioNeto)}</span>
        </div>
      </article>

      <article className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">Porcentaje de Liquidez</span>
          <span className="kpi-icon slate">
            <Activity size={16} />
          </span>
        </div>
        <div className="kpi-value mono">{formatPct(liquidezPct)}</div>
        <div className="kpi-foot">
          <span>Neto / Bruto</span>
          {ultima && (
            <span className="mono">
              Últ: {formatPct(ultima.reportado > 0 ? (ultima.pagado / ultima.reportado) * 100 : 0)}
            </span>
          )}
        </div>
      </article>
    </section>
  );
}
