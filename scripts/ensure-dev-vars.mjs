import { copyFileSync, existsSync } from 'node:fs';

if (!existsSync('.dev.vars')) {
  copyFileSync('.dev.vars.example', '.dev.vars');
  console.log('Created .dev.vars from .dev.vars.example');
}
