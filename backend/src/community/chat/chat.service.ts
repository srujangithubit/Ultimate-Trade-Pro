import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RoomType, Prisma } from '@prisma/client';

const USER_SELECT = {
  id: true,
  displayName: true,
  email: true,
  reputationScore: true,
} as const;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  async saveMessage(
    userId: string,
    roomId: string,
    content: string,
    fileUrl?: string,
  ) {
    const message = await this.prisma.chatMessage.create({
      data: { userId, roomId, content, fileUrl },
      include: { user: { select: USER_SELECT } },
    });
    return {
      ...message,
      createdAt: message.createdAt.toISOString(),
    };
  }

  async getMessageHistory(roomId: string, page = 1, limit = 50) {
    const take = Math.min(limit, 50);
    const skip = (page - 1) * take;
    const messages = await this.prisma.chatMessage.findMany({
      where: { roomId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: { user: { select: USER_SELECT } },
    });
    // Return oldest first
    return messages.reverse().map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async addReaction(
    userId: string,
    messageId: string,
    emoji: string,
  ): Promise<Record<string, string[]>> {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });
    if (!message) throw new NotFoundException('Message not found');

    const reactions = (message.reactions as Record<string, string[]>) ?? {};
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }

    const idx = reactions[emoji].indexOf(userId);
    if (idx >= 0) {
      reactions[emoji].splice(idx, 1);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji].push(userId);
    }

    await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { reactions: reactions as Prisma.InputJsonValue },
    });

    return reactions;
  }

  async getRoomInfo(roomId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
    });
    if (!room) throw new NotFoundException('Chat room not found');
    return room;
  }

  async createSymbolRoom(symbol: string) {
    return this.prisma.chatRoom.upsert({
      where: { symbol },
      create: { name: symbol, type: RoomType.SYMBOL, symbol },
      update: {},
    });
  }

  async getOrCreateGlobalRoom() {
    const existing = await this.prisma.chatRoom.findFirst({
      where: { type: RoomType.GLOBAL },
    });
    if (existing) return existing;
    return this.prisma.chatRoom.create({
      data: { name: 'Global', type: RoomType.GLOBAL },
    });
  }

  async getAllRooms() {
    return this.prisma.chatRoom.findMany({
      where: { type: { not: RoomType.PRIVATE } },
      orderBy: { createdAt: 'asc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { user: { select: USER_SELECT } },
        },
      },
    });
  }
}
