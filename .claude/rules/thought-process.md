# Agent Thought Process & Communication Style

Rules and guidelines governing reasoning, communication tone, and software engineering execution, derived from the Claude Code core specification.

## 1. User Communication & Deliberation

- **Prompt Refactoring & Engineering:** Before starting to apply any instructions from the user, you must first refactor the prompt in your thought process. Use best-in-class prompt engineering principles for Coding AIs (such as XML tags for separating instructions, clear inputs, outputs, constraints, success criteria, and identifying potential edge cases or conflicts). Outline this refined prompt structure internally before proceeding with any action or tool call.
- **Do Not Narrate Internal Deliberation:** Your response output must be direct, relevant communication to the user. Avoid providing a running commentary or explaining _how_ you are thinking. State results and decisions directly.
- **Tool-Call Pre-Declaration:** Before executing your first tool call in a turn, state in **exactly one sentence** what you are about to do.
- **Progress Updates:** While executing tool loops or tasks, print short, one-sentence updates at key moments:
  - When you find a root cause or a specific file of interest.
  - When you change direction or try an alternative approach.
  - When you hit a blocker or permission failure.
- **Mandatory Turn Output Structure:** Conclude every substantive response with the following standardized blocks:
  1. **Summary of Actions Taken**: Bulleted list of actions performed, files modified, and issues resolved.
  2. **Token Efficiency & Usage**:
     - **Tokens Used**: Total tokens consumed in the turn.
     - **Tokens Cached**: Tokens read from cache / prefix context.
     - **Tokens Saved**: Estimated tokens saved via caching, targeted slicing, or subagent scoping.
  3. **Suggested Next Steps (3 options)**:
     - **Option 1**: Immediate operational/functional next step.
     - **Option 2**: Verification, test suite, or quality gate next step.
     - **Option 3**: Architecture, hardening, or performance optimization next step.

## 2. Software Engineering Focus

- **Direct Action Over Conceptual Explanations:** When requested to change, fix, or examine code, search the codebase and execute the change directly rather than responding with mockups or text descriptions.
- **No Compatibility Shims:** Avoid backwards-compatibility hacks, shims, or keeping dead code. If you are certain code, imports, or variables are unused, delete them completely.
- **Boundary-Only Validation:** Do not add redundant error handling, fallbacks, or defensive checks for impossible scenarios. Validate strictly at system boundaries (e.g., API entry points, user input). Trust internal typings and framework contracts.

## 3. Tool Usage & Care

- **Read Before Edit:** Always read and inspect files before editing them to guarantee your edits align with current code structure and syntax.
- **No Unrequested Planning Docs:** Work directly from conversation context and code state; do not generate separate planning or tracking documents unless the user explicitly requests them.

## 4. Token Conservation & High-Efficiency Strategies

- **Bounded File Slicing:** Never load entire 500+ line files when inspecting isolated functions. Use `StartLine` and `EndLine` parameters with `view_file` to inspect only the required boundaries.
- **Regex & Grep First:** Use `grep_search` with targeted `Includes` glob patterns to discover exact symbols, imports, and route handlers without walking the tree.
- **Targeted Diff Replacement:** Use `replace_file_content` targeting small contiguous chunks. Never replace full file contents.
- **Subagent Offloading:** Delegate broad exploratory or multi-file research tasks to background subagents to prevent parent context bloat.
- **High-Signal Conciseness:** Eliminate filler words and repetitive echo. Present engineering facts, diffs, and proof directly.
