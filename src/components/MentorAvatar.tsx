import { useState } from "react";
import { useAtlasState } from "../atlas-state.tsx";
import { publicUrl, thumbUrl } from "../lib/assets.ts";
import type { Mentor } from "../types.ts";
import { Seal } from "./Seal.tsx";

export function MentorAvatar({
  mentor,
  size,
  thumb = false,
  loading = "eager",
}: {
  mentor: Mentor;
  size: number;
  thumb?: boolean;
  loading?: "eager" | "lazy";
}) {
  const { flyingId } = useAtlasState();
  const [source, setSource] = useState<"thumb" | "full" | "none">(
    mentor.photo ? (thumb ? "thumb" : "full") : "none",
  );
  const showPhoto = source !== "none" && Boolean(mentor.photo);
  return (
    <span
      className={`mentor-avatar${mentor.coverage === "broad" ? " is-broad" : ""}`}
      data-avatar-for={mentor.id}
      style={{
        width: size,
        height: size,
        borderColor: mentor.pigment,
        viewTransitionName: flyingId === mentor.id ? "mentor-flight" : undefined,
      }}
    >
      {showPhoto ? (
        <img
          src={source === "thumb" ? thumbUrl(mentor.photo!) : publicUrl(mentor.photo!)}
          alt=""
          width={size}
          height={size}
          draggable={false}
          decoding="async"
          loading={loading}
          style={{ objectPosition: mentor.photoFocus || "center 12%" }}
          onError={() => setSource((current) => (current === "thumb" ? "full" : "none"))}
        />
      ) : (
        <Seal
          id={mentor.id}
          char={mentor.seal}
          pigment={mentor.pigment}
          broad={mentor.coverage === "broad"}
          size={size}
        />
      )}
    </span>
  );
}
