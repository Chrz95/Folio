/** Preserve an already saved alias while exposing zones supported by this browser.
 * @param {string} currentZone - Saved IANA zone. @returns {string[]} Select options. */
export function timeZoneOptions(currentZone: string) {
  const zones =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : ['Europe/Athens', 'Europe/London', 'America/New_York'];
  return [...new Set([currentZone, 'UTC', ...zones])];
}
