/**
 * Prompts Module
 *
 * Central export for all LLM prompt builders and parsers.
 * Each prompt file contains:
 * - Input/Output types
 * - buildXxxRequest() - Creates OpenRouter request params
 * - parseXxxResponse() - Parses raw LLM response
 */

/* Hook Generation */
export {
  type HookType,
  type GenerateHookInput,
  type ParsedHooks,
  buildGenerateHookRequest,
  parseHookResponse,
} from "./generateHook";

/* CTA Generation */
export {
  type CtaType,
  type GenerateCtaInput,
  type ParsedCtas,
  buildGenerateCtaRequest,
  parseCtaResponse,
} from "./generateCta";

/* Story Refinement */
export {
  type StoryContent,
  type ConversationMessage,
  type RefineStoryInput,
  type ParsedRefinement,
  buildRefineStoryRequest,
  parseRefineResponse,
} from "./refineStory";

/* Viral Content Generation */
export {
  type GenerateViralInput,
  type ParsedViralContent,
  buildGenerateViralRequest,
  parseViralResponse,
} from "./generateViral";

/* Scene Splitting */
export {
  type SplitSceneInput,
  type Scene,
  type ParsedScenes,
  buildSplitSceneRequest,
  parseSplitSceneResponse,
} from "./splitScene";
