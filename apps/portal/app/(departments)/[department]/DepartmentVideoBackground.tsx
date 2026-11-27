'use client';

interface DepartmentVideoBackgroundProps {
  department: string;
}

export function DepartmentVideoBackground({ department }: DepartmentVideoBackgroundProps) {
  const slug = department.toLowerCase().replace(/\s+/g, '-');
  const src = `/images/departments/${slug}.mp4`;
  const poster = `/images/departments/${slug}.webp`;

  return (
    <div
      data-testid="department-video-background"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <video
        className="h-full w-full scale-105 object-cover object-center opacity-40 contrast-105 saturate-125"
        autoPlay
        loop
        muted
        playsInline
        disablePictureInPicture
        preload="metadata"
        poster={poster}
        onError={(e) => {
          (e.currentTarget as HTMLVideoElement).style.display = 'none';
        }}
      >
        <source src={src} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-white/40 to-white/60 backdrop-blur-[2px]" />
    </div>
  );
}
