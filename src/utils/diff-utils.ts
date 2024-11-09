import { diffLines, Change } from "diff";

export interface DiffChange {
  value: string;
  added: boolean;
  removed: boolean;
}

export function computeDocumentChanges(
  oldContent: string,
  newContent: string
): DiffChange[] {
  // If contents are identical, return empty changes
  if (oldContent === newContent) {
    return [];
  }

  // Get raw diff changes
  const changes = diffLines(oldContent, newContent, { newlineIsToken: true });

  // Convert to match server's format exactly
  return changes.map((change) => ({
    value: change.value,
    added: change.added || false,
    removed: change.removed || false,
  }));
}
