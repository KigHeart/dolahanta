/**
 * DolaHanta — Risk Controls & Safety Configuration Drawer
 * Section 10 implementation
 */

import React, { useState } from 'react';
import { RiskSettings } from '../types/trading';
import { X, ShieldAlert, Check, RefreshCw } from 'lucide-react';

interface RiskSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RiskSettings;
  onSave: (newSettings: RiskSettings) => void;
  customAppId: string;
  onSaveAppId: (appId: string) => void;
}

export const RiskSettingsModal: React.FC<RiskSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  customAppId,
  onSaveAppId
}) => {
  const [formData, setFormData] = useState<RiskSettings>({ ...settings });
  const [appId, setAppId] = useState<string>(customAppId);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onSaveAppId(appId);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-900/60">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <h3 className="text-sm font-bold text-white">Quantitative Risk Controls &amp; Safety Parameters</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-mono">
          {/* Max Stake */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-neutral-300">Max Stake Per Contract (USD):</span>
              <span className="text-white font-bold tabular-nums">${formData.maxStakePerTrade}</span>
            </div>
            <input
              type="number"
              min="1"
              max="500"
              value={formData.maxStakePerTrade}
              onChange={(e) => setFormData({ ...formData, maxStakePerTrade: Number(e.target.value) })}
              className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded text-white outline-none focus:border-rose-500"
            />
          </div>

          {/* Min EV Threshold */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-neutral-300">Minimum Expected Return Threshold:</span>
              <span className="text-emerald-400 font-bold tabular-nums">+{(formData.minEVThreshold * 100).toFixed(1)}%</span>
            </div>
            <select
              value={formData.minEVThreshold}
              onChange={(e) => setFormData({ ...formData, minEVThreshold: Number(e.target.value) })}
              className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded text-white outline-none focus:border-rose-500"
            >
              <option value={0.0}>0.0% (Accept any positive edge)</option>
              <option value={0.03}>+3.0% (Moderate safety margin)</option>
              <option value={0.05}>+5.0% (Recommended quantitative baseline)</option>
              <option value={0.10}>+10.0% (Strict high-edge requirement)</option>
            </select>
          </div>

          {/* Max Model Uncertainty */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-neutral-300">Max Permissible Estimation Uncertainty (SE):</span>
              <span className="text-amber-400 font-bold tabular-nums">&plusmn;{(formData.maxPermissibleUncertainty * 100).toFixed(1)}%</span>
            </div>
            <select
              value={formData.maxPermissibleUncertainty}
              onChange={(e) => setFormData({ ...formData, maxPermissibleUncertainty: Number(e.target.value) })}
              className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded text-white outline-none focus:border-rose-500"
            >
              <option value={0.05}>&plusmn;5.0% (Strict tight margin)</option>
              <option value={0.08}>&plusmn;8.0% (Standard default)</option>
              <option value={0.12}>&plusmn;12.0% (Permissive / Volatile assets)</option>
            </select>
          </div>

          {/* Max Permitted Data Age */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-neutral-300">Max Data Age Before Feed Flagged Stale:</span>
              <span className="text-white font-bold tabular-nums">{formData.maxDataAgeSec}s</span>
            </div>
            <select
              value={formData.maxDataAgeSec}
              onChange={(e) => setFormData({ ...formData, maxDataAgeSec: Number(e.target.value) })}
              className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded text-white outline-none focus:border-rose-500"
            >
              <option value={10}>10 Seconds (Ultra-fresh)</option>
              <option value={15}>15 Seconds (Default)</option>
              <option value={30}>30 Seconds (Tolerant)</option>
            </select>
          </div>

          {/* Regime Alignment Enforcement */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enforceRegimeAlignment}
                onChange={(e) => setFormData({ ...formData, enforceRegimeAlignment: e.target.checked })}
                className="w-4 h-4 accent-rose-500 rounded bg-neutral-900 border-neutral-800"
              />
              <span className="text-neutral-200">Enforce Regime Alignment Filter</span>
            </label>
            <p className="text-[11px] text-neutral-400 mt-1 pl-6">
              Blocks counter-trend Touch contracts (e.g. Upper Touch during a Bearish Trend) and tight No Touch during Volatility Expansions.
            </p>
          </div>

          {/* Deriv Custom App ID */}
          <div className="pt-3 border-t border-neutral-800/80 space-y-1.5">
            <label className="text-neutral-300 block">Deriv WebSocket App ID</label>
            <input
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="1089"
              className="w-full bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded text-white outline-none focus:border-rose-500"
            />
            <p className="text-[10px] text-neutral-400">
              Default is Deriv public market data App ID 1089. Enter your registered Deriv developer app ID if required.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-md transition-colors"
            >
              {savedNotice ? <Check className="w-4 h-4" /> : null}
              <span>{savedNotice ? 'Saved!' : 'Save & Enforce'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
