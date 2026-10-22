import React, { useCallback, useEffect, useRef, useState } from "react";
import { analyzeCharacterImageUrl } from "./character-image-assessment";
import { humanoidChibiAnalysisAdapter } from "./reference-analysis";
import { buildHumanoidStyleDna } from "./final-build-workflow";
import { createReferenceIntent } from "./reference-intent";
import { ModelPreview } from "./ModelPreview";
import "./minimal-studio.css";

const API = `${window.location.protocol}//${window.location.hostname}:3001`;
type View = "image" | "model" | "animations";
type Upload = {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
};
type Job = {
  id: string;
  stages: Record<
    string,
    { status: string; error?: { message: string; details?: string } }
  >;
};
type Result = {
  job: Job;
  metadata: { previewUrl: string; downloadUrl: string };
  validation: { valid: boolean; errors: string[] };
};
const labels: Record<View, string> = {
  image: "Uploaded image",
  model: "3D model",
  animations: "Animations",
};
const progress: Record<string, string> = {
  model: "Converting to a 3D model…",
  rig: "Adding a skeleton…",
  animate: "Applying animations…",
  validate: "Checking your model…",
  export: "Preparing your download…",
};

async function request<T>(
  path: string,
  signal: AbortSignal,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    signal,
    ...(body !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false)
    throw new Error(
      data.error ??
        `The service could not complete this request (${response.status}).`,
    );
  return data as T;
}
function artifactUrl(path: string) {
  const url = new URL(path, API);
  if (url.origin !== API)
    throw new Error("The service returned an unexpected model location.");
  return url.href;
}

