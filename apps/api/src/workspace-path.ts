import { basename, dirname, resolve } from 'node:path';

const currentDirectory = process.cwd();
const workspaceRoot =
  basename(currentDirectory) === 'api' && basename(dirname(currentDirectory)) === 'apps'
    ? resolve(currentDirectory, '../..')
    : currentDirectory;

export function workspacePath(...segments: string[]): string {
  return resolve(workspaceRoot, ...segments);
}
