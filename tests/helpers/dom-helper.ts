import fs from 'node:fs';
import path from 'node:path';

export interface ComponentRenderResult {
  html: string;
  hasTestId: (testId: string) => boolean;
  hasText: (text: string) => boolean;
  hasClass: (className: string) => boolean;
}

export function parseHtml(html: string): ComponentRenderResult {
  return {
    html,
    hasTestId(testId: string): boolean {
      return (
        html.includes(`data-testid="${testId}"`) ||
        html.includes(`data-testid='${testId}'`)
      );
    },
    hasText(text: string): boolean {
      return html.includes(text);
    },
    hasClass(className: string): boolean {
      const classAttrRegex = /class(?:Name)?=["']([^"']*)["']/g;
      let match;
      while ((match = classAttrRegex.exec(html)) !== null) {
        const classes = match[1].split(/\s+/);
        if (classes.includes(className)) {
          return true;
        }
      }
      return html.includes(className);
    },
  };
}

export function componentFileExists(relativeSrcPath: string): boolean {
  const fullPath = path.resolve(process.cwd(), relativeSrcPath);
  return fs.existsSync(fullPath);
}

export function readSourceFile(relativeSrcPath: string): string | null {
  const fullPath = path.resolve(process.cwd(), relativeSrcPath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, 'utf-8');
}
