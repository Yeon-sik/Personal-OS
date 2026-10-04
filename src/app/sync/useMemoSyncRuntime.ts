import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SaveState } from "../../components/HeaderBar";
import { getVisibleNotes } from "../../features/notes/noteService";
import {
  bindSupabaseUser,
  emptyRuntimeConfig,
  isManagedSupabaseConfig,
  loadRuntimeConfig,
  saveSupabaseConfig as persistSupabaseConfig,
  type RuntimeConfig,
  type SupabaseConfigInput,
} from "../../lib/config/runtimeConfig";
import {
  getAutostartEnabled,
  setAutostartEnabled as setDesktopAutostartEnabled,
} from "../../lib/desktop/autostart";
import { getOrCreateDevice, upsertDevice } from "../../lib/device/device";
import { localStorageAdapter } from "../../lib/storage/localStorageAdapter";
import type { StorageAdapter } from "../../lib/storage/storageAdapter";
import { createSyncQueue } from "../../lib/sync/syncQueue";
import { initializeSyncState, sameScope, trackLocalChanges } from "../../lib/sync/syncState";
import { reconcilePull, reconcileResult, reconcileRealtime } from "../../lib/sync/syncReconciliation";
import {
  createAppSyncClient,
  getConfiguredUserId,
} from "../../lib/sync/syncClientFactory";
import type {
  FinanceDailySummary,
  SyncClient,
  SyncContext,
  SyncStatus,
} from "../../lib/sync/syncTypes";
import type { Device, LocalDataSnapshot } from "../../types";
import {
  useSnapshotStore,
  type SnapshotStore,
} from "./useSnapshotStore";

const initialSyncStatus: SyncStatus = {
  mode: "local-only",
  label: "local-only",
  detail: "동기화 상태를 확인하는 중입니다.",
  isOnline: false,
  lastSyncedAt: null,
  isConfigured: false,
};

export interface MemoSyncRuntime
  extends Pick<SnapshotStore, "commitSnapshot" | "snapshot"> {
  activeDevices: Device[];
  authEmail: string | null;
  autostartEnabled: boolean;
  autostartSupported: boolean;
  device: Device | null;
  error: string | null;
  isAuthenticated: boolean;
  isManualSyncing: boolean;
  isReady: boolean;
  isSupabaseConfigured: boolean;
  loadFinanceDailySummaries: (
    fromDate: string,
    toDate: string,
  ) => Promise<FinanceDailySummary[]>;
  manualSync: () => Promise<void>;
  saveState: SaveState;
  saveSupabaseConfig: (config: SupabaseConfigInput) => Promise<void>;
  selectedNoteId: string | null;
  setAutostartEnabled: (enabled: boolean) => Promise<void>;
  setSelectedNoteId: React.Dispatch<React.SetStateAction<string | null>>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  supabaseConfig: RuntimeConfig;
  syncStatus: SyncStatus;
  userId: string;
}

