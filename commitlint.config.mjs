export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'perf',
        'refactor',
        'test',
        'docs',
        'chore',
        'style',
        'build',
        'ci',
        'revert',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      ['core', 'protocol', 'server', 'web', 'desktop', 'repo', 'ci', 'main', 'deps', 'deps-dev'],
    ],
    'header-max-length': [2, 'always', 100],
  },
};
