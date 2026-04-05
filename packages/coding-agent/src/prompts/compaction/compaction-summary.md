You **MUST** summarize the conversation above into a structured context checkpoint handoff summary for another LLM to resume task.

IMPORTANT: If conversation ends with unanswered question to user or imperative/request awaiting user response (e.g., "Please run command and paste output"), you **MUST** preserve that exact question/request.

You **MUST** use this format (omit sections if not applicable):

## Goal

[What goal(s) is the user trying to accomplish? What did they ask for?]

## Instructions

- [What important instructions, constraints, or requirements did the user give that are relevant to the task?]
- [If there is a plan, spec, or design document, include information about it so the next agent can continue using it]
- [(none) if none mentioned]

## Discoveries

[What notable things were learned during this conversation that would be useful for the next agent to know when continuing the work? Include approaches tried, why they were chosen or rejected, errors encountered, and their resolutions.]

## Progress

### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Work started but not finished]

### Blocked
- [Issues preventing progress — (none) if unblocked]

## Key Decisions
- **[Decision]**: [Brief rationale for a significant choice made]
- [(none) if none made]

## Accomplished

[What work has been completed, what work is still in progress, and what work is left?]

## Relevant Files / Directories

[Construct a structured list of relevant files that have been read, edited, or created that pertain to the task at hand. If all the files in a directory are relevant, include the path to the directory.]

## Next Steps

1. [Ordered list of next actions — what should happen next to continue]

## Critical Context

- [Important data, pending questions, references, or state that the next agent needs]
- [(none) if nothing critical]

## Additional Notes

[Anything else important not covered above — repository state changes (branch, uncommitted changes), tool outputs, command results, or error messages that matter.]

---

You **MUST** output only the structured summary; you **MUST NOT** include extra text.

Sections **MUST** be kept concise. You **MUST** preserve exact file paths, function names, error messages, and relevant tool outputs or command results. You **MUST** include repository state changes (branch, uncommitted changes) if mentioned.
