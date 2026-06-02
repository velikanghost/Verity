import { Test, TestingModule } from "@nestjs/testing"
import { getModelToken } from "@nestjs/mongoose"
import {
  PostsService,
  MARKET_OUTCOME_WARNING,
} from "../src/modules/posts/posts.service"
import { Post } from "../src/modules/posts/posts.model"
import { User } from "../src/modules/users/users.model"
import { Market, Vote } from "../src/modules/markets/markets.model"
import { Like, Reshare } from "../src/modules/interactions/interactions.model"
import { Comment } from "../src/modules/comments/comments.model"
import { NotFoundException, UnprocessableEntityException } from "@nestjs/common"

describe("PostsService", () => {
  let service: PostsService
  let postModel: any
  let userModel: any
  let marketModel: any
  let likeModel: any
  let reshareModel: any
  let voteModel: any
  let commentModel: any

  const mockUser = {
    _id: "60d0fe4f5311236168a109ca",
    id: "60d0fe4f5311236168a109ca",
    username: "testuser",
    displayName: "Test User",
    walletAddress: "0x123",
  }

  const mockPost = {
    _id: "60d0fe4f5311236168a109cb",
    id: "60d0fe4f5311236168a109cb",
    authorId: mockUser._id,
    type: "normal",
    content: "Hello World",
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(async () => {
    const mockModel = {
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn(),
      exists: jest.fn(),
      countDocuments: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: getModelToken(Post.name), useValue: mockModel },
        { provide: getModelToken(User.name), useValue: mockModel },
        { provide: getModelToken(Market.name), useValue: mockModel },
        { provide: getModelToken(Like.name), useValue: mockModel },
        { provide: getModelToken(Reshare.name), useValue: mockModel },
        { provide: getModelToken(Vote.name), useValue: mockModel },
        { provide: getModelToken(Comment.name), useValue: mockModel },
      ],
    }).compile()

    service = module.get<PostsService>(PostsService)
    postModel = module.get(getModelToken(Post.name))
    userModel = module.get(getModelToken(User.name))
    marketModel = module.get(getModelToken(Market.name))
    likeModel = module.get(getModelToken(Like.name))
    reshareModel = module.get(getModelToken(Reshare.name))
    voteModel = module.get(getModelToken(Vote.name))
    commentModel = module.get(getModelToken(Comment.name))
  })

  describe("getMarketWarning", () => {
    it("should return warning if question has vague words", () => {
      expect(service.getMarketWarning("Will this become popular?")).toBe(
        MARKET_OUTCOME_WARNING,
      )
    })

    it("should return null for specific questions", () => {
      expect(service.getMarketWarning("Will BTC be > 100k?")).toBeNull()
    })
  })

  describe("createNormalPost", () => {
    it("should create normal post", async () => {
      userModel.exists.mockResolvedValue(true)
      postModel.create.mockResolvedValue(mockPost)
      // Mock fetchFeed within serialize/fetch
      jest.spyOn(service, "fetchFeed").mockResolvedValue([
        {
          id: mockPost.id,
          authorId: mockUser.id,
          author_id: mockUser.id,
          type: "normal",
          content: "Hello World",
          createdAt: mockPost.createdAt.toISOString(),
          created_at: mockPost.createdAt.toISOString(),
          updatedAt: mockPost.updatedAt.toISOString(),
          likesCount: 0,
          commentsCount: 0,
          resharesCount: 0,
          sharesCount: 0,
          author: {
            id: mockUser.id,
            username: mockUser.username,
            displayName: mockUser.displayName,
            display_name: mockUser.displayName,
            walletAddress: mockUser.walletAddress,
            wallet_address: mockUser.walletAddress,
            bio: "",
            avatarUrl: "",
            avatar_url: "",
            followersCount: 0,
            followingCount: 0,
          } as any,
          market: null,
          viewerLiked: false,
          viewerReshared: false,
          viewerVote: null,
        },
      ])

      const result = await service.createNormalPost(mockUser.id, "Hello World")
      expect(result.content).toBe("Hello World")
    })

    it("should throw NotFoundException if author does not exist", async () => {
      userModel.exists.mockResolvedValue(false)
      await expect(
        service.createNormalPost(mockUser.id, "Hello"),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe("createMarketPost", () => {
    it("should throw UnprocessableEntityException if missing creationFeeTxHash", async () => {
      userModel.exists.mockResolvedValue(true)
      await expect(
        service.createMarketPost(mockUser.id, {
          question: "Will BTC reach $100k?",
          category: "crypto",
          deadline: new Date().toISOString(),
          resolutionSource: "Pyth",
          yesCondition: "BTC >= $100k",
          noCondition: "BTC < $100k",
          creationFeeTxHash: "",
          feeCollectorAddress: "0xCollector",
        }),
      ).rejects.toThrow(UnprocessableEntityException)
    })
  })
})
