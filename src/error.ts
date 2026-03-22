import * as core from '@actions/core';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface ErrorPattern {
  pattern: RegExp;
  type: string;
  suggestion: string;
}

interface ErrorBlock {
  lines: string[];
  type: string;
  suggestion: string;
}

// Error patterns from error.py
const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /No such file or directory/i,
    type: 'Missing Header or Source File',
    suggestion:
      'Check if the file path is correct, or if required development libraries are missing (e.g., libssl-dev, zlib1g-dev).',
  },
  {
    pattern: /undefined reference to/i,
    type: 'Link Error: Missing Library or Function',
    suggestion:
      'Check if required libraries are missing (e.g., -lssl, -lcrypto), if library paths are in LDFLAGS/LDLIBS, or if function names are misspelled.',
  },
  {
    pattern: /unrecognized command line option/i,
    type: 'Compiler Option Not Supported',
    suggestion:
      'Your compiler version may be too old or too new. Check the options passed to the compiler in the Makefile for compatibility with your compiler version. Consider upgrading or downgrading the toolchain.',
  },
  {
    pattern: /misleading-indentation/i,
    type: 'Code Indentation Does Not Match Logic',
    suggestion:
      "This is a code style/logic potential error. Add braces '{}' after 'if', 'for', 'while' statements to clarify code block scope. Or disable this warning (not recommended).",
  },
  {
    pattern: /type specifier missing/i,
    type: 'C Language Type Declaration Missing',
    suggestion:
      'Variable or function declarations may be missing types (e.g., int). For kernel modules, it could be missing headers or ordering issues, or API changes between kernel versions.',
  },
  {
    pattern: /make\[\d+\]:.*Error \d+/i,
    type: 'Makefile Build Error',
    suggestion:
      "This is a Makefile rule execution failure. Check the specific error messages above, usually a subcommand (e.g., 'gcc', 'ld', 'sh') returned a non-zero status code.",
  },
  {
    pattern: /target emulation unknown/i,
    type: 'Linker Emulation Mode Error',
    suggestion:
      "Your linker (ld) does not recognize the specific emulation mode. Check if LLVM and GNU toolchains are mixed, or ensure LD variable correctly points to LLVM's lld.",
  },
  {
    pattern: /cannot open.*\.gz/i,
    type: 'File Missing (Configuration May Not Be Generated)',
    suggestion:
      "Check if 'make defconfig' or your device-specific config has been run. If 'make mrproper' was executed previously, reconfiguration is needed.",
  },
  {
    pattern: /makes pointer from integer without a cast/i,
    type: 'Type Conversion Error (Pointer and Integer)',
    suggestion:
      'This is a severe type mismatch. Usually the function return type does not match the expected type (e.g., returning int but expecting pointer). May need to modify source code or use a more compatible compiler.',
  },
  {
    pattern: /MODULE_IMPORT_NS\(VFS_internal_I_am_really_a_filesystem_and_am_NOT_a_driver\)/i,
    type: 'Clang Version Anomaly',
    suggestion:
      'This is a compiler and KernelSU compatibility issue, usually occurs with KernelSU official version and SukiSU-Ultra. For official version, you can choose the old v0.9.5 version; for SukiSU-Ultra, it is generally recommended to switch to a different KernelSU branch.',
  },
  {
    pattern: /not found \(required by clang\)/i,
    type: 'Clang Version Anomaly',
    suggestion:
      'The current build system version is too old. If using 20.04, please use 22.04, otherwise use latest.',
  },
  {
    pattern: /multiple definition of 'yylloc'/i,
    type: 'Kernel Defect',
    suggestion:
      'Modify YYLTYPE yylloc to extern YYLTYPE yylloc in scripts/dtc/dtc-lexer.lex.c_shipped',
  },
  {
    pattern: /assembler command failed with exit code 1/i,
    type: 'Clang Compiler Error',
    suggestion: 'Switch to a different Clang compiler version',
  },
  {
    pattern: /incompatible pointer types passing 'atomic_long_t \*'/i,
    type: 'Source Code Pointer Type Error',
    suggestion:
      'Usually occurs after manual patching of cred.h, replace atomic_inc_not_zero with atomic_long_inc_not_zero in the code',
  },
  {
    pattern: /-Werror/i,
    type: 'Warning Treated as Error',
    suggestion:
      'The compiler is treating warnings as errors due to -Werror flag. Either fix the underlying warning, or temporarily remove -Werror from CFLAGS/KBUILD_CFLAGS in the Makefile to allow compilation with warnings.',
  },
  {
    pattern: /implicit declaration of function/i,
    type: 'Implicit Function Declaration',
    suggestion:
      'A function is being used without being declared first. Include the proper header file, or add a function declaration/prototype before use. This may also indicate an API change in newer kernel versions.',
  },
  {
    pattern: /array subscript.*is outside array bounds/i,
    type: 'Array Index Out of Bounds',
    suggestion:
      'Accessing an array element outside its declared size. Check array bounds and ensure indices are within valid range [0, size-1]. This could be a buffer overflow risk.',
  },
  {
    pattern: /division by zero/i,
    type: 'Division by Zero',
    suggestion:
      'Code attempts to divide by zero. Add proper checks to ensure the divisor is not zero before performing division operations.',
  },
  {
    pattern: /null pointer dereference/i,
    type: 'Null Pointer Dereference',
    suggestion:
      'Attempting to access memory through a null pointer. Add null checks before dereferencing pointers, or ensure proper initialization before use.',
  },
  {
    pattern: /incompatible implicit declaration/i,
    type: 'Incompatible Implicit Declaration',
    suggestion:
      'Function was implicitly declared with a signature that does not match its actual definition. Include the correct header or add a proper function prototype.',
  },
  {
    pattern: /unused variable/i,
    type: 'Unused Variable',
    suggestion:
      'A variable is declared but never used. Either use the variable, remove it, or mark it with __maybe_unused attribute to suppress the warning.',
  },
  {
    pattern: /uninitialized variable/i,
    type: 'Uninitialized Variable',
    suggestion:
      'A variable is being used before being initialized. Initialize the variable at declaration or before first use.',
  },
  {
    pattern: /dereferencing pointer to incomplete type/i,
    type: 'Dereferencing Incomplete Type',
    suggestion:
      'Attempting to access members of a struct/union that has not been fully defined. Include the header file containing the complete type definition.',
  },
  {
    pattern: /conflicting types/i,
    type: 'Conflicting Types',
    suggestion:
      'A function or variable has been declared with different types in different places. Ensure all declarations match the definition exactly.',
  },
  {
    pattern: /redefinition of /i,
    type: 'Symbol Redefinition',
    suggestion:
      'A function, variable, or macro has been defined multiple times. Check for duplicate definitions or include guards in header files.',
  },
  {
    pattern: /deprecated/i,
    type: 'Deprecated API Usage',
    suggestion:
      'Using a deprecated function or feature. Update the code to use the recommended replacement API or suppress with -Wno-deprecated-declarations (not recommended for long-term).',
  },
  {
    pattern: /overflow in conversion/i,
    type: 'Integer Overflow in Conversion',
    suggestion:
      'A value is being converted to a type that cannot hold it. Check value ranges and use appropriate data types or add bounds checking.',
  },
  {
    pattern: /shift count overflow/i,
    type: 'Bit Shift Overflow',
    suggestion:
      'The shift amount exceeds the bit width of the type. Ensure shift counts are less than the types bit width (e.g., < 32 for int32).',
  },
  {
    pattern: /cast from pointer to integer of different size/i,
    type: 'Pointer to Integer Size Mismatch',
    suggestion:
      'Converting a pointer to an integer type with different size. Use uintptr_t or intptr_t types which are guaranteed to hold pointer values.',
  },
  {
    pattern: /variable length array/i,
    type: 'Variable Length Array (VLA) Used',
    suggestion:
      'Using VLA which may cause stack overflow. Consider using dynamic allocation (kmalloc/vmalloc for kernel) instead, or ensure size is bounded.',
  },
  {
    pattern: /taking address of temporary/i,
    type: 'Address of Temporary Value',
    suggestion:
      'Attempting to take the address of a temporary/rvalue. Store the value in a variable first, then take its address.',
  },
  {
    pattern: /control reaches end of non-void function/i,
    type: 'Missing Return Statement',
    suggestion:
      'A non-void function may reach the end without returning a value. Add a return statement at the end of all code paths.',
  },
  {
    pattern: /comparison of integer expressions of different signedness/i,
    type: 'Signed/Unsigned Comparison',
    suggestion:
      'Comparing signed and unsigned integers. Cast one operand to match the others type, or ensure consistent types throughout.',
  },
  {
    pattern: /result of operation is still indeterminate/i,
    type: 'Sequence Point Violation',
    suggestion:
      'Undefined behavior due to multiple modifications between sequence points. Break the expression into multiple statements.',
  },
  {
    pattern: /stack-protector/i,
    type: 'Stack Protection Enabled But Failed',
    suggestion:
      'Stack smashing detected or stack protector instrumentation failed. Check for buffer overflows in the code, or disable with -fno-stack-protector (not recommended).',
  },
  {
    pattern: /clock skew detected/i,
    type: 'Clock Skew Detected',
    suggestion:
      'File timestamps are in the future. Synchronize system clock or touch the affected files to update timestamps.',
  },
];

