import { getImageProps } from "next/image";

type HomeCategoryLink = {
  href: string;
  label: string;
};

export default function HomeCategories({
  items,
}: {
  items: HomeCategoryLink[];
}) {
  const featuredCategories = [
    { href: "/whey-protein", label: "Protein", description: "Find your whey. Compare the value.", image: "protein" },
    { href: "/creatine", label: "Creatine", description: "Compare packs and verified unit costs.", image: "creatine" },
    { href: "/pre-workout", label: "Pre-workout", description: "Explore your next pre-workout.", image: "pre-workout" },
    { href: "/vitamins", label: "Vitamins & Health", description: "Everyday essentials, clearly compared.", image: "vitamins" },
  ];

  return (
    <section id="categories" className="home-categories px-5 sm:px-6" aria-labelledby="categories-heading">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 sm:text-sm">
          Browse
        </p>
        <h2 id="categories-heading" className="mt-2 text-2xl font-bold sm:text-3xl">
          Explore supplements
        </h2>

        <div className="home-category-featured">
          {featuredCategories.map((category) => {
            const item = items.find((item) => item.href === category.href);
            const { props } = getImageProps({ src: `/images/home/categories/${category.image}.webp`, width: 480, height: 320, sizes: "(max-width: 639px) 160px, (max-width: 1023px) 240px, 210px", alt: "", className: "home-category-image" });
            return item ? (
              <a key={item.href} href={item.href} className="home-category-card">
                <picture>
                  <source media="(min-width: 640px)" srcSet={props.srcSet} sizes={props.sizes} />
                  <img {...props} alt="" />
                </picture>
                <h3>{category.label}</h3>
                <p>{category.description}</p>
                <span className="home-category-arrow" aria-hidden="true">→</span>
              </a>
            ) : null;
          })}
        </div>
      </div>
    </section>
  );
}
