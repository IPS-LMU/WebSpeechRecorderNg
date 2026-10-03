/**
 * Fills `{placeholder}` slots in the templates held by `editor-strings.ts`. Kept beside the
 * catalogue so a translated template is a plain string with named slots.
 */
export function fillTemplate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}
