import { connect, disconnect, model } from 'mongoose';
import {
  SubcategorySchema,
  CategorySchema,
  Category,
  Subcategory,
} from '../modules/services/schemas/service.schema';

const MONGO_URI =
  'mongodb+srv://tundey520:qDMOY925z0RNAKzH@sanuxtech0.cdjjozr.mongodb.net/?retryWrites=true&w=majority&appName=Sanuxtech0';

export async function seedCategoriesAndSubcategories() {
  await connect(MONGO_URI);
  console.log('✅ Connected to DB');

  const CategoryModel = model<Category>('Category', CategorySchema);
  const SubcategoryModel = model<Subcategory>('Subcategory', SubcategorySchema);

  // Clear old data (optional)
  await CategoryModel.deleteMany({});
  await SubcategoryModel.deleteMany({});
  console.log('✅ Cleared existing categories and subcategories');

  // Create main categories
  const homeService = await new CategoryModel({
    name: 'Home Service',
    description: 'Home related services',
  }).save();

  const beauty = await new CategoryModel({
    name: 'Beauty',
    description: 'Beauty and personal care',
  }).save();

  console.log('✅ Created main categories');

  // Define all home service subcategories
  const homeServiceSubcategories = [
    'Electrical',
    'Cleaning',
    'Landscaping',
    'HVAC',
    'Painting',
    'Pest Control',
    'Roofing',
    'Moving',
    'Home Security',
    'Appliance Repair',
    'Carpentry',
    'Flooring',
    'Window Installation',
    'Garage Door Services',
    'Handyman',
    'Interior Design',
    'Pool Services',
    'Solar Panel Installation',
    'Fencing',
    'Masonry',
    'Gutter Services',
    'Waterproofing',
    'Foundation Repair',
    'Septic Services',
    'Snow Removal',
    'Junk Removal',
    'Tree Services',
    'Pressure Washing',
  ];

  // Map them to subcategory creation objects
  const homeServiceSubcategoryDocs = homeServiceSubcategories.map((name) => ({
    name,
    categoryId: homeService._id,
    description: `${name} services`,
  }));

  // Create the subcategories
  const createdHomeSubcategories = await SubcategoryModel.insertMany(
    homeServiceSubcategoryDocs,
  );

  // Optionally add some for Beauty
  const beautySubcategories = [
    {
      name: 'Hair Styling',
      categoryId: beauty._id,
      description: 'Professional hair styling',
    },
    {
      name: 'Makeup',
      categoryId: beauty._id,
      description: 'Makeup services',
    },
  ];
  const createdBeautySubcategories =
    await SubcategoryModel.insertMany(beautySubcategories);

  // Update categories with their subcategory ObjectIds
  await CategoryModel.findByIdAndUpdate(homeService._id, {
    $set: { subcategories: createdHomeSubcategories.map((s) => s._id) },
  });
  await CategoryModel.findByIdAndUpdate(beauty._id, {
    $set: { subcategories: createdBeautySubcategories.map((s) => s._id) },
  });

  console.log('✅ Linked subcategories to categories');
  await disconnect();
  console.log('✅ Seeding complete');
}

// To run as a script
if (require.main === module) {
  seedCategoriesAndSubcategories().catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  });
}
