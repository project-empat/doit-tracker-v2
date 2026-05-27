import { useRef, useState, useEffect, useCallback } from "react";

interface MomentumPoint {
	date: string;
	momentum: number | null;
}

interface Props {
	data: MomentumPoint[];
	height?: number;
	compact?: boolean;
}

function formatShort(dateStr: string) {
	const d = new Date(dateStr);
	return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDetailed(dateStr: string) {
	const d = new Date(dateStr);
	return d.toLocaleDateString("en-US", {
		weekday: "short",
		month: "long", day: "numeric", year: "numeric",
	});
}

function getColor(m: number | null): string {
	if (m === null) return "#9ca3af";
	if (m > 20) return "#16a34a";
	if (m > 10) return "#22c55e";
	if (m > 0) return "#4ade80";
	if (m === 0) return "#9ca3af";
	if (m > -10) return "#fb923c";
	if (m > -20) return "#f97316";
	return "#ef4444";
}

export default function MomentumChart({ data, height = 150, compact = false }: Props) {
	const svgRef = useRef<SVGSVGElement>(null);
	const [width, setWidth] = useState(300);
	const [hovered, setHovered] = useState<{
		index: number; x: number; y: number; momentum: number; date: string;
	} | null>(null);

	const margin = {
		top: compact ? 10 : 20,
		right: compact ? 5 : 20,
		bottom: compact ? 15 : 30,
		left: compact ? 5 : 30,
	};

	useEffect(() => {
		const el = svgRef.current?.parentElement;
		if (!el) return;
		const update = () => setWidth(el.clientWidth);
		update();
		const ro = new ResizeObserver(update);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const cw = Math.max(width - margin.left - margin.right, 50);
	const ch = height - margin.top - margin.bottom;

	const valid = data.filter((d): d is MomentumPoint & { momentum: number } => d.momentum !== null).map((d) => d.momentum);
	const rawMax = valid.length > 0 ? Math.max(...valid, 5) : 5;
	const rawMin = valid.length > 0 ? Math.min(...valid, -5) : -5;
	const pad = Math.max(1, (rawMax - rawMin) * 0.2);
	const maxV = rawMax + pad;
	const minV = rawMin - pad;

	const yScale = useCallback(
		(v: number) => ch - ((v - minV) / (maxV - minV)) * ch,
		[ch, minV, maxV],
	);
	const xScale = useCallback(
		(i: number) => (i / Math.max(data.length - 1, 1)) * cw,
		[cw, data.length],
	);

	const zeroY = yScale(0);
	const points = data
		.map((p, i) => (p.momentum !== null ? `${xScale(i)},${yScale(p.momentum)}` : null))
		.filter(Boolean)
		.join(" ");

	const handleMove = (e: React.MouseEvent) => {
		if (!data.length || cw <= 0) return;
		const rect = svgRef.current?.getBoundingClientRect();
		if (!rect) return;
		const mx = e.clientX - rect.left - margin.left;
		const spacing = cw / (data.length - 1);
		const idx = Math.max(0, Math.min(Math.round(mx / spacing), data.length - 1));
		const pt = data[idx];
		if (pt && pt.momentum !== null) {
			setHovered({
				index: idx,
				x: xScale(idx),
				y: yScale(pt.momentum),
				momentum: pt.momentum,
				date: pt.date,
			});
		}
	};

	const handleLeave = () => setHovered(null);

	const tickInterval = compact
		? Math.max(1, Math.floor(data.length / 3))
		: Math.max(1, Math.floor(data.length / 5));

	return (
		<div className="w-full relative" style={{ height: height + margin.top + margin.bottom }}>
			<svg
				ref={svgRef}
				width="100%"
				height="100%"
				className="overflow-visible"
				onMouseMove={handleMove}
				onMouseLeave={handleLeave}
			>
				<g transform={`translate(${margin.left},${margin.top})`}>
					<line x1={0} y1={zeroY} x2={cw} y2={zeroY} stroke="#d1d5db" strokeWidth={1} strokeDasharray="4 4" />
					{!compact && (
						<>
							<text x={-6} y={5} textAnchor="end" fontSize={10} fill="#6b7280">{Math.round(maxV)}</text>
							<text x={-6} y={ch} textAnchor="end" fontSize={10} fill="#6b7280">{Math.round(minV)}</text>
							<text x={-6} y={zeroY + 4} textAnchor="end" fontSize={10} fill="#6b7280">0</text>
						</>
					)}
					{points && cw > 0 && (
						<polyline points={points} fill="none" stroke="#4f46e5" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
					)}
					{data.map((pt, i) =>
						pt.momentum !== null ? (
							<circle key={i} cx={xScale(i)} cy={yScale(pt.momentum)} r={compact ? 3 : 4} fill={getColor(pt.momentum)} stroke="#fff" strokeWidth={1} />
						) : null,
					)}
					{data.map((pt, i) =>
						i % tickInterval === 0 || i === data.length - 1 ? (
							<text key={i} x={xScale(i)} y={ch + (compact ? 12 : 20)} textAnchor="middle" fontSize={compact ? 8 : 10} fill="#6b7280">
								{formatShort(pt.date)}
							</text>
						) : null,
					)}
					{hovered && (
						<>
							<line x1={hovered.x} y1={0} x2={hovered.x} y2={ch} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />
							<circle cx={hovered.x} cy={hovered.y} r={6} fill={getColor(hovered.momentum)} stroke="#fff" strokeWidth={2} />
							<rect x={hovered.x - 50} y={Math.max(hovered.y - 50, -5)} width={100} height={40} rx={4} fill="#1f2937" opacity={0.95} />
							<text x={hovered.x} y={Math.max(hovered.y - 30, 10)} textAnchor="middle" fontSize={11} fill="#fff">
								{formatDetailed(hovered.date)}
							</text>
							<text x={hovered.x} y={Math.max(hovered.y - 16, 24)} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#fff">
								Momentum: {hovered.momentum}
							</text>
						</>
					)}
				</g>
			</svg>
		</div>
	);
}
