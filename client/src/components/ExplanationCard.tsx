/**
 * ExplanationCard — the "explanations of why things work that way"
 * requirement. Text is pulled from /api/config (`explain.<key>`), which an
 * admin can rewrite from the admin dashboard's config editor without
 * touching code or redeploying — see defaultConfig.ts on the server for
 * the seeded defaults and ARCHITECTURE.md for the editing path.
 */
export function ExplanationCard({
  config,
  configKey,
  title = "Why this works this way",
}: {
  config: Record<string, string>;
  configKey: string;
  title?: string;
}) {
  const text = config[`explain.${configKey}`];
  if (!text) return null;
  return (
    <div className="finding-box">
      <strong style={{ display: "block", marginBottom: 4 }}>{title}</strong>
      <span className="small">{text}</span>
    </div>
  );
}