export function useMemoSyncRuntime(
  storage: StorageAdapter = localStorageAdapter,
  injectedSyncClient?: SyncClient,
  injectedUserId?: string,
): MemoSyncRuntime {
  const {
    commitSnapshot,
    replaceSnapshot,
    snapshot,
    snapshotRef,
  } = useSnapshotStore();
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(
    null,
  );
  const [device, setDevice] = useState<Device | null>(null);
  const [activeDevices, setActiveDevices] = useState<Device[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [localLoadFailed, setLocalLoadFailed] = useState(false);
  const remoteSyncBlockedRef = useRef(false);
  const remoteSyncQueueRef = useRef(createSyncQueue());
  const localSaveQueueRef = useRef(createSyncQueue());
  const hydratedStorageRef = useRef<StorageAdapter | null>(null);
  const lastSavedSnapshotRef = useRef<LocalDataSnapshot | null>(null);
  const [authEpoch, setAuthEpoch] = useState(0);
  const activeManualSyncCountRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [syncStatus, setSyncStatus] =
    useState<SyncStatus>(initialSyncStatus);
  const [autostartEnabled, setAutostartState] = useState(false);
  const [autostartSupported, setAutostartSupported] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const activeRuntimeConfig = runtimeConfig ?? emptyRuntimeConfig;
  const backend = injectedSyncClient?.getBackend?.() || activeRuntimeConfig.supabaseUrl.trim().replace(/\/+$/, "") || "injected";
  const isRuntimeConfigReady =
    runtimeConfig !== null || Boolean(injectedSyncClient) || Boolean(injectedUserId);
  const syncClient = useMemo(
    () => injectedSyncClient ?? createAppSyncClient(activeRuntimeConfig),
    [activeRuntimeConfig, injectedSyncClient],
  );
  const userId = useMemo(
    () => injectedUserId ?? authenticatedUserId ?? getConfiguredUserId(),
    [authenticatedUserId, injectedUserId],
  );
  const visibleNotes = useMemo(
    () => getVisibleNotes(snapshot.notes),
    [snapshot.notes],
  );
  const commitLocalSnapshot = useCallback(
    (updater: Parameters<SnapshotStore["commitSnapshot"]>[0]) => {
      commitSnapshot((current) => trackLocalChanges(current, updater(current), device?.id ?? ""));
    },
    [commitSnapshot, device?.id],
  );

  const applyRemoteSnapshot = useCallback(
    (nextSnapshot: LocalDataSnapshot) => {
      replaceSnapshot(nextSnapshot);
    },
    [replaceSnapshot],
  );

  const persistCurrentSnapshot = useCallback(() => localSaveQueueRef.current.enqueue(async () => {
    const current = snapshotRef.current;
    if (lastSavedSnapshotRef.current === current) return current;
    await storage.save(current);
    lastSavedSnapshotRef.current = current;
    return current;
  }), [snapshotRef, storage]);

  const persistRemoteSnapshot = useCallback((transform: (current: LocalDataSnapshot) => LocalDataSnapshot) =>
    localSaveQueueRef.current.enqueue(async () => {
      // A delayed adapter can overlap with new edits. Rebase and save again
      // before installing the checkpoint, never overwrite a newer revision.
      for (;;) {
        const current = snapshotRef.current;
        const transformed = transform(current);
        const next = JSON.stringify(transformed) === JSON.stringify(current) ? current : transformed;
        // The remote result can be a no-op because a newer revision is dirty.
        // That newer local revision still needs durable storage before return.
        if (next === current && lastSavedSnapshotRef.current === current) return current;
        await storage.save(next);
        lastSavedSnapshotRef.current = next;
        if (snapshotRef.current === current) {
          applyRemoteSnapshot(next);
          return next;
        }
      }
    }), [applyRemoteSnapshot, snapshotRef, storage]);

  useEffect(() => {
    if (injectedSyncClient || injectedUserId) {
      return;
    }

    let isMounted = true;

    async function hydrateRuntimeConfig() {
      const config = await loadRuntimeConfig();

      if (isMounted) {
        setRuntimeConfig(config);
      }
    }

    void hydrateRuntimeConfig();

    return () => {
      isMounted = false;
    };
  }, [injectedSyncClient, injectedUserId]);

  useEffect(() => {
    if (!isRuntimeConfigReady) {
      return;
    }

    let isMounted = true;

    async function hydrate() {
      const currentDevice = await getOrCreateDevice();
      if (!isMounted) return;
      setIsHydrating(true);

      try {
        // Restore the last local snapshot before auth or network work. This
        // keeps the app useful offline and prevents a failed remote request
        // from deciding whether local data is shown.
        let storedSnapshot: LocalDataSnapshot;
        try {
          storedSnapshot = hydratedStorageRef.current === storage ? snapshotRef.current : await storage.load();
          hydratedStorageRef.current = storage;
        } catch (caughtError) {
          if (isMounted) {
            const message =
              caughtError instanceof Error
                ? caughtError.message
                : "저장된 로컬 데이터를 읽지 못했습니다.";
            setLocalLoadFailed(true);
            setIsHydrating(false);
            setDevice(currentDevice);
            setError(message);
            setSaveState("error");
          }
          return;
        }

        const localSnapshot = initializeSyncState({
          ...storedSnapshot,
          devices: upsertDevice(storedSnapshot.devices, currentDevice),
        }, null, currentDevice.id);
        if (!isMounted) {
          return;
        }
        setLocalLoadFailed(false);
        replaceSnapshot(localSnapshot);
        setDevice(currentDevice);
        setActiveDevices([currentDevice]);
        setSelectedNoteId(getVisibleNotes(localSnapshot.notes)[0]?.id ?? null);
        setIsReady(true);
        setSaveState("saved");

        const authState = await syncClient.getAuthState();
        if (!isMounted) return;
        if (
          authState.userId &&
          ((activeRuntimeConfig.boundUserId && authState.userId !== activeRuntimeConfig.boundUserId) ||
            (snapshotRef.current.syncState?.scope && !sameScope(snapshotRef.current.syncState.scope, { backend, userId: authState.userId })))
        ) {
          await syncClient.signOut();
          throw new Error(
            "이 로컬 데이터는 다른 계정에 연결되어 있습니다. 계정 전환에는 별도 데이터 이전이 필요합니다.",
          );
        }
        if (authState.userId && !activeRuntimeConfig.boundUserId) {
          setRuntimeConfig(
            bindSupabaseUser(authState.userId, activeRuntimeConfig),
          );
        }
        const resolvedUserId =
          injectedUserId ?? authState.userId ?? getConfiguredUserId();
        setAuthenticatedUserId(authState.userId);
        setAuthEmail(authState.email);
        const context: SyncContext = {
          device: currentDevice,
          userId: resolvedUserId,
          backend,
        };
        const scope = injectedUserId || authState.userId ? { backend, userId: resolvedUserId } : null;
        const prepared = initializeSyncState(snapshotRef.current, scope, currentDevice.id);
        replaceSnapshot(prepared);
        // Binding the queue and its pending rows is durable before remote I/O.
        await persistCurrentSnapshot();
        if (!isMounted) return;
        let pullBase = snapshotRef.current;
        const syncedSnapshot = await remoteSyncQueueRef.current.enqueue(() => {
          pullBase = snapshotRef.current;
          return isMounted ? syncClient.pull(pullBase, context) : Promise.resolve(pullBase);
        });
        if (!isMounted) return;
        const pullStatus = syncClient.getStatus();
        const nextSnapshot = await persistRemoteSnapshot((current) => {
          const merged = reconcilePull(current, syncedSnapshot, pullBase);
          return { ...merged, devices: upsertDevice(merged.devices, currentDevice) };
        });
        const nextVisibleNotes = getVisibleNotes(nextSnapshot.notes);

        if (!isMounted) {
          return;
        }

        setDevice(currentDevice);
        setActiveDevices([currentDevice]);
        setSelectedNoteId(nextVisibleNotes[0]?.id ?? null);
        setSyncStatus(syncClient.getStatus());
        setIsReady(true);
        setIsHydrating(false);
        setSaveState("saved");

        remoteSyncBlockedRef.current = pullStatus.mode === "error";
        if (remoteSyncBlockedRef.current) {
          setError(pullStatus.detail);
        } else setError(null);
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "앱 데이터를 불러오지 못했습니다.";

        setError(message);
        remoteSyncBlockedRef.current = true;
        setSyncStatus({
          ...syncClient.getStatus(),
          mode: "error",
          label: "error",
          detail: message,
        });
        setDevice(currentDevice);
        setIsHydrating(false);
        setActiveDevices([currentDevice]);
        setIsReady(true);
        setSaveState("error");
      }
    }

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [
    activeRuntimeConfig,
    authEpoch,
    backend,
    injectedUserId,
    isRuntimeConfigReady,
    replaceSnapshot,
    storage,
    syncClient,
    persistCurrentSnapshot,
    persistRemoteSnapshot,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function hydrateAutostart() {
      const result = await getAutostartEnabled();

      if (!isMounted) {
        return;
      }

      setAutostartSupported(result.supported);
      setAutostartState(result.enabled);
    }

    void hydrateAutostart();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (
      !isReady ||
      isHydrating ||
      localLoadFailed ||
      remoteSyncBlockedRef.current ||
      !device
    ) {
      return;
    }

    const context: SyncContext = { device, userId, backend };
    let isSubscribed = true;
    const realtimeSubscription = syncClient.subscribeRealtime({
      context,
      getSnapshot: () => snapshotRef.current,
      onSnapshot: (nextSnapshot, status) => {
        if (!isSubscribed) return;
        void persistRemoteSnapshot((current) => isSubscribed ? reconcileRealtime(current, nextSnapshot) : current).then(() => {
          if (!isSubscribed) return;
          setSyncStatus(status);
          setError(null);
        }).catch((caughtError: unknown) => {
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "원격 변경사항을 로컬 저장소에 저장하지 못했습니다.";

          setError(message);
        });
      },
      onError: (message) => {
        setError(message);
        setSyncStatus((current) => ({ ...current, mode: "error", label: "error", detail: message }));
      },
    });
    const heartbeatSubscription = syncClient.startHeartbeat(context);

    return () => {
      isSubscribed = false;
      void realtimeSubscription.unsubscribe();
      void heartbeatSubscription.unsubscribe();
    };
  }, [
    device,
    isHydrating,
    isReady,
    localLoadFailed,
    applyRemoteSnapshot,
    snapshotRef,
    storage,
    syncClient,
    userId,
    backend,
    persistRemoteSnapshot,
  ]);

  useEffect(() => {
    if (!isReady || localLoadFailed || !device) {
      return;
    }

    setSaveState("saving");

    const currentDevice = {
      ...device,
      lastSeenAt: new Date().toISOString(),
    };
    const context: SyncContext = { device: currentDevice, userId, backend };

    const saveTimer = window.setTimeout(() => {
      persistCurrentSnapshot()
        .then(async () => {
          if (isHydrating) {
            // Persist edits made while the remote hydration request is still
            // running, but defer the remote write until pull/merge finishes.
            setSaveState("saved");
            return;
          }
          // A failed pull must not be hidden by a follow-up push. Keep the
          // local snapshot durable and wait for manual/online retry instead.
          if (
            remoteSyncBlockedRef.current ||
            syncClient.getStatus().mode === "error"
          ) {
            setSaveState("saved");
            return;
          }

          await remoteSyncQueueRef.current.enqueue(async () => {
            // Read at queue execution, not when the debounce was scheduled.
            // Persist before sending, including revisions created while queued.
            const sending = await persistCurrentSnapshot();
            if (!sending.syncState?.pending.length) { setSaveState("saved"); return; }
            const result = await syncClient.push(sending, context);
            await persistRemoteSnapshot((current) => reconcileResult(current, result));

            if (result.status.mode === "error") {
              remoteSyncBlockedRef.current = true;
              setSaveState("error");
              setSyncStatus(result.status);
              setError(result.status.detail);
              return;
            }

            remoteSyncBlockedRef.current = false;
            setSaveState("saved");
            setSyncStatus(result.status);
            setError(null);
          });
        })
        .catch((caughtError: unknown) => {
          remoteSyncBlockedRef.current = true;
          const message =
            caughtError instanceof Error
              ? caughtError.message
              : "변경사항을 저장하지 못했습니다.";

          setError(message);
          setSaveState("error");
        });
    }, 400);

    return () => window.clearTimeout(saveTimer);
  }, [
    device,
    isHydrating,
    isReady,
    localLoadFailed,
    snapshot,
    storage,
    syncClient,
    userId,
    applyRemoteSnapshot,
    backend,
    persistCurrentSnapshot,
    persistRemoteSnapshot,
  ]);

  useEffect(() => {
    function refreshSyncStatus() {
      setSyncStatus(syncClient.getStatus());
    }

    window.addEventListener("online", refreshSyncStatus);
    window.addEventListener("offline", refreshSyncStatus);

    return () => {
      window.removeEventListener("online", refreshSyncStatus);
      window.removeEventListener("offline", refreshSyncStatus);
    };
  }, [syncClient]);

  useEffect(() => {
    if (
      !isReady ||
      isHydrating ||
      localLoadFailed ||
      remoteSyncBlockedRef.current ||
      !device
    ) {
      return;
    }

    let isMounted = true;
    const currentDevice = device;
    const context: SyncContext = { device: currentDevice, userId, backend };

    async function refreshActiveDevices() {
      const fallbackDevices = upsertDevice(snapshot.devices, {
        ...currentDevice,
        lastSeenAt: new Date().toISOString(),
      });
      const nextDevices = await syncClient.getActiveDevices(
        context,
        fallbackDevices,
      );

      if (isMounted) {
        setActiveDevices(nextDevices);
      }
    }

    void refreshActiveDevices();
    const timerId = window.setInterval(refreshActiveDevices, 15_000);

    return () => {
      isMounted = false;
      window.clearInterval(timerId);
    };
  }, [
    device,
    isHydrating,
    isReady,
    localLoadFailed,
    snapshot.devices,
    syncClient,
    userId,
    backend,
  ]);

  useEffect(() => {
    if (visibleNotes.length === 0) {
      setSelectedNoteId(null);
      return;
    }

    if (
      !selectedNoteId ||
      !visibleNotes.some((note) => note.id === selectedNoteId)
    ) {
      setSelectedNoteId(visibleNotes[0].id);
    }
  }, [selectedNoteId, visibleNotes]);

  const manualSync = useCallback(async () => {
    if (!device) {
      return;
    }

    activeManualSyncCountRef.current += 1;
    setIsManualSyncing(true);
    setSyncStatus({
      ...syncClient.getStatus(),
      mode: "syncing",
      label: "syncing",
      detail: "수동 동기화를 실행하는 중입니다.",
    });

    const context: SyncContext = { device, userId, backend };

    try {
      await remoteSyncQueueRef.current.enqueue(async () => {
        const durable = await persistCurrentSnapshot();
        const pulledSnapshot = await syncClient.pull(
          durable,
          context,
        );
        const pullStatus = syncClient.getStatus();
        if (pullStatus.mode === "error") {
          remoteSyncBlockedRef.current = true;
          setSyncStatus(pullStatus);
          setError(pullStatus.detail);
          setSaveState("error");
          return;
        }

        const rebasedSnapshot = await persistRemoteSnapshot((current) => reconcilePull(current, pulledSnapshot, durable));
        const pushResult = await syncClient.push(rebasedSnapshot, context);
        await persistRemoteSnapshot((current) => reconcileResult(current, pushResult));

        if (pushResult.status.mode === "error") {
          remoteSyncBlockedRef.current = true;
          // Keep the merged pull and any edits made while the request is in
          // flight durable, while reporting the failed remote write explicitly.
          setSyncStatus(pushResult.status);
          setError(pushResult.status.detail);
          setSaveState("error");
          return;
        }

        // A user can edit while pull or push is in flight. Rebase the result on
        // the latest ref before replacing React state so that edit is retained.
        remoteSyncBlockedRef.current = false;
        setSyncStatus(pushResult.status);
        setError(null);
        setSaveState("saved");
      });
    } catch (caughtError) {
      remoteSyncBlockedRef.current = true;
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "수동 동기화에 실패했습니다.";

      setError(message);
      setSyncStatus({
        ...syncClient.getStatus(),
        mode: "error",
        label: "error",
        detail: message,
      });
      setSaveState("error");
    } finally {
      activeManualSyncCountRef.current -= 1;
      if (activeManualSyncCountRef.current === 0) {
        setIsManualSyncing(false);
      }
    }
  }, [
    applyRemoteSnapshot,
    device,
    snapshotRef,
    storage,
    syncClient,
    userId,
    backend,
    persistCurrentSnapshot,
    persistRemoteSnapshot,
  ]);

  useEffect(() => {
    if (!isReady || isHydrating || localLoadFailed || !device) {
      return;
    }

    const handleOnline = () => {
      void manualSync();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [device, isHydrating, isReady, localLoadFailed, manualSync]);

  const saveSupabaseConfig = useCallback(
    async (config: SupabaseConfigInput) => {
      try {
        if (isManagedSupabaseConfig(activeRuntimeConfig)) {
          throw new Error(
            "앱에서 관리되는 Supabase 연결은 설정 화면에서 변경할 수 없습니다.",
          );
        }
        const nextRuntimeConfig = persistSupabaseConfig(
          config,
          activeRuntimeConfig,
        );
        const nextSyncClient = createAppSyncClient(nextRuntimeConfig);

        setRuntimeConfig(nextRuntimeConfig);
        setSyncStatus(nextSyncClient.getStatus());
        setIsReady(false);
        setSaveState("saving");
        setError(null);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Supabase 설정을 저장하지 못했습니다.";

        setError(message);
        throw caughtError;
      }
    },
    [activeRuntimeConfig],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const authState = await syncClient.signIn(email, password);
      if (!authState.userId) {
        throw new Error("인증된 사용자 ID를 확인하지 못했습니다.");
      }
      if (
        (activeRuntimeConfig.boundUserId && activeRuntimeConfig.boundUserId !== authState.userId) ||
        (snapshotRef.current.syncState?.scope && !sameScope(snapshotRef.current.syncState.scope, { backend, userId: authState.userId }))
      ) {
        await syncClient.signOut();
        throw new Error(
          "이 로컬 데이터는 다른 계정에 연결되어 있습니다. 계정 전환에는 별도 데이터 이전이 필요합니다.",
        );
      }
      const nextRuntimeConfig = bindSupabaseUser(
        authState.userId,
        activeRuntimeConfig,
      );
      setRuntimeConfig(nextRuntimeConfig);
      setAuthenticatedUserId(authState.userId);
      setAuthEmail(authState.email);
      setIsReady(false);
      setSaveState("saving");
      setError(null);
    },
    [activeRuntimeConfig, backend, snapshotRef, syncClient],
  );

  const signOut = useCallback(async () => {
    await syncClient.signOut();
    setAuthenticatedUserId(null);
    setAuthEmail(null);
    setIsReady(false);
    setAuthEpoch((current) => current + 1);
    setSyncStatus(syncClient.getStatus());
  }, [syncClient]);

  const loadFinanceDailySummaries = useCallback(
    (fromDate: string, toDate: string) =>
      syncClient.getFinanceDailySummaries(userId, fromDate, toDate),
    [syncClient, userId],
  );

  const setAutostartEnabled = useCallback(async (enabled: boolean) => {
    const result = await setDesktopAutostartEnabled(enabled);
    setAutostartSupported(result.supported);
    setAutostartState(result.enabled);

    if (result.error) {
      setError(result.error);
    }
  }, []);

  return {
    activeDevices,
    authEmail,
    autostartEnabled,
    autostartSupported,
    commitSnapshot: commitLocalSnapshot,
    device,
    error,
    isAuthenticated: Boolean(authenticatedUserId),
    isManualSyncing,
    isReady,
    isSupabaseConfigured: syncClient.isConfigured(),
    loadFinanceDailySummaries,
    manualSync,
    saveState,
    saveSupabaseConfig,
    selectedNoteId,
    setAutostartEnabled,
    setSelectedNoteId,
    signIn,
    signOut,
    snapshot,
    supabaseConfig: activeRuntimeConfig,
    syncStatus,
    userId,
  };
}
