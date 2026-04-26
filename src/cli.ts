#!/usr/bin/env node

function main(): number {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    process.stderr.write('usage: instagram-dl <url> [--out <dir>] [--json]\n');
    return 1;
  }
  process.stderr.write('cli not implemented yet\n');
  return 2;
}

process.exit(main());
