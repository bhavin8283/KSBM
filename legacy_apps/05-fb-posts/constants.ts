export const PRODUCT_CATEGORIES = [
  "Energy Drinks",
  "Soft Drinks",
  "Snacks",
  "Milk & Dairy Products",
  "Ice Cream",
  "Confectionery",
  "Convenience Store Promotions",
] as const;

export const CAPTION_TONES = [
  "Fun",
  "Professional",
  "Promotional",
  "Trendy",
  "Sales Focused",
] as const;

export const BACKGROUND_STYLES = [
  { value: "Auto", label: "Auto-Match (Intelligent category recognition)" },
  { value: "Realistic Studio", label: "Realistic Studio Showcase" },
  { value: "Outdoor", label: "Outdoor Commercial Setting" },
  { value: "Nature", label: "Nature Atmosphere (Forest, stream, mountain)" },
  { value: "Luxury", label: "Luxury Showcase (Gold accents, marble)" },
  { value: "Splash", label: "Water / Fruit Splash" },
  { value: "Ice", label: "Frosted Ice Sparkles (Frozen chill)" },
  { value: "Fire", label: "Fire / Heat Wave (Glowing explosive energy)" },
  { value: "Neon", label: "Neon Cyberpunk Desk (LED bars)" },
  { value: "Tropical", label: "Tropical Oasis (Palm leaves, beach sunset)" },
  { value: "Christmas", label: "Christmas Holiday Scene" },
  { value: "Halloween", label: "Spooky Halloween Vibe" },
  { value: "Sports", label: "Sports Athletic Gym" },
  { value: "Café", label: "Cozy Café Setting (Roasted coffee beans, steam)" },
  { value: "Vintage", label: "Vintage Retro Diner" },
] as const;

export const SAFE_AREA_MODES = [
  { value: "Facebook & Instagram Mobile-Optimized", label: "Facebook & Instagram Mobile-Optimized (1:1 Square - 512x512px)" },
  { value: "Instagram Feed", label: "Instagram Post (1:1 Square - 1080x1080px)" },
  { value: "Facebook Feed", label: "Facebook Feed (1:1 Square - 1200x1200px)" },
  { value: "Instagram Stories", label: "Instagram Story (9:16 Vertical - 1080x1920px)" },
  { value: "Facebook Stories", label: "Facebook Story (9:16 Vertical - 1080x1920px)" },
  { value: "Reels Cover", label: "Reels Cover Preview (9:16 Vertical)" },
  { value: "Portrait Posts", label: "Portrait Post (4:5 Vertical - 1080x1350px)" },
] as const;

export const KSBM_PERMISSION_KEYS = {
  VIEW: "social.view",
  UPLOAD: "social.upload",
  EDIT: "social.edit",
  DELETE: "social.delete",
  APPROVE: "social.approve",
  PUBLISH: "social.publish",
  MANAGE_ASSETS: "social.assets.manage",
  MANAGE_SETTINGS: "social.settings.manage",
} as const;

export const MODULE_VIEWS = [
  { id: "dashboard", label: "Overview" },
  { id: "upload", label: "Product Studio" },
  { id: "assets", label: "Media Vault" },
  { id: "calendar", label: "Publish Queue" },
  { id: "settings", label: "Templates & Integrations" },
] as const;
