import React, { useState } from 'react';
import { 
  Building2, 
  Cloud, 
  Database, 
  X, 
  Upload, 
  CheckCircle, 
  RefreshCw, 
  Download,
  RotateCcw,
  HardDrive,
  Copy,
  Check,
  Laptop,
  ExternalLink
} from 'lucide-react';
import { 
  isFirebaseActive, 
  getStoredFirebaseConfig, 
  resetFirebaseCooldown,
  testFirestoreConnection
} from '../services/firebase';
import { 
  syncAllToFirebase, 
  exportDatabaseBackup, 
  importDatabaseBackup, 
  resetToFactoryDefaultData 
} from '../services/db';
import { buildFullSyncUrl } from '../utils/shareLink';

function SettingsModal({
  isOpen,
  onClose,
  companySettings,
  onSaveCompanySettings,
  onReloadData
}) {
  const [activeTab, setActiveTab] = useState('company'); // 'company' | 'bank' | 'firebase' | 'backup'
  const [formData, setFormData] = useState(companySettings || {});
  const [firebaseConfig, setFirebaseConfig] = useState(getStoredFirebaseConfig());
  const [firebaseStatus, setFirebaseStatus] = useState({
    active: isFirebaseActive(),
    testing: false,
    message: ''
  });
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [backupMessage, setBackupMessage] = useState('');
  const [syncLinkCopied, setSyncLinkCopied] = useState(false);
  const [syncUrl, setSyncUrl] = useState('');

  const handleCopySyncLink = async () => {
    try {
      const backup = exportDatabaseBackup();
      const url = await buildFullSyncUrl(backup);
      setSyncUrl(url);
      navigator.clipboard.writeText(url);
      setSyncLinkCopied(true);
      setTimeout(() => setSyncLinkCopied(false), 2500);
    } catch (err) {
      alert('Error generating sync link: ' + err.message);
    }
  };

  // Keep modal form state in sync when companySettings changes
  const [prevSettings, setPrevSettings] = useState(companySettings);
  if (companySettings !== prevSettings) {
    setPrevSettings(companySettings);
    setFormData(companySettings || {});
  }

  if (!isOpen) return null;

  // Handle Logo Upload
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024 * 2) {
      alert('Logo file size should be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setFormData(prev => ({
        ...prev,
        logoUrl: uploadEvent.target.result
      }));
    };
    reader.readAsDataURL(file);
  };

  // Save Company Profile
  const handleSaveCompany = (e) => {
    e.preventDefault();
    onSaveCompanySettings(formData);
    alert('Company settings saved successfully!');
  };

  // Test & Save Firebase Config
  const handleTestAndSaveFirebase = async (e) => {
    e.preventDefault();
    setFirebaseStatus({ active: false, testing: true, message: 'Connecting and verifying Firestore database...' });

    try {
      resetFirebaseCooldown();
      localStorage.setItem('kits_firebase_config', JSON.stringify(firebaseConfig));
      const result = await testFirestoreConnection(firebaseConfig);

      if (result.ok) {
        setFirebaseStatus({
          active: true,
          testing: false,
          notFound: false,
          message: 'Connected successfully to Firebase Firestore! Real-time cloud sync is active across all devices.'
        });
      } else {
        setFirebaseStatus({
          active: false,
          testing: false,
          notFound: Boolean(result.notFound),
          message: result.error || 'Failed to connect. Check configuration values.'
        });
      }
    } catch (err) {
      setFirebaseStatus({
        active: false,
        testing: false,
        message: err.message
      });
    }
  };

  // Sync Local Storage to Firebase Firestore
  const handleSyncData = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await syncAllToFirebase();
      setSyncMessage(`Successfully synced ${res.quotationsSynced} quotes, ${res.clientsSynced} clients & ${res.productsSynced} products to Firebase!`);
    } catch (err) {
      setSyncMessage('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Export JSON Backup
  const handleExportBackup = () => {
    try {
      const backup = exportDatabaseBackup();
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `KITS_Quotation_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupMessage('Backup file downloaded successfully!');
    } catch (err) {
      setBackupMessage('Export error: ' + err.message);
    }
  };

  // Import JSON Backup
  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        await importDatabaseBackup(parsed);
        setBackupMessage('Backup imported successfully! Reloading data...');
        if (onReloadData) {
          await onReloadData();
        }
      } catch (err) {
        setBackupMessage('Failed to import backup: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Reset to sample data
  const handleResetData = async () => {
    if (window.confirm('Are you sure you want to restore the factory default demo data? This will reset quotations, catalog items, and clients.')) {
      resetToFactoryDefaultData();
      setBackupMessage('Database reset to factory default sample data.');
      if (onReloadData) {
        await onReloadData();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-100 text-slate-800 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Application Settings</h3>
              <p className="text-xs text-slate-500">Configure company letterhead, bank details, cloud sync & backups</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 pt-2 bg-slate-50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('company')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'company'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Company Profile & Letterhead
          </button>

          <button
            onClick={() => setActiveTab('bank')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              activeTab === 'bank'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Bank & RTGS Details
          </button>

          <button
            onClick={() => setActiveTab('firebase')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              activeTab === 'firebase'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Firebase Cloud</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex items-center space-x-1.5 ${
              activeTab === 'backup'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Backup & Data Safety</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          
          {/* TAB 1: Company Profile */}
          {activeTab === 'company' && (
            <form onSubmit={handleSaveCompany} className="space-y-4">
              
              {/* Logo Preview & Uploader */}
              <div className="flex items-center space-x-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-white overflow-hidden shrink-0">
                  {formData.logoUrl ? (
                    <img src={formData.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Building2 className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div className="space-y-1">
                  <span className="font-semibold text-slate-700 block">Company Logo</span>
                  <p className="text-[11px] text-slate-400">Upload a PNG or JPEG logo for your quotation letterhead (Max 2MB)</p>
                  <label className="inline-flex items-center space-x-1 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Logo Image</span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, logoUrl: '' }))}
                      className="text-[11px] text-rose-500 hover:underline ml-2"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="KITS ROBOTICS & AUTOMATION PVT.LTD."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tagline / Subtitle</label>
                  <input
                    type="text"
                    value={formData.tagline || ''}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Official Address *</label>
                <textarea
                  rows="2"
                  required
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Website</label>
                  <input
                    type="text"
                    value={formData.website || ''}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">GSTIN *</label>
                  <input
                    type="text"
                    required
                    value={formData.gstin || ''}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PAN</label>
                  <input
                    type="text"
                    value={formData.pan || ''}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CIN</label>
                  <input
                    type="text"
                    value={formData.cin || ''}
                    onChange={(e) => setFormData({ ...formData, cin: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Home State</label>
                  <input
                    type="text"
                    value={formData.state || 'Maharashtra'}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Quotation Ref Prefix</label>
                  <input
                    type="text"
                    value={formData.quotationPrefix || 'KITS/QUO'}
                    onChange={(e) => setFormData({ ...formData, quotationPrefix: e.target.value })}
                    placeholder="e.g. KITS/QUO"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Signatory Name</label>
                  <input
                    type="text"
                    value={formData.signatoryName || ''}
                    onChange={(e) => setFormData({ ...formData, signatoryName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Signatory Designation</label>
                <input
                  type="text"
                  value={formData.signatoryDesignation || ''}
                  onChange={(e) => setFormData({ ...formData, signatoryDesignation: e.target.value })}
                  placeholder="Director / Technical Head"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white"
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-md shadow-blue-500/20"
                >
                  Save Company Settings
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Bank Details */}
          {activeTab === 'bank' && (
            <form onSubmit={handleSaveCompany} className="space-y-4">
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
                These banking coordinates will appear at the bottom of every generated quotation and PDF so clients can directly initiate RTGS / NEFT / IMPS advance payments.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Beneficiary Account Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.bankAccountName || formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bank Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.bankName || ''}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="e.g. CITY UNION BANK"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Number *</label>
                  <input
                    type="text"
                    required
                    value={formData.accountNumber || ''}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    placeholder="e.g. 510909010369706"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">IFSC Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.ifscCode || ''}
                    onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. CIUB0000800"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Branch Name</label>
                <input
                  type="text"
                  value={formData.branch || ''}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  placeholder="e.g. Akola Branch"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white"
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-md shadow-blue-500/20"
                >
                  Save Banking Details
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Firebase Config */}
          {activeTab === 'firebase' && (
            <div className="space-y-5">
              
              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                firebaseStatus.active 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    firebaseStatus.active ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                  }`}>
                    {firebaseStatus.active ? <CheckCircle className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
                  </div>
                  <div>
                    <span className="font-bold text-sm block">
                      {firebaseStatus.active ? 'Firebase Cloud Connected' : 'Running on Local Database (Offline Ready)'}
                    </span>
                    <p className="text-[11px] opacity-80">
                      {firebaseStatus.active 
                        ? 'All quotations, clients, and items are backed up in real-time to your Google Firebase Firestore.' 
                        : 'Your data is securely stored in your browser LocalStorage. Enter your Firebase project keys below to enable cloud sync.'}
                    </p>
                  </div>
                </div>

                {firebaseStatus.active && (
                  <button
                    onClick={handleSyncData}
                    disabled={syncing}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shrink-0 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>{syncing ? 'Syncing...' : 'Sync Local Data to Firebase'}</span>
                  </button>
                )}
              </div>

              {syncMessage && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs font-medium">
                  {syncMessage}
                </div>
              )}

              {/* Firebase Inputs */}
              <form onSubmit={handleTestAndSaveFirebase} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">API Key *</label>
                    <input
                      type="text"
                      required
                      placeholder="AIzaSy..."
                      value={firebaseConfig.apiKey || ''}
                      onChange={(e) => setFirebaseConfig({ ...firebaseConfig, apiKey: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Project ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="quotation-maker-1ac73"
                      value={firebaseConfig.projectId || ''}
                      onChange={(e) => setFirebaseConfig({ ...firebaseConfig, projectId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Auth Domain</label>
                    <input
                      type="text"
                      placeholder="quotation-maker-1ac73.firebaseapp.com"
                      value={firebaseConfig.authDomain || ''}
                      onChange={(e) => setFirebaseConfig({ ...firebaseConfig, authDomain: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">App ID</label>
                    <input
                      type="text"
                      placeholder="1:131348630748:web:189a8c0c03cb0355473819"
                      value={firebaseConfig.appId || ''}
                      onChange={(e) => setFirebaseConfig({ ...firebaseConfig, appId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Storage Bucket</label>
                    <input
                      type="text"
                      placeholder="quotation-maker-1ac73.firebasestorage.app"
                      value={firebaseConfig.storageBucket || ''}
                      onChange={(e) => setFirebaseConfig({ ...firebaseConfig, storageBucket: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Messaging Sender ID</label>
                    <input
                      type="text"
                      placeholder="131348630748"
                      value={firebaseConfig.messagingSenderId || ''}
                      onChange={(e) => setFirebaseConfig({ ...firebaseConfig, messagingSenderId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white"
                    />
                  </div>
                </div>

                {firebaseStatus.message && (
                  <div className={`p-3.5 rounded-xl text-xs font-medium space-y-2 ${
                    firebaseStatus.active ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}>
                    <div>{firebaseStatus.message}</div>
                    {firebaseStatus.notFound && (
                      <a
                        href={`https://console.firebase.google.com/project/${firebaseConfig.projectId || 'quotation-maker-1ac73'}/firestore`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
                      >
                        <span>Open Firebase Console to Create Database (1-Click)</span>
                        <ExternalLink className="w-3.5 h-3.5 ml-1" />
                      </a>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <div className="text-[11px] text-slate-400">
                    💡 Get these from Firebase Console &gt; Project Settings &gt; General.
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-md shadow-blue-500/20"
                  >
                    Test & Save Firebase
                  </button>
                </div>
              </form>

            </div>
          )}

          {/* TAB 4: Backup & Data Safety */}
          {activeTab === 'backup' && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-bold text-slate-900 text-sm block">Database Export & Multi-Laptop Sync</span>
                <p className="text-slate-500 text-xs">
                  Easily transfer your workspace (all quotations, clients, items, and company settings) to another laptop via link or file.
                </p>
              </div>

              {/* Direct Laptop-to-Laptop Transfer Card */}
              <div className="p-4 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200/80 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Laptop className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-slate-900 text-xs">Transfer All Data to Another Laptop (One-Click Link)</span>
                  </div>
                  <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
                    Fastest
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Generate a one-click transfer link containing all your quotations, clients, and items. Open it on your other laptop to sync instantly!
                </p>
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopySyncLink}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    {syncLinkCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Link Copied! Open on other laptop</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-white" />
                        <span>Copy Multi-Laptop Transfer Link</span>
                      </>
                    )}
                  </button>
                  {syncUrl && (
                    <span className="text-[11px] text-emerald-700 font-medium">Link ready to paste</span>
                  )}
                </div>
              </div>

              {backupMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-medium">
                  {backupMessage}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Export Card */}
                <div className="p-5 border border-slate-200 rounded-xl space-y-3 bg-white">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
                    <Download className="w-4 h-4 text-blue-600" />
                    <span>Download JSON Backup</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Saves all data to your downloads folder as a timestamped JSON file.
                  </p>
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm text-xs transition-colors"
                  >
                    Export Full Backup
                  </button>
                </div>

                {/* Import Card */}
                <div className="p-5 border border-slate-200 rounded-xl space-y-3 bg-white">
                  <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span>Restore from Backup</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Upload a previously exported JSON backup file to restore your database.
                  </p>
                  <label className="block w-full text-center py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm text-xs transition-colors cursor-pointer">
                    <span>Select Backup File</span>
                    <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
                  </label>
                </div>

              </div>

              {/* Reset to Demo Data */}
              <div className="p-4 border border-rose-200 bg-rose-50/50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-rose-900 text-xs block">Reset to Sample Demo Data</span>
                  <p className="text-rose-700 text-[11px]">
                    Restores the pre-loaded robotics & automation sample quotations, clients, and catalog items.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetData}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs shrink-0 transition-colors flex items-center space-x-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Demo Data</span>
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}

export default React.memo(SettingsModal);
