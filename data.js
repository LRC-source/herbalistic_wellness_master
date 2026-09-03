/**
 * ═══════════════════════════════════════════════════════════════════════
 * HERBALISTIC WELLNESS — DATA LAYER (data.js)
 * Foundational Content Matrix: Products, Blog Articles, Podcast Metadata
 * This module is the single source of truth for all dynamic content.
 * The app.js coordinator imports from here to hydrate all views.
 * ═══════════════════════════════════════════════════════════════════════
 */

export const APOTHECARY_DATABASE = {

  // ─── E-Commerce Storefront Categories ───────────────────────────────
  categories: [
    {
      id: "tinctures",
      name: "Tinctures",
      desc: "Concentrated botanical extracts meticulously crafted to bring you the potent benefits of nature's finest botanicals."
    },
    {
      id: "infused-oils",
      name: "Herbal Infused Oils",
      desc: "Slowly and carefully infused with a unique blend of botanicals to capture their potent protective properties."
    },
    {
      id: "natural-soaps",
      name: "Natural Soaps",
      desc: "Handcrafted in small batches with herbal infusions and skin-loving ingredients to cleanse without stripping moisture."
    },
    {
      id: "specialty-blends",
      name: "Herbie Specialty Blends",
      desc: "Handcrafted proprietary combinations thoughtfully selected to create synergistic lifestyle balance loops."
    },
    {
      id: "dried-herbs",
      name: "Dried Herbs",
      desc: "Pure, potent, sustainably wildcrafted and organic botanicals selected to empower your home remedies layout."
    }
  ],

  // ─── Exact Inventory Assets & Pricing Matrices ──────────────────────
  products: [
    {
      id: "immune-drops",
      name: "Forest Elder Immune Drops",
      slug: "forest-elder-immune-drops",
      category: "tinctures",
      price: 34.0, compareAtPrice: 40.00,
      desc: "Elderberry, echinacea, and astragalus extracted cleanly into a vegetable glycerin base.",
      svgType: "tincture",
      svgAccent: "#482C6A"
    },
    {
      id: "arnica-oil",
      name: "Ancient Arnica Infused Oil",
      slug: "ancient-arnica-infused-oil",
      category: "infused-oils",
      price: 22.49, compareAtPrice: 26.46,
      size: "2oz",
      desc: "Traditional arnica flower extraction designed for targeted topical muscle relief and recovery.",
      svgType: "oil-bottle",
      svgAccent: "#D88C43"
    },
    {
      id: "burdock-root",
      name: "Organic Burdock Root Isolate",
      category: "dried-herbs",
      price: 10.0, compareAtPrice: 11.760,
      size: "2oz",
      desc: "Premium wildcrafted Arctium lappa root for systemic deep cleansing and clear skin support.",
      svgType: "herb-pouch",
      svgAccent: "#829399"
    },
    {
      id: "st-johns-wort-dried",
      name: "St. John's Wort (Dried)",
      category: "dried-herbs",
      price: 13.5, compareAtPrice: 15.880,
      desc: "Mood-regulating whole herb ideal for DIY tea preparations and botanical wellness infusions.",
      svgType: "herb-pouch",
      svgAccent: "#D88C43"
    },
    {
      id: "lavender-flowers",
      name: "French Lavender Buds",
      category: "dried-herbs",
      price: 5.53, compareAtPrice: 6.51,
      size: ".5oz",
      desc: "Sustainably harvested Lavandula angustifolia flower tops for nervine relaxation protocols.",
      svgType: "herb-pouch",
      svgAccent: "#482C6A"
    },
    {
      id: "turmeric-soap",
      name: "Turmeric Root Repair Bar",
      category: "natural-soaps",
      price: 10.0, compareAtPrice: 11.760,
      desc: "Anti-inflammatory skin repair soap designed to leave a clear, radiant complexion.",
      svgType: "soap-bar",
      svgAccent: "#D88C43"
    },
    {
      id: "lavender-oatmeal-soap",
      name: "Lavender Oatmeal Calming Bar",
      category: "natural-soaps",
      price: 10.0, compareAtPrice: 11.760,
      desc: "A soothing, gentle bar for sensitive skin utilizing organic oatmeal and lavender extracts.",
      svgType: "soap-bar",
      svgAccent: "#482C6A"
    },
    {
      id: "charcoal-soap",
      name: "Activated Charcoal Deep Clean Bar",
      category: "natural-soaps",
      price: 10.0, compareAtPrice: 11.760,
      desc: "Additive-free structural soap crafted for high-performance extraction of skin impurities.",
      svgType: "soap-bar",
      svgAccent: "#1A3021"
    },
    {
      id: "golden-facial-elixir",
      name: "Golden Root Facial Elixir",
      category: "infused-oils",
      price: 56.0, compareAtPrice: 65.880,
      desc: "Turmeric, rosehip, and calendula complex calculated to boost organic collagen generation.",
      svgType: "oil-bottle",
      svgAccent: "#D88C43"
    },
    {
      id: "eucalyptus-scrub",
      name: "Eucalyptus Mint Body Scrub",
      category: "specialty-blends",
      price: 24.0, compareAtPrice: 28.240,
      desc: "Exfoliating botanical spa salts packed with cold-pressed mint essences for respiratory clarity.",
      svgType: "jar",
      svgAccent: "#1A3021"
    }
  ],

  // Ensure every product has a slug for routing
  runProductSlugHydration() {
    this.products.forEach(p => {
      if (!p.slug) {
        p.slug = p.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      }
    });
  },

  // ─── "What's The Tea?" Blog Integration Matrix ──────────────────────
  blogArticles: [
    {
      id: "black-herbalism",
      title: "The Business of Black Herbalism: Reclaiming Ownership in a Commercialized World",
      category: "Sourcing Logs",
      date: "Feb 02, 2025",
      slug: "business-of-black-herbalism",
      excerpt: "Exploring how Black herbalists are reclaiming ancestral plant knowledge and building sustainable businesses rooted in cultural sovereignty and ethical wildcrafting."
    },
    {
      id: "stress-relief",
      title: "5 Herbal Remedies for Stress & Anxiety Relief through Holistic Practices",
      category: "Biomedical Analysis",
      date: "Mar 05, 2025",
      slug: "5-herbal-remedies-stress-relief",
      excerpt: "A deep pharmacological breakdown of five nervine botanicals — passionflower, skullcap, ashwagandha, lemon balm, and holy basil — and their measurable effects on cortisol cascade suppression."
    },
    {
      id: "butterfly-pea",
      title: "Discover the Alluring and Healthy Delights of Butterfly Pea Flower Tea",
      category: "Extraction Tech",
      date: "Mar 12, 2025",
      slug: "butterfly-pea-flower-tea",
      excerpt: "Clitoria ternatea's anthocyanin matrix behaves as a natural pH indicator — turning violet in alkaline and magenta in acidic environments. We document the extraction science and antioxidant density profiles."
    },
    {
      id: "arthritis-joint",
      title: "Herbs for Arthritis: Nurturing Joint Health with Nature's Bounty",
      category: "Biomedical Analysis",
      date: "Jan 14, 2024",
      slug: "herbs-arthritis-joint-health",
      excerpt: "Boswellia, devil's claw, and cat's claw examined through the lens of COX-2 inhibition pathways, synovial fluid dynamics, and double-blind clinical trial outcomes."
    },
    {
      id: "gardyn-vs-traditional",
      title: "Gardyn Hydroponics vs Traditional Gardening Systems",
      category: "Sourcing Logs",
      date: "Jan 13, 2025",
      slug: "gardyn-vs-traditional-gardening",
      excerpt: "A side-by-side cultivation analysis measuring phytochemical density output, water consumption ratios, and seasonal yield consistency across soil and hydroponic growing environments."
    },
    {
      id: "daily-routine",
      title: "Wellness Made Easy: Integrating Herbs into Your Daily Routine",
      category: "Biomedical Analysis",
      date: "Oct 25, 2023",
      slug: "integrating-herbs-daily-routine",
      excerpt: "Practical circadian-aware protocols for morning adaptogens, midday nervines, and evening sedatives — structured around the body's natural hormonal rhythm cycles."
    }
  ],

  // ─── "Herb & Soul" Podcast Production System Parameters ────────────
  podcastMetadata: {
    showTitle: "Herb & Soul Podcast",
    host: "La'Toya Renee The Herbalist",
    globalFeedUrl: "https://rss.app/feeds/DYleFLKRuVFHx8QA.xml",
    category: "Health & Fitness (Alternative Health)",
    coverImage: "https://herbalisticwellness.com/wp-content/uploads/2024/12/Black-Gold-Classy-Podcast-Show-Cover-4.png",
    description: "The Herb and Soul podcast is your go-to guide for all things herbal. We explore ancient plant wisdom and modern applications to help you live a healthier, more vibrant life.",
    // Simulated episode list for the player interface
    episodes: [
      {
        id: "ep-042",
        number: "042",
        title: "The Intelligence of Mycelium Networks",
        guest: "Dr. Amara Osei",
        duration: "32:18",
        durationSeconds: 1938,
        tag: "Mycology",
        description: "We go deep into the underground fungal internet — how mycelial networks communicate chemical signals, transfer nutrients across forest ecosystems, and what this means for future bioactive formulation."
      },
      {
        id: "ep-041",
        number: "041",
        title: "Bitters, Bile, and the Forgotten Digestive Arc",
        guest: "Zara Fontaine RH",
        duration: "44:02",
        durationSeconds: 2642,
        tag: "Digestion",
        description: "A masterclass in the bitter taste receptor pathway — how gentian, dandelion root, and artichoke leaf fire vagus nerve signals that prime bile flow before a meal even arrives."
      },
      {
        id: "ep-040",
        number: "040",
        title: "Foraging Ethics in the 21st Century",
        guest: "Marco Velasquez",
        duration: "28:55",
        durationSeconds: 1735,
        tag: "Ecology",
        description: "Navigating the tension between wildcrafting tradition and ecological responsibility — population-level risk assessment, ethical harvest thresholds, and regenerative land stewardship."
      },
      {
        id: "ep-039",
        number: "039",
        title: "Nervines and the Vagus Nerve Revolution",
        guest: "Dr. Keiko Tanaka",
        duration: "51:10",
        durationSeconds: 3070,
        tag: "Neurology",
        description: "Polyvagal theory meets botanical medicine. How lemon balm, motherwort, and California poppy modulate the parasympathetic branch for measurable stress resilience outcomes."
      },
      {
        id: "ep-038",
        number: "038",
        title: "Soil Intelligence and Phytochemical Density",
        guest: "Ingrid Larsson",
        duration: "37:44",
        durationSeconds: 2264,
        tag: "Agriculture",
        description: "The mineral profile of soil is not a passive substrate — it is an active co-formulator. We examine how microbial density and humic acid ratios shape the secondary metabolite output of medicinal plants."
      }
    ]
  },

  // ─── The Formulators Collective Course Modules ──────────────────────
  collectiveCourses: [
    { id: "course-01", number: "01", name: "Botanical Foundations", desc: "Plant morphology, taxonomy, ecology, and identification across 80+ medicinal species.", tag: "Foundation" },
    { id: "course-02", number: "02", name: "Extraction Science", desc: "Menstruum chemistry, marc ratios, solubility parameters, and standardization protocols.", tag: "Technical" },
    { id: "course-03", number: "03", name: "Adaptogen Protocols", desc: "HPA axis regulation, cortisol feedback loops, and clinical adaptogen dosing logic.", tag: "Clinical" },
    { id: "course-04", number: "04", name: "Aromatic Medicine", desc: "Essential oil chemistry, hydrosol production, and aromatic pharmacology pathways.", tag: "Advanced" },
    { id: "course-05", number: "05", name: "Fermentation & Oxymels", desc: "Lacto-fermentation science, vinegars, meads, fire ciders, and preservation theory.", tag: "Craft" },
    { id: "course-06", number: "06", name: "Business of Herbalism", desc: "FDA compliance, GMP standards, product formulation for market, and ethical sourcing.", tag: "Practice" }
  ]
};

APOTHECARY_DATABASE.runProductSlugHydration();

