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
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 100,
  ) {
    // In production, you'd get this from auth context
    const userId = new Types.ObjectId('current-user-id');

    return this.chatService.getChatMessages(
      new Types.ObjectId(chatId),
      userId,
      page,
      limit,
    );
  }

  //   @Post('upload')
  //   @UseInterceptors(FileInterceptor('file'))
  //   async uploadFile(@UploadedFile() file: Express.Multer.File) {
  //     if (!file) {
  //       throw new BadRequestException('No file provided');
  //     }

  //     const uploadResult = await this.fileUploadService.uploadFile(file);

  //     return {
  //       success: true,
  //       data: uploadResult,
  //     };
  //   }

  @Delete('message/:messageId')
  async deleteMessage(
    @Req() req: RequestWithUser,
    @Param('messageId') messageId: string,
  ) {
    const userId = new Types.ObjectId(req.user.userId);

    await this.chatService.deleteMessage(new Types.ObjectId(messageId), userId);

    return { success: true };
  }
}
