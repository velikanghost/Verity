import { Test, TestingModule } from "@nestjs/testing"
import { getModelToken } from "@nestjs/mongoose"
import { MarketsKeeperService } from "../src/modules/markets/marketskeeper.service"
import { BlockchainService } from "../src/modules/blockchain/blockchain.service"
import { AgentService } from "../src/modules/agent/agent.service"
import { Market } from "../src/modules/markets/markets.model"
import { User } from "../src/modules/users/users.model"
import { ConfigService } from "@nestjs/config"
import { SocketGateway } from "../src/modules/socket/socket.gateway"

describe("MarketsKeeperService", () => {
  let service: MarketsKeeperService
  let blockchainService: jest.Mocked<BlockchainService>
  let agentService: jest.Mocked<AgentService>
  let marketModel: any

  const mockPythMarket = {
    _id: "60d0fe4f5311236168a109ca",
    question: "Will BTC reach $100k?",
    priceFeedId:
      "0xe62665949c883f9e0f6f002eac32e00bd59dfe6c34e92a91c37d6a8322d6489",
    deadline: new Date(Date.now() - 10000), // in the past
    status: "tradable",
    isPythMarket: true,
    resolvedOutcome: null as string | null,
    resolvedByAdmin: null as string | null,
    save: jest.fn().mockResolvedValue(undefined),
  }

  const mockSubjectiveMarket = {
    _id: "70e1ff5f6422347279b210db",
    question: "Will Arsenal win the Premier League 2025/26?",
    yesCondition: "Arsenal finish top of the table",
    noCondition: "Arsenal do not finish top of the table",
    resolutionSource: "Premier League official standings",
    deadline: new Date(Date.now() - 10000),
    status: "tradable",
    isPythMarket: false,
    resolvedOutcome: null as string | null,
    resolvedByAdmin: null as string | null,
    proposalReasoning: null as string | null,
    proposalCitations: [] as string[],
    proposedOutcome: null as boolean | null,
    proposalProposer: null as string | null,
    proposalDisputer: null as string | null,
    disputed: false,
    save: jest.fn().mockResolvedValue(undefined),
  }

  beforeEach(async () => {
    const mockBlockchainService = {
      resolveMarketWithPyth: jest.fn().mockResolvedValue("0xTxHash"),
      getTransactionReceipt: jest
        .fn()
        .mockResolvedValue({ blockNumber: 12345 }),
      readOnChainMarketState: jest.fn().mockResolvedValue({
        resolved: true,
        winningIsYes: true,
        totalCollateral: BigInt(100),
      }),
      readProposal: jest.fn().mockResolvedValue({
        proposer: "0x0000000000000000000000000000000000000000",
        proposedWinningOutcome: false,
        proposalTime: BigInt(0),
        disputed: false,
        disputer: "0x0000000000000000000000000000000000000000",
        finalized: false,
      }),
      proposeResolution: jest.fn().mockResolvedValue("0xProposalTxHash"),
      finalizeResolution: jest.fn().mockResolvedValue("0xFinalizeTxHash"),
    }

    const mockAgentService = {
      resolveMarket: jest.fn().mockResolvedValue({
        outcome: "YES",
        reasoning: "Arsenal won the league according to official standings.",
        citations: ["https://premierleague.com/tables"],
      }),
    }

    const mockMarketModel = {
      find: jest.fn().mockResolvedValue([]),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketsKeeperService,
        {
          provide: getModelToken(Market.name),
          useValue: mockMarketModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            findById: jest
              .fn()
              .mockResolvedValue({ walletAddress: "0xCreatorWallet" }),
          },
        },
        {
          provide: BlockchainService,
          useValue: mockBlockchainService,
        },
        {
          provide: AgentService,
          useValue: mockAgentService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === "DISPUTE_WINDOW_SECONDS") return 120
              return null
            }),
          },
        },
        {
          provide: SocketGateway,
          useValue: {
            broadcastToRoom: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<MarketsKeeperService>(MarketsKeeperService)
    blockchainService = module.get(BlockchainService)
    agentService = module.get(AgentService)
    marketModel = module.get(getModelToken(Market.name))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("processPythMarkets", () => {
    it("should query expired Pyth markets and resolve them", async () => {
      marketModel.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockPythMarket])
        .mockResolvedValueOnce([])

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          binary: { data: ["0x1234"] },
        }),
      })
      global.fetch = mockFetch as any

      await service.processExpiredMarkets()

      expect(marketModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ isPythMarket: true }),
      )
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://benchmarks.pyth.network/v1/updates/price/",
        ),
      )
      expect(blockchainService.resolveMarketWithPyth).toHaveBeenCalledWith(
        mockPythMarket._id,
        ["0x1234"],
      )
      expect(mockPythMarket.status).toBe("resolved")
      expect(mockPythMarket.resolvedOutcome).toBe("YES")
      expect(mockPythMarket.save).toHaveBeenCalled()
    })
  })

  describe("processSubjectiveMarkets", () => {
    it("should invoke AI agent and propose resolution for subjective markets", async () => {
      // First call (Pyth markets) returns empty, second call (subjective) returns market
      marketModel.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockSubjectiveMarket])

      await service.processExpiredMarkets()

      expect(blockchainService.readProposal).toHaveBeenCalledWith(
        mockSubjectiveMarket._id,
      )
      expect(agentService.resolveMarket).toHaveBeenCalledWith(
        mockSubjectiveMarket.question,
        mockSubjectiveMarket.yesCondition,
        mockSubjectiveMarket.noCondition,
        mockSubjectiveMarket.resolutionSource,
      )
      expect(blockchainService.proposeResolution).toHaveBeenCalledWith(
        mockSubjectiveMarket._id,
        true,
      )
      expect(mockSubjectiveMarket.proposalReasoning).toBe(
        "Arsenal won the league according to official standings.",
      )
      expect(mockSubjectiveMarket.proposalCitations).toEqual([
        "https://premierleague.com/tables",
      ])
      expect(mockSubjectiveMarket.proposedOutcome).toBe(true)
      expect(mockSubjectiveMarket.status).toBe("resolving")
      expect(mockSubjectiveMarket.save).toHaveBeenCalled()
    })

    it("should skip proposal if AI agent returns INVALID", async () => {
      agentService.resolveMarket.mockResolvedValue({
        outcome: "INVALID",
        reasoning: "Cannot determine outcome.",
        citations: [],
      })
      marketModel.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockSubjectiveMarket])

      await service.processExpiredMarkets()

      expect(agentService.resolveMarket).toHaveBeenCalled()
      expect(blockchainService.proposeResolution).not.toHaveBeenCalled()
    })

    it("should finalize undisputed proposal after dispute window expires", async () => {
      // Simulate an existing proposal from 3 hours ago (past the 2hr window)
      const threeHoursAgo = Math.floor(Date.now() / 1000) - 3 * 60 * 60
      blockchainService.readProposal.mockResolvedValue({
        proposer: "0x1234567890abcdef1234567890abcdef12345678",
        proposedWinningOutcome: true,
        proposalTime: BigInt(threeHoursAgo),
        disputed: false,
        disputer: "0x0000000000000000000000000000000000000000",
        finalized: false,
      } as any)
      marketModel.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockSubjectiveMarket])

      await service.processExpiredMarkets()

      expect(blockchainService.finalizeResolution).toHaveBeenCalledWith(
        mockSubjectiveMarket._id,
      )
      expect(mockSubjectiveMarket.status).toBe("resolved")
      expect(mockSubjectiveMarket.resolvedOutcome).toBe("YES")
    })

    it("should flag disputed market in database", async () => {
      blockchainService.readProposal.mockResolvedValue({
        proposer: "0x1234567890abcdef1234567890abcdef12345678",
        proposedWinningOutcome: true,
        proposalTime: BigInt(Math.floor(Date.now() / 1000) - 60),
        disputed: true,
        disputer: "0xdisputeraddress",
        finalized: false,
      } as any)
      // Reset the disputed flag for this test
      mockSubjectiveMarket.disputed = false
      marketModel.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockSubjectiveMarket])

      await service.processExpiredMarkets()

      expect(mockSubjectiveMarket.disputed).toBe(true)
      expect(mockSubjectiveMarket.proposalDisputer).toBe("0xdisputeraddress")
      expect(mockSubjectiveMarket.status).toBe("resolving")
    })
  })
})
