import { SpinnerGap } from "@phosphor-icons/react";

export default function Spinner({ size = 24, className = "" }) {
  return (
    <SpinnerGap
      size={size}
      className={`animate-spin text-brand-500 ${className}`}
    />
  );
}
