# ClarifyAI Chrome Extension (MVP)

Submission for the Agentic AI Hackathon – qualifying round. ClarifyAI is a lightweight research co-pilot that sits inside the browser, orchestrating a team of Gemini-powered agents to help fact-check text, URLs, images, and entire pages in real time.

## 🎯 Goal
Build trust on the web by giving users a single-click, context-aware truth layer driven by agentic reasoning. The MVP demonstrates how multiple specialised agents can collaborate through a shared API to deliver responsible, explainable verdicts inside a Chrome extension UI.

## 🧠 Agentic Flow
| Stage | Agent | Responsibility |
| --- | --- | --- |
| 1 | **Popup Orchestrator** | Captures user intent (text / URL / image / current page) and dispatches the right task to the API server. |
| 2 | **FactCheckerAPI (Flask)** | Routes the request to specialised agents, normalises responses, and enforces consistent output contracts. |
| 3 | **Gemini Agents** | 
|  | `Agnet.py` | Text claim reasoning & structured verdicts. |
|  | `WebAgent.py` | URL crawling and contextual label generation. |
|  | `ImageAgent.py` | Multimodal claim extraction with `gemini-2.5-pro`. |
|  | `PageAnalyzer.py` | Full-page scrape, risk scoring, and issue detection. |
| 4 | **UI Presenter** | Renders verdict, confidence, sources, issues, and recommendations inside the popup.

Each agent runs independently but shares a unified schema (`is_correct`, `confidence_score`, `explanation`, `sources`, `issues_found`, `recommendation`) so the UX stays consistent regardless of modality.

## 🚀 Key MVP Features
- **Text Fact-Checks**: Enter any claim; receive a verdict, confidence, summary, and citations.
- **URL Intelligence**: Paste an article link; the web agent analyses credibility, sources, and bias signals.
- **Image Verification**: Upload an image; the multimodal agent extracts embedded claims and validates them.
- **Current Page Audit**: One-click analyse for the active tab, highlighting misinformation risks and mitigation advice.
- **History & Shareability**: Snapshot every result locally, copy/share highlights, and revisit previous checks.
- **Live API Health Indicator**: Extension proactively warns when the local orchestrator is offline.

## 🛠️ Getting Set Up (Local Qualifier Demo)
1. **Install dependencies**
   ```bash
   cd /Users/sahilshahajikadam/Downloads/Extension
   pip install -r requirements.txt
   ```
2. **Configure environment**
   - Create `.env` in project root with a valid `GEMINI_API_KEY` (usable across agents).
   - Optional: override `GEMINI_IMAGE_MODEL` if you have a different multimodal tier.
3. **Start the agent server**
   ```bash
   sh start_server.sh
   ```
   The Flask API boots on `http://127.0.0.1:5001` and exposes `/api/fact-check`, `/api/health`, `/api/search`, `/api/stats`.
4. **Load the Chrome extension**
   - `chrome://extensions` → enable *Developer Mode* → *Load unpacked* → select the `chrome-extension` folder.
   - Pin the ClarifyAI icon for quick access.

## 🧭 Using the MVP
1. Open the popup (`Cmd/Ctrl + Shift + F` or toolbar icon).
2. Choose a tab:
   - **Text** – paste a claim, press *Check Fact*.
   - **URL** – drop in a link, press *Analyze URL*.
   - **Image** – upload a file, press *Check Image*.
   - **Current Page** – press *Analyze Page* to audit the active tab.
3. Review the verdict card:
   - Status (True / False / Misleading / Review)
   - Confidence percentage
   - Narrative explanation + recommendation
   - Issues found (type, severity, evidence)
   - Normalised source list with outbound links
4. Copy/share summary or browse previous results in the history sidebar (future iteration).

## 📦 Project Layout (Extension Slice)
```
chrome-extension/
├── manifest.json          # MV3 configuration
├── popup.html             # Multi-tab MVP UI
├── popup.js               # UI orchestrator & API client
├── popup.css              # Dark-mode design system
├── background.js          # Hotkey + context menu bridge
├── content.js             # On-page agent hooks (future work)
└── README.md              # This document
```
Backend agents live one level up, keeping browser code lean and secure.

## ✅ MVP Completion Criteria
- Works entirely offline except for calls to Gemini APIs.
- Handles text, URL, image, and current-page checks with consistent UX.
- Gracefully reports API downtime and rate-limit errors (429s).
- Stores results locally (`chrome.storage`) for auditability.

## 🚧 Known Constraints
- Gemini quota may throttle heavy usage (returns HTTP 429).
- Page analysis depends on accessible HTML (paywalled or heavily scripted sites may degrade output).
- Multimodal agent currently supports single-image uploads; batch mode is deferred to finals.

## 🔭 Roadmap for Final Round
1. Autonomous browsing agent to gather counter-evidence.
2. Collaborative UI that suggests follow-up questions driven by agent reasoning traces.
3. Inline annotations injected into the DOM via `content.js` for transparent fact labels.
4. Prompt hardening + retrieval augmentation to mitigate hallucinations.
5. Packaging for installable beta release with opt-in telemetry.

## 🧑‍⚖️ Compliance & Ethics
- No user data leaves the device except requests to Gemini.
- Sources are cited; explanations emphasise evidence over assertion.
- Designed with transparency controls (confidence, recommendations, issues) to avoid black-box verdicts.

---
**ClarifyAI** demonstrates how agentic AI can reinforce digital trust with minimal friction. This MVP proves the multi-agent architecture, while the final round will focus on deeper autonomy, richer evidence surfacing, and cooperative research loops.
