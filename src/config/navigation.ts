export const navigationConfig = {
  features: {
    // Hidden until corresponding pages exist
    enableLearningPaths: false, // "Parcours"
    enableBlog: false,          // "Blog"
  },
  links: [
    { href: "/" as const, key: "home", exact: true },
    { href: "/formations" as const, key: "courses", exact: false },
    { href: "/a-propos" as const, key: "about", exact: false },
    { href: "/contact" as const, key: "contact", exact: false },
  ],
};
