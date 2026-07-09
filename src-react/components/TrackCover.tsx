import { Image } from '../../src/state';

function bestImage(images: Image[], targetPx: number): Image | null {
    if (!images || images.length === 0) return null;
    const sorted = [...images].sort((a, b) => Math.abs(a.width - targetPx) - Math.abs(b.width - targetPx));
    return sorted[0];
}

export function TrackCover({ images, size = 54 }: { images: Image[]; size?: number }) {
    const img = bestImage(images, size);
    if (!img) {
        return <div style={{ width: size, height: size }} className="bg-black/20 shrink-0" />;
    }
    return (
        <img
            src={img.url}
            width={size}
            height={size}
            className="shrink-0 object-cover"
            style={{ width: size, height: size }}
            alt=""
        />
    );
}
