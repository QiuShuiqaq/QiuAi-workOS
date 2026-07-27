# ADR-017: Local asset refs and video workflow execution

## Status
Accepted

## Date
2026-07-27

## Context
QiuAI WorkOS must support richer digital employees, including workflows that read videos, images, documents, spreadsheets, and generated files. The server is a small control plane and should not store or process large enterprise assets. The Windows desktop client is the execution surface and has direct access to local user files.

Video workflows need to support this practical path:
- User drags a video into the PC chat input.
- Workflow nodes pass the local file path or a small file reference, not the video bytes.
- A local tool probes the video, extracts frame images, and exports MP4 deliverables.
- LLM nodes consume task text, metadata, extracted text, image/frame paths, and previous node outputs.
- Artifact nodes return local output paths for the chat UI.

## Decision
Use local asset references as the workflow transport model.

Workflow nodes may pass:
- `localPath`
- `uri`
- small metadata
- extracted text summaries
- generated artifact paths

Workflow nodes must not pass raw video/image/audio/document binaries through the server or through large in-memory payloads. The PC runtime resolves paths at execution time and enforces allowed local read roots where applicable.

Video processing is implemented as a desktop tool named `video-processing`. The first supported actions are:
- `video.probe`
- `video.extract_frames`
- `video.compose_clips`
- `video.export_mp4`

`video.extract_frames` and MP4 export depend on a local FFmpeg executable. FFmpeg is not bundled in this phase; missing FFmpeg must produce a clear actionable error.

## Alternatives Considered

### Upload media to the server for workflow execution
- Pros: central execution and easier server-side auditing.
- Cons: high storage and bandwidth pressure, privacy risk, and poor fit for the 40G server constraint.
- Rejected: server remains the control plane.

### Bundle FFmpeg immediately
- Pros: better out-of-box video feature success rate.
- Cons: larger installer, more packaging complexity, and platform-specific maintenance.
- Deferred: add guided FFmpeg install/config first; bundle later only if pilot feedback requires it.

### Keep video as a prompt-only workflow
- Pros: simplest implementation.
- Cons: cannot produce real MP4 deliverables and would feel fake in closed-loop testing.
- Rejected: video digital employees must execute real local tools.

## Consequences
- `admin-console` workflow templates can define file/video nodes without storing media in the backend.
- `pc-app` is responsible for resolving paths, invoking tools, producing artifacts, and showing node traces.
- Future tools should follow the same contract: small structured inputs/outputs, local paths for large assets, explicit actions, and clear failure messages.
- The default video template can be used for pilot demos, but successful editing requires the user's PC to have FFmpeg configured.
