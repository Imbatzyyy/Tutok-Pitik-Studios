import { useState } from 'react';
import bgcSeries1 from 'figma:asset/3105c16fd3359cada5a0747c5cd838ca4df26c60.png';
import bgcSeries2 from 'figma:asset/df206be07003a0d76653908219e6526c60d86459.png';
import joyXix from 'figma:asset/720b8a4a052529d0f1b4d58ef1d206f61e2e686f.png';
import retroBeauty from 'figma:asset/81a34d1a3320f8ef4bade6ae80a98b976c361c7a.png';
import bgcSeries3 from 'figma:asset/0e14a3c3ca32d5ea70a593d1c05cda9b87f03f77.png';
import bgcSeries4 from 'figma:asset/29a16cf877620509ac819745d295174ca581ff3e.png';
import bloomsInBlue from 'figma:asset/5d507fa4d3d1f609abc52c4c1ff182f7a6404312.png';
import mirasolCouple from 'figma:asset/c689b0258f6d963b52098e2478216817945b5a12.png';
import indak from 'figma:asset/eee20487d43dc85a611e30f24dfcb08b32b5d169.png';
import jimmyBondoc from 'figma:asset/6f3048cc6713529e980a3f4b5d6f42c3184c8018.png';
import olivia from 'figma:asset/09af3496bde7cedf90ff53e0f6c1ca15a60c8df0.png';
import spiralStairway from 'figma:asset/dbe79d24605c5d7c7fecc9071d8e44d31fbf9ae7.png';

const portfolioImages = [
  {
    src: bgcSeries1,
    category: 'portrait',
    subCategory: 'street',
    title: 'BGC Series 1',
    description: 'Street Photography'
  },
  {
    src: bgcSeries2,
    category: 'portrait',
    subCategory: 'street',
    title: 'BGC Series 2',
    description: 'Street Photography'
  },
  {
    src: joyXix,
    category: 'events',
    subCategory: 'birthday',
    title: 'JOY XIX',
    description: 'Joylyn Birthday Shoot'
  },
  {
    src: retroBeauty,
    category: 'portrait',
    subCategory: 'outdoor',
    title: 'Retro Beauty, Neon Glow',
    description: 'Park Shoot'
  },
  {
    src: bgcSeries3,
    category: 'portrait',
    subCategory: 'street',
    title: 'BGC Series 3',
    description: 'Slaying the Streets'
  },
  {
    src: bgcSeries4,
    category: 'portrait',
    subCategory: 'casual',
    title: 'BGC Series 4',
    description: 'Bro Shoot'
  },
  {
    src: bloomsInBlue,
    category: 'portrait',
    subCategory: 'graduation',
    title: 'Blooms in Blue',
    description: 'Graduation Shoot'
  },
  {
    src: mirasolCouple,
    category: 'portrait',
    subCategory: 'couple',
    title: 'Mirasol Couple',
    description: 'Couple Shoot'
  },
  {
    src: indak,
    category: 'events',
    subCategory: 'school',
    title: 'Indak Sa Ginintuang Imbayog',
    description: 'School Concert'
  },
  {
    src: jimmyBondoc,
    category: 'events',
    subCategory: 'concert',
    title: 'Jimmy Bondoc Singing',
    description: 'Street Party Concert'
  },
  {
    src: olivia,
    category: 'events',
    subCategory: 'birthday',
    title: 'Olivia 1st Birthday',
    description: '1st Birthday Celebration'
  },
  {
    src: spiralStairway,
    category: 'creative',
    subCategory: 'architecture',
    title: 'Spiral Stairway',
    description: 'Ronac Art Center - Stairway'
  }
];

export { portfolioImages };

interface PortfolioProps {
  onImageClick: (index: number) => void;
  user?: any;
}

