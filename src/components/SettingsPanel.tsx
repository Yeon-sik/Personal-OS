import { Settings } from "lucide-react";
import type { ThemeMode } from "../app/useThemeMode";
import type {
  RuntimeConfig,
  SupabaseConfigInput,
} from "../lib/config/runtimeConfig";
import type { DesktopQuickCaptureShortcutStatus } from "../lib/desktop/quickCapture";
import type { SyncStatus } from "../lib/sync/syncTypes";
import type { Device } from "../types";
import { ActiveDevicesSettingsSection } from "./settings/ActiveDevicesSettingsSection";
import { AppearanceSettingsSection } from "./settings/AppearanceSettingsSection";
import { DesktopIntegrationSettingsSection } from "./settings/DesktopIntegrationSettingsSection";
import { GitHubSettingsSection } from "./settings/GitHubSettingsSection";
import { SupabaseSettingsSection } from "./settings/SupabaseSettingsSection";
import { DbEditorLauncher } from "../features/db-editor/DbEditorLauncher";
import type { KnowledgeVaultRuntime } from "../features/knowledge-vault/useKnowledgeVaultRuntime";
import { KnowledgeVaultSettingsSection } from "./settings/KnowledgeVaultSettingsSection";
import { DeadlineNotificationSettingsSection } from "./settings/DeadlineNotificationSettingsSection";
import type { DeadlineNotificationsRuntime } from "../features/deadline-notifications/useDeadlineNotifications";

interface SettingsPanelProps {
  activeDevices: Device[];
  authEmail: string | null;
  autostartEnabled: boolean;
  autostartSupported: boolean;
  currentDeviceId: string | null;
  isManualSyncing: boolean;
  isSupabaseConfigured: boolean;
  isAuthenticated: boolean;
  supabaseConfig: RuntimeConfig;
  syncStatus: SyncStatus;
  themeMode: ThemeMode;
  userId: string;
  quickCaptureShortcutPreference: string;
  quickCaptureShortcutStatus: DesktopQuickCaptureShortcutStatus;
  onChangeThemeMode: (themeMode: ThemeMode) => void;
  onManualSync: () => Promise<void>;
  onRefreshGitHubStatus: () => Promise<void>;
  onRefreshQuickCaptureShortcutStatus: () => Promise<void>;
  onSaveSupabaseConfig: (config: SupabaseConfigInput) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onSaveQuickCaptureShortcutPreference: (shortcut: string) => void;
  onToggleAutostart: (enabled: boolean) => Promise<void>;
  knowledgeVault: KnowledgeVaultRuntime;
  deadlineNotifications: DeadlineNotificationsRuntime;
}

export function SettingsPanel({
  activeDevices,
  authEmail,
  autostartEnabled,
  autostartSupported,
  currentDeviceId,
  isManualSyncing,
  isSupabaseConfigured,
  isAuthenticated,
  supabaseConfig,
  syncStatus,
  themeMode,
  userId,
  quickCaptureShortcutPreference,
  quickCaptureShortcutStatus,
  onChangeThemeMode,
  onManualSync,
  onRefreshGitHubStatus,
  onRefreshQuickCaptureShortcutStatus,
  onSaveSupabaseConfig,
  onSignIn,
  onSignOut,
  onSaveQuickCaptureShortcutPreference,
  onToggleAutostart,
  knowledgeVault,
  deadlineNotifications,
}: SettingsPanelProps) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-slate-300 bg-white dark:border-neutral-800 dark:bg-black">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-slate-200 px-3 text-sm font-semibold text-slate-900 dark:border-neutral-800 dark:text-neutral-100">
        <Settings
          className="h-4 w-4 text-slate-600 dark:text-neutral-300"
          aria-hidden="true"
        />
        <span>설정</span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <AppearanceSettingsSection
          themeMode={themeMode}
          onChangeThemeMode={onChangeThemeMode}
        />
        <DeadlineNotificationSettingsSection notifications={deadlineNotifications} />
        <DbEditorLauncher />
        <KnowledgeVaultSettingsSection vault={knowledgeVault} />
        <SupabaseSettingsSection
          authEmail={authEmail}
          isAuthenticated={isAuthenticated}
          isManualSyncing={isManualSyncing}
          isSupabaseConfigured={isSupabaseConfigured}
          supabaseConfig={supabaseConfig}
          syncStatus={syncStatus}
          userId={userId}
          onManualSync={onManualSync}
          onSaveSupabaseConfig={onSaveSupabaseConfig}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
        />
        <GitHubSettingsSection onRefreshGitHubStatus={onRefreshGitHubStatus} />
        <DesktopIntegrationSettingsSection
          autostartEnabled={autostartEnabled}
          autostartSupported={autostartSupported}
          quickCaptureShortcutPreference={quickCaptureShortcutPreference}
          quickCaptureShortcutStatus={quickCaptureShortcutStatus}
          onRefreshQuickCaptureShortcutStatus={
            onRefreshQuickCaptureShortcutStatus
          }
          onSaveQuickCaptureShortcutPreference={
            onSaveQuickCaptureShortcutPreference
          }
          onToggleAutostart={onToggleAutostart}
        />
        <ActiveDevicesSettingsSection
          activeDevices={activeDevices}
          currentDeviceId={currentDeviceId}
        />
      </div>
    </section>
  );
}
