import type { BoletaRegistro } from '../types/boleta';

export function formatCRC(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace(/\u00a0/g, '');
}

export function formatCRCCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `₡${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `₡${(value / 1_000).toFixed(0)}k`;
  }
  return `₡${value.toFixed(0)}`;
}

export function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function exportBoletasToCSV(boletas: BoletaRegistro[]): void {
  const headers = [
    'ID_Registro',
    'Anio',
    'Bisemana',
    'Numero_Boleta',
    'Fecha_Deposito',
    'Dias_Laborados_Monto',
    'Horas_Extra_Monto',
    'Reportado',
    'CCSS_SEM',
    'CCSS_IVM',
    'Banco_Popular',
    'Otras_Deducciones',
    'Deducciones',
    'Pagado',
    'Aguinaldo',
    'Observaciones',
  ];

  const escapeCsv = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = boletas.map((b) => [
    b.id,
    b.anio,
    b.bisemana,
    b.numeroBoleta ?? '',
    b.fechaDeposito,
    b.diasLaboradosMonto ?? '',
    b.horasExtraMonto ?? '',
    b.reportado.toFixed(2),
    b.ccssSem ?? '',
    b.ccssIvm ?? '',
    b.bancoPopular ?? '',
    b.otrasDeducciones ?? '',
    b.deducciones.toFixed(2),
    b.pagado.toFixed(2),
    b.aguinaldoAcumulado.toFixed(2),
    b.observaciones ?? '',
  ]);

  const csvContent =
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `boletas_ice_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseCsvMoney(val: string | undefined): number | null {
  if (!val) return null;
  const clean = val.replace(/[₡",\s]/g, '').trim();
  if (!clean) return null;
  const num = Number.parseFloat(clean);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function parseBoletasCSV(csvText: string): BoletaRegistro[] {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const idx = (name: string) => headers.indexOf(name);

  const registros: BoletaRegistro[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const id = (cols[idx('ID_Registro')] ?? '').trim();
    if (!id || id.startsWith('TOTAL')) continue;

    const anio = Number.parseInt(cols[idx('Anio')] ?? '', 10);
    const bisemana = Number.parseInt(cols[idx('Bisemana')] ?? '', 10);
    if (!Number.isFinite(anio) || !Number.isFinite(bisemana)) continue;

    registros.push({
      id,
      anio,
      bisemana,
      numeroBoleta: (cols[idx('Numero_Boleta')] ?? '').trim() || null,
      fechaDeposito: (cols[idx('Fecha_Deposito')] ?? '').trim(),
      tipoPeriodo: 'Bisemana',
      diasLaboradosMonto: parseCsvMoney(cols[idx('Dias_Laborados_Monto')]),
      horasExtraMonto: parseCsvMoney(cols[idx('Horas_Extra_Monto')]),
      reportado: parseCsvMoney(cols[idx('Reportado')]) ?? 0,
      ccssSem: parseCsvMoney(cols[idx('CCSS_SEM')]),
      ccssIvm: parseCsvMoney(cols[idx('CCSS_IVM')]),
      bancoPopular: parseCsvMoney(cols[idx('Banco_Popular')]),
      impuestoRenta: null,
      fondoAhorroAsdeice: null,
      otrasDeducciones: parseCsvMoney(cols[idx('Otras_Deducciones')]),
      deducciones: parseCsvMoney(cols[idx('Deducciones')]) ?? 0,
      pagado: parseCsvMoney(cols[idx('Pagado')]) ?? 0,
      aguinaldoAcumulado: parseCsvMoney(cols[idx('Aguinaldo')]) ?? 0,
      observaciones: (cols[idx('Observaciones')] ?? '').trim() || null,
      origen: 'pdf',
    });
  }
  return registros;
}
