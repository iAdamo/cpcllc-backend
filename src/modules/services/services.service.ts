import {
  CreateCategoryDto,
  CreateSubcategoryDto,
} from '@modules/dto/create-service.dto';
import { CreateServiceDto } from '@modules/dto/create-service.dto';
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '@schemas/user.schema';
import {
  Provider,
  ProviderDocument,
} from 'src/modules/provider/schemas/provider.schema';
import {
  Subcategory,
  SubcategoryDocument,
  Category,
  CategoryDocument,
  Service,
  ServiceDocument,
} from '@modules/schemas/service.schema';
import {
  JobPost,
  JobPostDocument,
} from 'src/modules/services/schemas/job.schema';
import {
  Proposal,
  ProposalDocument,
} from 'src/modules/services/schemas/proposal.schema';
import { UpdateServiceDto } from '@modules/dto/update-service.dto';
import { DbStorageService } from 'src/common/utils/dbStorage';
import { CreateJobDto } from '@modules/dto/create-job.dto';
import { UpdateJobDto } from '@modules/dto/update-job.dto';
import { CreateProposalDto } from '@modules/dto/create-proposal.dto';
import { UpdateProposalDto } from '@modules/dto/update-proposal.dto';
import { numberToDate } from 'src/common/utils/numberToDate';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Provider.name) private providerModel: Model<ProviderDocument>,
    @InjectModel(Service.name) private serviceModel: Model<Service>,
    @InjectModel(JobPost.name) private jobPostModel: Model<JobPostDocument>,
    @InjectModel(Proposal.name) private proposalModel: Model<ProposalDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Subcategory.name)
    private subcategoryModel: Model<SubcategoryDocument>,
    private readonly storage: DbStorageService,
  ) {}

  // Admin
  async createCategory(
    categoryData: CreateCategoryDto,
  ): Promise<CategoryDocument> {
    const existingCategory = await this.categoryModel.findOne({
      name: categoryData.name,
    });

    if (existingCategory) {
      throw new ConflictException('Category already exists');
    }

    const category = new this.categoryModel(categoryData);
    return await category.save();
  }
  // Admin

  async createSubcategory(
    subcategoryData: CreateSubcategoryDto,
  ): Promise<SubcategoryDocument> {
    const existingSubcategory = await this.subcategoryModel.findOne({
      name: subcategoryData.name,
      category: subcategoryData.category,
    });

    if (existingSubcategory) {
      throw new ConflictException('Subcategory already exists');
    }

    const subcategory = new this.subcategoryModel(subcategoryData);
    return await subcategory.save();
  }
  // Admin

  async getAllCategoriesWithSubcategories(): Promise<Category[]> {
    return this.categoryModel
      .find()
      .populate({
        path: 'subcategories',
        model: 'Subcategory',
        select: 'name description', // add more fields if needed
      })
      .sort({ createdAt: 1 })
      .lean();
  }

  async getSubcategoryById(id: string): Promise<Subcategory> {
    return this.subcategoryModel.findById(id).populate('categoryId').exec();
  }

  async createService(
    serviceData: CreateServiceDto,
    user: { userId: string; email: string; phoneNumber?: string },
    files: { media?: Express.Multer.File[] },
  ): Promise<ServiceDocument> {
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const provider = await this.providerModel.findOne({
      owner: new Types.ObjectId(user.userId),
    });
    if (!provider) {
      throw new NotFoundException('You are not a provider yet!');
    }

    const fileUrls = await this.storage.handleFileUploads(
      `${user.email}/services/${serviceData.title.replace(/\s+/g, '_')}`,
      files,
    );
    const serviceImagesMedia = fileUrls.media as
      | {
          type: string;
          url: string;
          thumbnail?: string | null;
          index?: number;
        }[]
      | undefined;

    const validSubcategories = await this.subcategoryModel.find({
      _id: { $in: [new Types.ObjectId(serviceData.subcategoryId)] },
    });
    if (validSubcategories.length !== 1) {
      throw new BadRequestException('Subcategory ID is invalid');
    }

    const service = new this.serviceModel({
      ...serviceData,
      userId: new Types.ObjectId(user.userId),
      providerId: provider._id,
      subcategoryId: new Types.ObjectId(serviceData.subcategoryId),
      ...fileUrls,
    });

    return await service.save();
  }

  async updateService(
    serviceId: string,
    updateData: UpdateServiceDto,
    user: { userId: string; email: string; phoneNumber?: string },
    files: { media?: Express.Multer.File[] },
  ): Promise<ServiceDocument> {
    const service = await this.serviceModel.findById(serviceId);
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    const provider = await this.providerModel.findById(service.providerId);

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    if (provider._id.toString() !== service.providerId.toString()) {
      throw new BadRequestException(
        'You can only update services of your own provider account',
      );
    }

    const fileUrls = await this.storage.handleFileUploads(
      `${user.email}/services/${service.title.replace(/\s+/g, '_')}`,
      files,
    );
    const updateDataWithFiles = { ...updateData, ...fileUrls };
    const { ...safeUpdate } = updateDataWithFiles;
    return await this.serviceModel
      .findByIdAndUpdate(serviceId, safeUpdate, {
        new: true,
      })
      .populate('providerId', 'providerName providerLogo isVerified')
      .populate({
        path: 'subcategoryId',
        model: 'Subcategory',
        select: '_id name description',
        populate: {
          path: 'categoryId',
          model: 'Category',
          select: '_id name description',
        },
      });
  }

  async deleteService(serviceId: string): Promise<ServiceDocument> {
    const service = await this.serviceModel.findByIdAndDelete(serviceId);
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  async getServicesByProvider(providerId: string): Promise<Service[]> {
    try {
      const provider = await this.providerModel.findById(providerId);
      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      const services = await this.serviceModel
        .find({ providerId: provider._id })
        .populate('providerId', 'providerName providerLogo isVerified')
        .populate({
          path: 'subcategoryId',
          model: 'Subcategory',
          select: '_id name description',
          populate: {
            path: 'categoryId',
            model: 'Category',
            select: '_id name description',
          },
        });
      return services;
    } catch (error) {
      console.error(error);
    }
  }

  async getServiceById(serviceId: string): Promise<ServiceDocument> {
    const service = await this.serviceModel
      .findById(new Types.ObjectId(serviceId))
      .populate('providerId', 'providerName providerLogo isVerified')
      .populate({
        path: 'subcategoryId',
        model: 'Subcategory',
        select: '_id name description',
        populate: {
          path: 'categoryId',
          model: 'Category',
          select: '_id name description',
        },
      });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    return service;
  }

  /* Jobs and proposals */
  async createJob(
    jobData: CreateJobDto,
    user: { userId: string; email: string; phoneNumber?: string },
    files?: { media?: Express.Multer.File[] },
  ): Promise<JobPostDocument> {
    if (!user) throw new NotFoundException('User not found');

    // validate subcategory
    if (!jobData.subcategoryId) {
      throw new BadRequestException('subcategoryId is required');
    }
    const validSub = await this.subcategoryModel.findById(
      new Types.ObjectId(jobData.subcategoryId),
    );
    if (!validSub) throw new BadRequestException('Invalid subcategoryId');

    const fileUrls = await this.storage.handleFileUploads(
      `${user.email}/jobs/${(jobData.title || 'job').toString().replace(/\s+/g, '_')}`,
      files,
    );

    const parsedDate = numberToDate(jobData.deadline);
    const job = new this.jobPostModel({
      ...jobData,
      deadline: parsedDate,
      userId: new Types.ObjectId(user.userId),
      subcategoryId: new Types.ObjectId(jobData.subcategoryId),
      media: (fileUrls.media as any) || [],
    });

    const saved = await job.save();
    return await saved.populate({
      path: 'subcategoryId',
      model: 'Subcategory',
      select: '_id name description',
      populate: {
        path: 'categoryId',
        model: 'Category',
        select: '_id name description',
      },
    });
  }

  async patchJob(
    jobId: string,
    updateData: UpdateJobDto,
    user: { userId: string; email: string; phoneNumber?: string },
    files?: { media?: Express.Multer.File[] },
  ): Promise<JobPostDocument> {
    const job = await this.jobPostModel.findById(new Types.ObjectId(jobId));
    if (!job) throw new NotFoundException('Job not found');
    if (job.userId.toString() !== user.userId) {
      throw new BadRequestException('You are not the owner of this job');
    }

    // handle new files (append)
    const fileUrls = await this.storage.handleFileUploads(
      `${user.email}/jobs/${(job.title || 'job').toString().replace(/\s+/g, '_')}`,
      files,
    );

    if (
      fileUrls.media &&
      Array.isArray(fileUrls.media) &&
      fileUrls.media.length
    )
      job.media = (job.media || []).concat(fileUrls.media as any);

    const { deadline, ...rest } = updateData;

    if (typeof updateData.isActive === 'string') {
      job.isActive = updateData.isActive === 'true';
    }
    if (deadline) {
      job.deadline = numberToDate(deadline);
    }

    console.log({ updateData });

    // If providerId is provided in the update, limit job.proposals to only proposals from that provider
    if (updateData.providerId) {
      const providerObjectId = new Types.ObjectId(updateData.providerId);

      // Validate provider exists
      const provider = await this.providerModel.findById(providerObjectId);
      if (!provider) throw new BadRequestException('Invalid providerId');

      // Find accepted proposals for this job by that provider
      const providerProposals = await this.proposalModel
        .find({
          jobId: job._id,
          providerId: providerObjectId,
          status: 'accepted',
        })
        .select('_id')
        .lean();

      let assignProvider = false;

      if (providerProposals && providerProposals.length) {
        job.proposals = providerProposals.map((p: any) => p._id);
        assignProvider = true;
      } else {
        // No direct proposals found; check whether any existing proposal ids on the job belong to this provider
        const existingFromProvider = await this.proposalModel
          .find({
            _id: { $in: job.proposals || [] },
            providerId: providerObjectId,
          })
          .select('_id')
          .lean();

        if (existingFromProvider && existingFromProvider.length) {
          job.proposals = existingFromProvider.map((p: any) => p._id);
          assignProvider = true;
        } else {
          job.proposals = [];
        }
      }

      // Only set job.providerId when we actually have accepted proposals from that provider (or had existing matching ids)
      if (assignProvider) {
        job.providerId = providerObjectId;
        // TODO: notify assigned provider's owner (e.g., push notification / email).
        // We don't have a NotificationService here; log a placeholder for now.
        this.logger.log(
          `Provider ${providerObjectId.toString()} assigned to job ${job._id.toString()}`,
        );
      }
    }

    // apply other updates
    Object.assign(job, { ...rest, media: job.media });
    const saved = await job.save();
    return await saved.populate({
      path: 'subcategoryId',
      model: 'Subcategory',
      select: '_id name description',
      populate: {
        path: 'categoryId',
        model: 'Category',
        select: '_id name description',
      },
    });
  }

  async deleteJobPost(
    jobId: string,
    user: { userId: string; email: string; phoneNumber?: string },
  ): Promise<JobPostDocument> {
    const job = await this.jobPostModel.findById(new Types.ObjectId(jobId));
    if (!job) throw new NotFoundException('Job not found');
    if (job.userId.toString() !== user.userId) {
      throw new BadRequestException('You are not the owner of this job');
    }

    // delete attachments for job and its proposals
    const proposals = await this.proposalModel.find({ jobId: job._id });
    const urlsToDelete: string[] = [];
    (job.media || []).forEach((m: any) => m?.url && urlsToDelete.push(m.url));
    proposals.forEach((p) =>
      (p.attachments || []).forEach(
        (a: any) => a?.url && urlsToDelete.push(a.url),
      ),
    );

    if (urlsToDelete.length) await this.storage.deleteFilesByUrls(urlsToDelete);

    // delete proposals then job
    await this.proposalModel.deleteMany({ jobId: job._id });
    const deleted = await this.jobPostModel.findByIdAndDelete(job._id);
    return deleted;
  }

  async createProposal(
    jobId: string,
    proposalData: CreateProposalDto,
    user: { userId: string; email: string; phoneNumber?: string },
    files?: { attachments?: Express.Multer.File[] },
  ): Promise<ProposalDocument> {
    // ensure provider exists for this user
    const provider = await this.providerModel.findOne({
      owner: new Types.ObjectId(user.userId),
    });
    if (!provider) throw new BadRequestException('You are not a provider');

    const job = await this.jobPostModel.findById(new Types.ObjectId(jobId));
    if (!job) throw new NotFoundException('Job not found');

    // prevent duplicate proposals from the same provider for the same job
    const existing = await this.proposalModel.findOne({
      jobId: job._id,
      providerId: provider._id,
    });
    if (existing) {
      // provider already submitted a proposal for this job
      // use ConflictException (409) to indicate duplicate resource
      throw new ConflictException('Proposal already submitted for this job');
    }

    const fileUrls = await this.storage.handleFileUploads(
      `${user.email}/proposals/${jobId}`,
      files as any,
    );

    const proposal = new this.proposalModel({
      ...proposalData,
      jobId: job._id,
      providerId: provider._id,
      ...fileUrls,
    });

    // update job to add proposals
    // add the created proposal id to the job's proposals array
    job.proposals = job.proposals || [];
    const proposalIdStr = proposal._id.toString();
    const hasProposal = job.proposals.some(
      (p: any) => p && p.toString && p.toString() === proposalIdStr,
    );
    if (!hasProposal) {
      job.proposals.push(proposal._id);
      await job.save();
    }

    return await proposal.save();
  }

  async patchProposal(
    jobId: string,
    proposalId: string,
    updateData: UpdateProposalDto,
    user: { userId: string; email: string; phoneNumber?: string },
    files?: { attachments?: Express.Multer.File[] },
  ): Promise<ProposalDocument> {
    const proposal = await this.proposalModel.findById(
      new Types.ObjectId(proposalId),
    );
    if (!proposal) throw new NotFoundException('Proposal not found');

    const job = await this.jobPostModel.findById(new Types.ObjectId(jobId));
    if (!job) throw new NotFoundException('Job not found');

    // check permissions: provider who created it or job owner
    const provider = await this.providerModel.findOne({
      owner: new Types.ObjectId(user.userId),
    });

    const isProviderOwner =
      provider && proposal.providerId?.toString() === provider._id.toString();
    const isJobOwner = job.userId?.toString() === user.userId;

    if (!isProviderOwner && !isJobOwner) {
      throw new BadRequestException('Not authorized to modify this proposal');
    }

    // provider can update core fields; job owner can change status
    if (isProviderOwner) {
      // handle attachments append
      const fileUrls = await this.storage.handleFileUploads(
        `${user.email}/proposals/${jobId}`,
        files as any,
      );
      if (fileUrls.attachments && Array.isArray(fileUrls.attachments))
        proposal.attachments = (proposal.attachments || []).concat(
          fileUrls.attachments as any,
        );

      if (updateData.message) proposal.message = updateData.message;
      if (updateData.proposedPrice)
        proposal.proposedPrice = updateData.proposedPrice;
      if (updateData.estimatedDuration)
        proposal.estimatedDuration = updateData.estimatedDuration;
    }

    if (isJobOwner && updateData.status) {
      proposal.status = updateData.status;
    }

    return await proposal.save();
  }

  async deleteProposal(
    jobId: string,
    proposalId: string,
    user: { userId: string; email: string; phoneNumber?: string },
  ): Promise<ProposalDocument> {
    const proposal = await this.proposalModel.findById(
      new Types.ObjectId(proposalId),
    );
    if (!proposal) throw new NotFoundException('Proposal not found');

    const job = await this.jobPostModel.findById(new Types.ObjectId(jobId));
    if (!job) throw new NotFoundException('Job not found');

    const provider = await this.providerModel.findOne({
      owner: new Types.ObjectId(user.userId),
    });

    const isProviderOwner =
      provider && proposal.providerId?.toString() === provider._id.toString();
    const isJobOwner = job.userId?.toString() === user.userId;

    if (!isProviderOwner && !isJobOwner) {
      throw new BadRequestException('Not authorized to delete this proposal');
    }

    // delete attachments
    const urls: string[] = [];
    (proposal.attachments || []).forEach(
      (a: any) => a?.url && urls.push(a.url),
    );
    if (urls.length) await this.storage.deleteFilesByUrls(urls);

    const deleted = await this.proposalModel.findByIdAndDelete(proposal._id);
    return deleted;
  }

  async getProposalsByJob(jobId: string): Promise<Proposal[]> {
    return this.proposalModel
      .find({ jobId: new Types.ObjectId(jobId) })
      .populate('providerId', 'providerName providerLogo isVerified owner')
      .lean();
  }

  async getJobsByUser(userId: string): Promise<JobPost[]> {
    return this.jobPostModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate({
        path: 'userId',
        model: 'User',
      })
      .populate({
        path: 'proposals',
        model: 'Proposal',
        populate: {
          path: 'providerId',
          model: 'Provider',
          select: 'providerName providerLogo isVerified owner',
        },
      })
      .populate({
        path: 'subcategoryId',
        model: 'Subcategory',
        select: '_id name description',
        populate: {
          path: 'categoryId',
          model: 'Category',
          select: '_id name description',
        },
      })
      .lean();
  }
  async getJobById(jobId: string): Promise<JobPost> {
    const job = await this.jobPostModel
      .findById(new Types.ObjectId(jobId))
      .populate({
        path: 'userId',
        model: 'User',
      })
      .populate({
        path: 'proposals',
        model: 'Proposal',
        populate: {
          path: 'providerId',
          model: 'Provider',
          select: 'providerName providerLogo isVerified',
        },
      })
      .populate({
        path: 'subcategoryId',
        model: 'Subcategory',
        select: '_id name description',
        populate: {
          path: 'categoryId',
          model: 'Category',
          select: '_id name description',
        },
      })
      .lean();
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async getProposalById(proposalId: string): Promise<Proposal> {
    const proposal = await this.proposalModel
      .findById(new Types.ObjectId(proposalId))
      .populate('providerId', 'providerName providerLogo isVerified')
      .lean();
    if (!proposal) throw new NotFoundException('Proposal not found');
    return proposal;
  }
}
