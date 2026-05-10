export function redactAgentCommandForEvidence(value: string) {
  return value
    .replace(/x-access-token:[^@\s'"]+@github\.com/g, 'x-access-token:[redacted]@github.com')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]');
}
