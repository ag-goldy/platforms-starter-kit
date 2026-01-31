module.exports = {
  extends: ['next/core-web-vitals', 'next/typescript'],
  ignorePatterns: ['next-env.d.ts'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn', // Allow any types with warning
    '@typescript-eslint/no-unused-vars': 'warn', // Allow unused vars with warning
  },
};
