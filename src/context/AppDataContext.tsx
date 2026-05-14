import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface BannerSlide {
  image: string;
  text: string;
  description: string;
}

interface BannerSettings {
  promoText?: string;
  promoLines?: { text: string }[];
  bannerImage?: string;
  bannerText?: string;
  bannerSlides?: BannerSlide[];
}

interface Category {
  _id: string;
  name: string;
  image?: string;
  parentId?: string;
  createdAt?: string;
}

interface AppDataContextType {
  categories: Category[];
  banner: BannerSettings | null;
  isLoaded: boolean; // true only when BOTH APIs have responded
}

const AppDataContext = createContext<AppDataContextType>({
  categories: [],
  banner: null,
  isLoaded: false,
});

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [banner, setBanner] = useState<BannerSettings | null>(null);
  const [categoriesDone, setCategoriesDone] = useState(false);
  const [bannerDone, setBannerDone] = useState(false);

  useEffect(() => {
    // Fetch both APIs in parallel
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const filtered = data
            .filter((c: any) => !c.parentId && c.name && c.name.trim() !== '')
            .sort((a: any, b: any) =>
              new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
            );
          setCategories(filtered);
        }
      })
      .catch(() => {})
      .finally(() => setCategoriesDone(true));

    fetch('/api/banner')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) setBanner(data);
      })
      .catch(() => {})
      .finally(() => setBannerDone(true));
  }, []);

  // isLoaded is only true once BOTH APIs have responded
  const isLoaded = categoriesDone && bannerDone;

  return (
    <AppDataContext.Provider value={{ categories, banner, isLoaded }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  return useContext(AppDataContext);
}
