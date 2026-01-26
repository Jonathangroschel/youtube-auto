export type ProjectKind = "clip" | "editor";

export type ProjectLibraryItem = {
  id: string;
  title: string;
  type: "VIDEO" | "EDITOR";
  kind: ProjectKind;
  createdAt: string;
  previewImage?: string | null;
};