// 5 Main Categories with 5 Sub-categories each (25 total)
const categories = [
  {
    name: 'Portrait',
    value: 'portrait',
    subCategories: [
      { name: 'Street', value: 'street' },
      { name: 'Outdoor', value: 'outdoor' },
      { name: 'Casual', value: 'casual' },
      { name: 'Graduation', value: 'graduation' },
      { name: 'Couple', value: 'couple' }
    ]
  },
  {
    name: 'Events',
    value: 'events',
    subCategories: [
      { name: 'Birthday', value: 'birthday' },
      { name: 'Concert', value: 'concert' },
      { name: 'School', value: 'school' },
      { name: 'Corporate', value: 'corporate' },
      { name: 'Festival', value: 'festival' }
    ]
  },
  {
    name: 'Creative',
    value: 'creative',
    subCategories: [
      { name: 'Architecture', value: 'architecture' },
      { name: 'Abstract', value: 'abstract' },
      { name: 'Fine Art', value: 'fineart' },
      { name: 'Conceptual', value: 'conceptual' },
      { name: 'Editorial', value: 'editorial' }
    ]
  },
  {
    name: 'Commercial',
    value: 'commercial',
    subCategories: [
      { name: 'Product', value: 'product' },
      { name: 'Fashion', value: 'fashion' },
      { name: 'Food', value: 'food' },
      { name: 'Lifestyle', value: 'lifestyle' },
      { name: 'Brand', value: 'brand' }
    ]
  },
  {
    name: 'Documentary',
    value: 'documentary',
    subCategories: [
      { name: 'Wedding', value: 'wedding' },
      { name: 'Travel', value: 'travel' },
      { name: 'Reportage', value: 'reportage' },
      { name: 'Candid', value: 'candid' },
      { name: 'Photojournalism', value: 'photojournalism' }
    ]
  }
];

export default function Portfolio({ onImageClick, user }: PortfolioProps) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSubCategory, setActiveSubCategory] = useState('all');

  // Get sub-categories for the active category
  const currentSubCategories = activeCategory === 'all' 
    ? [] 
    : categories.find(cat => cat.value === activeCategory)?.subCategories || [];

  // Filter images based on active category and sub-category
  const filteredImages = portfolioImages.filter(img => {
    if (activeCategory === 'all') return true;
    if (activeSubCategory === 'all') return img.category === activeCategory;
    return img.category === activeCategory && img.subCategory === activeSubCategory;
  });

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    setActiveSubCategory('all');
  };

  return (
    <section id="portfolio" className="portfolio">
      <div className="container-fluid">
        <div className="section-header">
          <div className="section-tag">Our Portfolio</div>
          <h2 className="section-title">Selected Works</h2>
        </div>

        {/* Main Category Filters */}
        <div className="portfolio-filters">
          <button
            className={`filter-btn ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => handleCategoryChange('all')}
          >
            All Works
          </button>
          {categories.map(category => (
            <button
              key={category.value}
              className={`filter-btn ${activeCategory === category.value ? 'active' : ''}`}
              onClick={() => handleCategoryChange(category.value)}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Sub-category Filters */}
        {activeCategory !== 'all' && currentSubCategories.length > 0 && (
          <div className="portfolio-subfilters" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            justifyContent: 'center',
            marginTop: '24px',
            marginBottom: '40px'
          }}>
            <button
              className={`subfilter-btn ${activeSubCategory === 'all' ? 'active' : ''}`}
              onClick={() => setActiveSubCategory('all')}
              style={{
                padding: '8px 20px',
                background: activeSubCategory === 'all' ? 'var(--color-primary)' : 'var(--color-card)',
                color: 'var(--color-white)',
                border: '1px solid',
                borderColor: activeSubCategory === 'all' ? 'var(--color-primary)' : 'var(--color-gray-700)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'var(--transition)'
              }}
            >
              All {categories.find(c => c.value === activeCategory)?.name}
            </button>
            {currentSubCategories.map(subCat => (
              <button
                key={subCat.value}
                className={`subfilter-btn ${activeSubCategory === subCat.value ? 'active' : ''}`}
                onClick={() => setActiveSubCategory(subCat.value)}
                style={{
                  padding: '8px 20px',
                  background: activeSubCategory === subCat.value ? 'var(--color-primary)' : 'var(--color-card)',
                  color: 'var(--color-white)',
                  border: '1px solid',
                  borderColor: activeSubCategory === subCat.value ? 'var(--color-primary)' : 'var(--color-gray-700)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'var(--transition)'
                }}
              >
                {subCat.name}
              </button>
            ))}
          </div>
        )}

        <div className="portfolio-grid" id="portfolioGrid">
          {filteredImages.map((image, index) => {
            const originalIndex = portfolioImages.indexOf(image);
            return (
              <div
                key={originalIndex}
                className="portfolio-item"
                data-category={image.category}
                data-subcategory={image.subCategory}
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => onImageClick(originalIndex)}
              >
                <img src={image.src} alt={image.title} loading="lazy" />
                <div className="portfolio-overlay">
                  <div className="portfolio-title">{image.title}</div>
                  <div className="portfolio-category">
                    {image.category} • {image.subCategory}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredImages.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'var(--color-gray-400)'
          }}>
            <p>No images found in this category. More works coming soon!</p>
          </div>
        )}
      </div>
    </section>
  );
}