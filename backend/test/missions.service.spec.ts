import { Test, TestingModule } from "@nestjs/testing"
import { getModelToken } from "@nestjs/mongoose"
import { NotFoundException, BadRequestException } from "@nestjs/common"
import { MissionsService } from "../src/modules/missions/missions.service"
import { User } from "../src/modules/users/users.model"
import { Mission } from "../src/modules/missions/missions.model"
import { Vote, MarketTrade } from "../src/modules/markets/markets.model"
import { Comment } from "../src/modules/comments/comments.model"
import { Like } from "../src/modules/interactions/interactions.model"
import { LPPosition } from "../src/modules/liquidity/liquidity.model"
import { Post } from "../src/modules/posts/posts.model"
import { TwitterVerifyService } from "../src/modules/missions/twitter-verify.service"
import { Types } from "mongoose"

describe("MissionsService", () => {
  let service: MissionsService
  let userModelMock: any
  let missionModelMock: any
  let twitterVerifyServiceMock: any

  const mockUserId = "60d0fe4f5311236168a109ca"
  const mockUser = {
    _id: new Types.ObjectId(mockUserId),
    id: mockUserId,
    username: "testuser",
    arenaXp: 50,
    completedMissions: [],
  }

  const mockMissionId = "60d0fe4f5311236168a109cb"
  const mockMission = {
    _id: new Types.ObjectId(mockMissionId),
    title: "Test Mission",
    xpReward: 100,
    actionUrl: "https://example.com",
    isActive: true,
    toObject: function () {
      return {
        _id: this._id,
        title: this.title,
        xpReward: this.xpReward,
        actionUrl: this.actionUrl,
        isActive: this.isActive,
      }
    },
  }

  beforeEach(async () => {
    const mockUserModel = {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    }

    const mockMissionInstance = {
      save: jest.fn().mockResolvedValue(mockMission),
    }

    const mockMissionModel = jest
      .fn()
      .mockImplementation(() => mockMissionInstance) as any

    // Mock query builder for find().sort() chaining
    const mockFindQuery = {
      sort: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation(function (callback) {
        return Promise.resolve([mockMission]).then(callback)
      }),
    }
    mockMissionModel.find = jest.fn().mockReturnValue(mockFindQuery)
    mockMissionModel.findById = jest.fn()
    mockMissionModel.findByIdAndUpdate = jest.fn()
    mockMissionModel.findByIdAndDelete = jest.fn()

    const mockVoteModel = { findOne: jest.fn() }
    const mockMarketTradeModel = { findOne: jest.fn() }
    const mockCommentModel = { findOne: jest.fn() }
    const mockLikeModel = { findOne: jest.fn() }
    const mockLPPositionModel = { findOne: jest.fn() }
    const mockPostModel = { findOne: jest.fn() }
    const mockTwitterVerifyService = {
      checkFollow: jest.fn(),
      checkRetweet: jest.fn(),
      checkComment: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissionsService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Mission.name),
          useValue: mockMissionModel,
        },
        {
          provide: getModelToken(Vote.name),
          useValue: mockVoteModel,
        },
        {
          provide: getModelToken(MarketTrade.name),
          useValue: mockMarketTradeModel,
        },
        {
          provide: getModelToken(Comment.name),
          useValue: mockCommentModel,
        },
        {
          provide: getModelToken(Like.name),
          useValue: mockLikeModel,
        },
        {
          provide: getModelToken(LPPosition.name),
          useValue: mockLPPositionModel,
        },
        {
          provide: getModelToken(Post.name),
          useValue: mockPostModel,
        },
        {
          provide: TwitterVerifyService,
          useValue: mockTwitterVerifyService,
        },
      ],
    }).compile()

    service = module.get<MissionsService>(MissionsService)
    userModelMock = module.get(getModelToken(User.name))
    missionModelMock = module.get(getModelToken(Mission.name))
    twitterVerifyServiceMock = module.get<TwitterVerifyService>(TwitterVerifyService)
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("getMissions", () => {
    it("should return active missions with completion status", async () => {
      userModelMock.findById.mockResolvedValue({
        ...mockUser,
        completedMissions: [mockMissionId],
      })

      const result = await service.getMissions(mockUserId)

      expect(userModelMock.findById).toHaveBeenCalledWith(mockUserId)
      expect(missionModelMock.find).toHaveBeenCalledWith({ isActive: true })
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: mockMissionId,
        title: mockMission.title,
        xpReward: mockMission.xpReward,
        actionUrl: mockMission.actionUrl,
        isActive: true,
        missionType: "social",
        verificationKey: null,
        rewardMultiplier: null,
        rewardMatchesCount: null,
        completed: true,
      })
    })

    it("should throw NotFoundException if user not found", async () => {
      userModelMock.findById.mockResolvedValue(null)
      await expect(service.getMissions(mockUserId)).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe("completeMission", () => {
    it("should successfully complete a mission and award XP", async () => {
      userModelMock.findById.mockResolvedValue(mockUser)
      missionModelMock.findById.mockResolvedValue(mockMission)
      userModelMock.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        completedMissions: [mockMissionId],
        arenaXp: 150,
      })

      const result = await service.completeMission(mockUserId, mockMissionId)

      expect(userModelMock.findById).toHaveBeenCalledWith(mockUserId)
      expect(missionModelMock.findById).toHaveBeenCalledWith(mockMissionId)
      expect(userModelMock.findByIdAndUpdate).toHaveBeenCalledWith(
        mockUserId,
        {
          $push: { completedMissions: mockMissionId },
          $inc: { arenaXp: mockMission.xpReward },
        },
        { new: true },
      )
      expect(result).toEqual({
        xpEarned: 100,
        totalXp: 150,
        completedMissions: [mockMissionId],
      })
    })

    it("should throw BadRequestException if mission already completed", async () => {
      userModelMock.findById.mockResolvedValue({
        ...mockUser,
        completedMissions: [mockMissionId],
      })
      missionModelMock.findById.mockResolvedValue(mockMission)

      await expect(
        service.completeMission(mockUserId, mockMissionId),
      ).rejects.toThrow(BadRequestException)
    })

    it("should throw NotFoundException if mission not found or inactive", async () => {
      userModelMock.findById.mockResolvedValue(mockUser)
      missionModelMock.findById.mockResolvedValue(null)

      await expect(
        service.completeMission(mockUserId, mockMissionId),
      ).rejects.toThrow(NotFoundException)
    })

    it("should successfully complete a twitter_comment mission", async () => {
      const commentMission = {
        ...mockMission,
        missionType: "social",
        verificationKey: "twitter_comment",
      }
      userModelMock.findById.mockResolvedValue({
        ...mockUser,
        twitterUsername: "testuser",
      })
      missionModelMock.findById.mockResolvedValue(commentMission)
      twitterVerifyServiceMock.checkComment.mockResolvedValue(true)
      userModelMock.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        completedMissions: [mockMissionId],
      })

      const result = await service.completeMission(mockUserId, mockMissionId)
      expect(twitterVerifyServiceMock.checkComment).toHaveBeenCalledWith(
        "testuser",
        commentMission.actionUrl,
      )
      expect(result.completedMissions).toContain(mockMissionId)
    })

    it("should throw BadRequestException if user hasn't commented on a twitter_comment mission", async () => {
      const commentMission = {
        ...mockMission,
        missionType: "social",
        verificationKey: "twitter_comment",
      }
      userModelMock.findById.mockResolvedValue({
        ...mockUser,
        twitterUsername: "testuser",
      })
      missionModelMock.findById.mockResolvedValue(commentMission)
      twitterVerifyServiceMock.checkComment.mockResolvedValue(false)

      await expect(
        service.completeMission(mockUserId, mockMissionId),
      ).rejects.toThrow(BadRequestException)
    })

    it("should successfully complete a twitter_retweet_and_comment mission", async () => {
      const compoundMission = {
        ...mockMission,
        missionType: "social",
        verificationKey: "twitter_retweet_and_comment",
      }
      userModelMock.findById.mockResolvedValue({
        ...mockUser,
        twitterUsername: "testuser",
      })
      missionModelMock.findById.mockResolvedValue(compoundMission)
      twitterVerifyServiceMock.checkRetweet.mockResolvedValue(true)
      twitterVerifyServiceMock.checkComment.mockResolvedValue(true)
      userModelMock.findByIdAndUpdate.mockResolvedValue({
        ...mockUser,
        completedMissions: [mockMissionId],
      })

      const result = await service.completeMission(mockUserId, mockMissionId)
      expect(twitterVerifyServiceMock.checkRetweet).toHaveBeenCalledWith(
        "testuser",
        compoundMission.actionUrl,
      )
      expect(twitterVerifyServiceMock.checkComment).toHaveBeenCalledWith(
        "testuser",
        compoundMission.actionUrl,
      )
      expect(result.completedMissions).toContain(mockMissionId)
    })
  })

  describe("admin operations", () => {
    it("should update a mission", async () => {
      missionModelMock.findById.mockResolvedValue(mockMission)
      missionModelMock.findByIdAndUpdate.mockResolvedValue(mockMission)
      const result = await service.updateMission(mockMissionId, {
        title: "Updated Title",
      })
      expect(missionModelMock.findById).toHaveBeenCalledWith(mockMissionId)
      expect(missionModelMock.findByIdAndUpdate).toHaveBeenCalled()
      expect(result).toEqual(mockMission)
    })

    it("should delete a mission", async () => {
      missionModelMock.findByIdAndDelete.mockResolvedValue(mockMission)
      const result = await service.deleteMission(mockMissionId)
      expect(missionModelMock.findByIdAndDelete).toHaveBeenCalled()
      expect(result).toEqual({ success: true })
    })
  })
})
