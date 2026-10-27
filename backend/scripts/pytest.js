/**
 * Python pipeline testlerini .env'deki PYTHON_PATH (model bağımlılıklarının kurulu olduğu venv) ile çalıştırır.
 *   npm run test:python
 */
require('dotenv').config({ quiet: true });
const path = require('path');
const { spawnSync } = require('child_process');

const python = process.env.PYTHON_PATH || 'python';
const testsDir = path.join(__dirname, '..', 'src', 'tests', 'python');

const result = spawnSync(python, ['-m', 'pytest', '-q', '-p', 'no:cacheprovider', testsDir, ...process.argv.slice(2)], {
    stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
