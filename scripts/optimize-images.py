"""Resize chart portraits and object photos, and write display thumbs.

Requires Pillow. Not part of `npm run build`; rerun after adding a raster asset,
then commit both the resized original and `thumbs/` sibling. SVG diagrams are left
alone. `npm run check:data` fails if a raster photo has no thumb.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "assets"
JOBS = (("mentors", 384, 128), ("objects", 512, 192))


def save(image: Image.Image, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.suffix.lower() == ".png":
        if image.mode not in ("RGB", "RGBA", "L"):
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        image.save(dest, "PNG", optimize=True)
        return
    if image.mode != "RGB":
        image = image.convert("RGB")
    image.save(dest, "JPEG", quality=72, optimize=True, progressive=True)


def main() -> None:
    for folder, full_max, thumb_max in JOBS:
        src_dir = ROOT / folder
        for path in sorted(src_dir.iterdir()):
            if not path.is_file() or path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
                continue
            image = Image.open(path)
            image.load()
            thumb = image.copy()
            thumb.thumbnail((thumb_max, thumb_max), Image.Resampling.LANCZOS)
            save(thumb, src_dir / "thumbs" / path.name)
            if max(image.size) > full_max:
                image.thumbnail((full_max, full_max), Image.Resampling.LANCZOS)
                save(image, path)


if __name__ == "__main__":
    main()
