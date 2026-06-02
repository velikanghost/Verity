import { Test, TestingModule } from "@nestjs/testing"
import { getModelToken } from "@nestjs/mongoose"
import { AuthService } from "../src/modules/auth/auth.service"
import { User } from "../src/modules/users/users.model"
import { JwtService } from "@nestjs/jwt"
import {
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from "@nestjs/common"
import * as bcrypt from "bcryptjs"

jest.mock("bcryptjs")

describe("AuthService", () => {
  let service: AuthService
  let userModel: any
  let jwtService: any

  const mockUser = {
    _id: "60d0fe4f5311236168a109ca",
    id: "60d0fe4f5311236168a109ca",
    email: "test@example.com",
    username: "testuser",
    passwordHash: "hash123",
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(async () => {
    const mockUserModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    }

    const mockJwtService = {
      sign: jest.fn().mockReturnValue("jwt_token"),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
    userModel = module.get(getModelToken(User.name))
    jwtService = module.get(JwtService)
  })

  describe("register", () => {
    it("should register a user and return token and serialized user", async () => {
      userModel.findOne.mockResolvedValue(null)
      userModel.create.mockResolvedValue(mockUser)
      ;(bcrypt.hash as jest.Mock).mockResolvedValue("hash123")

      const result = await service.register({
        email: "test@example.com",
        username: "testuser",
        password: "password",
      })

      expect(userModel.findOne).toHaveBeenCalled()
      expect(userModel.create).toHaveBeenCalled()
      expect(result.token).toBe("jwt_token")
      expect(result.user.id).toBe(mockUser.id)
    })

    it("should throw ConflictException if email/username is taken", async () => {
      userModel.findOne.mockResolvedValue(mockUser)

      await expect(
        service.register({
          email: "test@example.com",
          username: "testuser",
          password: "password",
        }),
      ).rejects.toThrow(ConflictException)
    })
  })

  describe("login", () => {
    it("should throw UnauthorizedException if user not found", async () => {
      userModel.findOne.mockResolvedValue(null)

      await expect(
        service.login({ email: "test@example.com", password: "password" }),
      ).rejects.toThrow(UnauthorizedException)
    })

    it("should throw UnauthorizedException if password does not match", async () => {
      userModel.findOne.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(false)

      await expect(
        service.login({ email: "test@example.com", password: "password" }),
      ).rejects.toThrow(UnauthorizedException)
    })

    it("should return token and user on successful login", async () => {
      userModel.findOne.mockResolvedValue(mockUser)
      ;(bcrypt.compare as jest.Mock).mockResolvedValue(true)

      const result = await service.login({
        email: "test@example.com",
        password: "password",
      })
      expect(result.token).toBe("jwt_token")
      expect(result.user.id).toBe(mockUser.id)
    })
  })

  describe("me", () => {
    it("should return serialized user if found", async () => {
      userModel.findById.mockResolvedValue(mockUser)

      const result = await service.me(mockUser.id)
      expect(result.id).toBe(mockUser.id)
    })

    it("should throw NotFoundException if user not found", async () => {
      userModel.findById.mockResolvedValue(null)

      await expect(service.me(mockUser.id)).rejects.toThrow(NotFoundException)
    })
  })
})
