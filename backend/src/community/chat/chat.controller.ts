import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtGuard } from '../../auth/guard/jwt.guard';

@Controller('api/community/chat')
@UseGuards(JwtGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  getAllRooms() {
    return this.chatService.getAllRooms();
  }

  @Get('rooms/global')
  getGlobalRoom() {
    return this.chatService.getOrCreateGlobalRoom();
  }

  @Get('rooms/symbol/:symbol')
  getSymbolRoom(@Param('symbol') symbol: string) {
    return this.chatService.createSymbolRoom(symbol.toUpperCase());
  }

  @Get('rooms/:roomId')
  getRoomInfo(@Param('roomId') roomId: string) {
    return this.chatService.getRoomInfo(roomId);
  }

  @Get('rooms/:roomId/messages')
  getMessageHistory(
    @Param('roomId') roomId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chatService.getMessageHistory(
      roomId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
