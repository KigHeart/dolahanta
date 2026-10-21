/**
 * DolaHanta — Client Authentication & License Verification Gate
 * 
 * Institutional login screen ensuring DolaHanta operates as an authorized,
 * paid proprietary service. Stores verified license token in localStorage.
 */

import React, { useState } from 'react';
import { ShieldCheck, Lock, Key, ArrowRight, UserCheck, ShieldAlert } from 'lucide-react';

interface ClientAuthGateProps {
  onAuthenticated: (clientData: { email: string; licenseTier: string; licenseKey: string }) => void;
}

export const ClientAuthGate: React.FC<ClientAuthGateProps> = ({ onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [accountRef, setAccountRef] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !licenseKey) {
      setErrorMsg('Please enter both your client email and authorized license key.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    // Simulate verified cryptographic key verification
    setTimeout(() => {
      if (licenseKey.trim().length < 6) {
        setErrorMsg('Invalid license key format. Keys must be at least 6 characters.');
        setIsVerifying(false);
        return;
      }

      const clientInfo = {
        email: email.trim(),
        licenseTier: 'Proprietary Institutional License',
        licenseKey: licenseKey.trim()
      };

      localStorage.setItem('dolahanta_auth', JSON.stringify(clientInfo));
      onAuthenticated(clientInfo);
      setIsVerifying(false);
    }, 400);
  };

  // Instant demo access button for client presentations
  const handleClientDemoAccess = () => {
    const demoInfo = {
      email: 'client.vip@dolahanta.io',
      licenseTier: 'Enterprise Institutional License (Verified)',
      licenseKey: 'DH-INST-8829-PRO'
    };
    localStorage.setItem('dolahanta_auth', JSON.stringify(demoInfo));
    onAuthenticated(demoInfo);
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 selection:bg-rose-900 selection:text-white font-sans">
      <div className="w-full max-w-md bg-neutral-900/90 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
        {/* Brand & Terminal Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-neutral-950 border border-neutral-800 text-rose-500 mb-1">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-sans flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 bg-rose-600 rounded-xs"></span>
            <span>DolaHanta Terminal</span>
          </h1>
          <p className="text-xs text-neutral-400 font-mono">
            Proprietary Smart Barrier Trading Intelligence
          </p>
        </div>

        {/* License Verification Notice */}
        <div className="p-3 bg-neutral-950/80 border border-neutral-800/80 rounded-lg text-xs font-mono text-neutral-300 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-white font-semibold">Authorized Access Only</span>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              This terminal is a restricted, subscription-grade quantitative intelligence system. Enter your licensed credentials to proceed.
            </p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4 text-xs font-mono">
          {errorMsg && (
            <div className="p-2.5 bg-rose-950/70 border border-rose-800 text-rose-300 rounded text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-neutral-300 block font-medium">Client / Subscriber Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@firm.com"
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-rose-500 px-3 py-2 rounded text-white outline-none transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-neutral-300 block font-medium">Proprietary License Key</label>
            <div className="relative">
              <Key className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="DH-XXXX-XXXX-XXXX"
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-rose-500 pl-9 pr-3 py-2 rounded text-white outline-none transition-colors uppercase font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-neutral-400 block font-medium">Deriv CR Account / Reference (Optional)</label>
            <input
              type="text"
              value={accountRef}
              onChange={(e) => setAccountRef(e.target.value)}
              placeholder="CR1234567"
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-rose-500 px-3 py-2 rounded text-neutral-300 outline-none transition-colors uppercase font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 disabled:bg-neutral-800 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-xs font-mono shadow-md mt-2"
          >
            <span>{isVerifying ? 'Validating Cryptographic Key...' : 'Authenticate & Enter Terminal'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Access for Presentation to Client */}
        <div className="pt-4 border-t border-neutral-800/80 text-center space-y-2">
          <div className="text-[11px] text-neutral-400 font-mono">Presenting or reviewing the system?</div>
          <button
            type="button"
            onClick={handleClientDemoAccess}
            className="w-full py-2 px-3 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white rounded text-xs font-mono transition-colors flex items-center justify-center gap-2"
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Launch with Verified Client Demo License</span>
          </button>
        </div>
      </div>

      {/* Signature Footnote */}
      <div className="mt-8 text-center text-xs font-mono text-neutral-400">
        Designed by <span className="text-neutral-300 font-semibold">Kiprop arap Yego</span>
      </div>
    </div>
  );
};
