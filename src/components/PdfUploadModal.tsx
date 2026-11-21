import { CheckCircle2, FileUp, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { BoletaRegistro } from '../types/boleta';
import { formatCRC } from '../utils/formatters';
import { extractBoletaFromPdf } from '../utils/pdfParser';
import type { PdfExtractionResult } from '../utils/pdfParser';

interface PdfUploadModalProps {
  onClose: () => void;
  onSave: (registro: BoletaRegistro) => void;
  lastBoleta?: BoletaRegistro;
}

export function PdfUploadModal({ onClose, onSave, lastBoleta }: PdfUploadModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PdfExtractionResult | null>(null);
  const [form, setForm] = useState<BoletaRegistro | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Por favor selecciona un archivo en formato PDF.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const extracted = await extractBoletaFromPdf(file, lastBoleta);
      setResult(extracted);
      setForm(extracted.registro);
    } catch (err) {
      setError(
        err instanceof Error
          ? `No se pudo leer el PDF: ${err.message}`
          : 'Ocurrió un error al procesar el archivo PDF.'
      );
    } finally {
      setLoading(false);
    }
  };

  const updateNum = (field: keyof BoletaRegistro, rawVal: string) => {
    if (!form) return;
    const val = rawVal === '' ? null : Number.parseFloat(rawVal);
    const next = { ...form, [field]: Number.isNaN(val as number) ? 0 : val };

    // Recalcular totales automáticamente si se ajustan rubros
    if (field === 'reportado' || field === 'deducciones') {
      const rep = Number(next.reportado ?? 0);
      const ded = Number(next.deducciones ?? 0);
      next.pagado = Math.round((rep - ded) * 100) / 100;
    }
    setForm(next);
  };

  const handleConfirm = () => {
    if (!form) return;
    const idNormalized = `${form.anio}-B${String(form.bisemana).padStart(2, '0')}`;
    onSave({ ...form, id: idNormalized });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileUp size={19} color="#0066b2" />
            <h2>Cargar y Extraer Boleta PDF del ICE</h2>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {!form && (
            <div
              className={`dropzone ${dragging ? 'dragging' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <Loader2 size={28} color="#0066b2" />
                  <strong>Extrayendo datos de la boleta PDF...</strong>
                  <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    Procesamiento 100% local en tu navegador
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <FileUp size={32} color="#0066b2" />
                  <strong style={{ fontSize: 15 }}>
                    Arrastra tu boleta de pago en PDF aquí o haz clic para seleccionarla
                  </strong>
                  <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                    Detecta automáticamente fechas, salario reportado, CCSS SEM/IVM, Banco Popular,
                    renta, extras y salario neto.
                  </span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="alert-item alta" style={{ marginTop: 14 }}>
              <div className="alert-content">
                <h4>Error de lectura</h4>
                <p>{error}</p>
              </div>
            </div>
          )}

          {form && result && (
            <div>
              <div className="alert-item info">
                <CheckCircle2 size={18} color="#0066b2" style={{ flexShrink: 0, marginTop: 2 }} />
                <div className="alert-content" style={{ flex: 1 }}>
                  <h4>
                    Lectura completada (Confianza:{' '}
                    {result.confianza === 'alta'
                      ? 'Alta'
                      : result.confianza === 'media'
                        ? 'Media'
                        : 'Baja — verifica los campos'}
                    )
                  </h4>
                  <p>
                    {result.camposDetectados.length > 0
                      ? `Campos detectados: ${result.camposDetectados.join(', ')}.`
                      : 'No se detectaron etiquetas estándar del ICE; puedes completar o corregir los montos abajo.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowRaw((s) => !s)}
                >
                  {showRaw ? 'Ocultar texto PDF' : 'Ver texto PDF'}
                </button>
              </div>

              {showRaw && <pre className="raw-text-box">{result.rawText || '(Sin texto extraíble)'}</pre>}

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="pdf-anio">Año</label>
                  <input
                    id="pdf-anio"
                    type="number"
                    className="input-control mono"
                    value={form.anio}
                    onChange={(e) => setForm({ ...form, anio: Number(e.target.value) || 2026 })}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="pdf-bisemana">Bisemana (1–27)</label>
                  <input
                    id="pdf-bisemana"
                    type="number"
                    min={1}
                    max={27}
                    className="input-control mono"
                    value={form.bisemana}
                    onChange={(e) => setForm({ ...form, bisemana: Number(e.target.value) || 1 })}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="pdf-fecha">Fecha Depósito</label>
                  <input
                    id="pdf-fecha"
                    type="date"
                    className="input-control mono"
                    value={form.fechaDeposito}
                    onChange={(e) => setForm({ ...form, fechaDeposito: e.target.value })}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pdf-boleta">N° Boleta</label>
                  <input
                    id="pdf-boleta"
                    type="text"
                    className="input-control mono"
                    value={form.numeroBoleta ?? ''}
                    onChange={(e) => setForm({ ...form, numeroBoleta: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="pdf-base">Días Laborados (₡)</label>
                  <input
                    id="pdf-base"
                    type="number"
                    step="0.01"
                    className="input-control mono"
                    value={form.diasLaboradosMonto ?? ''}
                    onChange={(e) => updateNum('diasLaboradosMonto', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="pdf-extra">Horas Extra / Pluses (₡)</label>
                  <input
                    id="pdf-extra"
                    type="number"
                    step="0.01"
                    className="input-control mono"
                    value={form.horasExtraMonto ?? ''}
                    onChange={(e) => updateNum('horasExtraMonto', e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pdf-reportado">Salario Bruto Reportado (₡)</label>
                  <input
                    id="pdf-reportado"
                    type="number"
                    step="0.01"
                    className="input-control mono"
                    value={form.reportado}
                    onChange={(e) => updateNum('reportado', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="pdf-sem">CCSS SEM (₡)</label>
                  <input
                    id="pdf-sem"
                    type="number"
                    step="0.01"
                    className="input-control mono"
                    value={form.ccssSem ?? ''}
                    onChange={(e) => updateNum('ccssSem', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="pdf-ivm">CCSS IVM (₡)</label>
                  <input
                    id="pdf-ivm"
                    type="number"
                    step="0.01"
                    className="input-control mono"
                    value={form.ccssIvm ?? ''}
                    onChange={(e) => updateNum('ccssIvm', e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="pdf-bp">Banco Popular (₡)</label>
                  <input
                    id="pdf-bp"
                    type="number"
                    step="0.01"
                    className="input-control mono"
                    value={form.bancoPopular ?? ''}
                    onChange={(e) => updateNum('bancoPopular', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="pdf-deducciones">Total Deducciones (₡)</label>
                  <input
                    id="pdf-deducciones"
                    type="number"
                    step="0.01"
                    className="input-control mono"
                    value={form.deducciones}
                    onChange={(e) => updateNum('deducciones', e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="pdf-pagado">Salario Neto Pagado (₡)</label>
                  <input
                    id="pdf-pagado"
                    type="number"
                    step="0.01"
                    className="input-control mono"
                    value={form.pagado}
                    onChange={(e) => updateNum('pagado', e.target.value)}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'var(--emerald-soft)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 13,
                }}
              >
                <span>
                  ID generado: <strong className="mono">{form.anio}-B{String(form.bisemana).padStart(2, '0')}</strong>
                </span>
                <span>
                  Neto a registrar:{' '}
                  <strong className="mono" style={{ color: 'var(--emerald)' }}>
                    {formatCRC(form.pagado)}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {form && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setForm(null);
                setResult(null);
              }}
            >
              Cargar otro PDF
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          {form && (
            <button type="button" className="btn btn-primary" onClick={handleConfirm}>
              Guardar en Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
