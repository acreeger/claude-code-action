import type { GitHubContext } from "../github/context";
import {
  isEntityContext,
  isIssueCommentEvent,
  isPullRequestReviewCommentEvent,
  isPullRequestEvent,
  isIssuesEvent,
  isPullRequestReviewEvent,
} from "../github/context";
import { checkContainsTrigger } from "../github/validation/trigger";

export type AutoDetectedMode = "tag" | "agent";

export function detectMode(context: GitHubContext): AutoDetectedMode {
  console.log(`[DETECTOR] Starting detectMode - event: ${context.eventName}, action: ${context.eventAction}`);
  console.log(`[DETECTOR] trackProgress: ${context.inputs.trackProgress}`);
  
  // Validate track_progress usage
  if (context.inputs.trackProgress) {
    console.log(`[DETECTOR] Validating track_progress usage`);
    validateTrackProgressEvent(context);
  }

  // If track_progress is set for PR/issue events, force tag mode
  if (context.inputs.trackProgress && isEntityContext(context)) {
    if (isPullRequestEvent(context) || isIssuesEvent(context)) {
      console.log(`[DETECTOR] track_progress=true for PR/issue event - returning tag mode`);
      return "tag";
    }
  }

  // Comment events (current behavior - unchanged)
  if (isEntityContext(context)) {
    if (
      isIssueCommentEvent(context) ||
      isPullRequestReviewCommentEvent(context) ||
      isPullRequestReviewEvent(context)
    ) {
      console.log(`[DETECTOR] Comment event detected`);
      // If prompt is provided on comment events, use agent mode
      if (context.inputs.prompt) {
        console.log(`[DETECTOR] Comment event with prompt - returning agent mode`);
        return "agent";
      }
      // Default to tag mode if @claude mention found
      if (checkContainsTrigger(context)) {
        console.log(`[DETECTOR] Comment event with trigger - returning tag mode`);
        return "tag";
      }
    }
  }

  // Issue events
  if (isEntityContext(context) && isIssuesEvent(context)) {
    console.log(`[DETECTOR] Issue event detected`);
    console.log(`[DETECTOR] context.inputs.prompt type: ${typeof context.inputs.prompt}`);
    console.log(`[DETECTOR] context.inputs.prompt value: "${context.inputs.prompt}"`);
    console.log(`[DETECTOR] context.inputs.prompt length: ${context.inputs.prompt?.length}`);
    console.log(`[DETECTOR] context.inputs.prompt truthy? ${!!context.inputs.prompt}`);
    
    // If prompt is provided, use agent mode (same as PR events)
    if (context.inputs.prompt) {
      console.log(`[DETECTOR] Issue event with prompt - returning agent mode`);
      return "agent";
    }
    console.log(`[DETECTOR] No prompt detected, checking triggers`);
    
    // Check for @claude mentions or labels/assignees
    if (checkContainsTrigger(context)) {
      console.log(`[DETECTOR] Issue event with trigger - returning tag mode`);
      return "tag";
    }
  }

  // PR events (opened, synchronize, etc.)
  if (isEntityContext(context) && isPullRequestEvent(context)) {
    console.log(`[DETECTOR] PR event detected`);
    const supportedActions = [
      "opened",
      "synchronize",
      "ready_for_review",
      "reopened",
    ];
    if (context.eventAction && supportedActions.includes(context.eventAction)) {
      console.log(`[DETECTOR] PR event with supported action: ${context.eventAction}`);
      // If prompt is provided, use agent mode (default for automation)
      if (context.inputs.prompt) {
        console.log(`[DETECTOR] PR event with prompt - returning agent mode`);
        return "agent";
      }
    }
  }

  // Default to agent mode (which won't trigger without a prompt)
  console.log(`[DETECTOR] No conditions matched - returning default agent mode`);
  return "agent";
}

export function getModeDescription(mode: AutoDetectedMode): string {
  switch (mode) {
    case "tag":
      return "Interactive mode triggered by @claude mentions";
    case "agent":
      return "Direct automation mode for explicit prompts";
    default:
      return "Unknown mode";
  }
}

function validateTrackProgressEvent(context: GitHubContext): void {
  // track_progress is only valid for pull_request and issue events
  const validEvents = ["pull_request", "issues"];
  if (!validEvents.includes(context.eventName)) {
    throw new Error(
      `track_progress is only supported for pull_request and issue events. ` +
        `Current event: ${context.eventName}`,
    );
  }

  // Additionally validate PR actions
  if (context.eventName === "pull_request" && context.eventAction) {
    const validActions = [
      "opened",
      "synchronize",
      "ready_for_review",
      "reopened",
    ];
    if (!validActions.includes(context.eventAction)) {
      throw new Error(
        `track_progress for pull_request events is only supported for actions: ` +
          `${validActions.join(", ")}. Current action: ${context.eventAction}`,
      );
    }
  }
}

export function shouldUseTrackingComment(mode: AutoDetectedMode): boolean {
  return mode === "tag";
}

export function getDefaultPromptForMode(
  mode: AutoDetectedMode,
  context: GitHubContext,
): string | undefined {
  switch (mode) {
    case "tag":
      return undefined;
    case "agent":
      return context.inputs?.prompt;
    default:
      return undefined;
  }
}
