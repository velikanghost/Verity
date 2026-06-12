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

describe("PvpService", () => {
  let service: PvpService
  let marketModel: any
  let pvpTicketModel: any

  beforeEach(async () => {
    const mockModel = {
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
})
