import { connect, disconnect, model } from 'mongoose';
import {
  SubcategorySchema,
  Subcategory,
  CategorySchema,
  Category,
} from '../modules/users/schemas/service.schema';

const MONGO_URI = 'mongodb://localhost:27017/cpcdb';

async function seed() {
  await connect(MONGO_URI);
  console.log('Connected to DB');

  const CategoryModel = model('Category', CategorySchema);
  const SubcategoryModel = model('Subcategory', SubcategorySchema);

  // Clear old data (optional)
  await CategoryModel.deleteMany({});
  await SubcategoryModel.deleteMany({});
  console.log('Cleared existing categories');

  // Create main categories
  const homeService = await new CategoryModel({
    name: 'Home Service',
    description: 'Home related services',
  }).save();
  const beauty = await new CategoryModel({
    name: 'Beauty',
    description: 'Beauty and personal care',
  }).save();

  console.log('Created main categories');

  // Create subcategories
  await SubcategoryModel.create([
    {
      name: 'Electrical',
      category: homeService._id,
      description: 'Electrical installations and repairs',
    },
    {
      name: 'Snow Removal',
      category: homeService._id,
      description: 'Snow clearing services',
    },
    {
      name: 'Window Installation',
      category: homeService._id,
      description: 'Install windows in homes',
    },
    {
      name: 'Hair Styling',
      category: beauty._id,
      description: 'Professional hair styling',
    },
  ]);

  console.log('Created subcategories');

  await disconnect();
  console.log('Seeding complete');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
