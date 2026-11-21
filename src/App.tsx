import { Download, FileUp, LayoutDashboard, ShieldCheck, Table as TableIcon, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AuditoriaPanel } from './components/AuditoriaPanel';
import { BoletasTable } from './components/BoletasTable';
import { ChartsSection } from './components/ChartsSection';
import { KpiCards } from './components/KpiCards';
import { PdfUploadModal } from './components/PdfUploadModal';
import { INITIAL_AGUINALDOS, INITIAL_BOLETAS } from './data/initialData';
import type { BoletaRegistro } from './types/boleta';
import { generarAlertasAuditoria } from './utils/auditoria';
import { exportBoletasToCSV, parseBoletasCSV } from './utils/formatters';

const STORAGE_KEY = 'ice_boletas_custom_v1';

type TabKey = 'resumen' | 'boletas' | 'auditoria';

export function App() {
  const [boletas, setBoletas] = useState<BoletaRegistro[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const custom = JSON.parse(saved) as BoletaRegistro[];
        const map = new Map<string, BoletaRegistro>();
        for (const b of INITIAL_BOLETAS) map.set(b.id, b);
        for (const b of custom) map.set(b.id, b);
        return [...map.values()];
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_BOLETAS;
  });

  const [anioSeleccionado, setAnioSeleccionado] = useState<number | 'all'>('all');
  const [activeTab, setActiveTab] = useState<TabKey>('resumen');
  const [showPdfModal, setShowPdfModal] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportCSV = async (file: File) => {
    const text = await file.text();
    const parsed = parseBoletasCSV(text);
    if (parsed.length === 0) {
      alert('No se encontraron registros válidos en el CSV. Asegúrate de usar el formato de Boletas.');
      return;
    }
    setBoletas((prev) => {
      const map = new Map<string, BoletaRegistro>();
      for (const b of prev) map.set(b.id, b);
      for (const b of parsed) map.set(b.id, b);
      return [...map.values()];
    });
    const maxAnio = Math.max(...parsed.map((b) => b.anio));
    setAnioSeleccionado(maxAnio);
  };

  useEffect(() => {
    try {
      const customOnly = boletas.filter((b) => b.origen === 'pdf' || b.origen === 'manual');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customOnly));
    } catch {
      // ignore storage errors
    }
  }, [boletas]);

  const aniosDisponibles = useMemo(() => {
    const set = new Set(boletas.map((b) => b.anio));
    return [...set].sort((a, b) => b - a);
  }, [boletas]);

  const boletasFiltradas = useMemo(() => {
    if (anioSeleccionado === 'all') return boletas;
    return boletas.filter((b) => b.anio === anioSeleccionado);
  }, [boletas, anioSeleccionado]);

  const todasLasAlertas = useMemo(() => generarAlertasAuditoria(boletas), [boletas]);

  const alertasFiltradas = useMemo(() => {
    if (anioSeleccionado === 'all') return todasLasAlertas;
    const prefix = `${anioSeleccionado}-`;
    return todasLasAlertas.filter((a) => a.boletaId.startsWith(prefix));
  }, [todasLasAlertas, anioSeleccionado]);

  const alertIds = useMemo(
    () => new Set(todasLasAlertas.map((a) => a.boletaId)),
    [todasLasAlertas]
  );

  const ultimaBoletaGlobal = useMemo(() => {
    const sorted = [...boletas].sort((a, b) =>
      a.anio !== b.anio ? a.anio - b.anio : a.bisemana - b.bisemana
    );
    return sorted[sorted.length - 1];
  }, [boletas]);

  const handleSavePdfBoleta = (nuevo: BoletaRegistro) => {
    setBoletas((prev) => {
      const idx = prev.findIndex((b) => b.id === nuevo.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = nuevo;
        return copy;
      }
      return [...prev, nuevo];
    });
    setAnioSeleccionado(nuevo.anio);
  };

  return (
    <div className="app-container">
      <header className="top-header">
        <div className="brand-block">
          <div className="brand-emblem">ICE</div>
          <div>
            <h1 className="brand-title">Control de Boletas de Pago · ICE</h1>
            <p className="brand-subtitle">
              Planilla bisemanal · {boletas.length} registros guardados en este dispositivo
            </p>
          </div>
        </div>

        <div className="header-controls">
          <select
            id="select-anio"
            className="select-control"
            aria-label="Filtrar por año"
            value={anioSeleccionado}
            onChange={(e) => {
              const val = e.target.value;
              setAnioSeleccionado(val === 'all' ? 'all' : Number(val));
            }}
          >
            <option value="all">Todos los años</option>
            {aniosDisponibles.map((anio) => (
              <option key={anio} value={anio}>
                Año {anio}
              </option>
            ))}
          </select>

          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportCSV(file);
              e.target.value = '';
            }}
          />

          <button
            id="btn-import-csv"
            type="button"
            className="btn btn-secondary"
            onClick={() => csvInputRef.current?.click()}
          >
            <Upload size={16} /> Importar CSV
          </button>

          <button
            id="btn-export-csv"
            type="button"
            className="btn btn-secondary"
            onClick={() => exportBoletasToCSV(boletasFiltradas)}
          >
            <Download size={16} /> Exportar CSV
          </button>

          <button
            id="btn-upload-pdf"
            type="button"
            className="btn btn-primary"
            onClick={() => setShowPdfModal(true)}
          >
            <FileUp size={16} /> Cargar Boleta PDF
          </button>
        </div>
      </header>

      <nav className="nav-tabs" aria-label="Vistas del dashboard">
        <button
          id="tab-resumen"
          type="button"
          className={`nav-tab ${activeTab === 'resumen' ? 'active' : ''}`}
          onClick={() => setActiveTab('resumen')}
        >
          <LayoutDashboard size={16} /> Resumen y Gráficos
        </button>
        <button
          id="tab-boletas"
          type="button"
          className={`nav-tab ${activeTab === 'boletas' ? 'active' : ''}`}
          onClick={() => setActiveTab('boletas')}
        >
          <TableIcon size={16} /> Tabla de Boletas ({boletasFiltradas.length})
        </button>
        <button
          id="tab-auditoria"
          type="button"
          className={`nav-tab ${activeTab === 'auditoria' ? 'active' : ''}`}
          onClick={() => setActiveTab('auditoria')}
        >
          <ShieldCheck size={16} /> Auditoría y Aguinaldo
          {alertasFiltradas.length > 0 && (
            <span className="badge-count">{alertasFiltradas.length}</span>
          )}
        </button>
      </nav>

      <main>
        <KpiCards boletas={boletasFiltradas} anioSeleccionado={anioSeleccionado} />

        {activeTab === 'resumen' && (
          <>
            <ChartsSection boletas={boletasFiltradas} anioSeleccionado={anioSeleccionado} />
            <BoletasTable boletas={boletasFiltradas} alertIds={alertIds} />
          </>
        )}

        {activeTab === 'boletas' && (
          <BoletasTable boletas={boletasFiltradas} alertIds={alertIds} />
        )}

        {activeTab === 'auditoria' && (
          <AuditoriaPanel
            boletas={boletas}
            aguinaldosHistoricos={INITIAL_AGUINALDOS}
            alertas={alertasFiltradas}
            anioReferencia={anioSeleccionado === 'all' ? 2026 : anioSeleccionado}
          />
        )}
      </main>

      {showPdfModal && (
        <PdfUploadModal
          onClose={() => setShowPdfModal(false)}
          onSave={handleSavePdfBoleta}
          lastBoleta={ultimaBoletaGlobal}
        />
      )}
    </div>
  );
}

export default App;
