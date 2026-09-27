/** Summarise an OWASP ZAP JSON report (baseline -J / traditional JSON). */

export function summariseZap(raw) {
  const sites = Array.isArray(raw?.site) ? raw.site : raw?.site ? [raw.site] : [];
  const alerts = [];
  for (const site of sites) {
    for (const alert of site.alerts || []) {
      alerts.push({
        pluginId: alert.pluginid || alert.pluginId,
        name: alert.alert || alert.name,
        risk: alert.riskdesc || alert.risk || String(alert.riskcode || ""),
        riskCode: Number(alert.riskcode ?? alert.riskCode ?? 0),
        confidence: alert.confidence,
        count: (alert.instances || []).length || Number(alert.count || 1),
        url: alert.instances?.[0]?.uri || alert.instances?.[0]?.url || "",
      });
    }
  }
  const high = alerts.filter((a) => a.riskCode >= 3 || /high|critical/i.test(a.risk)).length;
  const medium = alerts.filter((a) => a.riskCode === 2 || /medium/i.test(a.risk)).length;
  const low = alerts.filter((a) => a.riskCode === 1 || /low/i.test(a.risk)).length;
  return {
    present: true,
    sites: sites.length,
    alerts: alerts.length,
    high,
    medium,
    low,
    items: alerts.slice(0, 40),
  };
}
