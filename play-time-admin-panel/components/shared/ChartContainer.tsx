import React, { useEffect, useRef, useState, ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';

interface ChartContainerProps {
  height: number;
  className?: string;
  children: ReactElement;
}

const ChartContainer: React.FC<ChartContainerProps> = ({ height, className = '', children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateDimensions = () => {
      const { width, height: measuredHeight } = element.getBoundingClientRect();
      if (width > 0 && measuredHeight > 0) {
        setDimensions({ width, height: measuredHeight });
      }
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(element);
    return () => observer.disconnect();
  }, [height]);

  return (
    <div
      ref={containerRef}
      className={`min-w-0 w-full ${className}`}
      style={{ height, minHeight: height }}
    >
      {dimensions && (
        <ResponsiveContainer width={dimensions.width} height={dimensions.height} minWidth={0}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default ChartContainer;
