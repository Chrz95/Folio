import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
/** Recursively enumerate application source files.
 * @param {string} directory - Source tree.
 * @returns {string[]} TypeScript files. */
function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'migrations' ? [] : collectFiles(path);
    }
    return /\.tsx?$/.test(path) && !path.includes('.test.') ? [path] : [];
  });
}
const findings = [];
for (const file of [...collectFiles('frontend/src'), ...collectFiles('backend/src')]) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  /** Inspect named functions and function-valued variable/property declarations.
   * @param {ts.Node} node - AST node.
   * @returns {void} Adds undocumented declarations. */
  function visit(node) {
    const isFunction =
      ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node);
    const isNamedArrow =
      (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer));
    if ((isFunction || isNamedArrow) && !ts.getJSDocCommentsAndTags(node).length) {
      findings.push({
        file,
        name: node.name?.getText(source) ?? 'constructor',
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
process.stdout.write(JSON.stringify(findings, null, 2) + '\n');
