import neostandard from 'neostandard'
import jsdoc from 'eslint-plugin-jsdoc'

export default [
  ...neostandard({
    env: ['node', 'vitest'],
    ignores: [...neostandard.resolveIgnoresFromGitignore()],
    noJsx: true,
    noStyle: true
  }),
  {
    files: ['**/*.{js,cjs,mjs}'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-types': 'error',
      'jsdoc/valid-types': 'error',
      'jsdoc/require-property': 'error',
      'jsdoc/require-property-name': 'error',
      'jsdoc/require-property-type': 'error'
    }
  },
  {
    files: ['src/domain/scoring-schema.js', 'src/domain/rubric.js'],
    rules: {
      'jsdoc/require-jsdoc': [
        'warn',
        {
          contexts: ['Program']
        }
      ]
    }
  }
]
