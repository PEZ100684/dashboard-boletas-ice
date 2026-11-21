import type { AlertaAuditoria, BoletaRegistro } from '../types/boleta';
import { formatCRC } from './formatters';

export function generarAlertasAuditoria(boletas: BoletaRegistro[]): AlertaAuditoria[] {
  const ordenadas = [...boletas].sort((a, b) => {
    if (a.anio !== b.anio) return a.anio - b.anio;
    return a.bisemana - b.bisemana;
  });

  const alertas: AlertaAuditoria[] = [];

  for (let i = 1; i < ordenadas.length; i++) {
    const prev = ordenadas[i - 1];
    const curr = ordenadas[i];

    if (prev.pagado > 0) {
      const variacionNeto = ((curr.pagado - prev.pagado) / prev.pagado) * 100;
      const variacionBruto = prev.reportado > 0
        ? ((curr.reportado - prev.reportado) / prev.reportado) * 100
        : 0;

      // Alerta de variación atípica: neto baja más de 5%
      if (variacionNeto <= -5) {
        const aumentoDeducciones = curr.deducciones - prev.deducciones;
        const motivo =
          aumentoDeducciones > 1500
            ? `Aumento en deducciones de ${formatCRC(aumentoDeducciones)}.`
            : variacionBruto <= -4
              ? `Reducción en salario reportado (${variacionBruto.toFixed(1)}%), posible menor tiempo extraordinario o días.`
              : `Diferencia neta de ${formatCRC(curr.pagado - prev.pagado)}.`;

        alertas.push({
          id: `var-${curr.id}`,
          tipo: 'variacion_atipica',
          severidad: variacionNeto <= -10 ? 'alta' : 'media',
          boletaId: curr.id,
          fecha: curr.fechaDeposito || `${curr.anio}-B${String(curr.bisemana).padStart(2, '0')}`,
          titulo: `Caída de neto de ${Math.abs(variacionNeto).toFixed(1)}% en ${curr.id}`,
          descripcion: `Pasó de ${formatCRC(prev.pagado)} (${prev.id}) a ${formatCRC(curr.pagado)}. ${motivo}`,
          variacionPct: variacionNeto,
        });
      }
    }

    // Alerta de liquidez baja (< 85%)
    if (curr.reportado > 0) {
      const liquidez = (curr.pagado / curr.reportado) * 100;
      if (liquidez < 85) {
        alertas.push({
          id: `liq-${curr.id}`,
          tipo: 'liquidez_baja',
          severidad: liquidez < 80 ? 'alta' : 'media',
          boletaId: curr.id,
          fecha: curr.fechaDeposito || `${curr.anio}-B${String(curr.bisemana).padStart(2, '0')}`,
          titulo: `Liquidez inferior al 85% en ${curr.id} (${liquidez.toFixed(2)}%)`,
          descripcion: `Deducciones totales de ${formatCRC(curr.deducciones)} sobre un bruto de ${formatCRC(curr.reportado)}.`,
        });
      }
    }
  }

  // Más recientes primero
  return alertas.reverse();
}

export function calcularProyeccionAguinaldo(boletas: BoletaRegistro[], anio: number) {
  // En Costa Rica el aguinaldo suma 1/12 (8.3333%) de los salarios ordinarios y extraordinarios
  // del 1 de diciembre del año anterior al 30 de noviembre del año actual.
  const delAnio = boletas
    .filter((b) => b.anio === anio)
    .sort((a, b) => a.bisemana - b.bisemana);

  const ultima = delAnio[delAnio.length - 1];
  const brutoAnio = delAnio.reduce((acc, b) => acc + b.reportado, 0);
  const acumuladoSheet = ultima ? ultima.aguinaldoAcumulado : 0;
  const estimado833 = brutoAnio / 12;

  // Salario escolar en CR (~8.33% acumulado sobre salario bruto devengado en el año calendario)
  const salarioEscolarEstimado = brutoAnio * 0.083333;

  const promedioBisemanalBruto = delAnio.length > 0 ? brutoAnio / delAnio.length : 0;
  const bisemanasRestantes = Math.max(0, 26 - delAnio.length);
  const proyeccionCierreAguinaldo =
    (acumuladoSheet > 0 ? acumuladoSheet : estimado833) +
    (bisemanasRestantes * promedioBisemanalBruto) / 12;

  return {
    cantidadBoletas: delAnio.length,
    brutoAnio,
    acumuladoActual: acumuladoSheet > 0 ? acumuladoSheet : estimado833,
    salarioEscolarEstimado,
    proyeccionCierreAguinaldo,
  };
}
