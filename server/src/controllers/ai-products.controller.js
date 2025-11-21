import Product from '../models/Product.js';
import Category from '../models/Category.js';

/**
 * @route   GET /api/ai/products
 * @desc    Get products formatted for AI context
 * @access  Internal (used by chatbot service)
 */
export const getProductsForAI = async (req, res) => {
  try {
    const { category, limit = 50, minPrice, maxPrice, search } = req.query;

    const filter = { status: 'active' };

    // Filter by category
    if (category) {
      const cat = await Category.findOne({
        $or: [{ slug: category.toLowerCase() }, { name: new RegExp(category, 'i') }],
      });
      if (cat) filter.categoryId = cat._id;
    }

    // Filter by price range using variant prices because basePrice is not persisted
    if (minPrice || maxPrice) {
      const priceFilter = {};
      if (minPrice) priceFilter.$gte = Number(minPrice);
      if (maxPrice) priceFilter.$lte = Number(maxPrice);
      filter.variants = { $elemMatch: { price: priceFilter } };
    }

    // Search by name
    if (search) {
      filter.name = new RegExp(search, 'i');
    }

    const products = await Product.find(filter)
      .limit(Number(limit))
      .select('name slug images ratingAvg variants')
      .sort({ ratingAvg: -1, createdAt: -1 })
      .lean();

    // Format for AI - only essential fields
    const formatted = products.map((p) => {
      const variantPrices = Array.isArray(p.variants)
        ? p.variants
            .map((v) => Number(v?.price) || 0)
            .filter((price) => Number.isFinite(price) && price > 0)
        : [];
      const price = variantPrices.length > 0 ? Math.min(...variantPrices) : 0;
      const imageId =
        p.images?.find?.((img) => img?.isPrimary)?.publicId ||
        p.images?.[0]?.publicId ||
        p.variants?.find?.((v) => v?.imagePublicId)?.imagePublicId ||
        '';

      return {
        name: p.name,
        slug: p.slug,
        price,
        rating: p.ratingAvg || 0,
        image: imageId,
        inStock: Array.isArray(p.variants) && p.variants.some((v) => Number(v?.stock) > 0),
      };
    });

    res.json({
      success: true,
      products: formatted,
      count: formatted.length,
    });
  } catch (error) {
    console.error('[AI Products] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      products: [],
    });
  }
};

/**
 * Helper function to be used internally by chatbot service
 */
export const queryProductsForAI = async (filters = {}) => {
  try {
    const { category, limit = 80, minPrice, maxPrice, search, size, gender } = filters;

    const filter = { status: 'active' };

    if (category) {
      const cat = await Category.findOne({
        $or: [{ slug: category.toLowerCase() }, { name: new RegExp(category, 'i') }],
      });
      if (cat) filter.categoryId = cat._id;
    }

    if (minPrice || maxPrice) {
      const priceFilter = {};
      if (minPrice) priceFilter.$gte = Number(minPrice);
      if (maxPrice) priceFilter.$lte = Number(maxPrice);
      filter.variants = { $elemMatch: { price: priceFilter } };
    }

    if (search) {
      filter.name = new RegExp(search, 'i');
    } else if (gender) {
      // If only gender specified, search in product name
      filter.name = new RegExp(gender, 'i');
    }

    // Filter by size in variants
    if (size) {
      if (filter.variants && filter.variants.$elemMatch) {
        filter.variants.$elemMatch.size = size;
      } else {
        filter.variants = { $elemMatch: { size } };
      }
    }

    console.log('[AI Products] Query filter:', JSON.stringify(filter, null, 2));

    const products = await Product.find(filter)
      .limit(Number(limit))
      .select('name slug images ratingAvg variants')
      .sort({ ratingAvg: -1, createdAt: -1 })
      .lean();

    return products.map((p) => {
      const variantPrices = Array.isArray(p.variants)
        ? p.variants
            .map((v) => Number(v?.price) || 0)
            .filter((price) => Number.isFinite(price) && price > 0)
        : [];
      const price = variantPrices.length > 0 ? Math.min(...variantPrices) : 0;
      const imageId =
        p.images?.find?.((img) => img?.isPrimary)?.publicId ||
        p.images?.[0]?.publicId ||
        p.variants?.find?.((v) => v?.imagePublicId)?.imagePublicId ||
        '';

      return {
        name: p.name,
        slug: p.slug,
        price,
        rating: p.ratingAvg || 0,
        image: imageId,
        inStock: Array.isArray(p.variants) && p.variants.some((v) => Number(v?.stock) > 0),
      };
    });
  } catch (error) {
    console.error('[AI Products Query] Error:', error);
    return [];
  }
};
