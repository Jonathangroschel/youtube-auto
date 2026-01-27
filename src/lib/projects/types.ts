export type ProjectKind = "clip" | "editor";

export type ProjectRenderStatus = "idle" | "rendering" | "complete" | "error";

export type ProjectLibraryItem = {
  id: string;
  title: string;
  type: "VIDEO" | "EDITOR";
  kind: ProjectKind;
  createdAt: string;
  previewImage?: string | null;
  status?: string | null;
  renderStatus?: ProjectRenderStatus;
  renderStage?: string | null;
  renderProgress?: number | null;
  renderJobId?: string | null;
  hasOutput?: boolean;
  downloadAvailable?: boolean;
};
