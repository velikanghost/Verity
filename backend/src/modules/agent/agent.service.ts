import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

export interface AgentResolutionResult {
  outcome: "YES" | "NO" | "INVALID"
  reasoning: string
  citations: string[]
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name)

  constructor(private configService: ConfigService) {}

  /**
   * Search the web for information regarding the market question using DuckDuckGo HTML.
   * Completely free, keyless, and does not require external libraries.
   */
  async searchWeb(query: string): Promise<string> {
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "max-age=0",
      "Sec-Ch-Ua":
        '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"macOS"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    }

    let lastError: any = null
    const maxAttempts = 3

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.log(
          `Attempting web search (Attempt ${attempt}/${maxAttempts}) via: ${url}`,
        )
        const response = await fetch(url, { headers })
        if (!response.ok) {
          throw new Error(`Returned status ${response.status} ${response.statusText}`)
        }
        const html = await response.text()
        const parts = html.split(
          'class="result results_links results_links_deep web-result ',
        )
        const results: Array<{ title: string; url: string; snippet: string }> =
          []

        for (let i = 1; i < parts.length; i++) {
          const part = parts[i]

          // Match title anchor tags containing title and URL
          const linkMatch =
            part.match(
              /class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/,
            ) ||
            part.match(
              /href="([^"]+)"[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/,
            )

          const snippetMatch = part.match(
            /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|span|div)>/,
          )

          if (linkMatch) {
            let rawUrl = linkMatch[1]
            const title = linkMatch[2].replace(/<[^>]*>/g, "").trim()
            const snippet = snippetMatch
              ? snippetMatch[1].replace(/<[^>]*>/g, "").trim()
              : ""

            // Extract real URL from DDG redirect parameters
            if (rawUrl.includes("uddg=")) {
              const match = rawUrl.match(/uddg=([^&]+)/)
              if (match) rawUrl = decodeURIComponent(match[1])
            }
            if (rawUrl.startsWith("//")) rawUrl = "https:" + rawUrl

            results.push({ title, url: rawUrl, snippet })
          }
        }

        if (results.length === 0) {
          throw new Error("No results could be parsed from response HTML structure.")
        }

        return results
          .slice(0, 5)
          .map(
            (r, idx) =>
              `[Source ${idx + 1}] Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}\n`,
          )
          .join("\n")
      } catch (err: any) {
        lastError = err
        this.logger.warn(
          `Web search attempt ${attempt} failed: ${err.message}`,
        )
        if (attempt < maxAttempts) {
          const delay = attempt * 1000 // exponential backoff: 1s, 2s
          this.logger.log(`Waiting ${delay}ms before retrying...`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    this.logger.error(
      `All web search attempts failed. Last error: ${lastError?.message}`,
      lastError?.stack,
    )
    if (lastError?.cause) {
      const causeMsg = lastError.cause.message || String(lastError.cause)
      this.logger.error(
        `Web search failure cause: ${causeMsg}`,
        lastError.cause.stack,
      )
    }
    return "Error performing web search."
  }


  /**
   * Main entrypoint to resolve a market using AI.
   */
  async resolveMarket(
    question: string,
    yesCondition: string,
    noCondition: string,
    resolutionSource: string,
    category?: string,
    outcomes?: string[],
  ): Promise<AgentResolutionResult> {
    const provider = (
      this.configService.get<string>("LLM_PROVIDER") || "mock"
    ).toLowerCase()

    let cleanQuestion = question
    // Map common PvP suffixes to clearer search terms
    if (cleanQuestion.includes(" - Major")) {
      cleanQuestion = cleanQuestion.replace(" - Major", " Match Winner")
    } else if (cleanQuestion.includes(" - First Goal")) {
      cleanQuestion = cleanQuestion.replace(" - First Goal", " First Team to Score")
    } else if (cleanQuestion.includes(" - Red Card")) {
      cleanQuestion = cleanQuestion.replace(" - Red Card", " Red Card")
    } else if (cleanQuestion.includes(" - Yellow Cards") || cleanQuestion.includes(" - Cards")) {
      cleanQuestion = cleanQuestion.replace(/ - (Yellow Cards|Cards)/g, " Yellow Cards")
    } else if (cleanQuestion.includes(" - Corners")) {
      cleanQuestion = cleanQuestion.replace(" - Corners", " Corners")
    } else if (cleanQuestion.includes(" - Goals")) {
      cleanQuestion = cleanQuestion.replace(" - Goals", " Goals")
    } else if (cleanQuestion.includes(" - Spread")) {
      cleanQuestion = cleanQuestion.replace(" - Spread", " Spread Winner")
    } else if (cleanQuestion.includes(" - Totals")) {
      cleanQuestion = cleanQuestion.replace(" - Totals", " Totals")
    }

    // Extract year from resolution source, falling back to the current year
    const yearMatch = resolutionSource ? resolutionSource.match(/\b\d{4}\b/) : null
    const year = yearMatch ? yearMatch[0] : String(new Date().getFullYear())

    let searchQuery = cleanQuestion
    if (!searchQuery.includes(year)) {
      searchQuery = `${cleanQuestion} ${year}`
    }

    // Perform web search to gather context
    const searchContext = await this.searchWeb(searchQuery)

    const outcomesList = outcomes && outcomes.length > 2
      ? `Possible Outcomes (choose exactly one of these strings): ${JSON.stringify(outcomes)}`
      : `Yes Condition: ${yesCondition}\nNo Condition: ${noCondition}`

    const outcomeSchema = outcomes && outcomes.length > 2
      ? outcomes.map(o => `"${o}"`).join(" | ")
      : `"YES" | "NO"`

    const prompt = `You are an expert prediction market resolution agent. Your task is to resolve the following market question using the provided search results.

Market Question: ${cleanQuestion}
${outcomesList}
Resolution Source Info: ${resolutionSource}

Search Results:
${searchContext}

Analyze the search results carefully. Determine whether the correct outcome is YES or NO (if it's a binary market), or one of the possible outcome strings (if it's a multi-outcome market).
If the search results do not contain enough definitive information or if the outcome is still undecided/future/ambiguous, return INVALID.

You must respond with a JSON object in exactly the following format:
{
  "outcome": ${outcomeSchema} | "INVALID",
  "reasoning": "A concise explanation of the facts and why they lead to this resolution, referencing specific search results.",
  "citations": ["url1", "url2", ...]
}
Do not include any other markdown formatting, code block markers, or text outside the JSON.`

    if (provider === "openai") {
      return this.callOpenAI(prompt)
    } else if (provider === "gemini") {
      return this.callGemini(prompt)
    } else if (provider === "claude") {
      return this.callClaude(prompt)
    } else if (provider === "deepseek") {
      return this.callDeepSeek(prompt)
    } else {
      // Mock Fallback for local testing/dev
      this.logger.log(`Using mock LLM resolution for question: "${question}"`)
      let outcome: string
      if (outcomes && outcomes.length > 2) {
        if (Math.random() < 0.1) {
          outcome = "INVALID"
        } else {
          const randIdx = Math.floor(Math.random() * outcomes.length)
          outcome = outcomes[randIdx]
        }
      } else if (category === "pvp") {
        outcome = Math.random() < 0.5 ? "YES" : "NO"
      } else {
        const lower = question.toLowerCase()
        outcome = lower.includes("no")
          ? "NO"
          : lower.includes("invalid")
            ? "INVALID"
            : "YES"
      }
      return {
        outcome: outcome as any,
        reasoning: `Mock reasoning for question: ${question}. Web search returned ${searchContext.length} chars of context.`,
        citations: ["https://mock-source.com/verity"],
      }
    }
  }

  private async callOpenAI(prompt: string): Promise<AgentResolutionResult> {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY")
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set but LLM_PROVIDER is openai.")
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a prediction market resolution agent.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      throw new Error(
        `OpenAI API returned status ${response.status}: ${await response.text()}`,
      )
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error("OpenAI API returned an empty completion response.")
    }

    return this.parseJSONResponse(content)
  }

  private async callGemini(prompt: string): Promise<AgentResolutionResult> {
    const apiKey = this.configService.get<string>("GEMINI_API_KEY")
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set but LLM_PROVIDER is gemini.")
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    })

    if (!response.ok) {
      throw new Error(
        `Gemini API returned status ${response.status}: ${await response.text()}`,
      )
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!content) {
      throw new Error("Gemini API returned an empty completion response.")
    }

    return this.parseJSONResponse(content)
  }

  private async callClaude(prompt: string): Promise<AgentResolutionResult> {
    const apiKey = this.configService.get<string>("CLAUDE_API_KEY")
    if (!apiKey) {
      throw new Error("CLAUDE_API_KEY is not set but LLM_PROVIDER is claude.")
    }

    const modelName =
      this.configService.get<string>("CLAUDE_MODEL") ||
      "claude-3-5-sonnet-latest"

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) {
      throw new Error(
        `Claude API returned status ${response.status}: ${await response.text()}`,
      )
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>
    }
    const content = data.content?.find((c) => c.type === "text")?.text
    if (!content) {
      throw new Error("Claude API returned an empty completion response.")
    }

    return this.parseJSONResponse(content)
  }

  private async callDeepSeek(prompt: string): Promise<AgentResolutionResult> {
    const apiKey = this.configService.get<string>("DEEPSEEK_API_KEY")
    if (!apiKey) {
      throw new Error(
        "DEEPSEEK_API_KEY is not set but LLM_PROVIDER is deepseek.",
      )
    }

    const modelName =
      this.configService.get<string>("DEEPSEEK_MODEL") || "deepseek-chat"

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: "system",
            content: "You are a prediction market resolution agent.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      throw new Error(
        `DeepSeek API returned status ${response.status}: ${await response.text()}`,
      )
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error("DeepSeek API returned an empty completion response.")
    }

    return this.parseJSONResponse(content)
  }

  async categorizeOptions(
    question: string,
    options: string[],
  ): Promise<Record<string, string>> {
    const provider = (
      this.configService.get<string>("LLM_PROVIDER") || "mock"
    ).toLowerCase()

    const prompt = `You are a prediction market structuring expert. Your task is to analyze a list of prediction options for a sports or pop culture matchup event and group them into logical categories.

Match Question: ${question}

Options:
${options.map((opt, idx) => `${idx + 1}. ${opt}`).join("\n")}

Rule for grouping:
- Options that are mutually exclusive (e.g., "Team A wins", "Team B wins", "Draw") or highly correlated outcomes of the same sub-event (e.g., "Team A scores first goal", "Team B scores first goal") MUST be placed in the same category group.
- Provide a concise group identifier (lowercase, alphanumeric, using snake_case like "match_winner", "first_goal", "halftime_leader") for each category group.
- If an option is completely independent and does not share mutual exclusivity or correlation with any other option in the list, assign it a unique group ID (e.g. based on its own name or "independent_1", "independent_2").

You must respond with a JSON object mapping each exact option name to its assigned group ID. Format:
{
  "option_name_1": "group_id",
  "option_name_2": "group_id",
  ...
}
Do not include any other markdown formatting, code block markers, or text outside the JSON.`

    if (provider === "mock") {
      this.logger.log(
        `Using mock LLM options categorization for question: "${question}"`,
      )
      return this.mockCategorize(options)
    }

    try {
      let content = ""
      if (provider === "openai") {
        const apiKey = this.configService.get<string>("OPENAI_API_KEY")
        if (!apiKey) throw new Error("OPENAI_API_KEY is not set.")
        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: "You are a prediction market structuring expert.",
                },
                { role: "user", content: prompt },
              ],
              response_format: { type: "json_object" },
            }),
          },
        )
        if (!response.ok)
          throw new Error(`OpenAI API returned status ${response.status}`)
        const data = await response.json()
        content = data.choices?.[0]?.message?.content || ""
      } else if (provider === "gemini") {
        const apiKey = this.configService.get<string>("GEMINI_API_KEY")
        if (!apiKey) throw new Error("GEMINI_API_KEY is not set.")
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        })
        if (!response.ok)
          throw new Error(`Gemini API returned status ${response.status}`)
        const data = await response.json()
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
      } else if (provider === "claude") {
        const apiKey = this.configService.get<string>("CLAUDE_API_KEY")
        if (!apiKey) throw new Error("CLAUDE_API_KEY is not set.")
        const modelName =
          this.configService.get<string>("CLAUDE_MODEL") ||
          "claude-3-5-sonnet-latest"
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: modelName,
            max_tokens: 1000,
            messages: [{ role: "user", content: prompt }],
          }),
        })
        if (!response.ok)
          throw new Error(`Claude API returned status ${response.status}`)
        const data = await response.json()
        content = data.content?.find((c) => c.type === "text")?.text || ""
      } else if (provider === "deepseek") {
        const apiKey = this.configService.get<string>("DEEPSEEK_API_KEY")
        if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set.")
        const modelName =
          this.configService.get<string>("DEEPSEEK_MODEL") || "deepseek-chat"
        const response = await fetch(
          "https://api.deepseek.com/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                {
                  role: "system",
                  content: "You are a prediction market structuring expert.",
                },
                { role: "user", content: prompt },
              ],
              response_format: { type: "json_object" },
            }),
          },
        )
        if (!response.ok)
          throw new Error(`DeepSeek API returned status ${response.status}`)
        const data = await response.json()
        content = data.choices?.[0]?.message?.content || ""
      }

      const clean = content
        .replace(/```json\s*/gi, "")
        .replace(/```\s*$/g, "")
        .trim()
      return JSON.parse(clean) as Record<string, string>
    } catch (err) {
      this.logger.error(
        `AI option categorization failed, falling back to mock: ${err.message}`,
      )
      return this.mockCategorize(options)
    }
  }

  private mockCategorize(options: string[]): Record<string, string> {
    const mapping: Record<string, string> = {}
    options.forEach((opt) => {
      const name = opt.toLowerCase()
      if (name.includes("win") || name.includes("draw")) {
        mapping[opt] = "match_winner"
      } else if (name.includes("goal") || name.includes("score first") || name.includes("scores first")) {
        mapping[opt] = "first_goal"
      } else if (name.includes("halftime")) {
        mapping[opt] = "halftime_leader"
      } else if (name.includes("clean sheet")) {
        mapping[opt] = "clean_sheet"
      } else if (name.includes("red card")) {
        mapping[opt] = "red_card"
      } else if (
        name.includes("yellow card") ||
        name.includes("yellow cards") ||
        name.includes("card") ||
        name.includes("cards")
      ) {
        mapping[opt] = "cards"
      } else if (name.includes("corner") || name.includes("corners")) {
        mapping[opt] = "corners"
      } else {
        mapping[opt] = `unique_${opt.replace(/\s+/g, "_").toLowerCase()}`
      }
    })
    return mapping
  }

  private parseJSONResponse(text: string): AgentResolutionResult {
    try {
      // Basic cleaning in case the LLM returned markdown blocks despite response format config
      const clean = text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*$/g, "")
        .trim()
      return JSON.parse(clean) as any
    } catch (e) {
      this.logger.error(`Failed to parse LLM JSON: ${text}`)
      throw new Error(`Invalid LLM response format: ${e.message}`)
    }
  }
}
