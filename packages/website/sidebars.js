module.exports = {
  docs: {
    Introduction: [
      'introduction/getting-started',
      'introduction/installation',
      'introduction/motivation',
      'introduction/features',
    ],
    'Fetching Data': [
      'fetching-data/queries',
      'fetching-data/local-state',
      'fetching-data/fragments',
    ],
    FAQ: ['faq'],
    React: [
      'react/basic-usage',
      'react/polling',
      'react/variables',
      'react/custom-queries',
      'react/interfaces-unions',
    ],
    'API Reference': [
      'api',
      {
        type: 'category',
        label: '@gqless/logger',
        items: ['api/logger/Logger'],
      },
    ],
    CLI: ['cli/installation', 'cli/codegen'],
  },
};
