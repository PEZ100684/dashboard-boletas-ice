export type TipoPeriodo =
  | 'Bisemana'
  | 'Quincena 1'
  | 'Quincena 2'
  | 'Aguinaldo'
  | 'Salario Escolar';

export interface BoletaRegistro {
  id: string; // ej. 2026-B23
  anio: number;
  bisemana: number;
  numeroBoleta?: string | null;
  fechaDeposito: string; // YYYY-MM-DD o vacío si no registrada
  tipoPeriodo: TipoPeriodo;
  diasLaboradosMonto: number | null;
  horasExtraMonto: number | null;
  reportado: number; // Salario Bruto Total
  ccssSem: number | null;
  ccssIvm: number | null;
  bancoPopular: number | null;
  impuestoRenta?: number | null;
  fondoAhorroAsdeice?: number | null;
  otrasDeducciones: number | null;
  deducciones: number; // Total Deducciones
  pagado: number; // Salario Neto Depositado
  aguinaldoAcumulado: number;
  observaciones?: string | null;
  origen?: 'sheets' | 'pdf' | 'manual';
}

export interface AguinaldoHistorico {
  anio: number;
  fechaPago: string;
  montoAguinaldo: number;
  detalleOriginal: string;
}

export interface AlertaAuditoria {
  id: string;
  tipo: 'variacion_atipica' | 'deduccion_alta' | 'liquidez_baja' | 'aguinaldo_audit';
  severidad: 'alta' | 'media' | 'info';
  boletaId: string;
  fecha: string;
  titulo: string;
  descripcion: string;
  variacionPct?: number;
}
