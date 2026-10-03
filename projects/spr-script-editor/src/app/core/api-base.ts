/**
 * URL building shared by the editor's read services. Mirrors `ProjectService`/`ScriptService`
 * (README §4.3, rest-api.md): paths hang off `apiEndPoint`, requests carry `withCredentials`, and
 * `ApiType.FILES` appends `.json?requestUUID=…` so the dev server serves (and re-fetches) the
 * static fixtures in `src/test`.
 */
import {ApiType, SpeechRecorderConfig} from 'speechrecorderng';
import {UUID} from 'speechrecorderng';

/** `apiEndPoint` with the trailing slash `ProjectService` adds, or `''` when unset. */
export function normaliseApiEndPoint(config?: SpeechRecorderConfig): string {
  const endPoint = config?.apiEndPoint ?? '';
  return endPoint === '' ? '' : endPoint + '/';
}

function encodeSegments(segments: (string | number)[]): string {
  return segments.map((segment) => encodeURIComponent(String(segment))).join('/');
}

/** `{apiEndPoint}project/{projectId}/…`. */
export function projectPath(base: string, projectId: string, ...segments: (string | number)[]): string {
  const path = base + 'project/' + encodeURIComponent(projectId);
  return segments.length === 0 ? path : path + '/' + encodeSegments(segments);
}

/** `{apiEndPoint}…` for the endpoints that are not project scoped (`version`, `script/{id}`). */
export function apiPath(base: string, ...segments: (string | number)[]): string {
  return base + encodeSegments(segments);
}

export interface QueryParam {
  name: string;
  value: string | number | boolean | Array<string | number | boolean>;
}

/**
 * Applies the FILES-mode suffix and the request UUID, then appends the query parameters. The UUID
 * makes the URL unique so the dev server cannot answer from its cache — the same trick
 * `ProjectService.appendRequestUUIDForDevelopmentServer` uses.
 */
export function withQuery(url: string, config: SpeechRecorderConfig | undefined, params: QueryParam[] = []): string {
  const files = config?.apiType === ApiType.FILES;
  const search = new URLSearchParams();
  for (const {name, value} of params) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      search.append(name, String(item));
    }
  }
  if (files) {
    search.append('requestUUID', UUID.generate());
  }
  const query = search.toString();
  const target = files ? url + '.json' : url;
  return query === '' ? target : target + '?' + query;
}
