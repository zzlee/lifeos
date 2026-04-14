export function toLocalDisplayDate(utcDateStr: string, timeZone: string): string {
  try {
    const d = new Date(utcDateStr.replace(' ', 'T').endsWith('Z') || utcDateStr.includes('+') ? utcDateStr.replace(' ', 'T') : utcDateStr.replace(' ', 'T') + 'Z');
    return d.toLocaleString('sv-SE', { timeZone }).split(' ')[0];
  } catch (e) {
    return utcDateStr;
  }
}

export function toLocalDisplayTime(utcDateStr: string, timeZone: string): string {
  try {
    const d = new Date(utcDateStr.replace(' ', 'T').endsWith('Z') || utcDateStr.includes('+') ? utcDateStr.replace(' ', 'T') : utcDateStr.replace(' ', 'T') + 'Z');
    return d.toLocaleString('sv-SE', { timeZone });
  } catch (e) {
    return utcDateStr;
  }
}

export function toLocalInputString(utcDateStr: string, timeZone: string, type: 'date' | 'datetime-local'): string {
  try {
    const d = new Date(utcDateStr.replace(' ', 'T').endsWith('Z') || utcDateStr.includes('+') ? utcDateStr.replace(' ', 'T') : utcDateStr.replace(' ', 'T') + 'Z');
    const local = d.toLocaleString('sv-SE', { timeZone }).replace(' ', 'T');
    return type === 'date' ? local.slice(0, 10) : local.slice(0, 16);
  } catch (e) {
    return utcDateStr;
  }
}

export function localInputToUtcString(localStr: string, timeZone: string): string {
  if (!localStr) return "";
  try {
    const strToParse = localStr.length === 10 ? localStr + "T00:00" : localStr;
    const tempUtc = new Date(strToParse + "Z");
    const targetLocalStr = tempUtc.toLocaleString('sv-SE', { timeZone }).replace(' ', 'T');
    const targetLocalTime = new Date(targetLocalStr + "Z").getTime();
    const offset = targetLocalTime - tempUtc.getTime();
    const realUtc = new Date(tempUtc.getTime() - offset);
    return realUtc.toISOString();
  } catch (e) {
    return new Date(localStr).toISOString();
  }
}

export function getCurrentLocalInputString(timeZone: string, type: 'date' | 'datetime-local'): string {
  const local = new Date().toLocaleString('sv-SE', { timeZone }).replace(' ', 'T');
  return type === 'date' ? local.slice(0, 10) : local.slice(0, 16);
}
