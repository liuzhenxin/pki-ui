export function isFawvwEmployeeSourceActive(status?: string | null): boolean {
  const code = status?.trim().toUpperCase();
  return code === 'A' || code === '3';
}
