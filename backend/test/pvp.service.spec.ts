import { Test, TestingModule } from "@nestjs/testing"
import { getModelToken } from "@nestjs/mongoose"
import { PvpService } from "../src/modules/pvp/pvp.service"
import { PvpTicket, PvpMatch } from "../src/modules/pvp/pvp.model"
import {
  Market,
  MarketPosition,
  MarketTrade,
} from "../src/modules/markets/markets.model"
import { Post } from "../src/modules/posts/posts.model"
import { User } from "../src/modules/users/users.model"
import { SocketGateway } from "../src/modules/socket/socket.gateway"
import { NotificationsService } from "../src/modules/notifications/notifications.service"
import { BlockchainService } from "../src/modules/blockchain/blockchain.service"
import { LiquidityService } from "../src/modules/liquidity/liquidity.service"
import { AgentService } from "../src/modules/agent/agent.service"
import { BadRequestException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { CouponsService } from "../src/modules/coupons/coupons.service"

import { Types } from "mongoose"
import { calculatePvpResultXp } from "../src/modules/pvp/pvp-scoring"

describe("PvpService", () => {
  let service: PvpService
  let marketModel: any
  let pvpTicketModel: any
  let userModel: any

  beforeEach(async () => {
    const mockModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn(),
      exists: jest.fn(),
      countDocuments: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PvpService,
        { provide: getModelToken(PvpTicket.name), useValue: mockModel },
        { provide: getModelToken(PvpMatch.name), useValue: mockModel },
        { provide: getModelToken(Market.name), useValue: mockModel },
        { provide: getModelToken(MarketPosition.name), useValue: mockModel },
        { provide: getModelToken(MarketTrade.name), useValue: mockModel },
        { provide: getModelToken(Post.name), useValue: mockModel },
        { provide: getModelToken(User.name), useValue: mockModel },
        {
          provide: SocketGateway,
          useValue: { broadcastToRoom: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: { createNotification: jest.fn() },
        },
        {
          provide: BlockchainService,
          useValue: {
            getAdminAddress: jest.fn().mockReturnValue("0xAdmin"),
            adminCreateMarketPreDeposit: jest.fn().mockResolvedValue("0xHash"),
            registerMarket: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: LiquidityService,
          useValue: {
            initializePoolFromPreDeposit: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: AgentService,
          useValue: {
            categorizeOptions: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "NEW_USER_CUTOFF_DATE")
                return "2026-06-16T00:00:00.000Z"
              return null
            }),
          },
        },
        {
          provide: CouponsService,
          useValue: {
            validateCoupon: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<PvpService>(PvpService)
    marketModel = module.get(getModelToken(Market.name))
    pvpTicketModel = module.get(getModelToken(PvpTicket.name))
    userModel = module.get(getModelToken(User.name))
  })

  describe("submitTicket lockTime validation", () => {
    it("should throw BadRequestException if lockTime has passed", async () => {
      const mockParentMarket = {
        _id: "parent-id",
        marketType: "parent",
        category: "pvp",
        deadline: new Date(Date.now() + 1000 * 60 * 60), // 1 hour in future
        lockTime: new Date(Date.now() - 1000 * 60), // 1 minute in past
      }

      marketModel.findById.mockResolvedValue(mockParentMarket)

      await expect(
        service.submitTicket("user-id", {
          parentMarketId: "parent-id",
          picks: [
            { marketId: "child-1", selection: "YES" },
            { marketId: "child-2", selection: "NO" },
            { marketId: "child-3", selection: "YES" },
          ],
        }),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe("pvp-scoring utilities", () => {
    it("should calculate correct XP without boost and perfect score", () => {
      // win (100) + no perfect bonus (0) = 100 XP
      expect(calculatePvpResultXp("win", 3, 5, false)).toBe(100)
    })

    it("should award perfect score bonus if score equals child count", () => {
      // win (100) + perfect bonus (20) = 120 XP
      expect(calculatePvpResultXp("win", 5, 5, false)).toBe(120)
    })

    it("should apply 1.2x multiplier if boost is active", () => {
      // (win (100) + perfect bonus (20)) * 1.2 = 144 XP
      expect(calculatePvpResultXp("win", 5, 5, true)).toBe(144)
    })
  })

  describe("resolveMatch scoring and winner determination", () => {
    let mockUser1: any
    let mockUser2: any
    let mockMatch: any

    beforeEach(() => {
      mockUser1 = {
        _id: new Types.ObjectId(),
        arenaXp: 100,
        pvpTicketsSubmittedCount: 0,
        pvpMatchesWonCount: 0,
        pvpMatchesLostCount: 0,
        pvpMatchesDrawnCount: 0,
        save: jest.fn().mockResolvedValue(null),
      }
      mockUser2 = {
        _id: new Types.ObjectId(),
        arenaXp: 100,
        pvpTicketsSubmittedCount: 0,
        pvpMatchesWonCount: 0,
        pvpMatchesLostCount: 0,
        pvpMatchesDrawnCount: 0,
        save: jest.fn().mockResolvedValue(null),
      }
      mockMatch = {
        _id: new Types.ObjectId(),
        parentMarketId: new Types.ObjectId(),
        user1Id: mockUser1._id,
        user2Id: mockUser2._id,
        ticket1Id: new Types.ObjectId(),
        ticket2Id: new Types.ObjectId(),
        status: "matched",
        winnerId: null,
        resolvedAt: null,
        save: jest.fn().mockResolvedValue(null),
      }

      userModel.findById.mockImplementation((id: any) => {
        if (id.toString() === mockUser1._id.toString()) return mockUser1
        if (id.toString() === mockUser2._id.toString()) return mockUser2
        return null
      })
    })

    it("should draw when users have equal absolute scores but different accuracies", async () => {
      // User 1: 2 correct out of 5 picks (40% accuracy)
      const ticket1: any = {
        userId: mockUser1._id,
        picks: [
          { isCorrect: true },
          { isCorrect: true },
          { isCorrect: false },
          { isCorrect: false },
          { isCorrect: false },
        ],
        doubleBoostActive: false,
        save: jest.fn(),
      }
      // User 2: 2 correct out of 3 picks (66.7% accuracy)
      const ticket2: any = {
        userId: mockUser2._id,
        picks: [{ isCorrect: true }, { isCorrect: true }, { isCorrect: false }],
        doubleBoostActive: false,
        save: jest.fn(),
      }

      // 5 child markets total
      marketModel.countDocuments.mockResolvedValue(5)

      await (service as any).resolveMatch(mockMatch, ticket1, ticket2)

      // Both absolute scores are 2. So it should draw.
      expect(mockMatch.winnerId).toBeNull()
      expect(mockUser1.pvpMatchesDrawnCount).toBe(1)
      expect(mockUser2.pvpMatchesDrawnCount).toBe(1)
      expect(mockUser1.pvpMatchesWonCount).toBe(0)
      expect(mockUser2.pvpMatchesWonCount).toBe(0)

      // XP for draw is 50. Neither gets perfect bonus (2 < 5).
      expect(mockUser1.arenaXp).toBe(150) // 100 + 50
      expect(mockUser2.arenaXp).toBe(150) // 100 + 50
    })

    it("should declare winner based on more correct predictions (e.g. 3/5 beats 2/3)", async () => {
      // User 1: 3 correct out of 5 picks (score = 3)
      const ticket1: any = {
        userId: mockUser1._id,
        picks: [
          { isCorrect: true },
          { isCorrect: true },
          { isCorrect: true },
          { isCorrect: false },
          { isCorrect: false },
        ],
        doubleBoostActive: false,
        save: jest.fn(),
      }
      // User 2: 2 correct out of 3 picks (score = 2)
      const ticket2: any = {
        userId: mockUser2._id,
        picks: [{ isCorrect: true }, { isCorrect: true }, { isCorrect: false }],
        doubleBoostActive: false,
        save: jest.fn(),
      }

      marketModel.countDocuments.mockResolvedValue(5)

      await (service as any).resolveMatch(mockMatch, ticket1, ticket2)

      // User 1 wins (score 3 > 2)
      expect(mockMatch.winnerId.toString()).toBe(mockUser1._id.toString())
      expect(mockUser1.pvpMatchesWonCount).toBe(1)
      expect(mockUser2.pvpMatchesLostCount).toBe(1)

      // Win XP = 100. Loss XP = 30. No perfect score bonuses.
      expect(mockUser1.arenaXp).toBe(200) // 100 + 100
      expect(mockUser2.arenaXp).toBe(130) // 100 + 30
    })

    it("should award perfect score bonus only if user selected and correctly predicted all child markets", async () => {
      // User 1: 3 correct out of 3 picks, but total child markets is 5.
      const ticket1: any = {
        userId: mockUser1._id,
        picks: [{ isCorrect: true }, { isCorrect: true }, { isCorrect: true }],
        doubleBoostActive: false,
        save: jest.fn(),
      }
      // User 2: 5 correct out of 5 picks, total child markets is 5.
      const ticket2: any = {
        userId: mockUser2._id,
        picks: [
          { isCorrect: true },
          { isCorrect: true },
          { isCorrect: true },
          { isCorrect: true },
          { isCorrect: true },
        ],
        doubleBoostActive: false,
        save: jest.fn(),
      }

      marketModel.countDocuments.mockResolvedValue(5)

      await (service as any).resolveMatch(mockMatch, ticket1, ticket2)

      // User 2 wins (score 5 > 3)
      expect(mockMatch.winnerId.toString()).toBe(mockUser2._id.toString())

      // User 1 (loss) got 3/3, score = 3, child markets = 5.
      // Loss XP = 30. No perfect bonus because 3 !== 5.
      expect(mockUser1.arenaXp).toBe(130) // 100 + 30

      // User 2 (win) got 5/5, score = 5, child markets = 5.
      // Win XP = 100 + 20 (perfect bonus) = 120.
      expect(mockUser2.arenaXp).toBe(220) // 100 + 120
    })
  })

  describe("resolvePvpMatchesForMarket binary mapping", () => {
    it("should resolve YES selection as correct if winner outcome is the yesCondition text", async () => {
      const childMarketId = new Types.ObjectId()
      const mockChildMarket = {
        _id: childMarketId,
        outcomeCount: 2,
        outcomes: ["Team A keeps a clean sheet", "NO"],
        status: "open",
      }

      const mockTicket = {
        _id: new Types.ObjectId(),
        status: "matched",
        picks: [
          {
            marketId: childMarketId,
            selection: "YES",
            isCorrect: null,
          },
        ],
        save: jest.fn().mockResolvedValue(null),
        markModified: jest.fn(),
      }

      pvpTicketModel.find.mockResolvedValue([mockTicket])
      marketModel.findById.mockResolvedValue(mockChildMarket)

      await service.resolvePvpMatchesForMarket(
        childMarketId.toString(),
        "Team A keeps a clean sheet",
      )

      expect(mockTicket.picks[0].isCorrect).toBe(true)
      expect(mockTicket.save).toHaveBeenCalled()
    })
  })

  describe("matchmake divergence constraint", () => {
    it("should not match candidate if divergence is 0", async () => {
      const parentMarketId = new Types.ObjectId()
      const ticket: any = {
        _id: new Types.ObjectId(),
        userId: "user-1",
        parentMarketId,
        picks: [
          { marketId: "market-1", selection: "YES" },
          { marketId: "market-2", selection: "NO" },
        ],
        status: "queued",
        save: jest.fn(),
      }

      const candidate: any = {
        _id: new Types.ObjectId(),
        userId: "user-2",
        parentMarketId,
        picks: [
          { marketId: "market-1", selection: "YES" },
          { marketId: "market-2", selection: "NO" },
        ],
        status: "queued",
        save: jest.fn(),
        createdAt: new Date(),
      }

      pvpTicketModel.find.mockResolvedValue([candidate])

      const result = await service.matchmake(ticket)
      expect(result).toBeNull()
    })

    it("should match candidate if divergence is >= 1", async () => {
      const parentMarketId = new Types.ObjectId()
      const ticket: any = {
        _id: new Types.ObjectId(),
        userId: "user-1",
        parentMarketId,
        picks: [
          { marketId: "market-1", selection: "YES" },
          { marketId: "market-2", selection: "NO" },
        ],
        status: "queued",
        save: jest.fn(),
      }

      const candidate: any = {
        _id: new Types.ObjectId(),
        userId: "user-2",
        parentMarketId,
        picks: [
          { marketId: "market-1", selection: "YES" },
          { marketId: "market-2", selection: "YES" }, // Different pick -> divergence = 1
        ],
        status: "queued",
        save: jest.fn(),
        createdAt: new Date(),
      }

      const mockPvpMatch = {
        _id: new Types.ObjectId(),
        parentMarketId,
        ticket1Id: ticket._id,
        ticket2Id: candidate._id,
        user1Id: ticket.userId,
        user2Id: candidate.userId,
        divergenceScore: 1,
        status: "matched",
      }

      pvpTicketModel.find.mockResolvedValue([candidate])
      const mockPvpMatchModel = (service as any).pvpMatchModel
      jest
        .spyOn(mockPvpMatchModel, "create")
        .mockResolvedValue(mockPvpMatch as any)

      const result = await service.matchmake(ticket)
      expect(result).toEqual(mockPvpMatch)
      expect(ticket.status).toBe("matched")
      expect(candidate.status).toBe("matched")
    })
  })

  describe("welcome boosts logic", () => {
    it("should calculate correct XP using custom welcome boost multipliers", () => {
      // 2x boost: (win (100) + no perfect bonus (0)) * 2 = 200 XP
      expect(calculatePvpResultXp("win", 3, 5, true, 2.0)).toBe(200)

      // 1.5x boost: (win (100) + perfect bonus (20)) * 1.5 = 180 XP
      expect(calculatePvpResultXp("win", 5, 5, true, 1.5)).toBe(180)
    })

    it("should assign 2.0x boost for a new user's first game", async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        createdAt: new Date("2026-06-17T00:00:00.000Z"), // after cutoff
        activeBoosts: [],
      }
      const mockParentMarket = {
        _id: new Types.ObjectId(),
        marketType: "parent",
        category: "pvp",
        deadline: new Date(Date.now() + 1000 * 60 * 60),
      }

      const child1Id = new Types.ObjectId()
      const child2Id = new Types.ObjectId()
      const child3Id = new Types.ObjectId()

      userModel.findById.mockImplementation((id: any) => {
        if (id && id.toString() === mockUser._id.toString()) {
          return Promise.resolve(mockUser)
        }
        return Promise.resolve(mockParentMarket)
      })
      marketModel.find.mockResolvedValue([
        { _id: child1Id, optionGroup: "group-1" },
        { _id: child2Id, optionGroup: "group-2" },
        { _id: child3Id, optionGroup: "group-3" },
      ])
      pvpTicketModel.countDocuments.mockImplementation((query: any) => {
        if (query && query.userId) {
          return Promise.resolve(0)
        }
        return Promise.resolve(3)
      })
      pvpTicketModel.findOne.mockResolvedValue(null)

      const mockTicket = {
        _id: new Types.ObjectId(),
        userId: mockUser._id,
        parentMarketId: mockParentMarket._id,
        picks: [],
        status: "queued",
        doubleBoostActive: true,
        xpBoostMultiplier: 2.0,
      }
      pvpTicketModel.create.mockResolvedValue(mockTicket)
      jest.spyOn(service, "matchmake").mockResolvedValue(null)

      const result = await service.submitTicket(mockUser._id.toString(), {
        parentMarketId: mockParentMarket._id.toString(),
        picks: [
          { marketId: child1Id.toString(), selection: "YES" },
          { marketId: child2Id.toString(), selection: "NO" },
          { marketId: child3Id.toString(), selection: "YES" },
        ],
      })

      expect(result.doubleBoostActive).toBe(true)
      expect(pvpTicketModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          xpBoostMultiplier: 2.0,
          doubleBoostActive: true,
        }),
      )
    })

    it("should assign 1.5x boost for a new user's second game", async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        createdAt: new Date("2026-06-17T00:00:00.000Z"), // after cutoff
        activeBoosts: [],
      }
      const mockParentMarket = {
        _id: new Types.ObjectId(),
        marketType: "parent",
        category: "pvp",
        deadline: new Date(Date.now() + 1000 * 60 * 60),
      }

      const child1Id = new Types.ObjectId()
      const child2Id = new Types.ObjectId()
      const child3Id = new Types.ObjectId()

      userModel.findById.mockImplementation((id: any) => {
        if (id && id.toString() === mockUser._id.toString()) {
          return Promise.resolve(mockUser)
        }
        return Promise.resolve(mockParentMarket)
      })
      marketModel.find.mockResolvedValue([
        { _id: child1Id, optionGroup: "group-1" },
        { _id: child2Id, optionGroup: "group-2" },
        { _id: child3Id, optionGroup: "group-3" },
      ])
      pvpTicketModel.countDocuments.mockImplementation((query: any) => {
        if (query && query.userId) {
          return Promise.resolve(1)
        }
        return Promise.resolve(3)
      })
      pvpTicketModel.findOne.mockResolvedValue(null)

      const mockTicket = {
        _id: new Types.ObjectId(),
        userId: mockUser._id,
        parentMarketId: mockParentMarket._id,
        picks: [],
        status: "queued",
        doubleBoostActive: true,
        xpBoostMultiplier: 1.5,
      }
      pvpTicketModel.create.mockResolvedValue(mockTicket)
      jest.spyOn(service, "matchmake").mockResolvedValue(null)

      const result = await service.submitTicket(mockUser._id.toString(), {
        parentMarketId: mockParentMarket._id.toString(),
        picks: [
          { marketId: child1Id.toString(), selection: "YES" },
          { marketId: child2Id.toString(), selection: "NO" },
          { marketId: child3Id.toString(), selection: "YES" },
        ],
      })

      expect(result.doubleBoostActive).toBe(true)
      expect(pvpTicketModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          xpBoostMultiplier: 1.5,
          doubleBoostActive: true,
        }),
      )
    })
  })

  describe("Bronze 1.5x boost logic", () => {
    it("should assign 1.5x boost for a Bronze level user who hasn't used it", async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        createdAt: new Date("2020-01-01"),
        activeBoosts: [],
        arenaXp: 100,
        hasUsedBronzeBoost: false,
      }
      const mockParentMarket = {
        _id: new Types.ObjectId(),
        marketType: "parent",
        category: "pvp",
        deadline: new Date(Date.now() + 1000 * 60 * 60),
      }

      const child1Id = new Types.ObjectId()
      const child2Id = new Types.ObjectId()
      const child3Id = new Types.ObjectId()

      userModel.findById.mockImplementation((id: any) => {
        if (id && id.toString() === mockUser._id.toString()) {
          return Promise.resolve(mockUser)
        }
        return Promise.resolve(mockParentMarket)
      })
      userModel.findOneAndUpdate.mockResolvedValue(mockUser)
      marketModel.find.mockResolvedValue([
        { _id: child1Id, optionGroup: "group-1" },
        { _id: child2Id, optionGroup: "group-2" },
        { _id: child3Id, optionGroup: "group-3" },
      ])
      pvpTicketModel.findOne.mockResolvedValue(null)

      const mockTicket = {
        _id: new Types.ObjectId(),
        userId: mockUser._id,
        parentMarketId: mockParentMarket._id,
        picks: [],
        status: "queued",
        doubleBoostActive: true,
        xpBoostMultiplier: 1.5,
      }
      pvpTicketModel.create.mockResolvedValue(mockTicket)
      jest.spyOn(service as any, "matchmake").mockResolvedValue(null)

      const result = await service.submitTicket(mockUser._id.toString(), {
        parentMarketId: mockParentMarket._id.toString(),
        picks: [
          { marketId: child1Id.toString(), selection: "YES" },
          { marketId: child2Id.toString(), selection: "NO" },
          { marketId: child3Id.toString(), selection: "YES" },
        ],
      })

      expect(result.doubleBoostActive).toBe(true)
      expect(pvpTicketModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          xpBoostMultiplier: 1.5,
          doubleBoostActive: true,
        }),
      )
      expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: mockUser._id,
          hasUsedBronzeBoost: false,
        }),
        expect.objectContaining({ $set: { hasUsedBronzeBoost: true } }),
        expect.any(Object),
      )
    })
  })

  describe("dynamic mission boost logic", () => {
    it("should assign and consume dynamic mission boost with highest multiplier", async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        createdAt: new Date("2020-01-01"),
        activeBoosts: [
          {
            type: "match_based",
            multiplier: 1.8,
            matchesRemaining: 3,
            source: "mission",
            sourceId: "mission-id-123",
          },
          {
            type: "match_based",
            multiplier: 1.2,
            matchesRemaining: 5,
            source: "referral",
            sourceId: null,
          }
        ],
        arenaXp: 10,
        hasUsedBronzeBoost: false,
      }
      const mockParentMarket = {
        _id: new Types.ObjectId(),
        marketType: "parent",
        category: "pvp",
        deadline: new Date(Date.now() + 1000 * 60 * 60),
      }

      const child1Id = new Types.ObjectId()
      const child2Id = new Types.ObjectId()
      const child3Id = new Types.ObjectId()

      userModel.findById.mockImplementation((id: any) => {
        if (id && id.toString() === mockUser._id.toString()) {
          return Promise.resolve(mockUser)
        }
        return Promise.resolve(mockParentMarket)
      })
      userModel.findOneAndUpdate.mockResolvedValue(mockUser)
      userModel.updateOne.mockResolvedValue({ modifiedCount: 1 })
      marketModel.find.mockResolvedValue([
        { _id: child1Id, optionGroup: "group-1" },
        { _id: child2Id, optionGroup: "group-2" },
        { _id: child3Id, optionGroup: "group-3" },
      ])
      pvpTicketModel.findOne.mockResolvedValue(null)

      const mockTicket = {
        _id: new Types.ObjectId(),
        userId: mockUser._id,
        parentMarketId: mockParentMarket._id,
        picks: [],
        status: "queued",
        doubleBoostActive: true,
        xpBoostMultiplier: 1.8,
      }
      pvpTicketModel.create.mockResolvedValue(mockTicket)
      jest.spyOn(service as any, "matchmake").mockResolvedValue(null)

      const result = await service.submitTicket(mockUser._id.toString(), {
        parentMarketId: mockParentMarket._id.toString(),
        picks: [
          { marketId: child1Id.toString(), selection: "YES" },
          { marketId: child2Id.toString(), selection: "NO" },
          { marketId: child3Id.toString(), selection: "YES" },
        ],
      })

      expect(result.doubleBoostActive).toBe(true)
      expect(pvpTicketModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          xpBoostMultiplier: 1.8,
          doubleBoostActive: true,
        }),
      )
      expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: mockUser._id,
          activeBoosts: expect.objectContaining({
            $elemMatch: {
              source: "mission",
              type: "match_based",
              matchesRemaining: { $gt: 0 },
              sourceId: "mission-id-123",
            }
          })
        }),
        expect.objectContaining({ $inc: { "activeBoosts.$.matchesRemaining": -1 } }),
        expect.any(Object),
      )
    })
  })

  describe("awardReferrerFirstWinBoosts", () => {
    it("should retroactively apply boosts to active tickets and add remainder to activeBoosts", async () => {
      const mockReferredPlayer = {
        _id: new Types.ObjectId(),
        username: "referee",
        referredById: new Types.ObjectId(),
      }
      const mockReferrer = {
        _id: mockReferredPlayer.referredById,
        username: "referrer",
        activeBoosts: [] as any[],
        save: jest.fn().mockResolvedValue(true),
        markModified: jest.fn(),
      }

      const mockTicket1 = {
        _id: new Types.ObjectId(),
        doubleBoostActive: false,
        xpBoostMultiplier: 1.0,
        save: jest.fn().mockResolvedValue(true),
      }

      userModel.findById.mockResolvedValue(mockReferrer)

      const mockFindChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockTicket1]),
      }
      pvpTicketModel.find.mockReturnValue(mockFindChain)

      await (service as any).awardReferrerFirstWinBoosts(mockReferredPlayer)

      // Ticket 1 should be boosted
      expect(mockTicket1.doubleBoostActive).toBe(true)
      expect(mockTicket1.xpBoostMultiplier).toBe(1.2)
      expect(mockTicket1.save).toHaveBeenCalled()

      // Remaining boost should be added to referrer (2 earned - 1 applied = 1 remaining)
      expect(mockReferrer.activeBoosts[0].matchesRemaining).toBe(1)
      expect(mockReferrer.save).toHaveBeenCalled()
    })

    it("should add both boosts to activeBoosts if there are no active, unboosted tickets", async () => {
      const mockReferredPlayer = {
        _id: new Types.ObjectId(),
        username: "referee",
        referredById: new Types.ObjectId(),
      }
      const mockReferrer = {
        _id: mockReferredPlayer.referredById,
        username: "referrer",
        activeBoosts: [
          {
            type: "match_based",
            multiplier: 1.2,
            matchesRemaining: 1,
            source: "referral",
            category: null,
            sourceId: null,
            expiresAt: null,
          },
        ] as any[],
        save: jest.fn().mockResolvedValue(true),
        markModified: jest.fn(),
      }

      userModel.findById.mockResolvedValue(mockReferrer)

      const mockFindChain = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      }
      pvpTicketModel.find.mockReturnValue(mockFindChain)

      await (service as any).awardReferrerFirstWinBoosts(mockReferredPlayer)

      // Referral boosts added to referrer (1 + 2 = 3)
      expect(mockReferrer.activeBoosts[0].matchesRemaining).toBe(3)
      expect(mockReferrer.save).toHaveBeenCalled()
    })
  })
})
