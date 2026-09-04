import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { stripBlockRange, cleanExistingHooks } from '../src/hooks';

vi.mock('@actions/core', () => ({
  startGroup: vi.fn(),
  endGroup: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('stripBlockRange', () => {
  it('removes ifdef block including its endif', () => {
    const lines = [
      'static int foo(void)',
      '{',
      '#ifdef CONFIG_KSU',
      '\tksu_handle_foo();',
      '#endif',
      '\treturn 0;',
      '}',
    ];
    expect(stripBlockRange(lines, /^\s*#\s*ifdef\s+CONFIG_KSU\s*$/)).toEqual([
      'static int foo(void)',
      '{',
      '\treturn 0;',
      '}',
    ]);
  });

  it('does not match other CONFIG_KSU_* macros (exact macro match)', () => {
    const lines = ['#ifdef CONFIG_KSU_MANUAL_HOOK', '\thook();', '#endif', 'keep();'];
    expect(stripBlockRange(lines, /^\s*#\s*ifdef\s+CONFIG_KSU\s*$/)).toEqual(lines);
  });

  it('removes nested preprocessor conditionals within the block', () => {
    const lines = [
      'int foo(void)',
      '{',
      '#ifdef CONFIG_KSU',
      '#ifdef CONFIG_MODULES',
      '\tksu_a();',
      '#endif',
      '\tksu_b();',
      '#endif',
      '\treturn 0;',
      '}',
    ];
    expect(stripBlockRange(lines, /^\s*#\s*ifdef\s+CONFIG_KSU\s*$/)).toEqual([
      'int foo(void)',
      '{',
      '\treturn 0;',
      '}',
    ]);
  });

  it('handles #else/#elif without affecting the nesting depth', () => {
    const lines = [
      '#ifdef CONFIG_KSU',
      '#if defined(CONFIG_A) && defined(CONFIG_B)',
      '\ta();',
      '#elif defined(CONFIG_C)',
      '\tc();',
      '#else',
      '\td();',
      '#endif',
      '\tksu_b();',
      '#endif',
      'keep();',
    ];
    expect(stripBlockRange(lines, /^\s*#\s*ifdef\s+CONFIG_KSU\s*$/)).toEqual(['keep();']);
  });

  it('leaves unrelated ifdefs untouched', () => {
    const lines = ['#ifdef CONFIG_FOO', '\tbar();', '#endif'];
    expect(stripBlockRange(lines, /^\s*#\s*ifdef\s+CONFIG_KSU\s*$/)).toEqual(lines);
  });
});

describe('cleanExistingHooks', () => {
  it('removes KernelSU dirs and hooks', () => {
    // KernelSU directory
    fs.mkdirSync(path.join(tmpDir, 'drivers', 'kernelsu'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'drivers', 'kernelsu', 'Kconfig'), 'config KSU\n');

    // Hooked source file
    const execC = path.join(tmpDir, 'fs', 'exec.c');
    fs.mkdirSync(path.dirname(execC), { recursive: true });
    fs.writeFileSync(
      execC,
      [
        'int do_execve(struct filename *filename)',
        '{',
        '#ifdef CONFIG_KSU',
        '\tksu_handle_execveat(0, &filename, 0, 0, 0);',
        '#endif',
        '\treturn do_execveat_common(filename);',
        '}',
        '',
      ].join('\n')
    );

    cleanExistingHooks(tmpDir);

    // Directory removed
    expect(fs.existsSync(path.join(tmpDir, 'drivers', 'kernelsu'))).toBe(false);

    // KSU hook stripped
    const execContent = fs.readFileSync(execC, 'utf-8');
    expect(execContent).not.toContain('CONFIG_KSU');
    expect(execContent).toContain('do_execveat_common');
  });

  it('is a no-op on a clean kernel tree', () => {
    fs.mkdirSync(path.join(tmpDir, 'fs'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'fs', 'exec.c'), 'int main(void)\n{\n\treturn 0;\n}\n');

    expect(() => cleanExistingHooks(tmpDir)).not.toThrow();
    expect(fs.existsSync(path.join(tmpDir, 'KernelSU'))).toBe(false);
    expect(fs.readFileSync(path.join(tmpDir, 'fs', 'exec.c'), 'utf-8')).toContain('return 0;');
  });
});
