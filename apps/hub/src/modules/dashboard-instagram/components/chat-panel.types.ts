import type { ChatMessage, ContentSuggestion, SuggestionBatch, AgentConfig } from '../types/instagram.types'

export interface UseGrowthAgentResult {
  messages: ChatMessage[]
  suggestions: ContentSuggestion[]
  suggestionBatches: SuggestionBatch[]
  isLoading: boolean
  sessionId: string
  error: string | null
  sendMessage: (text: string) => Promise<void>
  markUsed: (id: string, linkedMediaId: string) => Promise<void>
  dismiss: (id: string) => Promise<void>
  deleteMessage: (id: string) => Promise<void>
  clearConversation: () => Promise<void>
  selectedIds: Set<string>
  toggleSelection: (id: string) => void
  deleteSelected: () => Promise<void>
  clearSelection: () => void
  clearSuggestions: () => Promise<void>
  refreshSuggestions: () => Promise<void>
  // Agent config
  agentConfig: AgentConfig | null
  hasFalApiKey: boolean
  isSettingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void
  saveAgentConfig: (config: AgentConfig, falApiKey?: string) => Promise<void>
}
