import { createContext, useContext } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Workspace } from './useBudgetWorkspace';
import type { EditorState } from '../types/budget';
export interface WorkspaceContextValue extends Workspace {
  month: string;
  setMonth: Dispatch<SetStateAction<string>>;
  editor: EditorState | null;
  setEditor: Dispatch<SetStateAction<EditorState | null>>;
}
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
/** Read the active budget workspace from the application provider.
 * @returns {WorkspaceContextValue} Workspace state and actions. */
export function useWorkspace() {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) {
    throw new Error('Workspace provider is missing.');
  }
  return workspace;
}
