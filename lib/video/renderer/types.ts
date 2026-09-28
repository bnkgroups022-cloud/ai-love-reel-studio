export interface RenderAsset {
  /** Short-lived HTTPS URL (for cloud renderers). */
  url: string;
  /** Reads the bytes directly (for local renderers). */
  load(): Promise<Buffer>;
}

export interface RenderScene {
  sceneNumber: number;
  durationSeconds: number;
  image: RenderAsset;
  /** Transparent full-frame PNG with the scene's text, or null. */
  overlay: RenderAsset | null;
}

export interface RenderRequest {
  projectId: string;
  scenes: RenderScene[];
  width: number;
  height: number;
  fps: number;
}

export type RenderOutcome =
  | { state: "pending"; renderId: string; message: string }
  | { state: "done"; video: Buffer; duration: number; format: "mp4" }
  | { state: "done"; videoUrl: string; duration: number; format: "mp4" };

export interface VideoRenderer {
  readonly name: string;
  /** Starts (or fully performs) a render. */
  renderVideo(req: RenderRequest): Promise<RenderOutcome>;
  /** For asynchronous cloud renderers: checks a render started earlier. */
  checkRender?(renderId: string, expectedDuration: number): Promise<RenderOutcome>;
}

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderError";
  }
}
