/**
 * Best-effort, *safe* repair of almost-JSON text from an AI model:
 *  - strips ```json fences and text around the outermost { ... }
 *  - removes trailing commas before } or ]
 *  - replaces smart quotes used as JSON delimiters
 * It never invents content. Returns undefined when the text still isn't JSON.
 */
export function parseJsonLoose(raw: string): unknown | undefined {
  const attempts: string[] = [];
  const trimmed = raw.trim();
  attempts.push(trimmed);

  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  attempts.push(unfenced);

  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const body = unfenced.slice(start, end + 1);
    attempts.push(body);
    const noTrailingCommas = body.replace(/,\s*([}\]])/g, "$1");
    attempts.push(noTrailingCommas);
    attempts.push(noTrailingCommas.replace(/[“”](?=\s*[:,}\]])|(?<=[{,:\[]\s*)[“”]/g, '"'));
  }

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next repair
    }
  }
  return undefined;
}
