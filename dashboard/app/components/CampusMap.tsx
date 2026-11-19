import Image from "next/image";
import Link from "next/link";
import type { MapPin } from "../data/rankings";

// public/campus-map.png (Map.png with its shadow border cropped off).
const MAP = { src: "/campus-map.png", width: 1412, height: 769 };

type CampusMapProps = {
  pins: MapPin[];
  selectedId?: string;
  /** Pins become buttons calling this (map page)… */
  onSelect?: (pin: MapPin) => void;
  /** …or links to `${linkTo}?site=<id>` (e.g. the home page → /map). */
  linkTo?: string;
  className?: string;
};

/**
 * The campus map image, scaled to COVER its box (cropping the overflow, centred),
 * with pins placed in % of the image so they stay on their buildings at any size.
 * The box needs a size from its parent (e.g. flex-1 / min-h-*).
 */
export default function CampusMap({ pins, selectedId, onSelect, linkTo, className = "" }: CampusMapProps) {
  return (
    <div className={`relative overflow-hidden [container-type:size] ${className}`}>
      {/* Cover sizing via container units: at least as wide AND as tall as the box, keeping the image ratio. */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: `max(100cqw, 100cqh * ${MAP.width / MAP.height})`,
          height: `max(100cqh, 100cqw * ${MAP.height / MAP.width})`,
        }}
      >
        <Image
          src={MAP.src}
          alt="Map of the Chulalongkorn University area"
          fill
          sizes="(min-width: 768px) 75vw, 100vw"
          className="select-none"
          draggable={false}
        />

        {pins.map((pin) => {
          const selected = pin.id === selectedId;
          const style = { left: `${pin.x}%`, top: `${pin.y}%` };
          const pinClass =
            "absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F2A44]";
          const dot = <PinDot selected={selected} />;

          return linkTo ? (
            <Link key={pin.id} href={`${linkTo}?site=${pin.id}`} aria-label={pin.label} title={pin.label} className={pinClass} style={style}>
              {dot}
            </Link>
          ) : (
            <button
              key={pin.id}
              type="button"
              aria-label={pin.label}
              aria-pressed={selected}
              title={pin.label}
              onClick={() => onSelect?.(pin)}
              className={pinClass}
              style={style}
            >
              {dot}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PinDot({ selected }: { selected: boolean }) {
  return (
    <span
      className={`flex h-full w-full items-center justify-center rounded-full ${
        selected
          ? "bg-[#F26B6B] shadow-[0_0_0_5px_rgba(242,107,107,0.35),0_2px_4px_rgba(0,0,0,0.3)]"
          : "bg-[#5AA7EE] shadow-[0_0_0_5px_rgba(90,167,238,0.35),0_2px_4px_rgba(0,0,0,0.3)]"
      }`}
    >
      {/* map-pin glyph */}
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#0F2A44" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    </span>
  );
}
