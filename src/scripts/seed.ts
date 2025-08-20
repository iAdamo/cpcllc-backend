import { connect, disconnect, model } from 'mongoose';
import {
  SubcategorySchema,
  Subcategory,
  CategorySchema,
  Category,
} from '../modules/services/schemas/service.schema';

const MONGO_URI = 'mongodb://localhost:27017/cpcdb';

async function seed() {
  await connect(MONGO_URI);
  console.log('✅ Connected to DB');

  const CategoryModel = model('Category', CategorySchema);
  const SubcategoryModel = model('Subcategory', SubcategorySchema);

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
    { category: 'Electrical' },
    { category: 'Cleaning' },
    { category: 'Landscaping' },
    { category: 'HVAC' },
    { category: 'Painting' },
    { category: 'Pest Control' },
    { category: 'Roofing' },
    { category: 'Moving' },
    { category: 'Home Security' },
    { category: 'Appliance Repair' },
    { category: 'Carpentry' },
    { category: 'Flooring' },
    { category: 'Window Installation' },
    { category: 'Garage Door Services' },
    { category: 'Handyman' },
    { category: 'Interior Design' },
    { category: 'Pool Services' },
    { category: 'Solar Panel Installation' },
    { category: 'Fencing' },
    { category: 'Masonry' },
    { category: 'Gutter Services' },
    { category: 'Waterproofing' },
    { category: 'Foundation Repair' },
    { category: 'Septic Services' },
    { category: 'Snow Removal' },
    { category: 'Junk Removal' },
    { category: 'Tree Services' },
    { category: 'Pressure Washing' },
  ];

  // Map them to subcategory creation objects
  const homeServiceSubcategoryDocs = homeServiceSubcategories.map((item) => ({
    name: item.category,
    category: homeService._id,
    description: `${item.category} services`,
  }));

  // Create the subcategories
  await SubcategoryModel.insertMany(homeServiceSubcategoryDocs);

  // Optionally add some for Beauty
  await SubcategoryModel.create([
    {
      name: 'Hair Styling',
      category: beauty._id,
      description: 'Professional hair styling',
    },
    {
      name: 'Makeup',
      category: beauty._id,
      description: 'Makeup services',
    },
  ]);

  console.log('✅ Created all subcategories');

  await disconnect();
  console.log('✅ Seeding complete');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
