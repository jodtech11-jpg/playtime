import { useEffect, useRef, useState } from 'react';

export const useScrollAnimation = (threshold: number = 0.1, initialVisible: boolean = false) => {
  const [isVisible, setIsVisible] = useState(initialVisible);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // If initialVisible is true, set it immediately
    if (initialVisible) {
      setIsVisible(true);
      return; // Skip observer setup for initially visible elements
    }

    // Check if element is already visible on mount
    const checkInitialVisibility = () => {
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      const windowWidth = window.innerWidth || document.documentElement.clientWidth;
      // Check if element is in viewport (with some margin)
      const isInViewport = rect.top < windowHeight + 100 && rect.bottom > -100 && rect.left < windowWidth && rect.right > 0;
      if (isInViewport) {
        setIsVisible(true);
      }
    };

    // Check immediately and after DOM is ready
    checkInitialVisibility();
    const checkTimeout = setTimeout(checkInitialVisibility, 100);
    const checkTimeout2 = setTimeout(checkInitialVisibility, 500); // Fallback check

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold, rootMargin: '50px' } // Add margin to trigger earlier
    );

    observer.observe(element);

    return () => {
      clearTimeout(checkTimeout);
      clearTimeout(checkTimeout2);
      observer.disconnect();
    };
  }, [threshold, initialVisible]);

  return { ref, isVisible };
};

