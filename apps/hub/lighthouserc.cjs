module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3001/login', 'http://localhost:3001/signup'],
      startServerCommand: 'pnpm --filter @corehub/hub start',
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
};
