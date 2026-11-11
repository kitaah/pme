#!/usr/bin/env node
// Lance Jest avec --experimental-vm-modules (necessaire pour les paquets NestJS en ESM), depuis n'importe quel module.
// Avec les workspaces npm, Jest est installe a la racine du depot et non dans chaque module : on le cherche donc
// par resolution de module plutot que par un chemin ecrit en dur. Les arguments sont transmis tels quels.
const { spawnSync } = require('node:child_process');

const jest = require.resolve('jest/bin/jest', { paths: [process.cwd()] });
const result = spawnSync(process.execPath, ['--experimental-vm-modules', jest, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
