'use client';

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';

import { AgentSettingsPanel } from './components/agent-settings';
import { initHubToken, reportHeightToHub } from './lib/hub-token';
import { getAgentSettings, saveAgentSettings } from './services/instagram.service';
import type {
  AgentConfig,
  AgentSecrets,
  AgentSettingsSectionKey,
} from './types/instagram.types';

/**
 * The agent's tenant-wide settings, administered from the hub's settings area.
 *
 * Same panel the product shows, on its other surface: this one carries the
 * model, the API key and the character limits — whose credentials the agent
 * runs on and what it is allowed to spend. Those are organisation decisions,
 * which is why they belong beside the tenant's other settings rather than
 * behind a gear icon in the middle of somebody's work.
 *
 * Mounted in the hub's iframe like its sibling page, so it completes the token
 * handshake and reports its own height — nothing outside the frame can measure
 * it.
 */
export function AgentSettingsAdminPage(): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);

  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [hasFalApiKey, setHasFalApiKey] = useState(false);
  const [hasLlmApiKey, setHasLlmApiKey] = useState(false);
  const [editableSections, setEditableSections] = useState<AgentSettingsSectionKey[]>([]);
  const [settingsFailed, setSettingsFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => initHubToken(), []);

  useEffect(() => {
    const element = rootRef.current;
    if (element === null) return;
    return reportHeightToHub(element);
  }, []);

  const load = useCallback(async (): Promise<void> => {
    try {
      const response = await getAgentSettings();
      setConfig(response.agentConfig);
      setHasFalApiKey(response.hasFalApiKey);
      setHasLlmApiKey(response.hasLlmApiKey);
      setEditableSections(response.editableSections ?? []);
      setSettingsFailed(false);
    } catch {
      // Surfaced rather than swallowed: the panel draws only the sections the
      // response names, so a failed load is otherwise indistinguishable from
      // "you may not change anything".
      setSettingsFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(
    async (next: AgentConfig, secrets?: AgentSecrets): Promise<void> => {
      await saveAgentSettings(next, secrets);
      await load();
    },
    [load],
  );

  return (
    <div ref={rootRef} className="space-y-4 p-6">
      <div>
        <h1 className="text-lg font-semibold">Agente IA</h1>
        <p className="text-muted-foreground text-sm">
          Modelo, credenciales y límites del agente. Aplican a todo el tenant.
        </p>
      </div>

      {isLoading ? null : (
        <AgentSettingsPanel
          surface="settings"
          editableSections={editableSections}
          settingsFailed={settingsFailed}
          initialConfig={config}
          hasFalApiKey={hasFalApiKey}
          hasLlmApiKey={hasLlmApiKey}
          onSave={handleSave}
          // Nowhere to go back to: this is a page, not an overlay.
          onDone={() => undefined}
        />
      )}
    </div>
  );
}
