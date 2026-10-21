/**
 * DolaHanta — In-Browser Automated Test Suite Runner
 * Deliverable F implementation
 */

import React, { useState } from 'react';
import { runAllAutomatedTests } from '../engine/testSuite';
import { TestSuiteResult } from '../types/trading';
import { CheckCircle2, XCircle, Play, ShieldCheck, Cpu } from 'lucide-react';

export const TestSuiteRunner: React.FC = () => {
  const [results, setResults] = useState<TestSuiteResult[]>(() => runAllAutomatedTests());
  const [isRunning, setIsRunning] = useState(false);

  const handleRunTests = () => {
    setIsRunning(true);
    setTimeout(() => {
      const res = runAllAutomatedTests();
      setResults(res);
      setIsRunning(false);
    }, 40);
  };

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const allPassed = passedCount === totalCount;
  const totalTimeMs = results.reduce((a, b) => a + b.executionTimeMs, 0);

  return (
    <div className="space-y-6">
      {/* Test Suite Header */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white font-sans flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Automated Mathematical &amp; Risk Invariants Test Suite</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Rigorous unit and boundary assertions executing live in your browser runtime. Verifies CDF limits, first-passage monotonicity, expected value identities, and stale-data safety gates.
            </p>
          </div>

          <button
            onClick={handleRunTests}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md transition-colors whitespace-nowrap shrink-0 shadow"
          >
            <Play className="w-3.5 h-3.5 fill-white text-white" />
            <span>{isRunning ? 'Running Assertions...' : 'Re-Run All 10 Tests'}</span>
          </button>
        </div>

        {/* Status Strip */}
        <div className="flex items-center gap-4 pt-3 border-t border-neutral-800/80 font-mono text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-400">Status:</span>
            {allPassed ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>ALL {totalCount} ASSERTIONS PASSED</span>
              </span>
            ) : (
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>{totalCount - passedCount} FAILED</span>
              </span>
            )}
          </div>
          <span className="text-neutral-600">·</span>
          <div className="text-neutral-400">
            Runtime: <span className="text-white font-bold tabular-nums">{totalTimeMs.toFixed(2)}ms</span>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950 text-neutral-400 text-[11px]">
                <th className="py-2.5 px-3">Test ID</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Assertion Target</th>
                <th className="py-2.5 px-3">Diagnostic Vector</th>
                <th className="py-2.5 px-3">Latency</th>
                <th className="py-2.5 px-3 text-right">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50 font-sans">
              {results.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-800/30 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-neutral-300 font-semibold whitespace-nowrap">
                    {r.id}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                    <span className="px-1.5 py-0.5 rounded bg-neutral-950 text-neutral-400 border border-neutral-800">
                      {r.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-white">{r.name}</div>
                    <div className="text-[11px] text-neutral-400">{r.description}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-300">
                    {r.details}
                    {r.error && <div className="text-rose-400 mt-0.5">{r.error}</div>}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-neutral-400 whitespace-nowrap tabular-nums">
                    {r.executionTimeMs}ms
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                    {r.passed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>PASS</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-400 font-bold text-[11px]">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>FAIL</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
