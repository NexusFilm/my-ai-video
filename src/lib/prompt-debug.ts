// In-memory storage for last prompt sent (for debugging)
let lastPrompt = "";

export function setLastPrompt(prompt: string) {
  lastPrompt = prompt;
}

export function getLastPrompt() {
  return lastPrompt;
}
