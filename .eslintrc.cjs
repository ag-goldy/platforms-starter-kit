module.exports = {
  extends: ['next/core-web-vitals', 'next/typescript'],
  ignorePatterns: ['next-env.d.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-restricted-syntax': [
      'warn',
      {
        selector: "CallExpression[callee.property.name='findMany'] > ObjectExpression > Property[key.name='where']:not(:has(Identifier[name='orgId']))",
        message: 'All queries should include an orgId filter for tenant isolation.',
      },
      {
        selector: "CallExpression[callee.property.name='findFirst'] > ObjectExpression > Property[key.name='where']:not(:has(Identifier[name='orgId']))",
        message: 'All queries should include an orgId filter for tenant isolation.',
      }
    ]
  },
};
