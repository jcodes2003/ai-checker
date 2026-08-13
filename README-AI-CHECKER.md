AI Reflection Checker

This repository includes a Next.js app for teacher-led reflection grading with the OpenRouter API.

Setup

1. Install deps

```bash
npm install
```

2. Set your OpenRouter API key and optional model (Windows PowerShell example)

```powershell
$env:OPENROUTER_API_KEY = "your-api-key-here"
$env:OPENROUTER_MODEL = "openrouter/free"
npm run dev
```

Or set it persistently (PowerShell):

```powershell
setx OPENROUTER_API_KEY "your-api-key-here"
setx OPENROUTER_MODEL "openrouter/free"
```

3. Run the app

```bash
npm run dev
```

Usage

- Open `/teacher` to create the prompt and share a student link.
- Open `/student` to answer the prompt.
- The app sends the student name, question, rubric, and answer to `POST /api/ai-checker`, which calls the OpenRouter Responses API and saves the submission if Supabase is configured.

Notes

- The route reads `OPENROUTER_API_KEY` from the environment. For security, avoid committing secrets to source control.
- You can override the default model by setting `OPENROUTER_MODEL`.
- Free OpenRouter options include `openrouter/free`, `meta-llama/llama-3.2-3b-instruct:free`, `deepseek/deepseek-r1:free`, and `deepseek/deepseek-chat:free`.
- To store prompts and submissions, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` on the server, then run the SQL file in `supabase/migrations/20260812_create_reflection_submissions.sql`.
- Since the API key was shared in chat, rotate it if it was real.
