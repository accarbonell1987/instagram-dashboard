import type { ChatCompletionTool } from 'openai/resources/chat/completions.js';

export const TOOL_DEFINITIONS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'getDashboardContext',
      description:
        'Returns account-level summary: followers, media count, avg engagement rate, top format. Always call this first.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTopPosts',
      description: 'Returns top N posts ranked by specified metric.',
      parameters: {
        type: 'object',
        properties: {
          by: { type: 'string', enum: ['saves_shares', 'reach', 'engagement_rate'] },
          n: { type: 'number', minimum: 1, maximum: 20, default: 5 },
        },
        required: ['by'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getFormatBreakdown',
      description:
        'Performance stats grouped by format (REEL, IMAGE, CAROUSEL_ALBUM). Shows avg saves, shares, reach, engagement rate.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPostingHeatmap',
      description:
        'Saves+shares heatmap by day of week and hour. Use to recommend optimal posting times.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSuggestionOutcomes',
      description:
        'Past suggestions with measured outcomes (exceeded/met/below baseline). Use to close the feedback loop.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];
