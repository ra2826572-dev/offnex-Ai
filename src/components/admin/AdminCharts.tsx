'use client';

import React, { useMemo, useState } from 'react';
import { Conversation, GeneratedImageRecord, UserProfile } from '../../types';

export type AnalyticsRange = '7D' | '30D' | '90D';

interface SparklineProps {
  values: number[];
  strokeColor: string;
  gradientId: string;
}

export const KpiSparkline: React.FC<SparklineProps> = ({ values, strokeColor, gradientId }) => {
  const safeValues = values.length >= 2 ? values : [1, 2, 1.5, 3, 2.5, 4];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const span = max - min || 1;
  const width = 120;
  const height = 40;

  const points = safeValues.map((v, i) => {
    const x = (i / (safeValues.length - 1)) * width;
    const y = height - 6 - ((v - min) / span) * (height - 12);
    return { x, y };
  });

  const linePath = points.reduce((acc, pt, idx) => {
    if (idx === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    const prev = points[idx - 1];
    const cx = ((prev.x + pt.x) / 2).toFixed(1);
    return `${acc} C ${cx} ${prev.y.toFixed(1)}, ${cx} ${pt.y.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-24 h-10 overflow-visible shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
};

interface PlatformAnalyticsChartProps {
  conversations: Conversation[];
  images: GeneratedImageRecord[];
  users: UserProfile[];
  range: AnalyticsRange;
  onRangeChange: (r: AnalyticsRange) => void;
}

interface ChartBucket {
  label: string;
  chats: number;
  images: number;
  users: number;
  total: number;
}

export const PlatformAnalyticsChart: React.FC<PlatformAnalyticsChartProps> = ({
  conversations,
  images,
  users,
  range,
  onRangeChange,
}) => {
  const buckets = useMemo<ChartBucket[]>(() => {
    const now = new Date();
    const dayCount = range === '7D' ? 7 : range === '30D' ? 10 : 12;
    const stepDays = range === '7D' ? 1 : range === '30D' ? 3 : 8;
    const items: ChartBucket[] = [];

    for (let i = dayCount - 1; i >= 0; i--) {
      const bucketEnd = new Date(now);
      bucketEnd.setHours(23, 59, 59, 999);
      bucketEnd.setDate(bucketEnd.getDate() - i * stepDays);

      const bucketStart = new Date(bucketEnd);
      bucketStart.setHours(0, 0, 0, 0);
      bucketStart.setDate(bucketStart.getDate() - (stepDays - 1));

      const label =
        range === '7D'
          ? bucketEnd.toLocaleDateString('en-US', { weekday: 'short' })
          : bucketEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const inWindow = (iso?: string) => {
        if (!iso) return false;
        const ts = new Date(iso).getTime();
        return ts >= bucketStart.getTime() && ts <= bucketEnd.getTime();
      };

      const chatsCount = conversations.filter((c) => inWindow(c.updatedAt) || inWindow(c.createdAt)).length;
      const imagesCount = images.filter((img) => inWindow(img.createdAt)).length;
      const usersCount = users.filter((u) => inWindow(u.createdAt) || inWindow(u.lastLoginAt)).length;

      items.push({
        label,
        chats: chatsCount,
        images: imagesCount,
        users: usersCount,
        total: chatsCount + imagesCount,
      });
    }

    return items;
  }, [conversations, images, users, range]);

  const defaultIndex = useMemo(() => {
    let maxIdx = Math.max(0, buckets.length - 1);
    let maxVal = -1;
    buckets.forEach((b, idx) => {
      if (b.total >= maxVal) {
        maxVal = b.total;
        maxIdx = idx;
      }
    });
    return maxIdx;
  }, [buckets]);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const activeIdx = hoveredIndex !== null && hoveredIndex < buckets.length ? hoveredIndex : defaultIndex;

  const width = 640;
  const height = 220;
  const padLeft = 36;
  const padRight = 18;
  const padTop = 28;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const rawMax = Math.max(4, ...buckets.map((b) => b.total));
  const yMax = Math.ceil(rawMax * 1.25);

  const coords = buckets.map((b, idx) => {
    const x = padLeft + (buckets.length <= 1 ? plotW / 2 : (idx / (buckets.length - 1)) * plotW);
    const y = padTop + plotH - (b.total / yMax) * plotH;
    return { x, y, bucket: b };
  });

  const linePath = coords.reduce((acc, pt, idx) => {
    if (idx === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    const prev = coords[idx - 1];
    const cx = ((prev.x + pt.x) / 2).toFixed(1);
    return `${acc} C ${cx} ${prev.y.toFixed(1)}, ${cx} ${pt.y.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const yTicks = [0, Math.round(yMax * 0.33), Math.round(yMax * 0.66), yMax];
  const activePt = coords[activeIdx];

  return (
    <div className="rounded-2xl bg-[#101426]/90 border border-white/10 p-4 sm:p-5 flex flex-col justify-between min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#7547FF]/15 border border-[#7547FF]/30 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-[#A78BFA]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 20V14M10 20V8M16 20V11M22 20V4" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white leading-tight">Platform Analytics</h3>
            <p className="text-[11px] text-slate-400">Live chats & generated images activity</p>
          </div>
        </div>

        <div className="inline-flex items-center bg-[#090C18] border border-white/10 rounded-xl p-1 gap-1 shrink-0">
          {(['7D', '30D', '90D'] as AnalyticsRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                onRangeChange(r);
                setHoveredIndex(null);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer tabular-nums ${
                range === r
                  ? 'bg-gradient-to-r from-[#7547FF] to-[#5B32E5] text-white shadow-sm shadow-[#7547FF]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[420px] h-52 sm:h-56 select-none">
          <defs>
            <linearGradient id="adminAnalyticsArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="adminAnalyticsStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="55%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines & Y-Axis Ticks */}
          {yTicks.map((tick, idx) => {
            const yPos = padTop + plotH - (tick / yMax) * plotH;
            return (
              <g key={`${tick}-${idx}`}>
                <line
                  x1={padLeft}
                  y1={yPos}
                  x2={width - padRight}
                  y2={yPos}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  className="fill-slate-500 text-[10px] font-mono tabular-nums"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Vertical subtle day guides */}
          {coords.map((pt, idx) => (
            <line
              key={`v-${idx}`}
              x1={pt.x}
              y1={padTop}
              x2={pt.x}
              y2={padTop + plotH}
              stroke="rgba(255,255,255,0.03)"
              strokeWidth="1"
            />
          ))}

          {/* Area & Smooth Curve */}
          {areaPath && <path d={areaPath} fill="url(#adminAnalyticsArea)" />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="url(#adminAnalyticsStroke)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}

          {/* Active vertical dashed guide & floating callout */}
          {activePt && (
            <g>
              <line
                x1={activePt.x}
                y1={activePt.y}
                x2={activePt.x}
                y2={padTop + plotH}
                stroke="rgba(167,139,250,0.45)"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />
              <g
                transform={`translate(${Math.min(width - 134, Math.max(padLeft + 6, activePt.x - 56))}, ${Math.max(
                  4,
                  activePt.y - 36
                )})`}
              >
                <rect
                  width="112"
                  height="26"
                  rx="8"
                  fill="#0B0F1F"
                  stroke="rgba(167,139,250,0.45)"
                  strokeWidth="1"
                />
                <text
                  x="56"
                  y="16.5"
                  textAnchor="middle"
                  className="fill-white text-[10.5px] font-semibold font-mono tabular-nums"
                >
                  {activePt.bucket.chats} Chats · {activePt.bucket.images} Img
                </text>
              </g>
            </g>
          )}

          {/* Data Points & X-Axis Labels */}
          {coords.map((pt, idx) => {
            const isActive = idx === activeIdx;
            return (
              <g
                key={pt.bucket.label + idx}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(idx)}
                onClick={() => setHoveredIndex(idx)}
              >
                <rect
                  x={pt.x - 20}
                  y={padTop}
                  width="40"
                  height={plotH + 24}
                  fill="transparent"
                />
                {isActive && (
                  <circle cx={pt.x} cy={pt.y} r="9" fill="rgba(168,85,247,0.28)" />
                )}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isActive ? 5 : 3.5}
                  fill={isActive ? '#FFFFFF' : '#A855F7'}
                  stroke={isActive ? '#8B5CF6' : '#0B0F1F'}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                {isActive ? (
                  <g transform={`translate(${pt.x - 18}, ${padTop + plotH + 8})`}>
                    <rect width="36" height="18" rx="6" fill="#7547FF" />
                    <text
                      x="18"
                      y="12.5"
                      textAnchor="middle"
                      className="fill-white text-[10px] font-semibold"
                    >
                      {pt.bucket.label}
                    </text>
                  </g>
                ) : (
                  <text
                    x={pt.x}
                    y={padTop + plotH + 20}
                    textAnchor="middle"
                    className="fill-slate-400 text-[10px] font-medium"
                  >
                    {pt.bucket.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
