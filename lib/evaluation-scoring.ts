type EvaluationOptions = {
  responseFormat?: 'text' | 'json';
  requiredJsonKeys?: string[];
  requiredJsonPaths?: string[];
};

function hasJsonPath(value: unknown, path: string) {
  let current: unknown = value;
  for (const segment of path.split('.')) {
    if (Array.isArray(current) && /^\d+$/.test(segment)) {
      current = current[Number(segment)];
    } else if (current !== null && typeof current === 'object' && segment in current) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return false;
    }
  }
  return current !== undefined && current !== null && current !== '';
}

export function evaluateAnswer(answer: string, requiredAny: string[], forbidden: string[], options?: EvaluationOptions) {
  const requiredHits = requiredAny.filter((word) => answer.includes(word));
  const forbiddenHits = forbidden.filter((word) => {
    let offset = 0;
    while (offset < answer.length) {
      const index = answer.indexOf(word, offset);
      if (index === -1) return false;
      const prefix = answer.slice(Math.max(0, index - 8), index);
      const negated = /(?:不(?:是|要|能|应|可)?|没(?:有)?|并非|绝非|别|不要|不能|不应|不可|切勿|无需|避免)[\s，,：:！!]*$/.test(prefix);
      if (!negated) return true;
      offset = index + word.length;
    }
    return false;
  });
  let jsonValid: boolean | undefined;
  let missingJsonKeys: string[] = [];
  let missingJsonPaths: string[] = [];
  if (options?.responseFormat === 'json') {
    try {
      const parsed = JSON.parse(answer) as Record<string, unknown>;
      jsonValid = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
      missingJsonKeys = (options.requiredJsonKeys ?? []).filter((key) => !(key in parsed));
      missingJsonPaths = (options.requiredJsonPaths ?? []).filter((path) => !hasJsonPath(parsed, path));
    } catch {
      jsonValid = false;
      missingJsonKeys = options.requiredJsonKeys ?? [];
      missingJsonPaths = options.requiredJsonPaths ?? [];
    }
  }
  const formatPassed = options?.responseFormat !== 'json' || (jsonValid === true && missingJsonKeys.length === 0 && missingJsonPaths.length === 0);
  const contentLengthPassed = options?.responseFormat === 'json' ? answer.trim().length > 0 : answer.trim().length >= 20;
  const passed = requiredHits.length > 0 && forbiddenHits.length === 0 && contentLengthPassed && formatPassed;
  return { passed, requiredHits, forbiddenHits, jsonValid, missingJsonKeys, missingJsonPaths };
}
