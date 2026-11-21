import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { BoletaRegistro } from '../types/boleta';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PdfExtractionResult {
  registro: BoletaRegistro;
  rawText: string;
  camposDetectados: string[];
  confianza: 'alta' | 'media' | 'baja';
}

function parseCostaRicaNumber(raw: string): number | null {
  if (!raw) return null;
  let clean = raw.replace(/[₡¢$\s]/g, '').trim();
  if (!clean) return null;

  // Caso formato europeo/CR con punto de miles y coma decimal: 338.313,62
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(clean)) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else {
    // Caso estándar con coma de miles y punto decimal: 338,313.62
    clean = clean.replace(/,/g, '');
  }

  const num = Number.parseFloat(clean);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : null;
}

function extractAmountAfterLabels(lines: string[], patterns: RegExp[]): number | null {
  const moneyRegex = /(?:₡\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/g;

  for (const pattern of patterns) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (pattern.test(line)) {
        const matches = [...line.matchAll(moneyRegex)];
        if (matches.length > 0) {
          // Tomar el último monto de la línea (usualmente la columna de total/monto)
          const parsed = parseCostaRicaNumber(matches[matches.length - 1][1]);
          if (parsed !== null && parsed >= 0) return parsed;
        }
        // Revisar la línea siguiente por si el valor está debajo del encabezado
        if (i + 1 < lines.length) {
          const nextMatches = [...lines[i + 1].matchAll(moneyRegex)];
          if (nextMatches.length > 0) {
            const parsed = parseCostaRicaNumber(nextMatches[nextMatches.length - 1][1]);
            if (parsed !== null && parsed >= 0) return parsed;
          }
        }
      }
    }
  }
  return null;
}

