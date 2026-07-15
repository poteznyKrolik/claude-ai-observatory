interface SkeletonProps {
  width?: string | number
  height?: string | number
  shape?: 'rect' | 'circle' | 'line'
  className?: string
}

export default function Skeleton({
  width,
  height,
  shape = 'rect',
  className = '',
}: SkeletonProps) {
  const shapeClasses = {
    rect: 'rounded-lg',
    circle: 'rounded-full',
    line: 'rounded h-4 w-full',
  }

  return (
    <div
      className={`animate-pulse bg-[var(--bg-tertiary)] ${shapeClasses[shape]} ${className}`}
      style={{
        width: shape === 'line' ? undefined : width,
        height: shape === 'line' ? undefined : height,
      }}
    />
  )
}
