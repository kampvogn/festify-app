export function Spinner({ size = 40 }: { size?: number }) {
    return (
        <div
            className="animate-spin rounded-full border-2 border-transparent border-t-white"
            style={{ width: size, height: size }}
            role="status"
            aria-label="Loading"
        />
    );
}
