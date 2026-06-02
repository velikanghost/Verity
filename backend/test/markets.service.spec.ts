import { Test, TestingModule } from "@nestjs/testing"
import { getModelToken } from "@nestjs/mongoose"
import { MarketsService } from "../src/modules/markets/markets.service"
import {
  Market,
  Vote,
  DailyVoteUsage,
  MarketPosition,
  MarketTrade,
} from "../src/modules/markets/markets.model"
import { User } from "../src/modules/users/users.model"
import { Post } from "../src/modules/posts/posts.model"
import { PostsService } from "../src/modules/posts/posts.service"
import { BlockchainService } from "../src/modules/blockchain/blockchain.service"
import { NotFoundException, ConflictException } from "@nestjs/common"
import { SocketGateway } from "../src/modules/socket/socket.gateway"

describe("MarketsService", () => {
  let service: MarketsService
  let marketModel: any
  let voteModel: any
  let dailyVoteUsageModel: any
  let userModel: any
  let postsService: any

  const mockMarket = {
    _id: "60d0fe4f5311236168a109cc",
    id: "60d0fe4f5311236168a109cc",
    question: "Will BTC reach $100k?",
    status: "open_for_votes",
    qualificationThreshold: 10,
    uniqueVoterThreshold: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(async () => {
    const mockModel = {
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn(),
      exists: jest.fn(),
      countDocuments: jest.fn(),
      distinct: jest.fn().mockReturnValue({
        then: jest
          .fn()
          .mockImplementation((callback) => Promise.resolve(callback([]))),
      }),
      findByIdAndUpdate: jest.fn(),
    }

    const mockPostsService = {
      serializeMarket: jest
        .fn()
        .mockImplementation((m) => ({ ...m, id: m._id })),
    }

    const mockBlockchainService = {}

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketsService,
        { provide: getModelToken(Market.name), useValue: mockModel },
        { provide: getModelToken(Vote.name), useValue: mockModel },
        { provide: getModelToken(DailyVoteUsage.name), useValue: mockModel },
        { provide: getModelToken(MarketPosition.name), useValue: mockModel },
        { provide: getModelToken(MarketTrade.name), useValue: mockModel },
        { provide: getModelToken(User.name), useValue: mockModel },
        { provide: getModelToken(Post.name), useValue: mockModel },
        { provide: PostsService, useValue: mockPostsService },
        { provide: BlockchainService, useValue: mockBlockchainService },
        {
          provide: SocketGateway,
          useValue: {
            broadcastToRoom: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<MarketsService>(MarketsService)
    marketModel = module.get(getModelToken(Market.name))
    voteModel = module.get(getModelToken(Vote.name))
    dailyVoteUsageModel = module.get(getModelToken(DailyVoteUsage.name))
    userModel = module.get(getModelToken(User.name))
    postsService = module.get(PostsService)
  })

  describe("getDailyVotes", () => {
    it("should return serialized daily usage", async () => {
      dailyVoteUsageModel.findOne.mockResolvedValue({
        votesLimit: 10,
        votesUsed: 2,
      })

      const result = await service.getDailyVotes("60d0fe4f5311236168a109ca")
      expect(result.votesLimit).toBe(10)
      expect(result.votesUsed).toBe(2)
      expect(result.votesRemaining).toBe(8)
    })
  })

  describe("castFreeVote", () => {
    it("should throw NotFoundException if market not found", async () => {
      marketModel.findById.mockResolvedValue(null)
      userModel.exists.mockResolvedValue(true)

      await expect(
        service.castFreeVote(mockMarket.id, "60d0fe4f5311236168a109ca", "YES"),
      ).rejects.toThrow(NotFoundException)
    })

    it("should throw NotFoundException if user not found", async () => {
      marketModel.findById.mockResolvedValue(mockMarket)
      userModel.exists.mockResolvedValue(false)

      await expect(
        service.castFreeVote(mockMarket.id, "60d0fe4f5311236168a109ca", "YES"),
      ).rejects.toThrow(NotFoundException)
    })

    it("should throw ConflictException if already voted", async () => {
      marketModel.findById.mockResolvedValue(mockMarket)
      userModel.exists.mockResolvedValue(true)
      voteModel.exists.mockResolvedValue(true)

      await expect(
        service.castFreeVote(mockMarket.id, "60d0fe4f5311236168a109ca", "YES"),
      ).rejects.toThrow(ConflictException)
    })
  })
})
