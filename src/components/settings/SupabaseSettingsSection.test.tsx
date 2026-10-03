import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import type { RuntimeConfig } from "../../lib/config/runtimeConfig";
import type { SyncStatus } from "../../lib/sync/syncTypes";
import { SupabaseSettingsSection } from "./SupabaseSettingsSection";

const syncStatus: SyncStatus = {
  mode: "offline",
  label: "offline",
  detail: "로그인이 필요합니다.",
  isOnline: true,
  lastSyncedAt: null,
  isConfigured: true,
};

function renderSection(
  supabaseConfig: RuntimeConfig,
  status: SyncStatus = syncStatus,
): ReactTestRenderer {
  let renderer: ReactTestRenderer | undefined;

  act(() => {
    renderer = create(
      <SupabaseSettingsSection
        authEmail={null}
        isAuthenticated={false}
        isManualSyncing={false}
        isSupabaseConfigured={Boolean(
          supabaseConfig.supabaseUrl && supabaseConfig.supabaseAnonKey,
        )}
        supabaseConfig={supabaseConfig}
        syncStatus={status}
        userId="local-user"
        onManualSync={vi.fn(async () => undefined)}
        onSaveSupabaseConfig={vi.fn(async () => undefined)}
        onSignIn={vi.fn(async () => undefined)}
        onSignOut={vi.fn(async () => undefined)}
      />,
    );
  });

  return renderer!;
}

describe("SupabaseSettingsSection", () => {
  it("hides URL/key inputs for an app-managed backend and keeps Auth controls", () => {
    const renderer = renderSection({
      supabaseUrl: "https://shared-project.supabase.co",
      supabaseAnonKey: "shared-anon-key",
      boundUserId: "",
      loaded: true,
      sourcePath: "build environment",
    });
    const text = JSON.stringify(renderer.toJSON());
    const urlInputs = renderer.root.findAll(
      (node) => node.type === "input" && node.props.type === "url",
    );

    expect(text).toContain("앱에서 관리되는 Supabase 연결");
    expect(text).toContain("사용자별 Auth account");
    expect(text).not.toContain("수동 Supabase 연결");
    expect(urlInputs).toHaveLength(0);
    expect(renderer.root.findAllByType("input")).toHaveLength(2);

    act(() => renderer.unmount());
  });

  it("shows separate Fitness read-model diagnostics and their error details", () => {
    const renderer = renderSection(
      {
        supabaseUrl: "https://shared-project.supabase.co",
        supabaseAnonKey: "shared-anon-key",
        boundUserId: "",
        loaded: true,
        sourcePath: "build environment",
      },
      {
        ...syncStatus,
        detail: "Fitness read model 부분 실패: nutrition",
        fitnessReadModels: {
          workout: { state: "connected", detail: "fitness_summary_projections_v2: 2개 row" },
          nutrition: { state: "error", detail: "migration 20260922090000_fitness_nutrition_summary_v1.sql 적용 필요" },
          weight: { state: "empty", detail: "weight_records: row 없음" },
        },
      },
    );
    const text = JSON.stringify(renderer.toJSON());

    expect(text).toContain("Fitness read models");
    expect(text).toContain("workout");
    expect(text).toContain("connected");
    expect(text).toContain("nutrition");
    expect(text).toContain("error");
    expect(text).toContain("weight");
    expect(text).toContain("empty");
    expect(text).toContain("20260922090000_fitness_nutrition_summary_v1.sql");

    act(() => renderer.unmount());
  });

  it("shows the existing manual URL/key inputs without a managed backend", () => {
    const renderer = renderSection({
      supabaseUrl: "",
      supabaseAnonKey: "",
      boundUserId: "",
      loaded: false,
      sourcePath: null,
    });
    const text = JSON.stringify(renderer.toJSON());
    const urlInputs = renderer.root.findAll(
      (node) => node.type === "input" && node.props.type === "url",
    );

    expect(text).toContain("수동 Supabase 연결");
    expect(text).toContain("로컬 fallback");
    expect(urlInputs).toHaveLength(1);

    act(() => renderer.unmount());
  });
});
