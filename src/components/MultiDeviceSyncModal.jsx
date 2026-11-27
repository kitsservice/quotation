import React, { useState, useEffect } from 'react';
import { 
  X, 
  Laptop, 
  Share2, 
  Copy, 
  Check, 
  Download, 
  Upload, 
  CheckCircle2, 
  RefreshCw,
  AlertCircle,
  Database
} from 'lucide-react';
import { exportDatabaseBackup, importDatabaseBackup } from '../services/db';
import { buildFullSyncUrl, decompressFromUrlSafe } from '../utils/shareLink';

function MultiDeviceSyncModal({
  isOpen,
  onClose,
  onReloadData,
  showToast
}) {
  const [syncUrl, setSyncUrl] = useState('');
  const [generatingUrl, setGeneratingUrl] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [importingManual, setImportingManual] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // Generate the full sync URL when the modal opens
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    (async () => {
      setGeneratingUrl(true);
      try {
        const backup = exportDatabaseBackup();
        const url = await buildFullSyncUrl(backup);
        if (active) {
          setSyncUrl(url);
        }
      } catch (err) {
        console.warn('Error generating sync URL:', err);
      } finally {
        if (active) setGeneratingUrl(false);
      }
    })();

    return () => {
      active = false;
      setSyncUrl('');
      setCopiedLink(false);
      setManualCode('');
      setStatusMessage(null);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (!syncUrl) return;
    navigator.clipboard.writeText(syncUrl);
    setCopiedLink(true);
    if (showToast) showToast('Sync link copied! Open this on your other laptop.');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleExportBackup = () => {
    try {
      const backup = exportDatabaseBackup();
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KITS_Robotics_DataBackup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (showToast) showToast('Backup file downloaded.');
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Export error: ' + err.message });
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        await importDatabaseBackup(parsed);
        setStatusMessage({ type: 'success', text: 'All data imported successfully! Updating view...' });
        if (showToast) showToast('All data imported successfully!');
        if (onReloadData) await onReloadData();
        setTimeout(() => onClose(), 1200);
      } catch (err) {
        setStatusMessage({ type: 'error', text: 'Failed to import backup: ' + err.message });
      }
    };
    reader.readAsText(file);
  };

  const handleImportManualCode = async () => {
    const raw = manualCode.trim();
    if (!raw) return;

    setImportingManual(true);
    try {
      let code = raw;
      if (raw.includes('#sync=')) {
        code = raw.split('#sync=')[1].split('&')[0];
      } else if (raw.includes('sync=')) {
        code = raw.split('sync=')[1].split('&')[0];
      }

      const decoded = await decompressFromUrlSafe(code);
      if (!decoded || (!decoded.quotations && !decoded.clients)) {
        throw new Error('Invalid or corrupted sync code. Please verify the copied link or code.');
      }

      await importDatabaseBackup(decoded);
      setStatusMessage({ 
        type: 'success', 
        text: `Successfully imported ${decoded.quotations?.length || 0} quotations and ${decoded.clients?.length || 0} clients!` 
      });
      if (showToast) showToast('Data imported successfully!');
      if (onReloadData) await onReloadData();
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setImportingManual(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Sync Data Between Laptops</h3>
              <p className="text-xs text-slate-500">Make your quotations, clients & catalog visible on any laptop</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className={`p-3 rounded-xl text-xs font-medium flex items-center space-x-2 ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Method 1: Instant Multi-Device Sync Link */}
        <div className="p-4 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200/80 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Share2 className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-slate-900 text-xs">Method 1: One-Click Transfer Link</span>
            </div>
            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Fastest</span>
          </div>
          
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Copy this link and open it in the browser on your other laptop. It instantly transfers all your quotations, clients, and catalog items with zero setup!
          </p>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={generatingUrl ? 'Generating sync link...' : syncUrl}
              className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded-lg text-[11px] font-mono text-slate-700 select-all outline-none"
            />
            <button
              onClick={handleCopyLink}
              disabled={generatingUrl || !syncUrl}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center space-x-1.5 shrink-0 transition-colors cursor-pointer disabled:opacity-50"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-white" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Method 2: Import on this Laptop (File or Paste Code) */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
          <div className="flex items-center space-x-2">
            <Upload className="w-4 h-4 text-slate-700" />
            <span className="font-bold text-slate-900">Method 2: Import Data to this Laptop</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* File Backup / Restore */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
              <span className="font-semibold text-slate-700 block text-[11px]">Via Backup File (.json)</span>
              <div className="flex flex-col space-y-1.5">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="w-full py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Backup File</span>
                </button>
                <label className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-900 text-white rounded text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer text-center">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Backup File</span>
                  <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
                </label>
              </div>
            </div>

            {/* Paste Transfer Link or Code */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
              <span className="font-semibold text-slate-700 block text-[11px]">Paste Sync Link / Code</span>
              <div className="space-y-1.5">
                <input
                  type="text"
                  placeholder="Paste link or code here..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-[11px] font-mono"
                />
                <button
                  type="button"
                  onClick={handleImportManualCode}
                  disabled={importingManual || !manualCode.trim()}
                  className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {importingManual ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Apply Imported Data</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Note on Cloud Sync */}
        <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start space-x-2.5">
          <Database className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">Automatic Real-Time Cloud Sync:</span> To have all laptops sync automatically without manually copying links, you can activate the Firestore Database in your Firebase Console under project <span className="font-mono font-bold">quotation-maker-1ac73</span>. Until then, the One-Click Transfer Link above works anytime!
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

export default React.memo(MultiDeviceSyncModal);
