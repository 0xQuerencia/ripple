import {
  Butterfly,
  Sun,
  CloudSun,
  Lightning,
  Tree,
  Drop,
  Bus,
  Plant,
  Factory,
  FirstAid,
  Broadcast,
  Coins,
  GraduationCap,
  UsersThree,
  Fire,
  Cactus,
  Lightbulb,
  WifiSlash,
  Barricade,
  FlowerTulip,
  Cloud,
  Sparkle,
} from "@phosphor-icons/react";
const icons = {
  climate: CloudSun,
  power: Lightning,
  nature: Tree,
  water: Drop,
  transport: Bus,
  farming: Plant,
  industry: Factory,
  health: FirstAid,
  communications: Broadcast,
  economy: Coins,
  education: GraduationCap,
  people: UsersThree,
  blackout: Lightning,
  drought: Cactus,
  wildfire: Fire,
  strike: Barricade,
  discovery: Lightbulb,
  signal: WifiSlash,
  butterfly: Butterfly,
  sun: Sun,
  flower: FlowerTulip,
  cloud: Cloud,
  sparkle: Sparkle,
};
export function Art({ id, size = 42, className = "" }) {
  const Icon = icons[id] || Sparkle;
  return (
    <Icon
      size={size}
      weight="duotone"
      className={`art art-${id} ${className}`}
      aria-hidden="true"
    />
  );
}
export function Garden({ className = "" }) {
  return (
    <div className={`garden ${className}`} aria-hidden="true">
      <Art id="farming" size={56} />
      <Art id="flower" size={48} />
      <Art id="nature" size={68} />
      <Art id="flower" size={63} />
      <Art id="farming" size={44} />
    </div>
  );
}
