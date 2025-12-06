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
import { ApiTags } from '@nestjs/swagger';
import { User } from '@schemas/user.schema';
import {
  Service,
  CategorySchema,
  Subcategory,
  Category,
} from '@modules/schemas/service.schema';
import { ServicesService } from '@services/services.service';
import {
  CreateCategoryDto,
  CreateSubcategoryDto,
  CreateServiceDto,
} from '@modules/dto/create-service.dto';
import { UpdateServiceDto } from '@dto/update-service.dto';
import { CreateJobDto } from '@modules/dto/create-job.dto';
import { UpdateJobDto } from '@modules/dto/update-job.dto';
import { CreateProposalDto } from '@modules/dto/create-proposal.dto';
import { UpdateProposalDto } from '@modules/dto/update-proposal.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '@guards/jwt.guard';
import { CacheService } from 'src/modules/cache/cache.service';
import { UsePipes, ValidationPipe } from '@nestjs/common';

export interface RequestWithUser extends Request {
  user: {
    email: string;
    userId: string;
  };
}

type UserParam = 'me' | string;

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly cacheService: CacheService,
  ) {}

  /* Jobs */
  @Post('jobs')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'media', maxCount: 10 }]))
  async createJob(
    @Body() jobDto: CreateJobDto,
    @Req() req: RequestWithUser,
    @UploadedFiles() files?: { media?: Express.Multer.File[] },
  ) {
    return this.servicesService.createJob(jobDto, req.user, files);
  }

  @Patch('jobs/:id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'media', maxCount: 10 }]))
  async patchJob(
    @Param('id') jobId: string,
    @Body() jobDto: UpdateJobDto,
    @Req() req: RequestWithUser,
    @UploadedFiles() files?: { media?: Express.Multer.File[] },
  ) {
    return this.servicesService.patchJob(jobId, jobDto, req.user, files);
  }

  @Delete('jobs/:id')
  @UseGuards(JwtAuthGuard)
  async deleteJob(@Param('id') jobId: string, @Req() req: RequestWithUser) {
    return this.servicesService.deleteJobPost(jobId, req.user);
  }

  @Get('jobs/:id')
  @UseGuards(JwtAuthGuard)
  async getJobsByUser(
    @Req() req: RequestWithUser,
    @Param('id') userId: UserParam,
  ) {
    return this.servicesService.getJobsByUser(
      userId === 'me' ? req.user.userId : userId,
    );
  }

  /* Proposals */
  @Post('jobs/:id/proposals')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'attachments', maxCount: 10 }]),
  )
  async createProposal(
    @Param('id') jobId: string,
    @Body() proposalDto: CreateProposalDto,
    @Req() req: RequestWithUser,
    @UploadedFiles() files?: { attachments?: Express.Multer.File[] },
  ) {
    return this.servicesService.createProposal(
      jobId,
      proposalDto,
      req.user,
      files,
    );
  }

  @Patch('jobs/:jobId/proposals/:proposalId')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'attachments', maxCount: 10 }]),
  )
  async patchProposal(
    @Param('jobId') jobId: string,
    @Param('proposalId') proposalId: string,
    @Body() proposalDto: UpdateProposalDto,
    @Req() req: RequestWithUser,
    @UploadedFiles() files?: { attachments?: Express.Multer.File[] },
  ) {
    return this.servicesService.patchProposal(
      jobId,
      proposalId,
      proposalDto,
      req.user,
      files,
    );
  }

  @Delete('jobs/:jobId/proposals/:proposalId')
  @UseGuards(JwtAuthGuard)
  async deleteProposal(
    @Param('jobId') jobId: string,
    @Param('proposalId') proposalId: string,
    @Req() req: RequestWithUser,
  ) {
    return this.servicesService.deleteProposal(jobId, proposalId, req.user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'media', maxCount: 10 }]))
  async createService(
    @Body() serviceDto: CreateServiceDto,
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files?: { media?: Express.Multer.File[] },
  ) {
    const user = req.user;
    return this.servicesService.createService(serviceDto, user, files);
  }

  @Post('category')
  async createCategory(
    @Body() categoryDto: CreateCategoryDto,
  ): Promise<Category> {
    return this.servicesService.createCategory(categoryDto);
  }

  @Post('subcategory')
  async createSubcategory(
    @Body() subcategoryDto: CreateSubcategoryDto,
  ): Promise<Subcategory> {
    return this.servicesService.createSubcategory(subcategoryDto);
  }

  @Get('categories')
  async getAllCategoriesWithSubcategories(): Promise<Category[]> {
    const cacheKey = 'services:categories-with-subcategories';
    const cachedResult = await this.cacheService.get<Category[]>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    const result =
      await this.servicesService.getAllCategoriesWithSubcategories();
    await this.cacheService.set(cacheKey, result, 3600); // Cache for 1 hour
    return result;
  }

  @Get('provider/:id')
  @UseGuards(JwtAuthGuard)
  async getServicesByProvider(
    @Param('id') providerId: string,
  ): Promise<Service[]> {
    const cacheKey = `services:provider:${providerId}`;
    const cachedResult = await this.cacheService.get<Service[]>(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    const result = await this.servicesService.getServicesByProvider(providerId);
    await this.cacheService.set(cacheKey, result, 60); // Cache for 1 minute
    return result;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getServiceById(@Param('id') serviceId: string): Promise<Service> {
    return this.servicesService.getServiceById(serviceId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'media', maxCount: 10 }]))
  async updateService(
    @Param('id') serviceId: string,
    @Body() serviceData: UpdateServiceDto,
    @Req() req: RequestWithUser,
    @UploadedFiles()
    files?: { media?: Express.Multer.File[] },
  ): Promise<Service> {
    return this.servicesService.updateService(
      serviceId,
      serviceData,
      req.user,
      files,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteService(@Param('id') serviceId: string): Promise<Service> {
    return this.servicesService.deleteService(serviceId);
  }
}