/**
 * Analyze error block and return error type and suggestion
 */
function analyzeErrorBlock(lines: string[]): { type: string; suggestion: string } {
  const errorBlockText = lines.join('\n');
  let errorType = 'Uncommon Error';
  let suggestion =
    'Please follow the compilation output error results and try to resolve using search engines';

  for (const { pattern, type, suggestion: sugg } of ERROR_PATTERNS) {
    if (pattern.test(errorBlockText)) {
      errorType = type;
      suggestion = `Suggestion: ${sugg}`;
      break;
    }
  }

  return { type: errorType, suggestion };
}

/**
 * Print separator line
 */
function printSeparator(): void {
  core.info('-'.repeat(56));
}

/**
 * Analyze error log file
 */
export function analyzeErrors(logFile: string): number {
  if (!fs.existsSync(logFile)) {
    core.error(`Log file '${logFile}' does not exist.`);
    return 0;
  }

  core.info(`Analyzing log file: ${logFile}`);
  printSeparator();

  const content = fs.readFileSync(logFile, 'utf-8');
  const lines = content.split('\n');

  let errorCount = 0;
  const errorBlocks: ErrorBlock[] = [];
  let currentErrorLines: string[] = [];
  let processingError = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check for error start
    if (/\serror:|\sfatal error:|undefined reference to/i.test(line)) {
      // Save previous error block if exists
      if (processingError && currentErrorLines.length > 0) {
        const { type, suggestion } = analyzeErrorBlock(currentErrorLines);
        errorBlocks.push({ lines: [...currentErrorLines], type, suggestion });
      }

      processingError = true;
      errorCount++;
      currentErrorLines = [line];
    }
    // Check for continuation lines (notes, make errors)
    else if (
      processingError &&
      (line.includes('note:') || (/make\[\d+\]:/.test(line) && line.includes('***')) || trimmedLine)
    ) {
      currentErrorLines.push(line);
    } else {
      // Error block ended
      if (processingError && currentErrorLines.length > 0) {
        const { type, suggestion } = analyzeErrorBlock(currentErrorLines);
        errorBlocks.push({ lines: [...currentErrorLines], type, suggestion });
      }
      processingError = false;
      currentErrorLines = [];
    }
  }

  // Handle last error block
  if (processingError && currentErrorLines.length > 0) {
    const { type, suggestion } = analyzeErrorBlock(currentErrorLines);
    errorBlocks.push({ lines: currentErrorLines, type, suggestion });
  }

  // Process and display each error block
  for (let idx = 0; idx < errorBlocks.length; idx++) {
    const block = errorBlocks[idx];
    core.info(`Error #${idx + 1}:`);
    for (const errorLine of block.lines) {
      core.info(`  ${errorLine}`);
    }
    core.info(`Error: ${block.type}`);
    core.warning(`Suggestion: ${block.suggestion}`);
    printSeparator();
  }

  // Summary
  if (errorCount > 0) {
    core.info(`Total found ${errorCount} error(s).`);
    core.warning('Please carefully review the error messages and suggestions above.');

    // Create have_error marker file
    fs.writeFileSync('have_error', '');

    // Print final summary
    core.info('');
    core.info('='.repeat(56));
    core.info('                    Error Summary');
    core.info('='.repeat(56));
    for (let idx = 0; idx < errorBlocks.length; idx++) {
      const block = errorBlocks[idx];
      core.info(`\n  [${idx + 1}] ${block.type}`);
      core.warning(`      ${block.suggestion}`);
    }
    core.info(`\n${'='.repeat(56)}`);
    core.info(`Total: ${errorCount} error(s)`);
    core.info('='.repeat(56));
  } else {
    core.info('No errors found.');
  }

  printSeparator();
  return errorCount;
}

/**
 * Analyze errors from kernel build log
 */
export function analyzeBuildErrors(kernelDir: string): void {
  const logFile = path.join(kernelDir, 'out', 'build.log');
  if (fs.existsSync(logFile)) {
    analyzeErrors(logFile);
  } else {
    core.warning(`Build log not found: ${logFile}`);
  }
}
