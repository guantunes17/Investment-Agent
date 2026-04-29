import { create } from "zustand";
import { apiFetch } from "@/lib/api";

export interface Notification {
  id: number;
  title: string;
  body: string;
  is_read: boolean;
  notification_type: string;
  metadata_json?: Record<string, unknown> | null;
  created_at: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: (unreadOnly?: boolean) => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetchNotifications: async (unreadOnly = false) => {
    set({ loading: true });
    try {
      const params = unreadOnly ? "?unread=true" : "";
      const data = await apiFetch<Notification[]>(`/notifications/${params}`);
      set({
        notifications: data,
        unreadCount: data.filter((n) => !n.is_read).length,
      });
    } finally {
      set({ loading: false });
    }
  },

  markAsRead: async (id) => {
    await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
    const notifications = get().notifications.map((n) =>
      n.id === id ? { ...n, is_read: true } : n
    );
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.is_read).length,
    });
  },

  markAllAsRead: async () => {
    await apiFetch("/notifications/read-all", { method: "PUT" });
    set({
      notifications: get().notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    });
  },

  deleteNotification: async (id) => {
    await apiFetch(`/notifications/${id}`, { method: "DELETE" });
    const notifications = get().notifications.filter((n) => n.id !== id);
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.is_read).length,
    });
  },

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));
