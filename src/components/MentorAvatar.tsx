import { useState } from "react";
import { useAtlasState } from "../atlas-state.tsx";
import { publicUrl } from "../lib/assets.ts";
import type { Mentor } from "../types.ts";
import { Seal } from "./Seal.tsx";

export function MentorAvatar({ mentor, size }: { mentor: Mentor; size: number }) {
  const { flyingId } = useAtlasState();
  const [broken, setBroken] = useState(false);
  const showPhoto = Boolean(mentor.photo) && !broken;
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
          src={publicUrl(mentor.photo!)}
          alt=""
          draggable={false}
          style={{ objectPosition: mentor.photoFocus || "center 12%" }}
          onError={() => setBroken(true)}
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
