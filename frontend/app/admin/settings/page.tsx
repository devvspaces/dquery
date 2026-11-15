"use client";

import { PageHeader, Panel, QueryState, StatusBadge } from "@/components/admin/bits";
import { SettingField, type SettingView } from "@/components/admin/setting-field";
import { useAdminQuery } from "@/lib/admin-api";

interface SettingsResponse {
  settings: SettingView[];
  secrets: Array<{ name: string; configured: boolean }>;
}

export default function AdminSettings() {
  const { data, isLoading, error } = useAdminQuery<SettingsResponse>(["settings"], "/settings");
  const groups = data ? [...new Set(data.settings.map((s) => s.group))] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Changes apply within seconds, no redeploy. Overrides win over .env; Reset goes back to the .env value. Every change is in the audit log."
      />
      <QueryState isLoading={isLoading} error={error} />
      {groups.map((group) => (
        <Panel key={group} title={group}>
          {data!.settings.filter((s) => s.group === group).map((s) => (
            <SettingField key={s.key} setting={s} />
          ))}
        </Panel>
      ))}
      {data && (
        <Panel title="Secrets (.env only)">
          <p className="mb-3 text-xs text-muted-foreground">
            API keys never leave the server. To change one, edit /opt/domainq/.env and restart the API.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.secrets.map((s) => (
              <div key={s.name} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <span className="font-mono text-xs">{s.name}</span>
                <StatusBadge tone={s.configured ? "ok" : "muted"}>{s.configured ? "Configured" : "Not set"}</StatusBadge>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
