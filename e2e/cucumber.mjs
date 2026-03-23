export default {
  paths: ['features/**/*.feature'],
  import: ['e2e/step-definitions/**/*.ts', 'e2e/support/**/*.ts'],
  format: ['progress-bar', 'html:reports/e2e.html'],
  publishQuiet: true,
  tags: 'not @manual',
}
