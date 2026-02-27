import type { EditorAdapter } from "./EditorAdapter";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  aiContent?: string;
  aiContentType?: string;
  applied?: boolean;
  rating?: "up" | "down";
  timestamp?: number;
}

export interface AiChatPanelProps {
  adapter: EditorAdapter;
  onClose: () => void;
  documentId?: string;
  fullScreen?: boolean;
}

export const CHAT_STORAGE_PREFIX = "drawbook-chat-";
export const MAX_STORED_MESSAGES = 50;
export const AI_PANEL_WIDTH_KEY = "drawbook-ai-panel-width";
export const MIN_PANEL_WIDTH = 280;
export const MAX_PANEL_WIDTH = 600;
export const DEFAULT_PANEL_WIDTH = 360;
