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
   * Search the web for information regarding the market question.
   */
  async searchWeb(query: string): Promise<string> {
    const tavilyKey = this.configService.get<string>("TAVILY_API_KEY")
    if (!tavilyKey) {
      this.logger.warn(
        "TAVILY_API_KEY is not set. Using empty search results fallback.",
      )
      return "No web search results available."
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          search_depth: "basic",
          include_answer: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`Tavily search API returned status ${response.status}`)
      }

      const data = (await response.json()) as {
        results?: Array<{ title: string; url: string; content: string }>
      }
      if (!data.results || data.results.length === 0) {
        return "No relevant search results found."
      }

      return data.results
        .slice(0, 5)
        .map(
          (r, idx) =>
            `[Source ${idx + 1}] Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.content}\n`,
        )
        .join("\n")
    } catch (error) {
      this.logger.error(`Error performing web search: ${error.message}`)
      return "Error performing web search."
    }
  }

  /**
   * Main entrypoint to resolve a market using AI.
   */
  async resolveMarket(
    question: string,
    yesCondition: string,
    noCondition: string,
    resolutionSource: string,
  ): Promise<AgentResolutionResult> {
    const provider = (
      this.configService.get<string>("LLM_PROVIDER") || "mock"
    ).toLowerCase()

    // Perform web search to gather context
    const searchContext = await this.searchWeb(question)

    const prompt = `You are an expert prediction market resolution agent. Your task is to resolve the following market question using the provided search results.

Market Question: ${question}
Yes Condition: ${yesCondition}
No Condition: ${noCondition}
Resolution Source Info: ${resolutionSource}

Search Results:
${searchContext}

Analyze the search results carefully. Determine whether the correct outcome is YES or NO. 
If the search results do not contain enough definitive information or if the outcome is still undecided/future/ambiguous, return INVALID.

You must respond with a JSON object in exactly the following format:
{
  "outcome": "YES" | "NO" | "INVALID",
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
    } else {
      // Mock Fallback for local testing/dev
      this.logger.log(`Using mock LLM resolution for question: "${question}"`)
      const lower = question.toLowerCase()
      const outcome = lower.includes("no")
        ? "NO"
        : lower.includes("invalid")
          ? "INVALID"
          : "YES"
      return {
        outcome,
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

  private parseJSONResponse(text: string): AgentResolutionResult {
    try {
      // Basic cleaning in case the LLM returned markdown blocks despite response format config
      const clean = text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*$/g, "")
        .trim()
      return JSON.parse(clean) as AgentResolutionResult
    } catch (e) {
      this.logger.error(`Failed to parse LLM JSON: ${text}`)
      throw new Error(`Invalid LLM response format: ${e.message}`)
    }
  }
}
