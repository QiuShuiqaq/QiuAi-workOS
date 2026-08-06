# Spec: PC Digital Employee Onboarding Tutorial

## Objective
Create a short, guided onboarding tutorial for the PC desktop app that helps a new user reach the first successful digital-employee run with minimal friction.

Target user:
- enterprise users who installed QiuAI WorkOS but do not yet know how to configure models or start a task.

Success means:
- the tutorial is short, visual, step-based, and anchored to the actual UI control for each step
- each step can be acknowledged with `知道了`
- the user is never hard-blocked by the tutorial itself
- real execution still blocks on missing prerequisites when the user actually runs a task
- the user can reach the first successful digital-employee output in a small number of clicks

## Assumptions

- This tutorial is for `pc-app`, not for `admin-console` or `web-console`
- The tutorial is for digital employees first, not digital factories
- The tutorial should use the existing PC navigation and dialogs where possible
- DeepSeek is the recommended example for the model step, but not the only allowed provider
- Tutorial completion should be stored locally on the device, not on the server
- The tutorial should be replayable from the help or guidance entry point

## Tech Stack

- Electron + React + TypeScript
- Ant Design UI components
- Ant Design `Tour` for floating, target-anchored guidance
- Existing PC app bridge in `apps/pc-app`
- Existing local runtime state and client preferences

## Commands

Development and validation:

```powershell
npm run dev:pc
npm run typecheck -w @qiuai/pc-app
npm run test -w @qiuai/pc-app
npm run build -w @qiuai/pc-app
```

## Project Structure

Likely touch points:

```text
apps/pc-app/src/renderer/App.tsx
apps/pc-app/src/renderer/styles.css
apps/pc-app/src/shared/desktop-api.ts
apps/pc-app/src/main/ipc.ts
apps/pc-app/src/preload/preload.cts
docs/PC_DESKTOP_DIGITAL_EMPLOYEE_ONBOARDING_SPEC.md
```

Existing PC surfaces to reuse:
- onboarding/binding modal
- digital market
- model configuration modal
- digital employee chat/workbench
- help center or guidance entry

## Code Style

Keep the tutorial declarative and step-driven.

```ts
interface OnboardingStep {
  id: 'bind_enterprise' | 'install_employee' | 'configure_model' | 'try_employee';
  title: string;
  description: string;
  actionLabel: string;
  canSkip?: boolean;
  isComplete: (state: DesktopRuntimeState) => boolean;
  onPrimaryAction: () => Promise<void> | void;
}
```

Rules:
- keep step text short
- use imperative labels such as `下一步` and `知道了`
- prefer existing pages over new pages
- show one floating step at a time beside the relevant button, card, or input area
- auto-skip completed steps
- do not duplicate model-configuration logic
- if a target is not rendered yet, navigate to the relevant existing page and fall back gracefully

## Testing Strategy

Unit tests:
- step completion logic
- skip rules
- local completion-state persistence
- DeepSeek recommendation selection

Integration tests:
- tutorial opens the binding step when enterprise is unbound
- tutorial can jump to digital market
- tutorial can open model configuration
- tutorial can jump to the employee chat/workbench

Manual checks:
- first launch shows the floating guided flow
- clicking `知道了` never blocks the user
- the tutorial can be replayed
- existing install/configure/run behavior still works

## Boundaries

- Always: keep the tutorial short, non-blocking, and locally persisted
- Always: reuse existing PC routes and dialogs where possible
- Always: keep guidance as a floating highlight, not a large side panel
- Always: keep actual run-time prerequisite checks in the execution path, not the tutorial path
- Ask first: storing tutorial progress on the server, forcing the tutorial on every launch, changing the model selection system for the whole app, adding analytics
- Never: block app usage behind the tutorial, require a long course-like onboarding, hide the skip/acknowledge action, hard-code DeepSeek as the only supported provider

## Success Criteria

1. First-time users see a short tutorial with four steps:
   - bind enterprise
   - install one digital employee from digital market
   - configure a text model, with DeepSeek recommended
   - open the employee chat/workbench and try a sample prompt
2. Each step points at the relevant UI area and has a visible `知道了` / `下一步` flow.
3. The tutorial automatically skips steps that are already complete.
4. The tutorial does not prevent the user from closing it and using the app.
5. The tutorial state persists locally so it is not shown again after completion unless the user reopens it.
6. Existing digital employee installation, model configuration, and task execution continue to work unchanged.

## Open Questions

- Should the tutorial completion be tracked per device only, or per device plus workspace?
- Should the sample run use a specific recommended digital employee template, or the first available employee with a compatible text model?
- Should the tutorial be exposed from the help center only, or also from the digital market and workbench?
