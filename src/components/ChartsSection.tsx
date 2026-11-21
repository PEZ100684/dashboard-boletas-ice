import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BoletaRegistro } from '../types/boleta';
import { formatCRC, formatCRCCompact } from '../utils/formatters';

interface ChartsSectionProps {
  boletas: BoletaRegistro[];
  anioSeleccionado: number | 'all';
}

export function ChartsSection({ boletas, anioSeleccionado }: ChartsSectionProps) {
  const ordenadas = [...boletas].sort((a, b) =>
    a.anio !== b.anio ? a.anio - b.anio : a.bisemana - b.bisemana
  );

  // Evolución histórica: si es 'all', agregamos por año; si es año específico, por bisemana
  const datosEvolucion =
    anioSeleccionado === 'all'
      ? Object.values(
          ordenadas.reduce<
            Record<number, { etiqueta: string; bruto: number; neto: number; deducciones: number }>
          >((acc, b) => {
            if (!acc[b.anio]) {
              acc[b.anio] = { etiqueta: String(b.anio), bruto: 0, neto: 0, deducciones: 0 };
            }
            acc[b.anio].bruto += b.reportado;
            acc[b.anio].neto += b.pagado;
            acc[b.anio].deducciones += b.deducciones;
            return acc;
          }, {})
        )
      : ordenadas.map((b) => ({
          etiqueta: `B${String(b.bisemana).padStart(2, '0')}`,
          bruto: b.reportado,
          neto: b.pagado,
          deducciones: b.deducciones,
        }));

  // Última boleta disponible (o última con desglose completo) para Cascada y Dona
  const ultimaBoleta = ordenadas[ordenadas.length - 1];
  const boletaDesglose =
    [...ordenadas].reverse().find((b) => b.ccssSem !== null && b.ccssIvm !== null) ??
    ultimaBoleta;

  // Datos de Cascada (Waterfall) de la boleta más reciente con desglose o estimación 10.67%
  const waterfallData = (() => {
    if (!boletaDesglose) return [];
    const bruto = boletaDesglose.reportado;
    const sem = boletaDesglose.ccssSem ?? Math.round(bruto * 0.055 * 100) / 100;
    const ivm = boletaDesglose.ccssIvm ?? Math.round(bruto * 0.0417 * 100) / 100;
    const bp = boletaDesglose.bancoPopular ?? Math.round(bruto * 0.01 * 100) / 100;
    const otras = Math.max(0, boletaDesglose.deducciones - (sem + ivm + bp));

    const paso1 = bruto - sem;
    const paso2 = paso1 - ivm;
    const paso3 = paso2 - bp;
    const neto = boletaDesglose.pagado;

    return [
      { nombre: 'Bruto', base: 0, valor: bruto, montoReal: bruto, color: '#0066b2' },
      { nombre: 'CCSS SEM', base: paso1, valor: sem, montoReal: -sem, color: '#dc2626' },
      { nombre: 'CCSS IVM', base: paso2, valor: ivm, montoReal: -ivm, color: '#ef4444' },
      { nombre: 'Bco. Popular', base: paso3, valor: bp, montoReal: -bp, color: '#f59e0b' },
      ...(otras > 0.5
        ? [{ nombre: 'Renta/Otros', base: neto, valor: otras, montoReal: -otras, color: '#64748b' }]
        : []),
      { nombre: 'Neto', base: 0, valor: neto, montoReal: neto, color: '#059669' },
    ];
  })();

  // Datos para Gráfico de Anillo (Desglose de Deducciones del periodo filtrado)
  const donaData = (() => {
    const conDesglose = ordenadas.filter((b) => b.ccssSem !== null);
    if (conDesglose.length > 0 && anioSeleccionado !== 'all' && conDesglose.length === ordenadas.length) {
      const sem = conDesglose.reduce((s, b) => s + (b.ccssSem ?? 0), 0);
      const ivm = conDesglose.reduce((s, b) => s + (b.ccssIvm ?? 0), 0);
      const bp = conDesglose.reduce((s, b) => s + (b.bancoPopular ?? 0), 0);
      const otras = conDesglose.reduce(
        (s, b) => s + (b.otrasDeducciones ?? 0) + (b.impuestoRenta ?? 0) + (b.fondoAhorroAsdeice ?? 0),
        0
      );
      return [
        { name: 'CCSS SEM (5.50%)', value: sem, color: '#0066b2' },
        { name: 'CCSS IVM (4.17%)', value: ivm, color: '#0284c7' },
        { name: 'Banco Popular (1.00%)', value: bp, color: '#d97706' },
        ...(otras > 0 ? [{ name: 'Renta / Otras', value: otras, color: '#dc2626' }] : []),
      ];
    }

    // Estimación proporcional basada en tasas de ley CR cuando el histórico solo tiene total deducciones
    const totalDed = ordenadas.reduce((s, b) => s + b.deducciones, 0);
    const totalBruto = ordenadas.reduce((s, b) => s + b.reportado, 0);
    const semEst = Math.min(totalDed, totalBruto * 0.055);
    const ivmEst = Math.min(Math.max(0, totalDed - semEst), totalBruto * 0.0417);
    const bpEst = Math.min(Math.max(0, totalDed - semEst - ivmEst), totalBruto * 0.01);
    const otrasEst = Math.max(0, totalDed - semEst - ivmEst - bpEst);

    return [
      { name: 'CCSS SEM', value: Math.round(semEst), color: '#0066b2' },
      { name: 'CCSS IVM', value: Math.round(ivmEst), color: '#0284c7' },
      { name: 'Banco Popular', value: Math.round(bpEst), color: '#d97706' },
      ...(otrasEst > 100 ? [{ name: 'Renta / Otras', value: Math.round(otrasEst), color: '#64748b' }] : []),
    ];
  })();

  return (
    <>
      <div className="charts-grid-main">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                Evolución Histórica: Salario Bruto vs. Salario Neto
              </h2>
              <p className="panel-subtitle">
                {anioSeleccionado === 'all'
                  ? 'Totales anuales consolidados (2017–2026)'
                  : `Detalle bisemanal del año ${anioSeleccionado}`}
              </p>
            </div>
          </div>
          <div style={{ width: '100%', height: 310 }}>
            <ResponsiveContainer>
              <AreaChart data={datosEvolucion} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradBruto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0066b2" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#0066b2" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="gradNeto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.26} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis
                  tickFormatter={(v) => formatCRCCompact(Number(v))}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  width={72}
                />
                <Tooltip
                  formatter={(value) => formatCRC(Number(value))}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12.5 }} />
                <Area
                  type="monotone"
                  dataKey="bruto"
                  name="Salario Bruto"
                  stroke="#0066b2"
                  strokeWidth={2.2}
                  fill="url(#gradBruto)"
                />
                <Area
                  type="monotone"
                  dataKey="neto"
                  name="Salario Neto"
                  stroke="#059669"
                  strokeWidth={2.2}
                  fill="url(#gradNeto)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Desglose de Deducciones</h2>
              <p className="panel-subtitle">
                Proporción por rubro ({anioSeleccionado === 'all' ? 'Histórico' : anioSeleccionado})
              </p>
            </div>
          </div>
          <div style={{ width: '100%', height: 310 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={donaData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {donaData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCRC(Number(value))}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                  }}
                />
                <Legend verticalAlign="bottom" height={42} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {boletaDesglose && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div>
              <h2 className="panel-title">
                Distribución del Salario Bruto (Cascada · {boletaDesglose.id})
              </h2>
              <p className="panel-subtitle">
                Reducción paso a paso desde el monto reportado hasta el salario neto depositado
                {boletaDesglose.fechaDeposito ? ` (${boletaDesglose.fechaDeposito})` : ''}
              </p>
            </div>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={waterfallData} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="nombre" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis
                  tickFormatter={(v) => formatCRCCompact(Number(v))}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  width={72}
                />
                <Tooltip
                  formatter={(_val, _name, item) => {
                    const real = (item?.payload as { montoReal?: number })?.montoReal ?? 0;
                    return [formatCRC(real), 'Monto'];
                  }}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                  }}
                />
                <Bar dataKey="base" stackId="wf" fill="transparent" />
                <Bar dataKey="valor" stackId="wf" radius={[4, 4, 0, 0]}>
                  {waterfallData.map((entry) => (
                    <Cell key={entry.nombre} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </>
  );
}
