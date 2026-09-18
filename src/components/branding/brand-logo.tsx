import Image from "next/image";

type BrandLogoProps = {
  compact?: boolean;
  priority?: boolean;
};

export function BrandLogo({
  compact = false,
  priority = false,
}: BrandLogoProps) {
  return (
    <span
      className={compact ? "brand-logo brand-logo--compact" : "brand-logo"}
      aria-hidden="true"
    >
      <Image
        src="/logo.png"
        alt=""
        fill
        priority={priority}
        sizes={compact ? "38px" : "58px"}
      />
    </span>
  );
}
