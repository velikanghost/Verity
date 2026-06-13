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
        picks: [
          { isCorrect: true },
          { isCorrect: true },
          { isCorrect: false },
        ],
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
        picks: [
          { isCorrect: true },
          { isCorrect: true },
          { isCorrect: false },
        ],
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
        picks: [
          { isCorrect: true },
          { isCorrect: true },
          { isCorrect: true },
        ],
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
})
