import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Req,
  Delete,
  UseGuards,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '@modules/jwt/jwt.guard';
import { ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    phoneNumber: string;
    userId: string;
  };
}

// interface CreateChatDto {
//   participants: string[];
// }

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  //   @UseInterceptors(FileFieldsInterceptor([{ name: 'media', maxCount: 10 }]))
  async createChat(
    @Body() createChatDto: CreateChatDto,
    @Req() req: RequestWithUser,
    // @UploadedFiles()
    // files?: { media?: Express.Multer.File[] },
  ) {
    const currentUserId = req.user.userId;

    return this.chatService.createChat(currentUserId, createChatDto);
  }

  @Get('user/chats')
  async getUserChats(
    @Req() req: RequestWithUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    const userId = new Types.ObjectId(req.user.userId);

    return (
      this.chatService.getUserChats(userId, page, limit) || {
        chats: [],
        total: 0,
      }
    );
  }

  @Get(':chatId/messages')
  async getChatMessages(
    @Param('chatId') chatId: string,
    @Req() req: RequestWithUser,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 100,
    @Query('userTimezone') userTimezone: string,
  ) {
    const userId = new Types.ObjectId(req.user.userId);

    return this.chatService.getChatMessages(
      new Types.ObjectId(chatId),
      userId,
      page,
      limit,
      userTimezone,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(FileFieldsInterceptor([{ name: 'file', maxCount: 50 }]))
  async uploadFile(
    @Req() req: RequestWithUser,
    @UploadedFiles() files: { file: Express.Multer.File[] },
  ) {
    if (!files || !files.file || files.file.length === 0) {
      throw new BadRequestException('No file provided');
    }

    return await this.chatService.uploadFile(req.user.email, files);
  }

  @Delete('message/:messageId')
  async deleteMessage(
    @Req() req: RequestWithUser,
    @Param('messageId') messageId: string,
  ) {
    const userId = new Types.ObjectId(req.user.userId);

    await this.chatService.deleteMessage(new Types.ObjectId(messageId), userId);

    return { success: true };
  }

  @Get('lastseen/:userId')
  async getLastSeen(@Param('userId') userId: string) {
    const lastSeen = await this.chatService.getLastSeen(userId);
    return { lastSeen: lastSeen || null };
  }
}
