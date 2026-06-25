import { Injectable, Logger } from "@nestjs/common"

interface CacheEntry {
  usernames: Set<string>
  expiresAt: number
}

@Injectable()
export class TwitterVerifyService {
  private readonly logger = new Logger(TwitterVerifyService.name)
  private readonly baseUrl = "https://api.twitterapi.io"

  private readonly retweetersCache = new Map<string, CacheEntry>()
  private readonly repliesCache = new Map<string, CacheEntry>()

  private getApiKey(): string {
    return process.env.TWITTER_API_KEY || ""
  }

  private getCacheTtl(): number {
    const ttl = parseInt(process.env.TWITTER_API_CACHE_TTL_MS || "5000", 10)
    return isNaN(ttl) ? 5000 : ttl
  }

  private getRepliesPageLimit(): number {
    const limit = parseInt(
      process.env.TWITTER_API_REPLIES_PAGE_LIMIT || "1",
      10,
    )
    return isNaN(limit) ? 1 : limit
  }

  private getRetweetersPageLimit(): number {
    const limit = parseInt(
      process.env.TWITTER_API_RETWEETERS_PAGE_LIMIT || "2",
      10,
    )
    return isNaN(limit) ? 2 : limit
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

  async checkFollow(
    userTwitterHandle: string,
    targetUrlOrHandle: string,
  ): Promise<boolean> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      this.logger.warn(
        "TWITTER_API_KEY is not set. Skipping follow verification and returning false.",
      )
      return false
    }

    const source = this.extractTwitterUsername(userTwitterHandle)
    const target = this.extractTwitterUsername(targetUrlOrHandle)

    if (!source || !target) {
      this.logger.error(
        `Invalid usernames: source='${source}', target='${target}'`,
      )
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
        this.logger.error(
          `TwitterAPI.io follow check failed with status ${response.status}: ${errorText}`,
        )
        return false
      }

      const resData = (await response.json()) as any
      return resData?.data?.following === true
    } catch (error) {
      this.logger.error(
        `Error during Twitter follow verification: ${error.message}`,
        error.stack,
      )
      return false
    }
  }

  async checkRetweet(
    userTwitterHandle: string,
    tweetUrlOrId: string,
  ): Promise<boolean> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      this.logger.warn(
        "TWITTER_API_KEY is not set. Skipping retweet verification and returning false.",
      )
      return false
    }

    const sourceUser =
      this.extractTwitterUsername(userTwitterHandle).toLowerCase()
    const tweetId = this.extractTweetId(tweetUrlOrId)

    if (!sourceUser || !tweetId) {
      this.logger.error(
        `Invalid params: sourceUser='${sourceUser}', tweetId='${tweetId}'`,
      )
      return false
    }

    const cached = this.retweetersCache.get(tweetId)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.usernames.has(sourceUser)
    }

    try {
      const fetchedUsernames = new Set<string>()
      let nextToken = ""
      const pageLimit = this.getRetweetersPageLimit()

      for (let page = 1; page <= pageLimit; page++) {
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
          this.logger.error(
            `TwitterAPI.io retweeters check failed with status ${response.status}: ${errorText}`,
          )
          return false
        }

        const resData = (await response.json()) as any
        const users = resData?.users || []

        for (const user of users) {
          if (user?.userName) {
            fetchedUsernames.add(user.userName.toLowerCase())
          }
        }

        nextToken = resData?.nextToken
        if (!nextToken) {
          break
        }
      }

      this.retweetersCache.set(tweetId, {
        usernames: fetchedUsernames,
        expiresAt: Date.now() + this.getCacheTtl(),
      })

      return fetchedUsernames.has(sourceUser)
    } catch (error) {
      this.logger.error(
        `Error during Twitter retweet verification: ${error.message}`,
        error.stack,
      )
      return false
    }
  }

  async checkComment(
    userTwitterHandle: string,
    tweetUrlOrId: string,
  ): Promise<boolean> {
    const apiKey = this.getApiKey()
    if (!apiKey) {
      this.logger.warn(
        "TWITTER_API_KEY is not set. Skipping comment verification and returning false.",
      )
      return false
    }

    const sourceUser =
      this.extractTwitterUsername(userTwitterHandle).toLowerCase()
    const tweetId = this.extractTweetId(tweetUrlOrId)

    if (!sourceUser || !tweetId) {
      this.logger.error(
        `Invalid params: sourceUser='${sourceUser}', tweetId='${tweetId}'`,
      )
      return false
    }

    const cached = this.repliesCache.get(tweetId)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.usernames.has(sourceUser)
    }

    try {
      const fetchedUsernames = new Set<string>()
      let cursor = ""
      const pageLimit = this.getRepliesPageLimit()

      for (let page = 1; page <= pageLimit; page++) {
        let url = `${this.baseUrl}/twitter/tweet/replies?tweetId=${encodeURIComponent(tweetId)}`
        if (cursor) {
          url += `&cursor=${encodeURIComponent(cursor)}`
        }

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "x-api-key": apiKey,
          },
        })

        if (!response.ok) {
          const errorText = await response.text()
          this.logger.error(
            `TwitterAPI.io replies check failed with status ${response.status}: ${errorText}`,
          )
          return false
        }

        const resData = (await response.json()) as any
        const replies = resData?.replies || []

        for (const reply of replies) {
          if (reply?.author?.userName) {
            fetchedUsernames.add(reply.author.userName.toLowerCase())
          }
        }

        cursor = resData?.next_cursor
        if (!cursor || !resData?.has_more) {
          break
        }
      }

      this.repliesCache.set(tweetId, {
        usernames: fetchedUsernames,
        expiresAt: Date.now() + this.getCacheTtl(),
      })

      return fetchedUsernames.has(sourceUser)
    } catch (error) {
      this.logger.error(
        `Error during Twitter comment verification: ${error.message}`,
        error.stack,
      )
      return false
    }
  }
}
