import { useState, useCallback } from "react";
import { useFileSystem } from "./useFileSystem";
import { EditorTab } from "../types";

export function useIDE() {
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set<string>());

  const { fileTree, loading, connected, rootPath, sendMessage, setLoading } =
    useFileSystem({
      onFileContent: (path: string, content: string) => {
        // When file content is received, update or create tab
        const normalizedPath = path.startsWith(rootPath)
          ? path.slice(rootPath.length)
          : path;

        setTabs((prev) => {
          const existingTabIndex = prev.findIndex(
            (tab) => tab.path === normalizedPath
          );
          const newTab = {
            path: normalizedPath,
            content,
            language: "plaintext",
            isDirty: false,
          };

          if (existingTabIndex >= 0) {
            const newTabs = [...prev];
            newTabs[existingTabIndex] = newTab;
            return newTabs;
          }

          return [...prev, newTab];
        });

        setActiveTab(normalizedPath);
      },
    });

  const handleFileSelect = useCallback(
    (path: string) => {
      // Check if file is already open
      const existingTab = tabs.find((tab) => tab.path === path);
      if (existingTab) {
        setActiveTab(path);
      } else {
        sendMessage(
          JSON.stringify({
            type: "ReadFilePreview",
            content: { path: rootPath + path },
          })
        );
      }
    },
    [tabs, rootPath, sendMessage]
  );

  const handleTabClose = useCallback(
    (path: string) => {
      setTabs((prev) => prev.filter((tab) => tab.path !== path));
      if (activeTab === path) {
        const remainingTabs = tabs.filter((tab) => tab.path !== path);
        setActiveTab(
          remainingTabs.length > 0
            ? remainingTabs[remainingTabs.length - 1].path
            : null
        );
      }
    },
    [activeTab, tabs]
  );

  const handleFolderToggle = useCallback(
    (path: string) => {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          sendMessage(
            JSON.stringify({
              type: "GetDirectory",
              content: { path: rootPath + path },
            })
          );
        }
        return next;
      });
    },
    [rootPath, sendMessage]
  );

  const handleRefresh = useCallback(() => {
    setLoading(true);
    sendMessage(
      JSON.stringify({
        type: "RefreshDirectory",
        content: { path: rootPath || "" },
      })
    );
  }, [rootPath, sendMessage, setLoading]);

  return {
    // File explorer state
    fileTree,
    loading,
    connected,
    expandedFolders,

    // Editor state
    tabs,
    activeTab,

    // Actions
    handleFileSelect,
    handleTabClose,
    handleFolderToggle,
    handleRefresh,
  };
}
