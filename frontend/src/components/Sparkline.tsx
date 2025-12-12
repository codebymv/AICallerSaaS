'use client';

import { LineChart as RechartsLineChart, Line as RechartsLine, ResponsiveContainer as RechartsResponsiveContainer } from 'recharts';

// Fix for Recharts type compatibility with React 18
const ResponsiveContainer = RechartsResponsiveContainer as any;
const LineChart = RechartsLineChart as any;
const Line = RechartsLine as any;

interface SparklineProps {
  data: { date: string; value: number }[];
  color?: string;
  strokeWidth?: number;
}

export function Sparkline({ data, color = '#0d9488', strokeWidth = 2 }: SparklineProps) {
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={strokeWidth}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

