const { execSync } = require('child_process');
const path = require('path');

process.chdir(path.join(__dirname));

const args = process.argv.slice(2).join(' ');
const nextBin = path.join(__dirname, 'node_modules', '.bin', 'next');

require('child_process').execFileSync(nextBin, ['dev', '--port', '3001'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env, PATH: `/opt/homebrew/bin:/opt/homebrew/Cellar/node/25.4.0/bin:${process.env.PATH}` },
});