function extractDate(text: string): string {
  // YYYY-MM-DD
  const isoMatch = text.match(/\b(20\d{2})[-/](\d{2})[-/](\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  // DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    return `${dmyMatch[3]}-${m}-${d}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function estimateBisemanaFromDate(fechaIso: string): number {
  const date = new Date(`${fechaIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 1;
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diffDays = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(27, Math.max(1, Math.ceil((diffDays + 1) / 14)));
}

export async function extractBoletaFromPdf(
  file: File,
  lastBoleta?: BoletaRegistro
): Promise<PdfExtractionResult> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const pageLines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; str: string }[]>();

    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 4) * 4;
      const x = item.transform[4];
      const existing = rows.get(y) ?? [];
      existing.push({ x, str: item.str });
      rows.set(y, existing);
    }

    const sortedY = [...rows.keys()].sort((a, b) => b - a);
    for (const y of sortedY) {
      const items = rows.get(y)!.sort((a, b) => a.x - b.x);
      pageLines.push(items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim());
    }
  }

  const rawText = pageLines.join('\n');
  const camposDetectados: string[] = [];

  const fechaDeposito = extractDate(rawText);
  const anio = Number.parseInt(fechaDeposito.slice(0, 4), 10) || new Date().getFullYear();

  const bisemanaMatch = rawText.match(/(?:bisemana|periodo|per[ií]odo|semana)\s*[:#n°]?\s*(\d{1,2})/i);
  const bisemana = bisemanaMatch
    ? Math.min(27, Math.max(1, Number.parseInt(bisemanaMatch[1], 10)))
    : estimateBisemanaFromDate(fechaDeposito);

  const numBoletaMatch = rawText.match(/(?:boleta|comprobante|no\.?|n[°º])\s*[:#]?\s*(\d{2,10})/i);
  const numeroBoleta = numBoletaMatch ? numBoletaMatch[1] : undefined;
  if (numeroBoleta) camposDetectados.push('Número de Boleta');

  const diasLaboradosMonto = extractAmountAfterLabels(pageLines, [
    /d[ií]as\s+laborados/i,
    /salario\s+base/i,
    /sueldo\s+base/i,
    /ordinario/i,
  ]);
  if (diasLaboradosMonto !== null) camposDetectados.push('Salario Base / Días Laborados');

  const horasExtraMonto = extractAmountAfterLabels(pageLines, [
    /horas?\s+extra/i,
    /tiempo\s+extra/i,
    /pluses|anualidad|disponibilidad|zonaje/i,
  ]);
  if (horasExtraMonto !== null) camposDetectados.push('Horas Extra / Pluses');

  let reportado = extractAmountAfterLabels(pageLines, [
    /total\s+reportado/i,
    /total\s+devengado/i,
    /total\s+ingresos/i,
    /salario\s+bruto/i,
    /bruto\s+total/i,
  ]);
  if (reportado !== null) camposDetectados.push('Salario Bruto (Reportado)');

  const ccssSem = extractAmountAfterLabels(pageLines, [
    /c\.?c\.?s\.?s\.?\s*s\.?e\.?m/i,
    /enfermedad\s+y\s+maternidad/i,
    /\bsem\b.*5\.?5/i,
  ]);
  if (ccssSem !== null) camposDetectados.push('CCSS SEM');

  const ccssIvm = extractAmountAfterLabels(pageLines, [
    /c\.?c\.?s\.?s\.?\s*i\.?v\.?m/i,
    /invalidez.*vejez/i,
    /\bivm\b/i,
  ]);
  if (ccssIvm !== null) camposDetectados.push('CCSS IVM');

  const bancoPopular = extractAmountAfterLabels(pageLines, [
    /banco\s+popular/i,
    /b\.?p\.?d\.?c/i,
    /aporte\s+obrero/i,
  ]);
  if (bancoPopular !== null) camposDetectados.push('Banco Popular');

  const impuestoRenta = extractAmountAfterLabels(pageLines, [
    /impuesto.*renta/i,
    /retenci[oó]n\s+renta/i,
    /\brenta\b/i,
  ]);
  if (impuestoRenta !== null) camposDetectados.push('Impuesto de Renta');

  const fondoAhorroAsdeice = extractAmountAfterLabels(pageLines, [
    /fondo.*garant[ií]a/i,
    /asdeice/i,
    /fondo.*ahorro/i,
  ]);
  if (fondoAhorroAsdeice !== null) camposDetectados.push('Fondo Garantías / ASDEICE');

  let deducciones = extractAmountAfterLabels(pageLines, [
    /total\s+deducciones/i,
    /total\s+rebajos/i,
  ]);
  if (deducciones !== null) camposDetectados.push('Total Deducciones');

  let pagado = extractAmountAfterLabels(pageLines, [
    /total\s+pagado/i,
    /neto\s+a\s+pagar/i,
    /salario\s+neto/i,
    /l[ií]quido\s+a\s+recibir/i,
    /monto\s+depositado/i,
  ]);
  if (pagado !== null) camposDetectados.push('Salario Neto (Pagado)');

  // Completar cálculos faltantes de forma consistente
  if (reportado === null && diasLaboradosMonto !== null) {
    reportado = Math.round((diasLaboradosMonto + (horasExtraMonto ?? 0)) * 100) / 100;
  }
  if (reportado === null) reportado = 0;

  const sumaDesglose =
    (ccssSem ?? 0) +
    (ccssIvm ?? 0) +
    (bancoPopular ?? 0) +
    (impuestoRenta ?? 0) +
    (fondoAhorroAsdeice ?? 0);

  if (deducciones === null) {
    if (sumaDesglose > 0) {
      deducciones = Math.round(sumaDesglose * 100) / 100;
    } else if (pagado !== null && reportado > pagado) {
      deducciones = Math.round((reportado - pagado) * 100) / 100;
    } else {
      deducciones = 0;
    }
  }

  if (pagado === null && reportado > 0) {
    pagado = Math.round((reportado - deducciones) * 100) / 100;
  }
  if (pagado === null) pagado = 0;

  const otrasDeducciones =
    deducciones > sumaDesglose && sumaDesglose > 0
      ? Math.round((deducciones - sumaDesglose) * 100) / 100
      : fondoAhorroAsdeice ?? 0;

  const prevAguinaldo =
    lastBoleta && lastBoleta.anio === anio ? lastBoleta.aguinaldoAcumulado : 0;
  const aguinaldoAcumulado = Math.round((prevAguinaldo + reportado / 12) * 100) / 100;

  const id = `${anio}-B${String(bisemana).padStart(2, '0')}`;
  const confianza: 'alta' | 'media' | 'baja' =
    camposDetectados.length >= 4 ? 'alta' : camposDetectados.length >= 2 ? 'media' : 'baja';

  return {
    registro: {
      id,
      anio,
      bisemana,
      numeroBoleta,
      fechaDeposito,
      tipoPeriodo: 'Bisemana',
      diasLaboradosMonto,
      horasExtraMonto,
      reportado,
      ccssSem,
      ccssIvm,
      bancoPopular,
      impuestoRenta,
      fondoAhorroAsdeice,
      otrasDeducciones,
      deducciones,
      pagado,
      aguinaldoAcumulado,
      observaciones: `Extraído de ${file.name}`,
      origen: 'pdf',
    },
    rawText,
    camposDetectados,
    confianza,
  };
}
