import { Injectable, Logger } from "@nestjs/common"

@Injectable()
export class TwitterVerifyService {
  private readonly logger = new Logger(TwitterVerifyService.name)
  private readonly baseUrl = "https://api.twitterapi.io"

  private getApiKey(): string {
    return process.env.TWITTER_API_KEY || ""
  }

  extractTwitterUsername(urlOrHandle: string): string {
    const trimmed = urlOrHandle.trim()
    if (trimmed.includes("twitter.com") || trimmed.includes("x.com")) {
      const match = trimmed.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i)
      if (match && match[1]) {
        return match[1]
      }
    }
    return trimmed.replace(/^@/, "")
  }

  extractTweetId(urlOrId: string): string {
    const trimmed = urlOrId.trim()
    if (trimmed.includes("status/")) {
      const match = trimmed.match(/status\/(\d+)/i)
      if (match && match[1]) {
        return match[1]
      }
    }
    return trimmed
  }

  async checkFollow(userTwitterHandle: string, targetUrlOrHandle: string): Promise<boolean> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      this.logger.warn("TWITTER_API_KEY is not set. Skipping follow verification and returning false.")
      return false
    }

    const source = this.extractTwitterUsername(userTwitterHandle)
    const target = this.extractTwitterUsername(targetUrlOrHandle)

    if (!source || !target) {
      this.logger.error(`Invalid usernames: source='${source}', target='${target}'`)
      return false
    }

    try {
      const url = `${this.baseUrl}/twitter/user/check_follow_relationship?source_user_name=${encodeURIComponent(
        source,
      )}&target_user_name=${encodeURIComponent(target)}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        this.logger.error(`TwitterAPI.io follow check failed with status ${response.status}: ${errorText}`)
        return false
      }

      const resData = (await response.json()) as any
      return resData?.data?.following === true
    } catch (error) {
      this.logger.error(`Error during Twitter follow verification: ${error.message}`, error.stack)
      return false
    }
  }

  async checkRetweet(userTwitterHandle: string, tweetUrlOrId: string): Promise<boolean> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      this.logger.warn("TWITTER_API_KEY is not set. Skipping retweet verification and returning false.")
      return false
    }

    const sourceUser = this.extractTwitterUsername(userTwitterHandle).toLowerCase()
    const tweetId = this.extractTweetId(tweetUrlOrId)

    if (!sourceUser || !tweetId) {
      this.logger.error(`Invalid params: sourceUser='${sourceUser}', tweetId='${tweetId}'`)
      return false
    }

    try {
      let nextToken = ""
      // Limit to 2 pages (each page is typically up to 100 users) to avoid rate limits
      for (let page = 1; page <= 2; page++) {
        let url = `${this.baseUrl}/twitter/tweet/retweeters?tweetId=${encodeURIComponent(tweetId)}`
        if (nextToken) {
          url += `&nextToken=${encodeURIComponent(nextToken)}`
        }

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "x-api-key": apiKey,
          },
        })

        if (!response.ok) {
          const errorText = await response.text()
          this.logger.error(`TwitterAPI.io retweeters check failed with status ${response.status}: ${errorText}`)
          return false
        }

        const resData = (await response.json()) as any
        const users = resData?.users || []

        const hasRetweeted = users.some(
          (user: any) => user?.userName && user.userName.toLowerCase() === sourceUser,
        )

        if (hasRetweeted) {
          return true
        }

        nextToken = resData?.nextToken
        if (!nextToken) {
          break
        }
      }

      return false
    } catch (error) {
      this.logger.error(`Error during Twitter retweet verification: ${error.message}`, error.stack)
      return false
    }
  }
}
