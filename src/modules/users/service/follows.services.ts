import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { model, Model, Types, Connection } from 'mongoose';
import { User, UserDocument } from '@schemas/user.schema';
import {
  Provider,
  ProviderDocument,
} from 'src/modules/provider/schemas/provider.schema';
import {
  Subcategory,
  SubcategoryDocument,
} from '@modules/schemas/service.schema';
import { Terms, TermsDocument } from '@users/schemas/terms.schema';
import { Follow, FollowDocument } from '@users/schemas/follow.schema';

@Injectable()
export class FollowsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Provider.name) private providerModel: Model<ProviderDocument>,
    @InjectModel(Follow.name) private followModel: Model<FollowDocument>,
  ) {}

  async getFollowers(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    const provider = await this.providerModel.findOne({
      owner: userObjectId,
    });

    if (!provider) {
      return {
        followersCount: 0,
        followers: [],
      };
    }

    const followers = await this.followModel
      .find({
        provider: provider._id,
        isActive: true,
      })
      .populate({
        path: 'user',
        select: 'firstName lastName profilePicture',
      })
      .lean();

    const followersCount = await this.followModel.countDocuments({
      provider: provider._id,
      isActive: true,
    });

    return {
      followersCount,
      followers,
    };
  }

  async getFollowing(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    const following = await this.followModel
      .find({
        user: userObjectId,
        isActive: true,
      })
      .populate({
        path: 'provider',
        populate: {
          path: 'owner',
          select: 'firstName lastName profilePicture',
        },
      })
      .lean();

    const followingCount = await this.followModel.countDocuments({
      user: userObjectId,
      isActive: true,
    });

    return {
      followingCount,
      following,
    };
  }

  /**
   * Toggle follow/unfollow a provider
   * @param userId User ID
   * @param providerId Provider ID
   * @return Updated User
   */
  async toggleFollow(userId: string, providerOwnerId: string) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const userObjectId = new Types.ObjectId(userId);
      const sender = await this.userModel
        .findById(userObjectId)
        .select('firstName lastName profilePicture')
        .session(session)
        .lean();

      if (!sender) {
        throw new NotFoundException('User not found');
      }

      const provider = await this.providerModel
        .findOne({ owner: new Types.ObjectId(providerOwnerId) })
        .session(session);

      if (!provider) {
        throw new NotFoundException('Provider not found');
      }

      const existingFollow = await this.followModel
        .findOne({
          user: userObjectId,
          provider: provider._id,
        })
        .session(session);

      let isFirstTime = false;
      let isFollowing = false;
      let updatedProvider: any;

      if (!existingFollow) {
        // FIRST TIME EVER
        await this.followModel.create(
          [
            {
              user: userObjectId,
              provider: provider._id,
              isActive: true,
              followedAt: new Date(),
            },
          ],
          { session },
        );

        await this.userModel.updateOne(
          { _id: userObjectId },
          { $inc: { followingCount: 1 } },
          { session },
        );

        updatedProvider = await this.providerModel.findOneAndUpdate(
          { _id: provider._id },
          { $inc: { followersCount: 1 } },
          { session, new: true }, // Return the updated document
        );

        isFirstTime = true;
        isFollowing = true;
      } else if (existingFollow.isActive) {
        // UNFOLLOW
        await this.followModel.updateOne(
          { _id: existingFollow._id },
          {
            isActive: false,
            unfollowedAt: new Date(),
          },
          { session },
        );

        await this.userModel.updateOne(
          { _id: userObjectId },
          { $inc: { followingCount: -1 } },
          { session },
        );

        updatedProvider = await this.providerModel.findOneAndUpdate(
          { _id: provider._id },
          { $inc: { followersCount: -1 } },
          { session, new: true }, // Return the updated document
        );

        isFollowing = false;
      } else {
        // RE-FOLLOW
        await this.followModel.updateOne(
          { _id: existingFollow._id },
          {
            isActive: true,
            followedAt: new Date(),
            $unset: { unfollowedAt: 1 },
          },
          { session },
        );

        await this.userModel.updateOne(
          { _id: userObjectId },
          { $inc: { followingCount: 1 } },
          { session },
        );

        updatedProvider = await this.providerModel.findOneAndUpdate(
          { _id: provider._id },
          { $inc: { followersCount: 1 } },
          { session, new: true }, // Return the updated document
        );

        isFollowing = true;
      }

      await session.commitTransaction();
      session.endSession();

      return {
        providerId: provider._id.toString(),
        userId,
        senderName: `${sender.firstName} ${sender.lastName}`,
        senderImage: sender.profilePicture?.thumbnail ?? null,
        followersCount: updatedProvider.followersCount,
        isFollowing,
        isFirstTime,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}