export function MinimalStudio() {
  const [view, setView] = useState<View>("image");
  const [upload, setUpload] = useState<Upload | null>(null);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmHumanoid, setConfirmHumanoid] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [clips, setClips] = useState<string[]>([]);
  const [clip, setClip] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const current = useRef<Upload | null>(null);
  const run = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const onClips = useCallback((names: string[]) => {
    setClips(names);
    setClip((selected) =>
      selected && names.includes(selected) ? selected : (names[0] ?? null),
    );
  }, []);
  useEffect(
    () => () => {
      run.current++;
      controller.current?.abort();
      if (current.current) URL.revokeObjectURL(current.current.url);
    },
    [],
  );

  function cancel() {
    run.current++;
    controller.current?.abort();
    setBusy(false);
    setConfirmHumanoid(false);
    setResult(null);
    setClips([]);
    setClip(null);
    setStatus("");
  }
  async function choose(file?: File) {
    if (!file) return;
    cancel();
    setError("");
    const ticket = run.current;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    ) {
      setError("Choose a PNG, JPG or WebP image up to 15 MB.");
      return;
    }
    setBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () =>
          reject(
            new Error("This image could not be opened. Try another file."),
          );
        image.src = url;
      });
      if (ticket !== run.current) {
        URL.revokeObjectURL(url);
        return;
      }
      if (current.current) URL.revokeObjectURL(current.current.url);
      const next = {
        id: `upload-${Date.now()}-${crypto.getRandomValues(new Uint32Array(2)).join("-")}`,
        url,
        name: file.name,
        type: file.type,
        size: file.size,
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
      current.current = next;
      setUpload(next);
      setDescription("");
      setView("image");
    } catch (reason) {
      URL.revokeObjectURL(url);
      if (ticket === run.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to open this image.",
        );
    } finally {
      if (ticket === run.current) setBusy(false);
    }
  }
  async function convert(acceptedHumanoid = false) {
    if (!upload) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const ticket = ++run.current;
    let poll: ReturnType<typeof setTimeout> | undefined;
    setBusy(true);
    setError("");
    setResult(null);
    setClips([]);
    setConfirmHumanoid(false);
    setView("model");
    setStatus("Reading your image…");
    try {
      const generic = await analyzeCharacterImageUrl(upload.url, {
        description,
      });
      if (ticket !== run.current) return;
      if (generic.input.usability.value === "unusable") {
        throw new Error(
          "We could not find a clear character in this image. Try a clearer reference with a plain background.",
        );
      }
      const plan = generic.bodyPlan.selected.value;
      if (plan && plan !== "unknown" && plan !== "articulated/humanoid-bipedal")
        throw new Error(
          "This shape is not supported yet. The current generator supports stylized humanoids. Try a humanoid reference.",
        );
      if ((!plan || plan === "unknown") && !acceptedHumanoid) {
        setConfirmHumanoid(true);
        setStatus(
          "We could not confidently identify the shape. Is this a humanoid character?",
        );
        return;
      }
      const analysis = await humanoidChibiAnalysisAdapter.analyzeImageUrl(
        upload.url,
      );
      if (ticket !== run.current) return;
      const styleDna = buildHumanoidStyleDna({
        source: upload.name,
        imageSize: analysis.imageSize,
        landmarks: analysis.landmarks,
      });
      const userIntent = createReferenceIntent(
        upload.id,
        description.trim() ? "described" : "skipped",
        description,
      );
      setStatus(progress.model);
      const created = await request<{ job: Job }>("/jobs", abort.signal, {
        modelTypeId: "humanoid/chibi-v1",
        input: {
          styleDna,
          analysis: {
            ...analysis,
            modelTypeSelection: {
              source: acceptedHumanoid ? "user" : "image-assessment",
              modelTypeId: "humanoid/chibi-v1",
            },
          },
          referenceSet: {
            schemaVersion: "reference-set/v1",
            modelTypeId: "humanoid/chibi-v1",
            description: userIntent.description,
            userIntent,
            references: {
              front: {
                id: upload.id,
                fileName: upload.name,
                mimeType: upload.type,
                sizeBytes: upload.size,
                width: upload.width,
                height: upload.height,
                source: "upload",
                slot: "front",
              },
            },
          },
          modelTypeConfirmation: {
            schemaVersion: "model-type-confirmation/v1",
            modelTypeId: "humanoid/chibi-v1",
            confirmedAt: new Date().toISOString(),
            source: "user",
            selectionBasis: acceptedHumanoid
              ? "explicit-humanoid-confirmation"
              : "convert-action-in-humanoid-workspace",
          },
        },
      });
      if (typeof created.job?.id !== "string")
        throw new Error(
          "The conversion service returned an incomplete response. Please try again.",
        );
      const observe = async () => {
        try {
          const { job } = await request<{ job: Job }>(
            `/jobs/${created.job.id}`,
            abort.signal,
          );
          if (ticket !== run.current) return;
          const active = Object.entries(job.stages).find(
            ([, stage]) => stage.status === "running",
          );
          if (active && progress[active[0]]) setStatus(progress[active[0]]);
        } catch {
          /* The run response remains authoritative; progress is optional. */
        }
        if (ticket === run.current && !abort.signal.aborted)
          poll = setTimeout(observe, 1500);
      };
      poll = setTimeout(observe, 800);
      const completed = await request<Result>(
        `/jobs/${created.job.id}/run`,
        abort.signal,
        {},
      );
      if (ticket !== run.current) return;
      if (!completed.validation || typeof completed.validation.valid !== "boolean")
        throw new Error("The conversion service did not return model validation. Please try again.");
      if (!completed.validation.valid)
        throw new Error(
          completed.validation.errors.join(" ") ||
            "The model did not pass quality checks. Try another reference.",
        );
      artifactUrl(completed.metadata.previewUrl);
      artifactUrl(completed.metadata.downloadUrl);
      setResult(completed);
      setStatus("Your 3D model is ready.");
    } catch (reason) {
      if (ticket === run.current && !abort.signal.aborted) {
        setError(
          reason instanceof TypeError
            ? "Could not reach the conversion service. Please try again."
            : reason instanceof Error
            ? reason.message
            : "Conversion failed. Please try again.",
        );
        setStatus("");
      }
    } finally {
      clearTimeout(poll);
      if (ticket === run.current) {
        abort.abort();
        setBusy(false);
      }
    }
  }
  function updateDescription(text: string) {
    cancel();
    setDescription(text);
    setError("");
  }
  const stageEmpty =
    view === "model"
      ? "Your 3D model will appear here"
      : "Your animations will appear here";
  return (
    <div className={`minimalStudio ${upload ? "hasUpload" : ""}`}>
      <header className="minimalHeader">
        <a className="minimalBrand" href="/" aria-label="Character Studio home">
          <span className="minimalLogo" aria-hidden="true">
            ◇
          </span>{" "}
          Character Studio
        </a>
        <a
          className="minimalAdvanced"
          href="?advanced=1&guest=1&modelType=humanoid%2Fchibi-v1"
          target="_blank"
          rel="noreferrer"
        >
          Advanced editor
        </a>
      </header>
      <main className="minimalMain">
        <div className="minimalIntro">
          <span className="minimalKicker">IMAGE TO 3D</span>
          <h1>Bring your character to life.</h1>
          <p>Upload a reference. Create a model. Explore its animations.</p>
        </div>
        <section className="minimalWorkspace" aria-label="Character workspace">
          <nav
            className="minimalTabs"
            role="tablist"
            aria-label="Workspace views"
          >
            {(Object.keys(labels) as View[]).map((id) => (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                aria-selected={view === id}
                aria-controls="workspace-panel"
                onClick={() => setView(id)}
                onKeyDown={(event) => {
                  const keys = Object.keys(labels) as View[];
                  const index = keys.indexOf(id);
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % 3
                      : event.key === "ArrowLeft"
                        ? (index + 2) % 3
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? 2
                            : -1;
                  if (next >= 0) {
                    event.preventDefault();
                    setView(keys[next]);
                    event.currentTarget.parentElement
                      ?.querySelectorAll<HTMLButtonElement>("[role=tab]")
                      [next].focus();
                  }
                }}
              >
                {labels[id]}
                {id === "image" && upload ? (
                  <span className="minimalDot" aria-label="Image uploaded" />
                ) : null}
                {id === "model" && result ? (
                  <span className="minimalDot" aria-label="Model ready" />
                ) : null}
              </button>
            ))}
          </nav>
          <div
            className="minimalPanel"
            role="tabpanel"
            id="workspace-panel"
            aria-labelledby={`tab-${view}`}
          >
            {view === "image" ? (
              upload ? (
                <div className="minimalImageResult">
                  <div className="minimalImageStage">
                    <img src={upload.url} alt="Uploaded character reference" />
                  </div>
                  <div className="minimalImageFooter">
                    <div>
                      <strong>{upload.name}</strong>
                      <span>
                        {upload.width} × {upload.height}
                      </span>
                    </div>
                    <div className="minimalImageActions">
                      <button
                        className="minimalQuiet"
                        onClick={() => input.current?.click()}
                      >
                        Replace image
                      </button>
                      <button
                        className="minimalPrimary"
                        onClick={() => void convert()}
                        disabled={busy}
                      >
                        {busy
                          ? "Converting…"
                          : result
                            ? "Convert again"
                            : "Convert to 3D"}
                      </button>
                    </div>
                  </div>
                  <details className="minimalGuidance">
                    <summary>Add a description (optional)</summary>
                    <label htmlFor="minimal-description">
                      Describe the character
                      <textarea
                        id="minimal-description"
                        rows={2}
                        maxLength={2000}
                        value={description}
                        onChange={(event) =>
                          updateDescription(event.target.value)
                        }
                        placeholder="Anything important about its shape or movement?"
                      />
                    </label>
                  </details>
                </div>
              ) : (
                <div
                  className={`minimalDropzone ${dragging ? "dragging" : ""}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    void choose(event.dataTransfer.files[0]);
                  }}
                >
                  <span className="minimalUploadIcon" aria-hidden="true">
                    ↑
                  </span>
                  <h2>Start with an image</h2>
                  <p>Drop your character here, or choose a file.</p>
                  <button
                    className="minimalPrimary"
                    onClick={() => input.current?.click()}
                  >
                    Upload image
                  </button>
                  <small>PNG, JPG or WebP · up to 15 MB</small>
                </div>
              )
            ) : result ? (
              <div className="minimalOutput">
                <ModelPreview
                  url={artifactUrl(result.metadata.previewUrl)}
                  clip={view === "animations" ? clip : null}
                  paused={paused}
                  onClips={onClips}
                />
                {view === "animations" ? (
                  <div className="minimalAnimations">
                    {clips.length ? (
                      <>
                        <div
                          className="minimalClipList"
                          aria-label="Available animations"
                        >
                          {clips.map((name) => (
                            <button
                              key={name}
                              aria-pressed={clip === name}
                              onClick={() => {
                                setClip(name);
                                setPaused(false);
                              }}
                            >
                              {name.replaceAll("_", " ")}
                            </button>
                          ))}
                        </div>
                        <button
                          className="minimalQuiet"
                          onClick={() => setPaused((value) => !value)}
                        >
                          {paused ? "Play animation" : "Pause animation"}
                        </button>
                      </>
                    ) : (
                      <p>No animation clips are available in this model yet.</p>
                    )}
                  </div>
                ) : (
                  <p className="minimalHint">Drag to rotate · scroll to zoom</p>
                )}
              </div>
            ) : (
              <div className="minimalEmpty">
                {busy ? (
                  <>
                    <span className="minimalSpinner" aria-hidden="true" />
                    <h2>{status}</h2>
                    <p>You can still view your uploaded image.</p>
                  </>
                ) : confirmHumanoid ? (
                  <>
                    <span className="minimalPlaceholderIcon" aria-hidden="true">
                      ◇
                    </span>
                    <h2>Is this a humanoid?</h2>
                    <p>{status}</p>
                    <button
                      className="minimalPrimary"
                      onClick={() => void convert(true)}
                    >
                      Yes, create a humanoid
                    </button>
                    <button
                      className="minimalQuiet"
                      onClick={() => setView("image")}
                    >
                      Back to image
                    </button>
                  </>
                ) : (
                  <>
                    <span className="minimalPlaceholderIcon" aria-hidden="true">
                      {view === "model" ? "◇" : "▷"}
                    </span>
                    <h2>{stageEmpty}</h2>
                    <p>
                      {upload
                        ? "Convert your uploaded image to get started."
                        : "Upload a character image to get started."}
                    </p>
                    <button
                      className="minimalQuiet"
                      onClick={() => setView("image")}
                    >
                      {upload ? "View uploaded image" : "Go to upload"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <input
            ref={input}
            className="minimalFileInput"
            aria-label="Upload character image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              void choose(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {error ? (
            <div className="minimalError" role="alert">
              <p>{error}</p>
              <button className="minimalQuiet" onClick={() => setView("image")}>
                Back to image
              </button>
            </div>
          ) : null}
          {result ? (
            <footer className="minimalDownload">
              <span>✓ Model and animations checked</span>
              <a
                className="minimalPrimary"
                href={artifactUrl(result.metadata.downloadUrl)}
                download
              >
                Download GLB
              </a>
            </footer>
          ) : null}
        </section>
        <p className="minimalSupport">
          Currently supports stylized humanoid characters. Other shapes are
          coming later.
        </p>
      </main>
    </div>
  );
}
