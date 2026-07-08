'use client';

import { useState, useEffect, useCallback, type ReactElement } from 'react';

import { SCENARIOS, getActiveScenario, setActiveScenario } from './scenarios/index';
import type { Scenario } from './scenarios/index';
import { applyScenario } from './seed';

/**
 * Dev-only floating widget for switching MSW scenarios.
 * Rendered only when NEXT_PUBLIC_API_MOCKING === 'enabled' and in a browser.
 */
export function MswDevWidget(): ReactElement | null {
  const [isOpen, setIsOpen] = useState(false);
  const [activeScenario, setActive] = useState<Scenario>('happy');
  const [confirmed, setConfirmed] = useState<string | null>(null);

  useEffect(() => {
    if (
      process.env['NEXT_PUBLIC_API_MOCKING'] !== 'enabled' ||
      typeof window === 'undefined'
    ) {
      return;
    }
    setActive(getActiveScenario());
  }, []);

  const handleScenarioChange = useCallback((scenario: Scenario) => {
    setActiveScenario(scenario);
    applyScenario(scenario);
    setActive(scenario);
    setConfirmed(`Escenario activado: ${scenario}`);
    setIsOpen(false);
    setTimeout(() => { setConfirmed(null); }, 3000);
  }, []);

  if (
    process.env['NEXT_PUBLIC_API_MOCKING'] !== 'enabled' ||
    typeof window === 'undefined'
  ) {
    return null;
  }

  const activeLabel = SCENARIOS.find((s) => s.id === activeScenario)?.label ?? activeScenario;

  return (
    <div
      style={{ position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 9999 }}
      data-testid="msw-dev-widget"
    >
      {confirmed !== null && (
        <div
          className="mb-2 rounded bg-green-600 px-3 py-1.5 text-xs text-white shadow"
          data-testid="msw-confirmation"
        >
          {confirmed}
        </div>
      )}

      {isOpen && (
        <div className="mb-2 w-64 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <div className="border-b border-neutral-200 px-3 py-2 dark:border-neutral-700">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              MSW Escenarios
            </span>
          </div>
          <ul className="py-1" data-testid="msw-scenario-list">
            {SCENARIOS.map((scenario) => (
              <li key={scenario.id}>
                <button
                  type="button"
                  onClick={() => { handleScenarioChange(scenario.id); }}
                  className={[
                    'w-full px-3 py-2 text-left text-sm transition-colors',
                    activeScenario === scenario.id
                      ? 'bg-neutral-100 font-semibold dark:bg-neutral-800'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800',
                  ].join(' ')}
                  data-testid={`msw-scenario-option-${scenario.id}`}
                >
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">
                    {activeScenario === scenario.id && '✓ '}
                    {scenario.label}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {scenario.description}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => { setIsOpen((prev) => !prev); }}
        className="rounded-full bg-neutral-800 px-3 py-1.5 text-xs font-mono text-white shadow-md hover:bg-neutral-700 dark:bg-neutral-200 dark:text-neutral-900 dark:hover:bg-neutral-300"
        data-testid="msw-toggle-button"
      >
        MSW: {activeLabel}
      </button>
    </div>
  );
}
