import { Test, TestingModule } from "@nestjs/testing"
import { getModelToken } from "@nestjs/mongoose"
import { UsersService } from "../src/modules/users/users.service"
import { User } from "../src/modules/users/users.model"
import { NotFoundException } from "@nestjs/common"

describe("UsersService", () => {
  let service: UsersService
  let model: any

  const mockUser = {
    _id: "60d0fe4f5311236168a109ca",
    id: "60d0fe4f5311236168a109ca",
    username: "testuser",
    displayName: "Test User",
    walletAddress: "0x1234567890123456789012345678901234567890",
    bio: "Test bio",
    avatarUrl: "http://example.com/avatar.jpg",
  }

  beforeEach(async () => {
    const mockUserModel = {
      findOneAndUpdate: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findById: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
      ],
    }).compile()

    service = module.get<UsersService>(UsersService)
    model = module.get(getModelToken(User.name))
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  // describe('ensureDevUser', () => {
  //   it('should upsert dev user and return serialized object', async () => {
  //     model.findOneAndUpdate.mockResolvedValue(mockUser);
  //     const result = await service.ensureDevUser();
  //     expect(model.findOneAndUpdate).toHaveBeenCalledWith(
  //       { username: DEV_USERNAME },
  //       expect.any(Object),
  //       expect.any(Object),
  //     );
  //     expect(result).toHaveProperty('id', mockUser.id);
  //     expect(result).toHaveProperty('username', mockUser.username);
  //   });
  // });

  describe("getOrCreateByWallet", () => {
    it("should return existing user if found by wallet", async () => {
      model.findOne.mockResolvedValue(mockUser)
      const result = await service.getOrCreateByWallet(mockUser.walletAddress)
      expect(model.findOne).toHaveBeenCalledWith({
        walletAddress: mockUser.walletAddress.toLowerCase(),
      })
      expect(result).toHaveProperty("id", mockUser.id)
    })

    it("should create user if not found", async () => {
      model.findOne.mockResolvedValue(null)
      model.create.mockResolvedValue(mockUser)
      const result = await service.getOrCreateByWallet(mockUser.walletAddress)
      expect(model.create).toHaveBeenCalled()
      expect(result).toHaveProperty("id", mockUser.id)
    })
  })

  describe("updateUser", () => {
    it("should update and return serialized user", async () => {
      model.findByIdAndUpdate.mockResolvedValue(mockUser)
      const result = await service.updateUser(mockUser.id, {
        username: "newname",
        display_name: "New Name",
        bio: "new bio",
        avatar_url: "new avatar",
      })
      expect(model.findByIdAndUpdate).toHaveBeenCalled()
      expect(result).toHaveProperty("id", mockUser.id)
    })

    it("should throw NotFoundException if user to update is not found", async () => {
      model.findByIdAndUpdate.mockResolvedValue(null)
      await expect(
        service.updateUser(mockUser.id, { username: "newname" }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe("findUserById", () => {
    it("should return UserDocument if found", async () => {
      model.findById.mockResolvedValue(mockUser)
      const result = await service.findUserById(mockUser.id)
      expect(model.findById).toHaveBeenCalledWith(mockUser.id)
      expect(result).toEqual(mockUser)
    })

    it("should throw NotFoundException if not found", async () => {
      model.findById.mockResolvedValue(null)
      await expect(service.findUserById(mockUser.id)).rejects.toThrow(
        NotFoundException,
      )
    })
  })
})
